import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STATUT_VENDU, STATUTS } from "@/lib/calc";

export const dynamic = "force-dynamic";

type Body = { ids?: string[]; statut?: string };

// PATCH /api/articles/bulk — change le statut d'un ensemble d'articles.
export async function PATCH(req: NextRequest) {
  try {
    const { ids, statut } = (await req.json()) as Body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Aucun article sélectionné." },
        { status: 400 },
      );
    }
    const nouveau = String(statut ?? "").trim();
    if (!STATUTS.includes(nouveau as never)) {
      return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
    }
    if (nouveau === STATUT_VENDU) {
      return NextResponse.json(
        {
          error:
            "Pour marquer des articles comme vendus, utilise la validation (prix requis).",
        },
        { status: 400 },
      );
    }

    // Champs de vente remis à null (règle centrale si on quitte « Vendu »).
    const res = await prisma.article.updateMany({
      where: { id: { in: ids } },
      data: {
        statut: nouveau,
        prixVente: null,
        dateVente: null,
        margeBrute: null,
        margeNette: null,
        coefficient: null,
      },
    });

    return NextResponse.json({ count: res.count, statut: nouveau });
  } catch (err) {
    console.error("PATCH /api/articles/bulk", err);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour groupée." },
      { status: 500 },
    );
  }
}
