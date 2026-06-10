import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STATUT_A_COMPTABILISER } from "@/lib/calc";
import { getCardLabels } from "@/lib/trello";

export const dynamic = "force-dynamic";

// Trello envoie un HEAD pour vérifier l'URL lors de la création du webhook.
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

type TrelloWebhookBody = {
  action?: {
    data?: {
      board?: { id?: string };
      card?: { id?: string; name?: string };
    };
  };
};

// POST /api/webhooks/trello — déclenché à chaque action du board Trello.
export async function POST(req: NextRequest) {
  try {
    const boardId = process.env.TRELLO_BOARD_ID;
    const labelId = process.env.TRELLO_LABEL_ID;

    const body = (await req.json()) as TrelloWebhookBody;
    const data = body.action?.data;

    // 1. L'action doit concerner notre board.
    if (!data?.board?.id || data.board.id !== boardId) {
      return NextResponse.json({ ok: true, ignored: "board" });
    }
    // 2. L'action doit concerner une carte.
    const card = data.card;
    if (!card?.id) {
      return NextResponse.json({ ok: true, ignored: "no-card" });
    }

    // 3. Étiquettes de la carte → présence de « À comptabiliser » ?
    const labels = await getCardLabels(card.id);
    const hasComptabiliser = labels.some((l) => l.id === labelId);
    if (!hasComptabiliser) {
      return NextResponse.json({ ok: true, ignored: "no-label" });
    }

    // 3. SKU = nom de la carte ; transporteur = nom de l'autre étiquette.
    const sku = (card.name ?? "").trim();
    if (!sku) {
      return NextResponse.json({ ok: true, ignored: "no-sku" });
    }
    const transporteur =
      labels.find((l) => l.id !== labelId && l.name)?.name ?? null;

    // 5. Cherche l'article par SKU → met à jour ou crée.
    const existing = await prisma.article.findUnique({ where: { sku } });
    if (existing) {
      await prisma.article.update({
        where: { sku },
        data: {
          statut: STATUT_A_COMPTABILISER,
          transporteur,
          trelloCardId: card.id,
        },
      });
    } else {
      await prisma.article.create({
        data: {
          sku,
          statut: STATUT_A_COMPTABILISER,
          transporteur,
          trelloCardId: card.id,
          marque: "À définir",
          categorie: "À définir",
          prixAchat: 0,
        },
      });
    }

    return NextResponse.json({ ok: true, sku });
  } catch (err) {
    // 500 → Trello réessaiera.
    console.error("POST /api/webhooks/trello", err);
    return NextResponse.json({ error: "webhook error" }, { status: 500 });
  }
}
