import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { moyenne, STATUT_VENDU, naturalSort } from "@/lib/calc";
import type {
  CanalRow,
  CommandeResume,
  CommandeStatsDTO,
  CommandeStatsRow,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const JOUR_MS = 86_400_000;
const FENETRE_RECENTE_J = 28; // fenêtre du rythme de vente « récent »

const joursEntre = (a: Date, b: Date) =>
  Math.max(0, (b.getTime() - a.getTime()) / JOUR_MS);

// GET /api/commandes/[id]/stats
// Récap par catégorie + synthèse de rentabilité (état actuel et projection).
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const commande = await prisma.commande.findUnique({
      where: { id: params.id },
      select: { date: true, coutTotal: true, coefObjectif: true },
    });
    if (!commande) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }

    const articles = await prisma.article.findMany({
      where: { commandeId: params.id },
      select: {
        categorie: true,
        statut: true,
        prixVente: true,
        margeNette: true,
        coefficient: true,
        dateVente: true,
        canal: true,
      },
    });

    // ---------- Récap par catégorie ----------
    type Acc = CommandeStatsRow & { coefs: number[] };
    const map = new Map<string, Acc>();
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
          coefMoyen: 0,
          pctVendu: 0,
          coefs: [],
        };
      row.total += 1;
      if (a.statut === "En stock") row.enStock += 1;
      if (a.statut === "En vente") row.enVente += 1;
      if (a.statut === STATUT_VENDU) {
        row.vendus += 1;
        row.ca += a.prixVente ?? 0;
        row.margeNette += a.margeNette ?? 0;
        if (a.coefficient != null) row.coefs.push(a.coefficient);
      }
      map.set(cat, row);
    }

    const rows: CommandeStatsRow[] = Array.from(map.values())
      .map((r) => ({
        categorie: r.categorie,
        total: r.total,
        enStock: r.enStock,
        enVente: r.enVente,
        vendus: r.vendus,
        ca: r.ca,
        margeNette: r.margeNette,
        coefMoyen: moyenne(r.coefs),
        pctVendu: r.total ? r.vendus / r.total : 0,
      }))
      .sort((a, b) => naturalSort(a.categorie, b.categorie));

    // ---------- Synthèse : où on en est, et où ça atterrit ----------
    // Les champs indisponibles valent null (jamais 0, qui serait un mensonge).
    const now = new Date();
    const coutTotal = commande.coutTotal;
    const coefObjectif = commande.coefObjectif;

    const ventes = articles.filter((a) => a.statut === STATUT_VENDU);
    const perdus = articles.filter((a) => a.statut === "Perdu").length;
    // Restants = ce qu'il est encore possible de vendre : les perdus ne le sont plus.
    const restants = articles.length - ventes.length - perdus;

    const montantRecupere = ventes.reduce((s, a) => s + (a.prixVente ?? 0), 0);
    const margeNetteRealisee = ventes.reduce((s, a) => s + (a.margeNette ?? 0), 0);
    const resteARecuperer = Math.max(0, coutTotal - montantRecupere);

    const panierMoyen = ventes.length > 0 ? montantRecupere / ventes.length : null;
    const coefActuel = coutTotal > 0 ? montantRecupere / coutTotal : null;
    const seuilArticles =
      panierMoyen && panierMoyen > 0 && resteARecuperer > 0
        ? Math.ceil(resteARecuperer / panierMoyen)
        : null;

    // Projection : les restants partent au panier moyen constaté.
    const caProjete =
      panierMoyen != null ? montantRecupere + restants * panierMoyen : null;
    const coefProjete = caProjete != null && coutTotal > 0 ? caProjete / coutTotal : null;
    // Marge projetée : on extrapole le taux de marge nette déjà constaté.
    const tauxMarge = montantRecupere > 0 ? margeNetteRealisee / montantRecupere : null;
    const margeProjetee =
      caProjete != null && tauxMarge != null
        ? margeNetteRealisee + (caProjete - montantRecupere) * tauxMarge
        : null;

    // Prix moyen à tenir sur les restants pour atteindre l'objectif de coefficient.
    const prixMoyenRequis =
      coefObjectif != null && restants > 0
        ? Math.max(0, (coutTotal * coefObjectif - montantRecupere) / restants)
        : null;

    // Rythme de vente : fenêtre récente (28 j) si elle contient des ventes, sinon
    // moyenne depuis la première vente. `rythmeRecent` dit laquelle est utilisée —
    // afficher un rythme sans dire sur quoi il porte serait trompeur.
    const datesVente = ventes
      .map((a) => a.dateVente)
      .filter((d): d is Date => d != null)
      .sort((a, b) => a.getTime() - b.getTime());

    const ventesRecentes = datesVente.filter(
      (d) => joursEntre(d, now) <= FENETRE_RECENTE_J,
    ).length;

    let rythmeHebdo: number | null = null;
    let rythmeRecent = false;
    if (ventesRecentes > 0) {
      rythmeHebdo = (ventesRecentes / FENETRE_RECENTE_J) * 7;
      rythmeRecent = true;
    } else if (datesVente.length > 0) {
      const jours = Math.max(1, joursEntre(datesVente[0], now));
      rythmeHebdo = (datesVente.length / jours) * 7;
    }

    const joursEcoulement =
      rythmeHebdo && rythmeHebdo > 0 && restants > 0
        ? Math.ceil((restants / rythmeHebdo) * 7)
        : null;
    const dateEcoulement =
      joursEcoulement != null
        ? new Date(now.getTime() + joursEcoulement * JOUR_MS).toISOString()
        : null;

    // Point mort : première vente dont le cumul couvre le coût du lot.
    const ventesTriees = ventes
      .filter((a) => a.dateVente != null)
      .sort((x, y) => x.dateVente!.getTime() - y.dateVente!.getTime());
    let cumul = 0;
    let datePointMort: string | null = null;
    for (const a of ventesTriees) {
      cumul += a.prixVente ?? 0;
      if (cumul >= coutTotal) {
        datePointMort = a.dateVente!.toISOString();
        break;
      }
    }
    const joursPointMort =
      datePointMort != null
        ? Math.round(joursEntre(commande.date, new Date(datePointMort)))
        : null;

    const delaiMoyenVente =
      datesVente.length > 0
        ? moyenne(datesVente.map((d) => joursEntre(commande.date, d)))
        : null;

    // Canaux de vente.
    const parCanal = new Map<string, { vendus: number; ca: number }>();
    for (const a of ventes) {
      const canal = a.canal || "Non renseigné";
      const c = parCanal.get(canal) ?? { vendus: 0, ca: 0 };
      c.vendus += 1;
      c.ca += a.prixVente ?? 0;
      parCanal.set(canal, c);
    }
    const canaux: CanalRow[] = Array.from(parCanal.entries())
      .map(([canal, c]) => ({
        canal,
        vendus: c.vendus,
        ca: c.ca,
        panierMoyen: c.vendus > 0 ? c.ca / c.vendus : 0,
        pctCa: montantRecupere > 0 ? c.ca / montantRecupere : 0,
      }))
      .sort((a, b) => b.ca - a.ca);

    // Angles morts : en stock, photos pas encore prêtes → CA immobilisé.
    // (Les articles photographiés sont passés au statut « Photos prêtes ».)
    const dormants = articles.filter((a) => a.statut === "En stock").length;
    const caDormant = panierMoyen != null ? dormants * panierMoyen : null;

    // Top / flop catégorie — uniquement celles qui ont réellement vendu.
    const triCoef = rows
      .filter((r) => r.vendus > 0 && r.coefMoyen > 0)
      .sort((a, b) => b.coefMoyen - a.coefMoyen);
    const meilleureCategorie =
      triCoef.length > 0
        ? { categorie: triCoef[0].categorie, coefMoyen: triCoef[0].coefMoyen }
        : null;
    const pireCategorie =
      triCoef.length > 1
        ? {
            categorie: triCoef[triCoef.length - 1].categorie,
            coefMoyen: triCoef[triCoef.length - 1].coefMoyen,
          }
        : null;

    const resume: CommandeResume = {
      coutTotal,
      totalArticles: articles.length,
      vendus: ventes.length,
      restants,
      perdus,
      montantRecupere,
      resteARecuperer,
      margeNetteRealisee,
      panierMoyen,
      coefActuel,
      coefObjectif,
      seuilArticles,
      caProjete,
      margeProjetee,
      coefProjete,
      prixMoyenRequis,
      rythmeHebdo,
      rythmeRecent,
      joursEcoulement,
      dateEcoulement,
      ageJours: Math.round(joursEntre(commande.date, now)),
      datePointMort,
      joursPointMort,
      delaiMoyenVente,
      canaux,
      dormants,
      caDormant,
      meilleureCategorie,
      pireCategorie,
    };

    const dto: CommandeStatsDTO = { rows, resume };
    return NextResponse.json(dto);
  } catch (err) {
    console.error("GET /api/commandes/[id]/stats", err);
    return NextResponse.json(
      { error: "Erreur lors du chargement du détail de la commande." },
      { status: 500 },
    );
  }
}
