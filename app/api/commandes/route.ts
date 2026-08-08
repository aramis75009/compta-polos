import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized } from "@/lib/apiAuth";
import {
  normaliserPrefixe,
  numeroDuSku,
  prixUnitaire,
  repartirFrais,
  skuNumber,
  skuPrefix,
} from "@/lib/calc";
import type { CommandeDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_ARTICLES = 5000;
// La saisie détaillée passe une ligne par pièce dans le corps de la requête.
// Un plafond bien plus bas que MAX_ARTICLES : au-delà, ce n'est plus une saisie
// à la main, et le payload devient déraisonnable.
const MAX_LIGNES = 500;

type LigneBody = {
  marque?: string;
  categorie?: string;
  prixAchat?: number;
  /** Préfixe SKU propre à cette ligne ; à défaut celui de la commande. */
  prefixeSku?: string;
};

type PostBody = {
  fournisseur?: string;
  date?: string;
  marque?: string;
  categorie?: string;
  grade?: string | null;
  coefObjectif?: number | null;
  modeSaisie?: string;
  /** Préfixe SKU de la commande. À défaut, suggéré depuis catégorie + marque. */
  prefixeSku?: string;
  // Mode LISSE
  coutTotal?: number;
  nbArticles?: number;
  // Mode DETAILLE
  fraisLivraison?: number;
  lignes?: LigneBody[];
};

/** Article prêt à insérer, sans les champs communs à toute la commande. */
type ArticleAPoser = {
  marque: string;
  categorie: string;
  prixAchat: number;
  /** Préfixe SKU saisi par l'utilisateur, déjà normalisé. */
  prefixe: string;
};

/**
 * Numérote les SKU en reprenant la série de chaque préfixe, dans le périmètre
 * de l'utilisateur. Format `PRÉFIXE` + numéro, sans séparateur ni zéro de tête.
 *
 * Gère plusieurs préfixes à la fois : en saisie détaillée, un lot peut mêler
 * des sacs Nike et des coques Rhodes, donc deux séries indépendantes. Un seul
 * SELECT couvre l'ensemble (pas de N+1).
 *
 * Le filtre SQL `startsWith` est volontairement large : c'est `numeroDuSku` qui
 * tranche ensuite, car sans séparateur « A » matcherait « ADI1 ».
 */
async function numeroterSkus(
  userId: string,
  articles: ArticleAPoser[],
): Promise<string[]> {
  const prefixes = [...new Set(articles.map((a) => a.prefixe))];

  const existants = await prisma.article.findMany({
    where: {
      userId,
      OR: prefixes.map((p) => ({ sku: { startsWith: p } })),
    },
    select: { sku: true },
  });

  const compteur = new Map(prefixes.map((p) => [p, 0]));
  for (const { sku } of existants) {
    for (const p of prefixes) {
      const n = numeroDuSku(sku, p);
      if (n != null && n > (compteur.get(p) ?? 0)) compteur.set(p, n);
    }
  }

  return articles.map((a) => {
    const n = (compteur.get(a.prefixe) ?? 0) + 1;
    compteur.set(a.prefixe, n);
    return `${a.prefixe}${skuNumber(n)}`;
  });
}

// GET /api/commandes
export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  try {
    const commandes = await prisma.commande.findMany({
      where: { userId },
      orderBy: { date: "desc" },
    });
    const dto: CommandeDTO[] = commandes.map((c) => ({
      id: c.id,
      date: c.date.toISOString(),
      fournisseur: c.fournisseur,
      nbArticles: c.nbArticles,
      coutTotal: c.coutTotal,
      prixUnitaire: prixUnitaire(c.coutTotal, c.nbArticles),
      fraisLivraison: c.fraisLivraison,
      modeSaisie: c.modeSaisie,
      marque: c.marque,
      categorie: c.categorie,
      grade: c.grade,
      coefObjectif: c.coefObjectif,
    }));
    return NextResponse.json(dto);
  } catch (err) {
    console.error("GET /api/commandes", err);
    return NextResponse.json(
      { error: "Erreur lors du chargement des commandes." },
      { status: 500 },
    );
  }
}

// POST /api/commandes — crée la commande et génère ses articles
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  try {
    const body = (await req.json()) as PostBody;

    const fournisseur = body.fournisseur?.trim();
    const marque = body.marque?.trim();
    const categorie = body.categorie?.trim();
    const grade = body.grade ? String(body.grade).trim() : null;
    const coefObjectif =
      body.coefObjectif != null && Number.isFinite(Number(body.coefObjectif))
        ? Number(body.coefObjectif)
        : null;
    const detaille = body.modeSaisie === "DETAILLE";
    // Préfixe de repli : celui saisi pour la commande, sinon la suggestion.
    const prefixeCommande =
      normaliserPrefixe(body.prefixeSku ?? "") ||
      skuPrefix(marque ?? "", categorie);

    if (!fournisseur)
      return NextResponse.json(
        { error: "Fournisseur requis." },
        { status: 400 },
      );
    if (!marque)
      return NextResponse.json({ error: "Marque requise." }, { status: 400 });
    if (!categorie)
      return NextResponse.json({ error: "Catégorie requise." }, { status: 400 });

    // Ces trois valeurs sont construites différemment selon le mode, mais tout
    // ce qui suit les traite de la même façon.
    let coutTotal: number;
    let fraisLivraison: number | null = null;
    let aPoser: ArticleAPoser[];

    if (detaille) {
      const brutes = Array.isArray(body.lignes) ? body.lignes : [];
      if (brutes.length === 0)
        return NextResponse.json(
          { error: "Au moins une ligne d'article est requise." },
          { status: 400 },
        );
      if (brutes.length > MAX_LIGNES)
        return NextResponse.json(
          { error: `Trop de lignes (max ${MAX_LIGNES}).` },
          { status: 400 },
        );

      const lignes: ArticleAPoser[] = [];
      for (const [i, l] of brutes.entries()) {
        const prix = Number(l.prixAchat);
        // Un prix nul est légitime : pièce offerte dans le lot.
        if (!Number.isFinite(prix) || prix < 0)
          return NextResponse.json(
            { error: `Prix d'achat invalide à la ligne ${i + 1}.` },
            { status: 400 },
          );
        const mq = l.marque?.trim() || marque;
        const cat = l.categorie?.trim() || categorie;
        lignes.push({
          marque: mq,
          categorie: cat,
          prixAchat: prix,
          // Priorité : préfixe de la ligne → préfixe de la commande.
          prefixe: normaliserPrefixe(l.prefixeSku ?? "") || prefixeCommande,
        });
      }

      const frais = Number(body.fraisLivraison ?? 0);
      if (!Number.isFinite(frais) || frais < 0)
        return NextResponse.json(
          { error: "Frais de livraison invalides." },
          { status: 400 },
        );
      fraisLivraison = frais;

      // Le coût total est CALCULÉ, jamais reçu du client : c'est ce qui garantit
      // `Σ prixAchat = coutTotal` et empêche les deux écrans de rentabilité de
      // se contredire.
      const avecFrais = repartirFrais(
        lignes.map((l) => l.prixAchat),
        frais,
      );
      aPoser = lignes.map((l, i) => ({ ...l, prixAchat: avecFrais[i] }));
      coutTotal = avecFrais.reduce((s, p) => s + p, 0);

      if (coutTotal <= 0)
        return NextResponse.json(
          { error: "Le coût total du lot ne peut pas être nul." },
          { status: 400 },
        );
    } else {
      coutTotal = Number(body.coutTotal);
      const nb = Number(body.nbArticles);

      if (!Number.isFinite(coutTotal) || coutTotal <= 0)
        return NextResponse.json(
          { error: "Coût total invalide." },
          { status: 400 },
        );
      if (!Number.isInteger(nb) || nb <= 0)
        return NextResponse.json(
          { error: "Nombre d'articles invalide." },
          { status: 400 },
        );
      if (nb > MAX_ARTICLES)
        return NextResponse.json(
          { error: `Nombre d'articles trop élevé (max ${MAX_ARTICLES}).` },
          { status: 400 },
        );

      const prixAchat = prixUnitaire(coutTotal, nb);
      aPoser = Array.from({ length: nb }, () => ({
        marque,
        categorie,
        prixAchat,
        prefixe: prefixeCommande,
      }));
    }

    const date = body.date ? new Date(body.date) : new Date();
    const skus = await numeroterSkus(userId, aPoser);

    const commande = await prisma.$transaction(async (tx) => {
      const created = await tx.commande.create({
        data: {
          fournisseur,
          date,
          coutTotal,
          nbArticles: aPoser.length,
          fraisLivraison,
          modeSaisie: detaille ? "DETAILLE" : "LISSE",
          marque,
          categorie,
          grade,
          userId,
          ...(coefObjectif != null ? { coefObjectif } : {}),
        },
      });

      await tx.article.createMany({
        data: aPoser.map((a, i) => ({
          sku: skus[i],
          marque: a.marque,
          categorie: a.categorie,
          // Libellé du lot d'achat : alimente le filtre « Tous les lots » du Stock.
          lot: a.marque === a.categorie ? a.marque : `${a.categorie} ${a.marque}`,
          grade,
          statut: "En stock",
          prixAchat: a.prixAchat,
          commandeId: created.id,
          userId,
        })),
      });

      return created;
    });

    const dto: CommandeDTO = {
      id: commande.id,
      date: commande.date.toISOString(),
      fournisseur: commande.fournisseur,
      nbArticles: commande.nbArticles,
      coutTotal: commande.coutTotal,
      prixUnitaire: prixUnitaire(commande.coutTotal, commande.nbArticles),
      fraisLivraison: commande.fraisLivraison,
      modeSaisie: commande.modeSaisie,
      marque: commande.marque,
      categorie: commande.categorie,
      grade: commande.grade,
      coefObjectif: commande.coefObjectif,
    };
    return NextResponse.json(dto, { status: 201 });
  } catch (err) {
    console.error("POST /api/commandes", err);
    return NextResponse.json(
      { error: "Erreur lors de la création de la commande." },
      { status: 500 },
    );
  }
}
