import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDTO } from "@/lib/serialize";
import { naturalSort } from "@/lib/calc";
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
      include: { commande: true },
    });

    // Tri naturel des SKU (AD1, AD2…AD10) côté JS — le tri SQL classerait
    // AD1, AD10, AD11, AD2… (ordre lexicographique).
    const dtos = articles.map(toDTO);
    dtos.sort((a, b) => naturalSort(a.sku, b.sku));

    return NextResponse.json(dtos);
  } catch (err) {
    console.error("GET /api/articles", err);
    return NextResponse.json(
      { error: "Erreur lors du chargement des articles." },
      { status: 500 },
    );
  }
}
