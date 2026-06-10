import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STATUT_VENDU } from "@/lib/calc";
import type { CalendarDay, CalendarDTO } from "@/lib/types";
import { endOfMonth, format, parse, startOfMonth } from "date-fns";

export const dynamic = "force-dynamic";

// GET /api/calendar?month=YYYY-MM — ventes du mois groupées par jour
export async function GET(req: NextRequest) {
  try {
    const monthParam = req.nextUrl.searchParams.get("month");
    const ref = monthParam
      ? parse(monthParam, "yyyy-MM", new Date())
      : new Date();
    if (Number.isNaN(ref.getTime())) {
      return NextResponse.json({ error: "Mois invalide." }, { status: 400 });
    }

    const from = startOfMonth(ref);
    const to = endOfMonth(ref);

    const articles = await prisma.article.findMany({
      where: {
        statut: STATUT_VENDU,
        dateVente: { gte: from, lte: to },
      },
      select: {
        id: true,
        sku: true,
        marque: true,
        prixVente: true,
        margeNette: true,
        coefficient: true,
        dateVente: true,
      },
      orderBy: { dateVente: "asc" },
    });

    const byDay = new Map<string, CalendarDay>();
    for (const a of articles) {
      if (!a.dateVente) continue;
      const key = format(a.dateVente, "yyyy-MM-dd");
      const day =
        byDay.get(key) ??
        { date: key, ca: 0, nbArticles: 0, net: 0, articles: [] };
      day.ca += a.prixVente ?? 0;
      day.net += a.margeNette ?? 0;
      day.nbArticles += 1;
      day.articles.push({
        id: a.id,
        sku: a.sku,
        marque: a.marque,
        prixVente: a.prixVente ?? 0,
        margeNette: a.margeNette ?? 0,
        coefficient: a.coefficient ?? 0,
      });
      byDay.set(key, day);
    }

    const days = Array.from(byDay.values());
    const total = days.reduce(
      (t, d) => ({
        ca: t.ca + d.ca,
        nbArticles: t.nbArticles + d.nbArticles,
        net: t.net + d.net,
      }),
      { ca: 0, nbArticles: 0, net: 0 },
    );

    const dto: CalendarDTO = {
      month: format(ref, "yyyy-MM"),
      days,
      total,
    };
    return NextResponse.json(dto);
  } catch (err) {
    console.error("GET /api/calendar", err);
    return NextResponse.json(
      { error: "Erreur lors du chargement du calendrier." },
      { status: 500 },
    );
  }
}
