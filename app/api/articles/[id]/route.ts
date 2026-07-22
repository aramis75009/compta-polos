import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deriveVente, STATUT_VENDU, STATUTS } from "@/lib/calc";
import { toDTO } from "@/lib/serialize";

type PatchBody = {
  sku?: string;
  marque?: string;
  categorie?: string;
  grade?: string | null;
  statut?: string;
  prixAchat?: number;
  prixVente?: number | null;
  dateVente?: string | null;
  canal?: string | null;
  titreAnnonce?: string | null;
  descriptionAnnonce?: string | null;
  motsClesAnnonce?: string | null;
};

// PATCH /api/articles/[id] — édition inline + transitions de statut
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const body = (await req.json()) as PatchBody;

    const existing = await prisma.article.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Article introuvable." },
        { status: 404 },
      );
    }

    // Champs « texte » directement éditables.
    const data: Record<string, unknown> = {};
    if (body.sku !== undefined) {
      const sku = body.sku.trim();
      if (!sku)
        return NextResponse.json({ error: "SKU vide." }, { status: 400 });
      data.sku = sku;
    }
    if (body.marque !== undefined) data.marque = body.marque.trim();
    if (body.categorie !== undefined) data.categorie = body.categorie.trim();
    if (body.grade !== undefined)
      data.grade = body.grade ? String(body.grade).trim() : null;
    if (body.canal !== undefined)
      data.canal = body.canal ? String(body.canal).trim() : null;
    if (body.titreAnnonce !== undefined)
      data.titreAnnonce = body.titreAnnonce ? String(body.titreAnnonce) : null;
    if (body.descriptionAnnonce !== undefined)
      data.descriptionAnnonce = body.descriptionAnnonce
        ? String(body.descriptionAnnonce)
        : null;
    if (body.motsClesAnnonce !== undefined)
      data.motsClesAnnonce = body.motsClesAnnonce
        ? String(body.motsClesAnnonce)
        : null;

    if (body.statut !== undefined && !STATUTS.includes(body.statut as never)) {
      return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
    }

    // Valeurs effectives après fusion pour recalcul des dérivés.
    const statut = body.statut ?? existing.statut;
    const prixAchat =
      body.prixAchat !== undefined ? Number(body.prixAchat) : existing.prixAchat;
    if (Number.isNaN(prixAchat) || prixAchat < 0) {
      return NextResponse.json(
        { error: "Prix d'achat invalide." },
        { status: 400 },
      );
    }

    const prixVente =
      body.prixVente !== undefined
        ? body.prixVente === null
          ? null
          : Number(body.prixVente)
        : existing.prixVente;
    if (prixVente != null && (Number.isNaN(prixVente) || prixVente < 0)) {
      return NextResponse.json(
        { error: "Prix de vente invalide." },
        { status: 400 },
      );
    }

    const dateVente =
      body.dateVente !== undefined
        ? body.dateVente
          ? new Date(body.dateVente)
          : null
        : existing.dateVente;

    // Passage à « Vendu » sans prix → refus (le client doit ouvrir le modal).
    if (statut === STATUT_VENDU && prixVente == null) {
      return NextResponse.json(
        { error: "Un prix de vente est requis pour marquer l'article vendu." },
        { status: 400 },
      );
    }

    const derived = deriveVente({ statut, prixAchat, prixVente, dateVente });

    data.statut = statut;
    data.prixAchat = prixAchat;
    data.prixVente = derived.prixVente;
    data.dateVente = derived.dateVente;
    data.margeBrute = derived.margeBrute;
    data.margeNette = derived.margeNette;
    data.coefficient = derived.coefficient;

    const updated = await prisma.article.update({
      where: { id: params.id },
      data,
      include: { commande: true },
    });

    return NextResponse.json(toDTO(updated));
  } catch (err: unknown) {
    // Conflit de SKU unique
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ce SKU existe déjà." },
        { status: 409 },
      );
    }
    console.error("PATCH /api/articles/[id]", err);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'article." },
      { status: 500 },
    );
  }
}

// DELETE /api/articles/[id]
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await prisma.article.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/articles/[id]", err);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'article." },
      { status: 500 },
    );
  }
}
