import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { moyenne, STATUT_VENDU } from "@/lib/calc";
import type { BrandRow, DashboardDTO, WeekPoint } from "@/lib/types";
import { format, startOfWeek, subWeeks } from "date-fns";
import { fr } from "date-fns/locale";

export const dynamic = "force-dynamic";

// GET /api/dashboard — KPIs + récap par marque + CA hebdomadaire
export async function GET() {
  try {
    // Une seule requête, on agrège en mémoire (volume faible).
    const articles = await prisma.article.findMany({
      select: {
        marque: true,
        statut: true,
        prixVente: true,
        margeNette: true,
        coefficient: true,
        dateVente: true,
      },
    });

    const totalArticles = articles.length;
    const vendusList = articles.filter((a) => a.statut === STATUT_VENDU);
    const vendus = vendusList.length;
    const enStock = articles.filter((a) => a.statut === "En stock").length;

    const caTotal = vendusList.reduce((s, a) => s + (a.prixVente ?? 0), 0);
    const margeNetteTotal = vendusList.reduce(
      (s, a) => s + (a.margeNette ?? 0),
      0,
    );
    const pctVendu = totalArticles ? vendus / totalArticles : 0;

    // --- Récap par marque ---
    const brands = new Map<
      string,
      {
        total: number;
        enStock: number;
        vendus: number;
        ca: number;
        margeNette: number;
        coefs: number[];
      }
    >();
    for (const a of articles) {
      const b =
        brands.get(a.marque) ??
        { total: 0, enStock: 0, vendus: 0, ca: 0, margeNette: 0, coefs: [] };
      b.total += 1;
      if (a.statut === "En stock") b.enStock += 1;
      if (a.statut === STATUT_VENDU) {
        b.vendus += 1;
        b.ca += a.prixVente ?? 0;
        b.margeNette += a.margeNette ?? 0;
        if (a.coefficient != null) b.coefs.push(a.coefficient);
      }
      brands.set(a.marque, b);
    }
    const parMarque: BrandRow[] = Array.from(brands.entries())
      .map(([marque, b]) => ({
        marque,
        total: b.total,
        enStock: b.enStock,
        vendus: b.vendus,
        ca: b.ca,
        margeNette: b.margeNette,
        coefMoyen: moyenne(b.coefs),
        panierMoyen: b.vendus ? b.ca / b.vendus : 0,
        pctVendu: b.total ? b.vendus / b.total : 0,
      }))
      .sort((x, y) => y.ca - x.ca || x.marque.localeCompare(y.marque));

    // --- CA par semaine (8 dernières semaines, lundi → dimanche) ---
    const weekKey = (d: Date) =>
      format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const buckets = new Map<string, number>();
    const labels: WeekPoint[] = [];
    for (let i = 7; i >= 0; i--) {
      const ws = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
      const key = format(ws, "yyyy-MM-dd");
      buckets.set(key, 0);
      labels.push({ semaine: format(ws, "d MMM", { locale: fr }), ca: 0 });
    }
    for (const a of vendusList) {
      if (!a.dateVente) continue;
      const key = weekKey(a.dateVente);
      if (buckets.has(key)) buckets.set(key, buckets.get(key)! + (a.prixVente ?? 0));
    }
    const keys = Array.from(buckets.keys());
    const caParSemaine: WeekPoint[] = labels.map((l, idx) => ({
      semaine: l.semaine,
      ca: buckets.get(keys[idx]) ?? 0,
    }));

    const dto: DashboardDTO = {
      caTotal,
      margeNetteTotal,
      enStock,
      pctVendu,
      totalArticles,
      vendus,
      parMarque,
      caParSemaine,
    };
    return NextResponse.json(dto);
  } catch (err) {
    console.error("GET /api/dashboard", err);
    return NextResponse.json(
      { error: "Erreur lors du chargement du dashboard." },
      { status: 500 },
    );
  }
}
