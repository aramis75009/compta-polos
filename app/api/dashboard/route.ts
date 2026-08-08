import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized } from "@/lib/apiAuth";
import { moyenneCoefs, STATUT_VENDU } from "@/lib/calc";
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

// Borne basse de la période demandée ; null = tout l'historique.
// Arithmétique native volontaire pour « 30j » et « 3m » : `subMonths` de
// date-fns rabat les débordements de fin de mois (31 mai − 3 mois = 28 février),
// là où `setMonth` déborde sur le mois suivant. C'est le comportement d'origine.
function debutPeriode(periode: string, now: Date): Date | null {
  switch (periode) {
    case "month":
      return startOfMonth(now);
    case "30j": {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return d;
    }
    case "3m": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      return d;
    }
    default:
      return null;
  }
}

// GET /api/dashboard — KPIs + récap par marque + CA hebdomadaire
export async function GET(request: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  try {
    const { searchParams } = new URL(request.url);
    const periode = searchParams.get("periode") ?? "all";
    // Une seule requête, on agrège en mémoire (volume faible).
    // Le filtre userId porte sur CETTE requête et donc sur tous les agrégats qui
    // en découlent : KPI, récap par marque, CA hebdomadaire.
    const articles = await prisma.article.findMany({
      where: { userId },
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
    const depuis = debutPeriode(periode, now);
    const vendusList = depuis
      ? allVendus.filter((a) => a.dateVente && a.dateVente >= depuis)
      : allVendus;
    const vendus = vendusList.length;
    const enStock = articles.filter((a) => a.statut === "En stock").length;
    // Portefeuille : articles actuellement au statut « En vente » (indépendant
    // de la période). Nouveaux au stock : créés dans la période sélectionnée.
    const enVente = articles.filter((a) => a.statut === "En vente").length;
    const nouveaux = depuis
      ? articles.filter((a) => a.createdAt >= depuis).length
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
        // moyenneCoefs et non moyenne : une pièce offerte (prix d'achat 0) a un
        // coefficient de 0, qui est une absence de coefficient et non un
        // coefficient faible. La compter tirerait la moyenne de la marque vers
        // le bas. Cas devenu courant avec la saisie détaillée.
        coefMoyen: moyenneCoefs(b.coefs),
        panierMoyen: b.vendus ? b.ca / b.vendus : 0,
        pctVendu: b.total ? b.vendus / b.total : 0,
      }))
      .sort((x, y) => y.ca - x.ca || x.marque.localeCompare(y.marque));

    // --- CA par semaine (8 dernières semaines, lundi → dimanche) ---
    // Une seule structure — libellé et cumul dans le même objet — plutôt qu'un
    // tableau de libellés et une Map de montants tenus en parallèle par indice.
    const weekKey = (d: Date) =>
      format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const semaines = Array.from({ length: 8 }, (_, i) => {
      const debut = startOfWeek(subWeeks(now, 7 - i), { weekStartsOn: 1 });
      return {
        key: weekKey(debut),
        semaine: format(debut, "d MMM", { locale: fr }),
        ca: 0,
      };
    });
    const parSemaine = new Map(semaines.map((s) => [s.key, s]));
    for (const a of vendusList) {
      if (!a.dateVente) continue;
      const bucket = parSemaine.get(weekKey(a.dateVente));
      if (bucket) bucket.ca += a.prixVente ?? 0;
    }
    const caParSemaine: WeekPoint[] = semaines.map(({ semaine, ca }) => ({
      semaine,
      ca,
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
    // On repart de `allVendus`, jamais de `vendusList` : celle-ci est filtrée
    // par la période, donc en vue « Ce mois » (la période d'atterrissage) le
    // mois précédent en était exclu — `caMoisPrecedent` tombait à 0, `pct`
    // à null, et le badge d'évolution du héros ne s'affichait jamais.
    const debutMoisCourant = startOfMonth(new Date());
    const debutMoisPrecedent = startOfMonth(subMonths(new Date(), 1));
    let caMoisCourant = 0;
    let caMoisPrecedent = 0;
    let margeMoisCourant = 0;
    let margeMoisPrecedent = 0;
    for (const a of allVendus) {
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
      caMoisPrecedent,
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
