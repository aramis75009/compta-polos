// Helpers d'intégration Trello (serveur uniquement — utilisent les secrets env).
const BASE = "https://api.trello.com/1";

function creds() {
  const key = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;
  if (!key || !token) {
    throw new Error("TRELLO_API_KEY / TRELLO_TOKEN manquants.");
  }
  return `key=${key}&token=${token}`;
}

export type TrelloLabel = { id: string; name: string; color: string | null };

/** Récupère les étiquettes d'une carte. */
export async function getCardLabels(cardId: string): Promise<TrelloLabel[]> {
  const res = await fetch(`${BASE}/cards/${cardId}/labels?${creds()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Trello getCardLabels ${res.status}`);
  }
  return (await res.json()) as TrelloLabel[];
}

/** Nom d'une carte (repli quand le payload du webhook ne le contient pas). */
export async function getCardName(cardId: string): Promise<string> {
  const res = await fetch(`${BASE}/cards/${cardId}?fields=name&${creds()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Trello getCardName ${res.status}`);
  const card = (await res.json()) as { name?: string };
  return card.name ?? "";
}

/** Ajoute une étiquette à une carte. */
export async function addLabelToCard(
  cardId: string,
  labelId: string,
): Promise<void> {
  const res = await fetch(
    `${BASE}/cards/${cardId}/idLabels?value=${labelId}&${creds()}`,
    { method: "POST" },
  );
  // 200 si ajoutée ; on tolère 400 (étiquette déjà présente sur la carte).
  if (!res.ok && res.status !== 400) {
    throw new Error(`Trello addLabelToCard ${res.status}`);
  }
}

/** Retire l'étiquette « À comptabiliser » (TRELLO_LABEL_ID) d'une carte. */
export async function removeComptabiliserLabel(cardId: string): Promise<void> {
  const labelId = process.env.TRELLO_LABEL_ID;
  if (!labelId) throw new Error("TRELLO_LABEL_ID manquant.");
  const res = await fetch(
    `${BASE}/cards/${cardId}/idLabels/${labelId}?${creds()}`,
    { method: "DELETE" },
  );
  // 200 si retirée ; on tolère 400 (étiquette déjà absente).
  if (!res.ok && res.status !== 400) {
    throw new Error(`Trello removeComptabiliserLabel ${res.status}`);
  }
}

/** Enregistre un webhook Trello sur le board. Renvoie l'objet créé. */
export async function createWebhook(callbackURL: string, idModel: string) {
  const res = await fetch(`${BASE}/webhooks?${creds()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callbackURL, idModel }),
  });
  if (!res.ok) {
    throw new Error(`Trello createWebhook ${res.status}: ${await res.text()}`);
  }
  return res.json();
}
