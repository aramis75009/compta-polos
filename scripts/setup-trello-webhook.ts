// Enregistre un webhook Trello pointant vers /api/webhooks/trello.
// À lancer APRÈS le déploiement (NEXTAUTH_URL doit être l'URL publique, pas localhost).
//   npm run setup-trello
import { loadEnvConfig } from "@next/env";
import { createWebhook } from "../lib/trello";

loadEnvConfig(process.cwd());

async function main() {
  const base = process.env.NEXTAUTH_URL;
  const boardId = process.env.TRELLO_BOARD_ID;
  const key = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;

  if (!base || base.includes("localhost")) {
    throw new Error(
      `NEXTAUTH_URL doit être une URL publique (actuel: ${base ?? "non défini"}). Trello ne peut pas appeler localhost.`,
    );
  }
  if (!boardId) throw new Error("TRELLO_BOARD_ID manquant.");
  if (!key || !token) throw new Error("TRELLO_API_KEY / TRELLO_TOKEN manquants.");

  const callbackURL = `${base.replace(/\/$/, "")}/api/webhooks/trello`;
  console.log(`Création du webhook Trello → ${callbackURL}`);

  // Ce script reste l'outil du board de l'app. Chaque utilisateur passe
  // désormais par le bouton « Connecter mon Trello » de /compte, qui fait le
  // même appel avec ses propres identifiants.
  const webhook = (await createWebhook(
    {
      key,
      token,
      secret: null,
      boardId,
      labelId: null,
      comptabiliseLabelId: null,
      // Ce script vise explicitement TRELLO_BOARD_ID avec TRELLO_TOKEN : c'est
      // une connexion « héritée » au sens de lib/settings.ts, pas un jeton
      // obtenu par le parcours de connexion.
      source: "heritee",
    },
    callbackURL,
    boardId,
  )) as { id: string };
  console.log(`✅ Webhook créé. ID : ${webhook.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
