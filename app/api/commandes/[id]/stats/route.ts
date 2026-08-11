import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized, notFound } from "@/lib/apiAuth";
import {
  cleRegroupement,
  moyenne,
  moyenneCoefs,
  naturalSort,
  STATUT_VENDU,
} from "@/lib/calc";
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
  const userId = await getUserId();
  if (!userId) return unauthorized();

  try {
    const commande = await prisma.commande.findFirst({
      where: { id: params.id, userId },
      select: { date: true, coutTotal: true, coefObjectif: true },
    });
    if (!commande) return notFound("Commande");

    // `lotRef` est joint : la migration des lots a rétro-rempli `Article.lotId`
    // mais PAS `Article.lot`. Sans `lotRef.nom`, toutes les commandes
    // antérieures afficheraient une ligne sans nom. Cf. `cleRegroupement`.
    const articles = await prisma.article.findMany({
      where: { commandeId: params.id, userId },
      select: {
        categorie: true,
        marque: true,
        lot: true,
        lotId: true,
        lotRef: { select: { nom: true } },
        statut: true,
        prixVente: true,
        margeNette: true,
        coefficient: true,
        dateVente: true,
        canal: true,
      },
    });

    // ---------- Récap par LOT ----------
    // Groupé par lot et non par catégorie depuis le 11/08/2026 : une ligne
    // « Polo » ne dit pas de quel lot elle vient, « Polo Ralph Lauren » si.
    type Acc = CommandeStatsRow & { coefs: number[] };
    const map = new Map<string, Acc>();
    for (const a of articles) {
      const { cle, libelle } = cleRegroupement(a);
      const row =
        map.get(cle) ??
        {
          cle,
          libelle,
          // Doublon assumé, le temps qu'un onglet servi par l'ancien bundle
          // finisse sa session. Cf. le @deprecated sur CommandeStatsRow.
          categorie: libelle,
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
      map.set(cle, row);
    }

    const rows: CommandeStatsRow[] = Array.from(map.values())
      .map((r) => ({
        cle: r.cle,
        libelle: r.libelle,
        categorie: r.libelle,
        total: r.total,
        enStock: r.enStock,
        enVente: r.enVente,
        vendus: r.vendus,
        ca: r.ca,
        margeNette: r.margeNette,
        // Exclut les pièces offertes (coef 0) : sans ça, le classement des
        // meilleurs et pires lots serait faussé par des lots contenant
        // des pièces à 0 €.
        coefMoyen: moyenneCoefs(r.coefs),
        pctVendu: r.total ? r.vendus / r.total : 0,
      }))
      .sort((a, b) => naturalSort(a.libelle, b.libelle));

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

    // Top / flop LOT — uniquement ceux qui ont réellement vendu. Dérivés des
    // mêmes lignes que `rows` : depuis qu'elles portent un lot, ces deux
    // champs aussi. Les garder nommés « catégorie » ferait mentir l'affichage.
    const triCoef = rows
      .filter((r) => r.vendus > 0 && r.coefMoyen > 0)
      .sort((a, b) => b.coefMoyen - a.coefMoyen);
    const meilleurLot =
      triCoef.length > 0
        ? { libelle: triCoef[0].libelle, coefMoyen: triCoef[0].coefMoyen }
        : null;
    const pireLot =
      triCoef.length > 1
        ? {
            libelle: triCoef[triCoef.length - 1].libelle,
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
      meilleurLot,
      pireLot,
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
