import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDTO } from "@/lib/serialize";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET /api/articles?marque=&statut=&q=
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const marque = searchParams.get("marque")?.trim();
    const statut = searchParams.get("statut")?.trim();
    const q = searchParams.get("q")?.trim();

    const where: Prisma.ArticleWhereInput = {};
    if (marque) where.marque = marque;
    if (statut) where.statut = statut;
    if (q) where.sku = { contains: q, mode: "insensitive" };

    const articles = await prisma.article.findMany({
      where,
      include: { commande: true },
      orderBy: { sku: "asc" },
    });

    return NextResponse.json(articles.map(toDTO));
  } catch (err) {
    console.error("GET /api/articles", err);
    return NextResponse.json(
      { error: "Erreur lors du chargement des articles." },
      { status: 500 },
    );
  }
}
