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

/** Archive (closed=true) une carte si elle n'a plus l'étiquette « À comptabiliser ». */
export async function archiveCard(cardId: string): Promise<boolean> {
  const labelId = process.env.TRELLO_LABEL_ID;
  const labels = await getCardLabels(cardId);
  const stillHas = labels.some((l) => l.id === labelId);
  if (stillHas) return false;

  const res = await fetch(`${BASE}/cards/${cardId}?closed=true&${creds()}`, {
    method: "PUT",
  });
  if (!res.ok) {
    throw new Error(`Trello archiveCard ${res.status}`);
  }
  return true;
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
