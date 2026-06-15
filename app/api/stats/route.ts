import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { moyenne, STATUT_VENDU } from "@/lib/calc";
import type { StatsDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

const JOURS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];

// GET /api/stats
export async function GET() {
  try {
    const articles = await prisma.article.findMany({
      select: {
        sku: true,
        marque: true,
        statut: true,
        prixVente: true,
        margeNette: true,
        coefficient: true,
        canal: true,
        dateVente: true,
      },
    });

    const vendus = articles.filter((a) => a.statut === STATUT_VENDU);
    const now = new Date();
    const daysAgo = (n: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() - n);
      return d;
    };

    // --- Vitesse de vente ---
    const total7 = vendus.filter(
      (a) => a.dateVente && a.dateVente >= daysAgo(7),
    ).length;
    const total30 = vendus.filter(
      (a) => a.dateVente && a.dateVente >= daysAgo(30),
    ).length;
    const round = (n: number) => Math.round(n * 100) / 100;

    // --- Meilleur jour de la semaine (lundi=0 … dimanche=6) ---
    const parJour = new Array(7).fill(0) as number[];
    const caJour = new Array(7).fill(0) as number[];
    const dateRecenteJour = new Array(7).fill(null) as (Date | null)[];
    for (const a of vendus) {
      if (!a.dateVente) continue;
      const js = (a.dateVente.getDay() + 6) % 7; // 0 = lundi
      parJour[js] += 1;
      caJour[js] += a.prixVente ?? 0;
      // En cas d'ex-aequo sur le même jour de semaine, on garde la plus récente.
      if (!dateRecenteJour[js] || a.dateVente > (dateRecenteJour[js] as Date)) {
        dateRecenteJour[js] = a.dateVente;
      }
    }
    const parJourSemaine = JOURS.map((jour, i) => ({
      jour,
      vendus: parJour[i],
      ca: round(caJour[i]),
      dateRecente: dateRecenteJour[i] ? dateRecenteJour[i]!.toISOString() : null,
    }));

    // --- Marques les plus rentables ---
    const brands = new Map<
      string,
      { margeNette: number; coefs: number[]; vendus: number }
    >();
    for (const a of vendus) {
      const b =
        brands.get(a.marque) ?? { margeNette: 0, coefs: [], vendus: 0 };
      b.margeNette += a.margeNette ?? 0;
      if (a.coefficient != null) b.coefs.push(a.coefficient);
      b.vendus += 1;
      brands.set(a.marque, b);
    }
    const marquesRentables = Array.from(brands.entries())
      .map(([marque, b]) => ({
        marque,
        margeNette: round(b.margeNette),
        coefMoyen: round(moyenne(b.coefs)),
        vendus: b.vendus,
      }))
      .sort((x, y) => y.margeNette - x.margeNette);

    // --- Top 5 articles (prix de vente) ---
    const topArticles = vendus
      .filter((a) => a.prixVente != null)
      .sort((x, y) => (y.prixVente ?? 0) - (x.prixVente ?? 0))
      .slice(0, 5)
      .map((a) => ({
        sku: a.sku,
        marque: a.marque,
        prixVente: a.prixVente ?? 0,
        margeNette: a.margeNette ?? 0,
      }));

    // --- Projection ---
    const restants = articles.filter((a) => a.statut !== STATUT_VENDU).length;
    const cadenceParJour = total30 > 0 ? total30 / 30 : total7 / 7;
    const joursRestants =
      cadenceParJour > 0 ? Math.ceil(restants / cadenceParJour) : null;

    // --- Répartition des statuts ---
    const statutMap = new Map<string, number>();
    for (const a of articles) {
      statutMap.set(a.statut, (statutMap.get(a.statut) ?? 0) + 1);
    }
    const repartitionStatuts = Array.from(statutMap.entries())
      .map(([statut, count]) => ({ statut, count }))
      .sort((a, b) => b.count - a.count);

    // --- CA par canal de vente (sur les articles vendus) ---
    const canalMap = new Map<string, number>();
    for (const a of vendus) {
      const canal = a.canal ?? "Autre";
      canalMap.set(canal, (canalMap.get(canal) ?? 0) + (a.prixVente ?? 0));
    }
    const caParCanal = Array.from(canalMap.entries())
      .map(([canal, ca]) => ({ canal, ca: round(ca) }))
      .sort((a, b) => b.ca - a.ca);

    const dto: StatsDTO = {
      vitesse: {
        parJour7: round(total7 / 7),
        parJour30: round(total30 / 30),
        total7,
        total30,
      },
      parJourSemaine,
      marquesRentables,
      topArticles,
      projection: { restants, cadenceParJour: round(cadenceParJour), joursRestants },
      repartitionStatuts,
      caParCanal,
    };
    return NextResponse.json(dto);
  } catch (err) {
    console.error("GET /api/stats", err);
    return NextResponse.json(
      { error: "Erreur lors du chargement des statistiques." },
      { status: 500 },
    );
  }
}
