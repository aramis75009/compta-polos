import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STATUT_A_COMPTABILISER } from "@/lib/calc";
import { getCardLabels, getCardName } from "@/lib/trello";
import {
  contexteTrello,
  utilisateurDuBoard,
  type TrelloContexte,
} from "@/lib/settings";
import { origineDe } from "@/lib/hosts";

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

/**
 * Valide la signature `x-trello-webhook` : HMAC-SHA1, en base64, du corps brut
 * concaténé à l'URL de rappel, avec le secret d'API du compte.
 *
 * L'endpoint est public et route désormais vers un compte d'après l'id du
 * board : sans cette vérification, une requête forgée ferait basculer les
 * articles d'un utilisateur en « À comptabiliser ».
 *
 * Faute de secret configuré, on laisse passer — sinon la synchro s'arrêterait
 * du jour au lendemain pour un board déjà en place. Le défaut est journalisé à
 * chaque appel, et l'écran de configuration invite à renseigner le secret.
 */
function signatureValide(
  ctx: TrelloContexte | null,
  brut: string,
  entete: string | null,
  callbackURL: string,
): boolean {
  if (!ctx?.secret) {
    console.warn(
      "[trello] secret d'API absent : signature du webhook non vérifiée.",
    );
    return true;
  }
  if (!entete) return false;

  const attendu = crypto
    .createHmac("sha1", ctx.secret)
    .update(brut + callbackURL)
    .digest("base64");

  // Comparaison à temps constant, sur des tampons de même longueur.
  const a = Buffer.from(entete);
  const b = Buffer.from(attendu);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Migration ponctuelle : supprimer les faux articles créés par l'ancien
// comportement (un seul article avec un SKU contenant des espaces).
// Exécutée une seule fois au démarrage de la correction.
let fakeArticlesCleanupDone = false;
async function cleanupFakeArticlesOnce(userId: string) {
  if (fakeArticlesCleanupDone) return;
  fakeArticlesCleanupDone = true;
  try {
    const result = await prisma.article.deleteMany({
      where: { userId, sku: { contains: " " } },
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
    // Le corps est lu en texte : la signature porte sur les octets exacts reçus,
    // qu'un aller-retour par JSON.parse/stringify ne restituerait pas.
    const brut = await req.text();
    const body = JSON.parse(brut || "{}") as TrelloWebhookBody;
    const action = body.action ?? {};
    const data = action.data ?? {};
    const type = action.type;

    const card = data.card;
    const journal = { type, cardId: card?.id, cardName: card?.name };

    // 1. Le board désigne le compte concerné. C'est la seule identification
    //    disponible : l'appel entrant n'a pas de session.
    const boardRecu = data?.board?.id;
    if (!boardRecu) {
      log({ ...journal, ignored: "no-board" });
      return NextResponse.json({ ignored: "no-board" });
    }

    const ownerId = await utilisateurDuBoard(boardRecu);
    if (!ownerId) {
      log({ ...journal, ignored: "board-inconnu", boardRecu });
      return NextResponse.json({ ignored: "board" });
    }

    // 2. Signature. Vérifiée avec le secret du compte que le board désigne.
    const trello = await contexteTrello(ownerId);
    // L'URL de rappel est celle réellement servie, la même que celle utilisée à
    // l'enregistrement du webhook — la signature porte dessus.
    const callbackURL = `${origineDe(req)}/api/webhooks/trello`;
    if (
      !signatureValide(
        trello,
        brut,
        req.headers.get("x-trello-webhook"),
        callbackURL,
      )
    ) {
      console.warn("[trello] signature invalide — événement rejeté.");
      return NextResponse.json({ error: "Signature invalide." }, { status: 401 });
    }

    if (!trello) {
      log({ ...journal, ignored: "trello-non-configure" });
      return NextResponse.json({ ignored: "trello-non-configure" });
    }
    const labelId = trello.labelId;

    // Nettoyage ponctuel des faux articles de l'ancien comportement (une seule fois).
    await cleanupFakeArticlesOnce(ownerId);

    // 3. L'action doit concerner une carte.
    if (!card?.id) {
      log({ ...journal, ignored: "no-card" });
      return NextResponse.json({ ignored: "no-card" });
    }

    // 4. Type d'action pertinent ? (cf. CARD_ACTIONS)
    if (!type || !CARD_ACTIONS.has(type)) {
      log({ ...journal, ignored: "type-hors-scope" });
      return NextResponse.json({ ignored: type ?? "unknown" });
    }

    // 5. L'étiquette « À comptabiliser » est-elle sur la carte ?
    //    `addLabelToCard` la porte dans son payload ; pour tous les autres types
    //    (création, copie, déplacement, update) il faut interroger l'API.
    if (!labelId) {
      log({ ...journal, ignored: "label-non-configuree" });
      return NextResponse.json({ ignored: "label-non-configuree" });
    }

    let labels: TrelloLabel[] | null = null;
    let hasComptabiliser: boolean;

    if (type === "addLabelToCard" && data.label?.id) {
      hasComptabiliser = data.label.id === labelId;
    } else {
      labels = await getCardLabels(trello, card.id);
      hasComptabiliser = labels.some((l) => l.id === labelId);
    }

    if (!hasComptabiliser) {
      log({
        ...journal,
        ignored: "no-label",
        labelsCarte: labels?.map((l) => l.name ?? l.id),
      });
      return NextResponse.json({ ignored: "no-label" });
    }

    // 6. Le nom de la carte peut contenir plusieurs SKUs (ex: "SDM11 SDM36 ADI36").
    //    Certains payloads (copie, déplacement) n'incluent pas le nom → on le lit.
    let cardName = card.name ?? "";
    if (!cardName) {
      try {
        cardName = await getCardName(trello, card.id);
      } catch (e) {
        console.error("[trello] lecture du nom de carte échouée", e);
      }
    }

    const skus = parseSkus(cardName);
    if (skus.length === 0) {
      log({ ...journal, cardName, ignored: "no-sku" });
      return NextResponse.json({ ignored: "no-sku" });
    }

    // 7. Transporteur = nom de l'autre étiquette de la carte (best-effort).
    //    L'étiquette « Comptabilisé » ne doit pas être prise pour un transporteur.
    const comptabiliseId = trello.comptabiliseLabelId;
    let transporteur: string | null = null;
    try {
      if (!labels) labels = await getCardLabels(trello, card.id);
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
        where: { userId: ownerId, sku: { equals: token, mode: "insensitive" } },
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

    log({ ...journal, cardName, transporteur, found, notFound });
    return NextResponse.json({ ok: true, found, notFound });
  } catch (err) {
    const e = err as Error;
    // Stack loggée côté serveur uniquement : l'endpoint est public, on ne la renvoie pas.
    console.error("[trello] erreur webhook", e.message, e.stack);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
