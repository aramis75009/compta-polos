// Recopie dans la base l'accès Trello qui vivait dans les variables
// d'environnement du déploiement.
//
// Pourquoi : jusqu'au 15/08/2026, un compte sans réglages Trello retombait sur
// TRELLO_API_KEY / TRELLO_TOKEN / TRELLO_BOARD_ID. Ce repli est supprimé —
// c'est par lui qu'un utilisateur atteignait le board du propriétaire. Le
// compte historique n'ayant jamais rien saisi dans /compte, il perdrait sa
// connexion : ce script la lui rend, cette fois attachée à SON compte.
//
// IDEMPOTENT : un compte qui a déjà une connexion (OAuth ou héritée) n'est pas
// touché. Relancer ne fait rien.
//
//   npm run migrer-trello                # simulation, n'écrit rien
//   npm run migrer-trello -- --ecrire    # applique
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { chiffrer, chiffrementDisponible } from "../lib/crypto";

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const vide = (s: string | undefined) => (s && s.trim() ? s.trim() : null);

async function main() {
  const ecrire = process.argv.includes("--ecrire");

  if (!chiffrementDisponible()) {
    throw new Error("ENCRYPTION_KEY absente ou invalide : impossible de chiffrer.");
  }

  const key = vide(process.env.TRELLO_API_KEY);
  const token = vide(process.env.TRELLO_TOKEN);
  if (!key || !token) {
    console.log("TRELLO_API_KEY / TRELLO_TOKEN absentes : rien à migrer.");
    return;
  }

  // Le propriétaire est celui que désignait l'ancien repli du webhook.
  const email = vide(process.env.TRELLO_OWNER_EMAIL);
  const proprietaire = email
    ? await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true },
      })
    : await prisma.user.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true, email: true },
      });

  if (!proprietaire) {
    throw new Error(
      "Aucun compte propriétaire trouvé (TRELLO_OWNER_EMAIL introuvable ?).",
    );
  }

  const existant = await prisma.userSettings.findUnique({
    where: { userId: proprietaire.id },
    select: { trelloOauthToken: true, trelloKey: true, trelloToken: true },
  });

  if (existant?.trelloOauthToken || (existant?.trelloKey && existant?.trelloToken)) {
    console.log(`${proprietaire.email} a déjà une connexion Trello — rien à faire.`);
    return;
  }

  const secret = vide(process.env.TRELLO_SECRET);
  const boardId = vide(process.env.TRELLO_BOARD_ID);
  const labelId = vide(process.env.TRELLO_LABEL_ID);
  const comptaId = vide(process.env.TRELLO_COMPTABILISE_LABEL_ID);

  const donnees = {
    trelloKey: chiffrer(key),
    trelloToken: chiffrer(token),
    ...(secret ? { trelloSecret: chiffrer(secret) } : {}),
    ...(boardId ? { trelloBoardId: boardId } : {}),
    ...(labelId ? { trelloLabelId: labelId } : {}),
    ...(comptaId ? { trelloComptabiliseLabelId: comptaId } : {}),
  };

  // Journal volontairement muet sur les valeurs : on dit CE QU'ON POSE, jamais
  // ce que ça vaut. Un script de migration qui affiche un jeton le grave dans
  // l'historique du terminal et dans les logs de CI.
  console.log(`Compte visé   : ${proprietaire.email}`);
  console.log(`Champs à poser : ${Object.keys(donnees).join(", ")}`);
  if (boardId) {
    // Le board est un identifiant public, et c'est le seul élément qui permet
    // de vérifier qu'on migre bien le bon compte.
    console.log(`Board          : ${boardId}`);
  }

  if (!ecrire) {
    console.log("\nSimulation. Relancer avec --ecrire pour appliquer.");
    return;
  }

  await prisma.userSettings.upsert({
    where: { userId: proprietaire.id },
    create: { userId: proprietaire.id, ...donnees },
    update: donnees,
  });
  console.log("✅ Migration appliquée.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
