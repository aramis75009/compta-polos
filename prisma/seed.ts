import { PrismaClient } from "@prisma/client";
import { skuNumber } from "../lib/calc";
import { DEFAULT_PROMPT_CONTENU } from "../lib/promptSelect";

const prisma = new PrismaClient();

// Répartition des 385 articles : préfixe SKU, marque, nombre de pièces.
const GROUPES = [
  { prefix: "PRL", marque: "Polo Ralph Lauren", count: 128 },
  { prefix: "LAC", marque: "Lacoste", count: 128 },
  { prefix: "TH", marque: "Tommy Hilfiger", count: 129 },
];
const CATEGORIE = "Polo";
const COUT_TOTAL = 2500;
const PRIX_ACHAT = 6.5;
const NB_ARTICLES = GROUPES.reduce((s, g) => s + g.count, 0); // 385

// Le seed appartient à un utilisateur précis depuis le cloisonnement.
// SEED_USER_EMAIL le désigne explicitement ; à défaut, le compte le plus ancien.
// Sans aucun utilisateur en base, on échoue plutôt que de créer des orphelins.
async function resolveUserId(): Promise<string> {
  const email = process.env.SEED_USER_EMAIL?.trim().toLowerCase();

  const user = email
    ? await prisma.user.findUnique({ where: { email }, select: { id: true } })
    : await prisma.user.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

  if (!user) {
    throw new Error(
      email
        ? `Aucun utilisateur avec l'email ${email}.`
        : "Aucun utilisateur en base. Créer un compte via /signup avant de lancer le seed.",
    );
  }
  return user.id;
}

async function main() {
  const userId = await resolveUserId();

  // Le nettoyage est scopé : sans le userId, un seed effacerait le stock de
  // TOUS les comptes, pas seulement celui qu'on réinitialise.
  console.log("Nettoyage des données existantes de ce compte…");
  await prisma.article.deleteMany({ where: { userId } });
  await prisma.commande.deleteMany({ where: { userId } });

  console.log("Création de la commande Grossiste KZ…");
  const commande = await prisma.commande.create({
    data: {
      fournisseur: "Grossiste KZ",
      date: new Date(),
      coutTotal: COUT_TOTAL,
      nbArticles: NB_ARTICLES,
      marque: "Multi-marques",
      categorie: CATEGORIE,
      userId,
    },
  });

  const articles = GROUPES.flatMap((g) =>
    Array.from({ length: g.count }, (_, i) => ({
      sku: `${g.prefix}-${skuNumber(i + 1)}`,
      marque: g.marque,
      categorie: CATEGORIE,
      statut: "En stock",
      prixAchat: PRIX_ACHAT,
      commandeId: commande.id,
      userId,
    })),
  );

  console.log(`Création de ${articles.length} articles…`);
  await prisma.article.createMany({ data: articles });

  // Prompt d'annonce par défaut (si aucun n'existe) → la Mise en vente
  // fonctionne immédiatement sans configuration.
  if ((await prisma.promptTemplate.count({ where: { userId } })) === 0) {
    await prisma.promptTemplate.create({
      data: {
        nom: "Prompt par défaut",
        contenu: DEFAULT_PROMPT_CONTENU,
        estDefaut: true,
        userId,
      },
    });
    console.log("Prompt par défaut créé.");
  }

  console.log(
    `✅ Seed terminé : 1 commande, ${articles.length} articles (prix d'achat ${PRIX_ACHAT.toFixed(2)} €).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
