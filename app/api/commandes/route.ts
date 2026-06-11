import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prixUnitaire, skuNumber, skuPrefix } from "@/lib/calc";
import type { CommandeDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

type PostBody = {
  fournisseur?: string;
  date?: string;
  coutTotal?: number;
  nbArticles?: number;
  marque?: string;
  categorie?: string;
  grade?: string | null;
  coefObjectif?: number | null;
};

// GET /api/commandes
export async function GET() {
  try {
    const commandes = await prisma.commande.findMany({
      orderBy: { date: "desc" },
    });
    const dto: CommandeDTO[] = commandes.map((c) => ({
      id: c.id,
      date: c.date.toISOString(),
      fournisseur: c.fournisseur,
      nbArticles: c.nbArticles,
      coutTotal: c.coutTotal,
      prixUnitaire: prixUnitaire(c.coutTotal, c.nbArticles),
      marque: c.marque,
      categorie: c.categorie,
      grade: c.grade,
      coefObjectif: c.coefObjectif,
    }));
    return NextResponse.json(dto);
  } catch (err) {
    console.error("GET /api/commandes", err);
    return NextResponse.json(
      { error: "Erreur lors du chargement des commandes." },
      { status: 500 },
    );
  }
}

// POST /api/commandes — crée la commande et génère ses articles
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PostBody;

    const fournisseur = body.fournisseur?.trim();
    const marque = body.marque?.trim();
    const categorie = body.categorie?.trim();
    const grade = body.grade ? String(body.grade).trim() : null;
    const coutTotal = Number(body.coutTotal);
    const nbArticles = Number(body.nbArticles);
    const coefObjectif =
      body.coefObjectif != null && Number.isFinite(Number(body.coefObjectif))
        ? Number(body.coefObjectif)
        : null;

    if (!fournisseur)
      return NextResponse.json(
        { error: "Fournisseur requis." },
        { status: 400 },
      );
    if (!marque)
      return NextResponse.json({ error: "Marque requise." }, { status: 400 });
    if (!categorie)
      return NextResponse.json({ error: "Catégorie requise." }, { status: 400 });
    if (!Number.isFinite(coutTotal) || coutTotal <= 0)
      return NextResponse.json(
        { error: "Coût total invalide." },
        { status: 400 },
      );
    if (!Number.isInteger(nbArticles) || nbArticles <= 0)
      return NextResponse.json(
        { error: "Nombre d'articles invalide." },
        { status: 400 },
      );
    if (nbArticles > 5000)
      return NextResponse.json(
        { error: "Nombre d'articles trop élevé (max 5000)." },
        { status: 400 },
      );

    const date = body.date ? new Date(body.date) : new Date();
    const prixAchat = prixUnitaire(coutTotal, nbArticles);
    const prefix = skuPrefix(marque);

    // Numéro de départ : on continue après le plus grand SKU existant du préfixe
    // pour éviter les collisions (un seul SELECT, pas de N+1).
    const existing = await prisma.article.findMany({
      where: { sku: { startsWith: `${prefix}-` } },
      select: { sku: true },
    });
    let start = 0;
    for (const { sku } of existing) {
      const n = parseInt(sku.slice(prefix.length + 1), 10);
      if (Number.isFinite(n) && n > start) start = n;
    }

    const commande = await prisma.$transaction(async (tx) => {
      const created = await tx.commande.create({
        data: {
          fournisseur,
          date,
          coutTotal,
          nbArticles,
          marque,
          categorie,
          grade,
          ...(coefObjectif != null ? { coefObjectif } : {}),
        },
      });

      const articles = Array.from({ length: nbArticles }, (_, i) => ({
        sku: `${prefix}-${skuNumber(start + i + 1)}`,
        marque,
        categorie,
        grade,
        statut: "En stock",
        prixAchat,
        commandeId: created.id,
      }));

      await tx.article.createMany({ data: articles });
      return created;
    });

    const dto: CommandeDTO = {
      id: commande.id,
      date: commande.date.toISOString(),
      fournisseur: commande.fournisseur,
      nbArticles: commande.nbArticles,
      coutTotal: commande.coutTotal,
      prixUnitaire: prixAchat,
      marque: commande.marque,
      categorie: commande.categorie,
      grade: commande.grade,
      coefObjectif: commande.coefObjectif,
    };
    return NextResponse.json(dto, { status: 201 });
  } catch (err) {
    console.error("POST /api/commandes", err);
    return NextResponse.json(
      { error: "Erreur lors de la création de la commande." },
      { status: 500 },
    );
  }
}
