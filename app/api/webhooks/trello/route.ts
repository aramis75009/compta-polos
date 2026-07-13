import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STATUT_A_COMPTABILISER } from "@/lib/calc";
import { getCardLabels, getCardName } from "@/lib/trello";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Trello envoie un HEAD pour vérifier l'URL lors de la création du webhook.
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

// Un token est un SKU s'il ressemble à 2-5 lettres suivies de chiffres (ex: SDM11).
const SKU_PATTERN = /^[A-Z]{2,5}\d+$/i;

// Découpe le nom d'une carte en liste de SKUs.
// "SDM11 SDM36 ADI36" → ["SDM11", "SDM36", "ADI36"] ; "DIC30" → ["DIC30"]
function parseSkus(cardName: string): string[] {
  return cardName
    .trim()
    .split(/\s+/)
    .filter((token) => SKU_PATTERN.test(token));
}

// Migration ponctuelle : supprimer les faux articles créés par l'ancien
// comportement (un seul article avec un SKU contenant des espaces).
// Exécutée une seule fois au démarrage de la correction.
let fakeArticlesCleanupDone = false;
async function cleanupFakeArticlesOnce() {
  if (fakeArticlesCleanupDone) return;
  fakeArticlesCleanupDone = true;
  try {
    const result = await prisma.article.deleteMany({
      where: { sku: { contains: " " } },
    });
    if (result.count > 0) {
      console.log(`Migration: ${result.count} faux article(s) supprimé(s)`);
    }
  } catch (e) {
    // En cas d'échec, on réautorise une nouvelle tentative au prochain appel.
    fakeArticlesCleanupDone = false;
    console.error("Migration faux articles échouée", e);
  }
}

type TrelloLabel = { id: string; name: string | null };
type TrelloWebhookBody = {
  action?: {
    type?: string;
    data?: {
      board?: { id?: string };
      card?: { id?: string; name?: string };
      label?: { id?: string; name?: string | null };
    };
  };
};

// Actions Trello qui peuvent amener une carte étiquetée « À comptabiliser ».
//
// Piège : Trello n'émet `addLabelToCard` QUE si l'étiquette est posée après coup.
// Une carte qui arrive avec l'étiquette déjà dessus ne déclenche aucun événement
// d'étiquette — d'où les articles qui n'apparaissaient jamais dans la page.
// Pour ces types, on interroge l'API pour connaître les étiquettes réelles.
const CARD_ACTIONS = new Set([
  "addLabelToCard", // étiquette posée sur une carte existante
  "updateCard", // renommage, déplacement de liste, archivage…
  "createCard", // création (éventuellement avec étiquette déjà cochée)
  "copyCard", // duplication : les étiquettes sont héritées
  "moveCardToBoard", // carte venue d'un autre board, avec ses étiquettes
  "convertToCardFromCheckItem", // promotion d'une checklist en carte
]);

// Log unique et préfixé → filtrable dans les logs Vercel via « [trello] ».
function log(payload: Record<string, unknown>) {
  console.log("[trello]", JSON.stringify(payload));
}

// POST /api/webhooks/trello — déclenché à chaque action du board Trello.
export async function POST(req: NextRequest) {
  try {
    // Nettoyage ponctuel des faux articles de l'ancien comportement (une seule fois).
    await cleanupFakeArticlesOnce();

    const body = (await req.json()) as TrelloWebhookBody;
    const action = body.action ?? {};
    const data = action.data ?? {};
    const type = action.type;

    const boardId = process.env.TRELLO_BOARD_ID;
    const labelId = process.env.TRELLO_LABEL_ID;

    const card = data.card;
    const ctx = { type, cardId: card?.id, cardName: card?.name };

    // 1. L'action doit concerner notre board.
    if (!data?.board?.id || data.board.id !== boardId) {
      log({ ...ctx, ignored: "board", boardRecu: data?.board?.id });
      return NextResponse.json({ ignored: "board" });
    }

    // 2. L'action doit concerner une carte.
    if (!card?.id) {
      log({ ...ctx, ignored: "no-card" });
      return NextResponse.json({ ignored: "no-card" });
    }

    // 3. Type d'action pertinent ? (cf. CARD_ACTIONS)
    if (!type || !CARD_ACTIONS.has(type)) {
      log({ ...ctx, ignored: "type-hors-scope" });
      return NextResponse.json({ ignored: type ?? "unknown" });
    }

    // 4. L'étiquette « À comptabiliser » est-elle sur la carte ?
    //    `addLabelToCard` la porte dans son payload ; pour tous les autres types
    //    (création, copie, déplacement, update) il faut interroger l'API.
    let labels: TrelloLabel[] | null = null;
    let hasComptabiliser: boolean;

    if (type === "addLabelToCard" && data.label?.id) {
      hasComptabiliser = data.label.id === labelId;
    } else {
      labels = await getCardLabels(card.id);
      hasComptabiliser = labels.some((l) => l.id === labelId);
    }

    if (!hasComptabiliser) {
      log({
        ...ctx,
        ignored: "no-label",
        labelsCarte: labels?.map((l) => l.name ?? l.id),
      });
      return NextResponse.json({ ignored: "no-label" });
    }

    // 5. Le nom de la carte peut contenir plusieurs SKUs (ex: "SDM11 SDM36 ADI36").
    //    Certains payloads (copie, déplacement) n'incluent pas le nom → on le lit.
    let cardName = card.name ?? "";
    if (!cardName) {
      try {
        cardName = await getCardName(card.id);
      } catch (e) {
        console.error("[trello] lecture du nom de carte échouée", e);
      }
    }

    const skus = parseSkus(cardName);
    if (skus.length === 0) {
      log({ ...ctx, cardName, ignored: "no-sku" });
      return NextResponse.json({ ignored: "no-sku" });
    }

    // 6. Transporteur = nom de l'autre étiquette de la carte (best-effort).
    //    L'étiquette « Comptabilisé » ne doit pas être prise pour un transporteur.
    const comptabiliseId = process.env.TRELLO_COMPTABILISE_LABEL_ID;
    let transporteur: string | null = null;
    try {
      if (!labels) labels = await getCardLabels(card.id);
      transporteur =
        labels.find(
          (l) => l.id !== labelId && l.id !== comptabiliseId && l.name,
        )?.name ?? null;
    } catch (e) {
      console.error("[trello] récupération transporteur échouée", e);
    }

    // 7. Pour chaque SKU détecté : mettre l'article existant « À comptabiliser ».
    //    On ne crée jamais d'article ; un SKU inconnu est simplement loggé.
    const found: string[] = [];
    const notFound: string[] = [];

    for (const token of skus) {
      const existing = await prisma.article.findFirst({
        where: { sku: { equals: token, mode: "insensitive" } },
      });
      if (existing) {
        await prisma.article.update({
          where: { id: existing.id },
          data: {
            statut: STATUT_A_COMPTABILISER,
            transporteur,
            trelloCardId: card.id,
          },
        });
        found.push(token);
      } else {
        notFound.push(token);
      }
    }

    log({ ...ctx, cardName, transporteur, found, notFound });
    return NextResponse.json({ ok: true, found, notFound });
  } catch (err) {
    const e = err as Error;
    // Stack loggée côté serveur uniquement : l'endpoint est public, on ne la renvoie pas.
    console.error("[trello] erreur webhook", e.message, e.stack);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
