import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { moyenne, STATUT_VENDU } from "@/lib/calc";
import type {
  BrandRow,
  DashboardDelta,
  DashboardDTO,
  WeekPoint,
} from "@/lib/types";
import {
  endOfMonth,
  format,
  getDate,
  getDaysInMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { fr } from "date-fns/locale";

export const dynamic = "force-dynamic";

// GET /api/dashboard — KPIs + récap par marque + CA hebdomadaire
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const periode = searchParams.get("periode") ?? "all";
    // Une seule requête, on agrège en mémoire (volume faible).
    const articles = await prisma.article.findMany({
      select: {
        marque: true,
        statut: true,
        prixVente: true,
        margeNette: true,
        coefficient: true,
        dateVente: true,
        createdAt: true,
      },
    });

    const totalArticles = articles.length;
    const allVendus = articles.filter((a) => a.statut === STATUT_VENDU);

    // Filtre par période
    const now = new Date();
    let depuis: Date | null = null;
    if (periode === "month") {
      depuis = startOfMonth(now);
    } else if (periode === "30j") {
      depuis = new Date(now);
      depuis.setDate(depuis.getDate() - 30);
    } else if (periode === "3m") {
      depuis = new Date(now);
      depuis.setMonth(depuis.getMonth() - 3);
    }
    const vendusList = depuis
      ? allVendus.filter((a) => a.dateVente && a.dateVente >= depuis!)
      : allVendus;
    const vendus = vendusList.length;
    const enStock = articles.filter((a) => a.statut === "En stock").length;
    // Portefeuille : articles actuellement au statut « En vente » (indépendant
    // de la période). Nouveaux au stock : créés dans la période sélectionnée.
    const enVente = articles.filter((a) => a.statut === "En vente").length;
    const nouveaux = depuis
      ? articles.filter((a) => a.createdAt >= depuis!).length
      : totalArticles;

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
    const ensureBrand = (marque: string) => {
      let b = brands.get(marque);
      if (!b) {
        b = { total: 0, enStock: 0, vendus: 0, ca: 0, margeNette: 0, coefs: [] };
        brands.set(marque, b);
      }
      return b;
    };
    // Portefeuille (tout l'historique) : total + stock par marque.
    for (const a of articles) {
      const b = ensureBrand(a.marque);
      b.total += 1;
      if (a.statut === "En stock") b.enStock += 1;
    }
    // Ventes de la PÉRIODE : ca / vendus / marge / coef par marque.
    for (const a of vendusList) {
      const b = ensureBrand(a.marque);
      b.vendus += 1;
      b.ca += a.prixVente ?? 0;
      b.margeNette += a.margeNette ?? 0;
      if (a.coefficient != null) b.coefs.push(a.coefficient);
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

    // --- CA par jour du mois EN COURS (pour la vue « Ce mois », calée calendrier) ---
    const moisRef = new Date();
    const debutMois = startOfMonth(moisRef);
    const finMois = endOfMonth(moisRef);
    const nbJours = getDaysInMonth(moisRef);
    const jours = Array(nbJours).fill(0) as number[];
    for (const a of allVendus) {
      if (!a.dateVente) continue;
      if (a.dateVente >= debutMois && a.dateVente <= finMois) {
        jours[getDate(a.dateVente) - 1] += a.prixVente ?? 0;
      }
    }
    const caParJour = jours.map((ca, i) => ({ jour: String(i + 1), ca }));

    // --- Évolution mois courant vs mois précédent (CA + marge nette) ---
    const debutMoisCourant = startOfMonth(new Date());
    const debutMoisPrecedent = startOfMonth(subMonths(new Date(), 1));
    let caMoisCourant = 0;
    let caMoisPrecedent = 0;
    let margeMoisCourant = 0;
    let margeMoisPrecedent = 0;
    for (const a of vendusList) {
      if (!a.dateVente) continue;
      const d = a.dateVente;
      if (d >= debutMoisCourant) {
        caMoisCourant += a.prixVente ?? 0;
        margeMoisCourant += a.margeNette ?? 0;
      } else if (d >= debutMoisPrecedent) {
        caMoisPrecedent += a.prixVente ?? 0;
        margeMoisPrecedent += a.margeNette ?? 0;
      }
    }
    const delta = (courant: number, precedent: number): DashboardDelta => ({
      pct: precedent > 0 ? (courant - precedent) / precedent : null,
      abs: courant - precedent,
    });

    const dto: DashboardDTO = {
      caTotal,
      margeNetteTotal,
      margeMoyenne: caTotal ? margeNetteTotal / caTotal : 0,
      enStock,
      enVente,
      nouveaux,
      pctVendu,
      totalArticles,
      vendus,
      parMarque,
      caParSemaine,
      caParJour,
      caDelta: delta(caMoisCourant, caMoisPrecedent),
      margeDelta: delta(margeMoisCourant, margeMoisPrecedent),
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
