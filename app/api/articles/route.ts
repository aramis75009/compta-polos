import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDTO, articleSelect } from "@/lib/serialize";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET /api/articles?marque=&statut=&q=
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const marque = searchParams.get("marque")?.trim();
    const statut = searchParams.get("statut")?.trim();
    const q = searchParams.get("q")?.trim();
    const commande = searchParams.get("commande")?.trim();

    const where: Prisma.ArticleWhereInput = {};
    if (marque) where.marque = marque;
    if (statut) where.statut = statut;
    if (commande) where.commandeId = commande;
    if (q) where.sku = { contains: q, mode: "insensitive" };

    const articles = await prisma.article.findMany({
      where,
      select: articleSelect,
    });

    // Pas de tri ici : les consommateurs trient eux-mêmes (tri naturel SKU côté
    // Stock / a-comptabiliser). Évite un tri redondant sur 1000+ lignes à chaque
    // requête (le Stock re-triait systématiquement par-dessus).
    const dtos = articles.map(toDTO);

    return NextResponse.json(dtos);
  } catch (err) {
    console.error("GET /api/articles", err);
    return NextResponse.json(
      { error: "Erreur lors du chargement des articles." },
      { status: 500 },
    );
  }
}
