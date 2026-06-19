import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STATUT_A_COMPTABILISER } from "@/lib/calc";
import { getCardLabels } from "@/lib/trello";

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

// POST /api/webhooks/trello — déclenché à chaque action du board Trello.
export async function POST(req: NextRequest) {
  try {
    // Nettoyage ponctuel des faux articles de l'ancien comportement (une seule fois).
    await cleanupFakeArticlesOnce();

    const body = (await req.json()) as TrelloWebhookBody;
    const action = body.action ?? {};
    const data = action.data ?? {};
    const type = action.type;

    console.log("Webhook reçu:", type, JSON.stringify(data?.card));

    const boardId = process.env.TRELLO_BOARD_ID;
    const labelId = process.env.TRELLO_LABEL_ID;

    // 1. L'action doit concerner notre board.
    if (!data?.board?.id || data.board.id !== boardId) {
      return NextResponse.json({ ignored: "board" });
    }

    // 2. L'action doit concerner une carte.
    const card = data.card;
    if (!card?.id) {
      return NextResponse.json({ ignored: "no-card" });
    }

    // 3. Détection de l'étiquette « À comptabiliser » selon le type d'action.
    let hasComptabiliser = false;
    let labels: TrelloLabel[] | null = null;

    if (type === "addLabelToCard") {
      // Le payload contient directement l'étiquette ajoutée.
      hasComptabiliser = data.label?.id === labelId;
    } else if (type === "updateCard") {
      // On récupère les étiquettes actuelles de la carte.
      labels = await getCardLabels(card.id);
      hasComptabiliser = labels.some((l) => l.id === labelId);
    } else {
      // Tous les autres types sont ignorés.
      return NextResponse.json({ ignored: type ?? "unknown" });
    }

    if (!hasComptabiliser) {
      return NextResponse.json({ ignored: "no-label" });
    }

    // 4. Le nom de la carte peut contenir plusieurs SKUs (ex: "SDM11 SDM36 ADI36").
    const skus = parseSkus(card.name ?? "");
    if (skus.length === 0) {
      return NextResponse.json({ ignored: "no-sku" });
    }

    // 5. Transporteur = nom de l'autre étiquette de la carte (best-effort).
    let transporteur: string | null = null;
    try {
      if (!labels) labels = await getCardLabels(card.id);
      transporteur =
        labels.find((l) => l.id !== labelId && l.name)?.name ?? null;
    } catch (e) {
      console.error("Webhook: récupération transporteur échouée", e);
    }

    // 6. Pour chaque SKU détecté : mettre l'article existant « À comptabiliser ».
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
        console.warn(`SKU non trouvé : ${token}`);
        notFound.push(token);
      }
    }

    return NextResponse.json({ ok: true, found, notFound });
  } catch (err) {
    const e = err as Error;
    console.error("Webhook error:", err);
    // On expose le détail pour pouvoir diagnostiquer dans les logs Vercel.
    return NextResponse.json(
      { error: e.message, stack: e.stack },
      { status: 500 },
    );
  }
}
