import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STATUT_VENDU, naturalSort } from "@/lib/calc";
import type { CommandeStatsDTO, CommandeStatsRow } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/commandes/[id]/stats
// Récap par catégorie : total + répartition par statut + CA + marge nette.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const articles = await prisma.article.findMany({
      where: { commandeId: params.id },
      select: {
        categorie: true,
        statut: true,
        prixVente: true,
        margeNette: true,
      },
    });

    const map = new Map<string, CommandeStatsRow>();
    for (const a of articles) {
      const cat = a.categorie || "À définir";
      const row =
        map.get(cat) ??
        {
          categorie: cat,
          total: 0,
          enStock: 0,
          enVente: 0,
          vendus: 0,
          ca: 0,
          margeNette: 0,
        };
      row.total += 1;
      if (a.statut === "En stock") row.enStock += 1;
      if (a.statut === "En vente") row.enVente += 1;
      if (a.statut === STATUT_VENDU) {
        row.vendus += 1;
        row.ca += a.prixVente ?? 0;
        row.margeNette += a.margeNette ?? 0;
      }
      map.set(cat, row);
    }

    const rows = Array.from(map.values()).sort((a, b) =>
      naturalSort(a.categorie, b.categorie),
    );

    const dto: CommandeStatsDTO = { rows };
    return NextResponse.json(dto);
  } catch (err) {
    console.error("GET /api/commandes/[id]/stats", err);
    return NextResponse.json(
      { error: "Erreur lors du chargement du détail de la commande." },
      { status: 500 },
    );
  }
}
