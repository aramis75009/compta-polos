import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { moyenne, STATUT_VENDU } from "@/lib/calc";
import { compteId, metaFromId, sizeFromAvis } from "@/lib/orbite/compteMeta";
import {
  ventePositionFromId,
  type OrbiteCompte,
  type OrbiteData,
  type OrbiteMarque,
  type OrbiteVente,
} from "@/lib/orbite/types";

export const dynamic = "force-dynamic";

/** Nombre d'anneaux affichés : au-delà, la scène devient illisible. */
const MAX_MARQUES = 6;
/** Nombre de points de vente affichés autour de la planète. */
const MAX_VENTES = 14;

const round = (n: number) => Math.round(n * 100) / 100;

// GET /api/orbite — agrégats de la scène Orbite, calculés sur les articles VENDUS.
//
// Définition du CA retenue : somme des `prixVente` des articles au statut
// « Vendu », sur tout l'historique. C'est exactement `caTotal` de
// /api/dashboard en période « all » — les deux chiffres doivent coïncider.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    // Même select que /api/stats, augmenté de compteVente et prixAchat.
    const articles = await prisma.article.findMany({
      select: {
        id: true,
        sku: true,
        marque: true,
        statut: true,
        prixVente: true,
        margeNette: true,
        coefficient: true,
        canal: true,
        compteVente: true,
        dateVente: true,
      },
    });

    const vendus = articles.filter((a) => a.statut === STATUT_VENDU);
    const caTotal = vendus.reduce((s, a) => s + (a.prixVente ?? 0), 0);

    // --- Comptes (lunes) : group by compteVente sur les vendus ---
    const comptesMap = new Map<string, { ca: number; ventes: number }>();
    for (const a of vendus) {
      const key = compteId(a.compteVente);
      const c = comptesMap.get(key) ?? { ca: 0, ventes: 0 };
      c.ca += a.prixVente ?? 0;
      c.ventes += 1;
      comptesMap.set(key, c);
    }
    const comptes: OrbiteCompte[] = Array.from(comptesMap.entries())
      .map(([id, c]) => {
        const meta = metaFromId(id);
        return {
          id,
          label: meta.label,
          avis: meta.avis,
          ca: round(c.ca),
          ventes: c.ventes,
          panierMoyen: c.ventes ? round(c.ca / c.ventes) : 0,
          size: sizeFromAvis(meta.avis),
        };
      })
      .sort((x, y) => y.ca - x.ca);

    // --- Marques (anneaux) : group by marque sur les vendus, top 6 par CA ---
    const marquesMap = new Map<
      string,
      { ca: number; ventes: number; marges: number[]; coefs: number[] }
    >();
    for (const a of vendus) {
      const m =
        marquesMap.get(a.marque) ?? { ca: 0, ventes: 0, marges: [], coefs: [] };
      m.ca += a.prixVente ?? 0;
      m.ventes += 1;
      if (a.margeNette != null) m.marges.push(a.margeNette);
      if (a.coefficient != null) m.coefs.push(a.coefficient);
      marquesMap.set(a.marque, m);
    }
    const marques: OrbiteMarque[] = Array.from(marquesMap.entries())
      .map(([nom, m]) => {
        const margeNetteMoyenne = moyenne(m.marges);
        return {
          nom,
          ca: round(m.ca),
          ventes: m.ventes,
          // Même logique que « marques rentables » de /api/stats : c'est la
          // marge nette qui tranche, pas le coefficient.
          rentable: margeNetteMoyenne > 0,
          coefMoyen: round(moyenne(m.coefs)),
          margeNetteMoyenne: round(margeNetteMoyenne),
          topArticles: vendus
            .filter((a) => a.marque === nom && a.prixVente != null)
            .sort((x, y) => (y.prixVente ?? 0) - (x.prixVente ?? 0))
            .slice(0, 3)
            .map((a) => ({
              sku: a.sku,
              prixVente: a.prixVente ?? 0,
              statut: a.statut,
            })),
        };
      })
      .sort((x, y) => y.ca - x.ca || x.nom.localeCompare(y.nom))
      .slice(0, MAX_MARQUES);

    // --- Ventes récentes (points) : les N dernières, position stable par id ---
    const ventesRecentes: OrbiteVente[] = vendus
      .filter((a) => a.dateVente != null)
      .sort(
        (x, y) => (y.dateVente as Date).getTime() - (x.dateVente as Date).getTime(),
      )
      .slice(0, MAX_VENTES)
      .map((a) => ({
        id: a.id,
        sku: a.sku,
        position: ventePositionFromId(a.id),
        prixVente: round(a.prixVente ?? 0),
        margeNette: round(a.margeNette ?? 0),
        coefficient: round(a.coefficient ?? 0),
        canal: a.canal,
        compteVente: a.compteVente,
        dateVente: a.dateVente ? a.dateVente.toISOString() : null,
      }));

    const dto: OrbiteData = {
      center: {
        label: "MyFlip",
        caTotal: round(caTotal),
        ventesTotal: vendus.length,
      },
      comptes,
      marques,
      ventesRecentes,
    };
    return NextResponse.json(dto);
  } catch (err) {
    console.error("GET /api/orbite", err);
    return NextResponse.json(
      { error: "Erreur lors du chargement d'Orbite." },
      { status: 500 },
    );
  }
}
