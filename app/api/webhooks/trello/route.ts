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

    // 4. SKU = nom de la carte.
    const sku = (card.name ?? "").trim();
    if (!sku) {
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

    // 6. Met à jour l'article existant, sinon le crée.
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

    return NextResponse.json({ ok: true, sku, type });
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
