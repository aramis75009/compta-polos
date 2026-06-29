import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deriveVente, prixUnitaire, STATUT_VENDU } from "@/lib/calc";
import type { CommandeDTO } from "@/lib/types";

type PatchBody = {
  fournisseur?: string;
  date?: string;
  coutTotal?: number;
  nbArticles?: number;
};

// PATCH /api/commandes/[id]
// Si coutTotal ou nbArticles change, le prix unitaire est recalculé et propagé
// au prix d'achat de tous les articles de la commande (et les marges des
// articles vendus sont recalculées en conséquence).
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const body = (await req.json()) as PatchBody;

    const existing = await prisma.commande.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Commande introuvable." },
        { status: 404 },
      );
    }

    const fournisseur =
      body.fournisseur !== undefined
        ? body.fournisseur.trim()
        : existing.fournisseur;
    if (!fournisseur)
      return NextResponse.json(
        { error: "Fournisseur requis." },
        { status: 400 },
      );

    const date = body.date !== undefined ? new Date(body.date) : existing.date;

    const coutTotal =
      body.coutTotal !== undefined ? Number(body.coutTotal) : existing.coutTotal;
    if (!Number.isFinite(coutTotal) || coutTotal <= 0)
      return NextResponse.json(
        { error: "Coût total invalide." },
        { status: 400 },
      );

    const nbArticles =
      body.nbArticles !== undefined
        ? Number(body.nbArticles)
        : existing.nbArticles;
    if (!Number.isInteger(nbArticles) || nbArticles <= 0)
      return NextResponse.json(
        { error: "Nombre d'articles invalide." },
        { status: 400 },
      );

    const prixAchat = prixUnitaire(coutTotal, nbArticles);
    const coutChanged =
      coutTotal !== existing.coutTotal || nbArticles !== existing.nbArticles;

    await prisma.$transaction(async (tx) => {
      await tx.commande.update({
        where: { id: params.id },
        data: { fournisseur, date, coutTotal, nbArticles },
      });

      if (coutChanged) {
        // Propage le nouveau prix d'achat à tous les articles (1 requête).
        await tx.article.updateMany({
          where: { commandeId: params.id },
          data: { prixAchat },
        });

        // Recalcule les marges des articles vendus (peu nombreux).
        const vendus = await tx.article.findMany({
          where: { commandeId: params.id, statut: STATUT_VENDU },
        });
        for (const a of vendus) {
          const d = deriveVente({
            statut: a.statut,
            prixAchat,
            prixVente: a.prixVente,
            dateVente: a.dateVente,
          });
          await tx.article.update({
            where: { id: a.id },
            data: {
              margeBrute: d.margeBrute,
              margeNette: d.margeNette,
              coefficient: d.coefficient,
            },
          });
        }
      }
    });

    const dto: CommandeDTO = {
      id: existing.id,
      date: date.toISOString(),
      fournisseur,
      nbArticles,
      coutTotal,
      prixUnitaire: prixAchat,
      marque: existing.marque,
      categorie: existing.categorie,
      grade: existing.grade,
      coefObjectif: existing.coefObjectif,
    };
    return NextResponse.json(dto);
  } catch (err) {
    console.error("PATCH /api/commandes/[id]", err);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de la commande." },
      { status: 500 },
    );
  }
}

// DELETE /api/commandes/[id] — supprime la commande et ses articles
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await prisma.$transaction([
      prisma.article.deleteMany({ where: { commandeId: params.id } }),
      prisma.commande.delete({ where: { id: params.id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/commandes/[id]", err);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de la commande." },
      { status: 500 },
    );
  }
}
