import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized } from "@/lib/apiAuth";
import {
  libelleLot,
  normaliserPrefixe,
  numeroDuSku,
  prixUnitaire,
  repartirFrais,
  skuNumber,
  skuPrefix,
} from "@/lib/calc";
import type { CommandeDTO, LotDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_ARTICLES = 5000;
// Un lot saisi pièce par pièce passe une ligne par pièce dans la requête.
// Plafond bien plus bas que MAX_ARTICLES : au-delà, ce n'est plus une saisie à
// la main et le corps de requête devient déraisonnable.
const MAX_PIECES = 500;
const MAX_LOTS = 50;

type PieceBody = { prixAchat?: number };

type LotBody = {
  nom?: string;
  marque?: string;
  categorie?: string;
  prefixeSku?: string;
  /** "LOT" (quantité + prix global) ou "PIECE" (un prix par pièce). */
  modeSaisie?: string;
  quantite?: number;
  prixTotal?: number;
  pieces?: PieceBody[];
};

type PostBody = {
  fournisseur?: string;
  date?: string;
  grade?: string | null;
  coefObjectif?: number | null;
  /** Frais de port de la COMMANDE, répartis sur les pièces de tous les lots. */
  fraisLivraison?: number;
  lots?: LotBody[];

  // ── Forme héritée, antérieure aux lots ──
  marque?: string;
  categorie?: string;
  modeSaisie?: string;
  prefixeSku?: string;
  coutTotal?: number;
  nbArticles?: number;
  lignes?: {
    marque?: string;
    categorie?: string;
    prixAchat?: number;
    prefixeSku?: string;
  }[];
};

/** Un lot validé, avec le prix brut (hors port) de chacune de ses pièces. */
type LotPrepare = {
  nom: string;
  marque: string;
  categorie: string;
  prefixe: string;
  mode: "LOT" | "PIECE";
  prix: number[];
};

/**
 * Numérote les SKU en reprenant la série de chaque préfixe, dans le périmètre
 * de l'utilisateur. Format `PRÉFIXE` + numéro, sans séparateur ni zéro de tête.
 *
 * Gère plusieurs préfixes à la fois : une commande mêle des sacs Nike et des
 * coques Rhodes, donc deux séries indépendantes. Un seul SELECT couvre
 * l'ensemble, quel que soit le nombre de lots (pas de N+1).
 *
 * Le filtre SQL `startsWith` est volontairement large : c'est `numeroDuSku` qui
 * tranche ensuite, car sans séparateur « A » matcherait « ADI1 ».
 */
async function numeroterSkus(
  userId: string,
  prefixes: string[],
): Promise<string[]> {
  const distincts = [...new Set(prefixes)];

  const existants = await prisma.article.findMany({
    where: { userId, OR: distincts.map((p) => ({ sku: { startsWith: p } })) },
    select: { sku: true },
  });

  const compteur = new Map(distincts.map((p) => [p, 0]));
  for (const { sku } of existants) {
    for (const p of distincts) {
      const n = numeroDuSku(sku, p);
      if (n != null && n > (compteur.get(p) ?? 0)) compteur.set(p, n);
    }
  }

  return prefixes.map((p) => {
    const n = (compteur.get(p) ?? 0) + 1;
    compteur.set(p, n);
    return `${p}${skuNumber(n)}`;
  });
}

const toLotDTO = (l: {
  id: string;
  nom: string;
  marque: string;
  categorie: string;
  prefixeSku: string;
  modeSaisie: string;
  quantite: number;
  prixTotal: number;
}): LotDTO => ({
  id: l.id,
  nom: l.nom,
  marque: l.marque,
  categorie: l.categorie,
  prefixeSku: l.prefixeSku,
  modeSaisie: l.modeSaisie,
  quantite: l.quantite,
  prixTotal: l.prixTotal,
});

/**
 * Ramène toute requête à une liste de lots.
 *
 * Les corps antérieurs aux lots (`modeSaisie` + `coutTotal`/`nbArticles`, ou
 * `lignes[]`) deviennent une commande à un seul lot — ce qu'ils décrivaient
 * réellement. Le reste de la route ne connaît plus qu'une seule forme.
 */
function normaliserLots(body: PostBody): LotBody[] {
  if (Array.isArray(body.lots) && body.lots.length > 0) return body.lots;

  const commun = {
    marque: body.marque,
    categorie: body.categorie,
    prefixeSku: body.prefixeSku,
    nom: libelleLot(body.marque ?? "", body.categorie ?? ""),
  };

  if (body.modeSaisie === "DETAILLE") {
    return [
      {
        ...commun,
        modeSaisie: "PIECE",
        pieces: (body.lignes ?? []).map((l) => ({ prixAchat: l.prixAchat })),
      },
    ];
  }

  return [
    {
      ...commun,
      modeSaisie: "LOT",
      quantite: body.nbArticles,
      prixTotal: body.coutTotal,
    },
  ];
}

// GET /api/commandes
export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  try {
    const commandes = await prisma.commande.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      include: { lots: { orderBy: { createdAt: "asc" } } },
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
      lots: c.lots.map(toLotDTO),
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

// POST /api/commandes — crée la commande, ses lots et leurs articles
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  try {
    const body = (await req.json()) as PostBody;

    const fournisseur = body.fournisseur?.trim();
    if (!fournisseur)
      return NextResponse.json(
        { error: "Fournisseur requis." },
        { status: 400 },
      );

    const grade = body.grade ? String(body.grade).trim() : null;
    const coefObjectif =
      body.coefObjectif != null && Number.isFinite(Number(body.coefObjectif))
        ? Number(body.coefObjectif)
        : null;

    const frais = Number(body.fraisLivraison ?? 0);
    if (!Number.isFinite(frais) || frais < 0)
      return NextResponse.json(
        { error: "Frais de livraison invalides." },
        { status: 400 },
      );

    const bruts = normaliserLots(body);
    if (bruts.length === 0)
      return NextResponse.json(
        { error: "Au moins un lot est requis." },
        { status: 400 },
      );
    if (bruts.length > MAX_LOTS)
      return NextResponse.json(
        { error: `Trop de lots (max ${MAX_LOTS}).` },
        { status: 400 },
      );

    // ── Validation, lot par lot ──
    const lots: LotPrepare[] = [];
    for (const [i, l] of bruts.entries()) {
      const rang = i + 1;
      const marque = l.marque?.trim();
      const categorie = l.categorie?.trim();
      if (!marque)
        return NextResponse.json(
          { error: `Marque requise au lot ${rang}.` },
          { status: 400 },
        );
      if (!categorie)
        return NextResponse.json(
          { error: `Catégorie requise au lot ${rang}.` },
          { status: 400 },
        );

      const prefixe =
        normaliserPrefixe(l.prefixeSku ?? "") || skuPrefix(marque, categorie);
      const nom = l.nom?.trim() || libelleLot(marque, categorie);
      const mode = l.modeSaisie === "PIECE" ? "PIECE" : "LOT";

      let prix: number[];
      if (mode === "PIECE") {
        const pieces = Array.isArray(l.pieces) ? l.pieces : [];
        if (pieces.length === 0)
          return NextResponse.json(
            { error: `Au moins une pièce est requise au lot ${rang}.` },
            { status: 400 },
          );
        if (pieces.length > MAX_PIECES)
          return NextResponse.json(
            { error: `Trop de pièces au lot ${rang} (max ${MAX_PIECES}).` },
            { status: 400 },
          );
        prix = [];
        for (const [j, p] of pieces.entries()) {
          const v = Number(p.prixAchat);
          // Un prix nul est légitime : pièce offerte dans le lot.
          if (!Number.isFinite(v) || v < 0)
            return NextResponse.json(
              { error: `Prix invalide à la pièce ${j + 1} du lot ${rang}.` },
              { status: 400 },
            );
          prix.push(v);
        }
      } else {
        const quantite = Number(l.quantite);
        const prixTotal = Number(l.prixTotal);
        if (!Number.isInteger(quantite) || quantite <= 0)
          return NextResponse.json(
            { error: `Quantité invalide au lot ${rang}.` },
            { status: 400 },
          );
        if (!Number.isFinite(prixTotal) || prixTotal < 0)
          return NextResponse.json(
            { error: `Prix invalide au lot ${rang}.` },
            { status: 400 },
          );
        // Réparti uniformément : c'est la définition du mode « au lot ».
        prix = Array.from({ length: quantite }, () => prixTotal / quantite);
      }

      lots.push({ nom, marque, categorie, prefixe, mode, prix });
    }

    const total = lots.reduce((s, l) => s + l.prix.length, 0);
    if (total > MAX_ARTICLES)
      return NextResponse.json(
        { error: `Nombre d'articles trop élevé (max ${MAX_ARTICLES}).` },
        { status: 400 },
      );

    // ── Frais de port : au prorata sur TOUTES les pièces de TOUS les lots ──
    //
    // Le port est un coût de commande, pas de lot : un lot lourd en absorbe
    // davantage. Le calcul se fait donc sur la liste aplatie, puis on redécoupe
    // par lot. `repartirFrais` garantit `Σ résultat = Σ prix + frais`, ce qui
    // maintient `Σ Article.prixAchat = Commande.coutTotal`.
    const aplati = lots.flatMap((l) => l.prix);
    const avecFrais = repartirFrais(aplati, frais);

    const coutTotal = avecFrais.reduce((s, p) => s + p, 0);
    if (coutTotal <= 0)
      return NextResponse.json(
        { error: "Le coût total de la commande ne peut pas être nul." },
        { status: 400 },
      );

    // Redécoupage : chaque lot retrouve ses pièces, port compris.
    let curseur = 0;
    const parLot = lots.map((l) => {
      const tranche = avecFrais.slice(curseur, curseur + l.prix.length);
      curseur += l.prix.length;
      return { ...l, prixAvecFrais: tranche };
    });

    const skus = await numeroterSkus(
      userId,
      parLot.flatMap((l) => l.prixAvecFrais.map(() => l.prefixe)),
    );

    const date = body.date ? new Date(body.date) : new Date();
    const premier = parLot[0];

    const commande = await prisma.$transaction(async (tx) => {
      const created = await tx.commande.create({
        data: {
          fournisseur,
          date,
          coutTotal,
          nbArticles: total,
          fraisLivraison: frais,
          // Champs hérités, conservés : les statistiques et le seed s'en
          // servent. Ils reflètent le premier lot, faute de mieux.
          modeSaisie: parLot.some((l) => l.mode === "PIECE")
            ? "DETAILLE"
            : "LISSE",
          marque: premier.marque,
          categorie: premier.categorie,
          grade,
          userId,
          ...(coefObjectif != null ? { coefObjectif } : {}),
        },
      });

      let n = 0;
      for (const l of parLot) {
        const lot = await tx.lot.create({
          data: {
            commandeId: created.id,
            nom: l.nom,
            marque: l.marque,
            categorie: l.categorie,
            prefixeSku: l.prefixe,
            modeSaisie: l.mode,
            quantite: l.prixAvecFrais.length,
            // Hors port, pour rester le montant que l'utilisateur a saisi.
            prixTotal: l.prix.reduce((s, p) => s + p, 0),
            userId,
          },
        });

        await tx.article.createMany({
          data: l.prixAvecFrais.map((prixAchat) => ({
            sku: skus[n++],
            marque: l.marque,
            categorie: l.categorie,
            // Le libellé du lot est recopié ici : c'est lui qui alimente le
            // filtre « Tous les lots » du Stock, sans jointure.
            lot: l.nom,
            lotId: lot.id,
            grade,
            statut: "En stock",
            prixAchat,
            commandeId: created.id,
            userId,
          })),
        });
      }

      return tx.commande.findUniqueOrThrow({
        where: { id: created.id },
        include: { lots: { orderBy: { createdAt: "asc" } } },
      });
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
      lots: commande.lots.map(toLotDTO),
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
