// Enregistre un webhook Trello pointant vers /api/webhooks/trello.
// À lancer APRÈS le déploiement (NEXTAUTH_URL doit être l'URL publique, pas localhost).
//   npm run setup-trello
import { loadEnvConfig } from "@next/env";
import { createWebhook } from "../lib/trello";

loadEnvConfig(process.cwd());

async function main() {
  const base = process.env.NEXTAUTH_URL;
  const boardId = process.env.TRELLO_BOARD_ID;

  if (!base || base.includes("localhost")) {
    throw new Error(
      `NEXTAUTH_URL doit être une URL publique (actuel: ${base ?? "non défini"}). Trello ne peut pas appeler localhost.`,
    );
  }
  if (!boardId) throw new Error("TRELLO_BOARD_ID manquant.");

  const callbackURL = `${base.replace(/\/$/, "")}/api/webhooks/trello`;
  console.log(`Création du webhook Trello → ${callbackURL}`);

  const webhook = (await createWebhook(callbackURL, boardId)) as {
    id: string;
  };
  console.log(`✅ Webhook créé. ID : ${webhook.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
