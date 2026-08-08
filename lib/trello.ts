// Helpers d'intégration Trello (serveur uniquement).
//
// Chaque appel reçoit un `TrelloContexte` — les identifiants ne sont plus lus
// dans `process.env` au fond des helpers. C'est ce qui permet à deux
// utilisateurs d'avoir chacun leur board : les secrets viennent de leurs
// réglages (cf. `lib/settings.ts`), avec repli sur ceux du déploiement.
import type { TrelloContexte } from "@/lib/settings";

const BASE = "https://api.trello.com/1";

const creds = (ctx: TrelloContexte) => `key=${ctx.key}&token=${ctx.token}`;

export type TrelloLabel = { id: string; name: string; color: string | null };
export type TrelloBoard = { id: string; name: string };

/** Récupère les étiquettes d'une carte. */
export async function getCardLabels(
  ctx: TrelloContexte,
  cardId: string,
): Promise<TrelloLabel[]> {
  const res = await fetch(`${BASE}/cards/${cardId}/labels?${creds(ctx)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Trello getCardLabels ${res.status}`);
  }
  return (await res.json()) as TrelloLabel[];
}

/** Nom d'une carte (repli quand le payload du webhook ne le contient pas). */
export async function getCardName(
  ctx: TrelloContexte,
  cardId: string,
): Promise<string> {
  const res = await fetch(
    `${BASE}/cards/${cardId}?fields=name&${creds(ctx)}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Trello getCardName ${res.status}`);
  const card = (await res.json()) as { name?: string };
  return card.name ?? "";
}

/** Ajoute une étiquette à une carte. */
export async function addLabelToCard(
  ctx: TrelloContexte,
  cardId: string,
  labelId: string,
): Promise<void> {
  const res = await fetch(
    `${BASE}/cards/${cardId}/idLabels?value=${labelId}&${creds(ctx)}`,
    { method: "POST" },
  );
  // 200 si ajoutée ; on tolère 400 (étiquette déjà présente sur la carte).
  if (!res.ok && res.status !== 400) {
    throw new Error(`Trello addLabelToCard ${res.status}`);
  }
}

/** Retire l'étiquette « À comptabiliser » du contexte d'une carte. */
export async function removeComptabiliserLabel(
  ctx: TrelloContexte,
  cardId: string,
): Promise<void> {
  if (!ctx.labelId) throw new Error("Étiquette « À comptabiliser » non configurée.");
  const res = await fetch(
    `${BASE}/cards/${cardId}/idLabels/${ctx.labelId}?${creds(ctx)}`,
    { method: "DELETE" },
  );
  // 200 si retirée ; on tolère 400 (étiquette déjà absente).
  if (!res.ok && res.status !== 400) {
    throw new Error(`Trello removeComptabiliserLabel ${res.status}`);
  }
}

/**
 * Boards accessibles avec ces identifiants.
 *
 * Double emploi : c'est le test de validité des clés dans l'écran de
 * configuration (lecture seule), et la source du menu déroulant — l'utilisateur
 * choisit son board au lieu d'en recopier l'identifiant à la main.
 */
export async function listBoards(ctx: TrelloContexte): Promise<TrelloBoard[]> {
  const res = await fetch(
    `${BASE}/members/me/boards?fields=id,name&${creds(ctx)}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Trello listBoards ${res.status}`);
  return (await res.json()) as TrelloBoard[];
}

/** Étiquettes d'un board, pour choisir les deux étiquettes de statut. */
export async function listBoardLabels(
  ctx: TrelloContexte,
  boardId: string,
): Promise<TrelloLabel[]> {
  const res = await fetch(`${BASE}/boards/${boardId}/labels?${creds(ctx)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Trello listBoardLabels ${res.status}`);
  return (await res.json()) as TrelloLabel[];
}

/** Enregistre un webhook Trello sur le board. Renvoie l'objet créé. */
export async function createWebhook(
  ctx: TrelloContexte,
  callbackURL: string,
  idModel: string,
) {
  const res = await fetch(`${BASE}/webhooks?${creds(ctx)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callbackURL, idModel }),
  });
  if (!res.ok) {
    throw new Error(`Trello createWebhook ${res.status}: ${await res.text()}`);
  }
  return res.json();
}
