// One-shot : bascule les articles « En stock » déjà photographiés
// (ancien drapeau photosPretes = true) vers le nouveau statut « Photos prêtes ».
//
// ⚠️ À lancer UNE fois, AVANT tout `prisma db push` qui supprimerait la colonne
//    "photosPretes" : une fois la colonne partie, le drapeau est irrécupérable.
//
//   node scripts/migrate-photos-pretes.mjs
//
// Idempotent : relancer ne change plus rien (les articles déjà « Photos prêtes »
// ne sont plus « En stock »). Lit DATABASE_URL depuis .env (chargé par Prisma).

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  // Raw SQL volontaire : la colonne "photosPretes" n'existe plus dans le schéma
  // Prisma (retirée avec l'ajout du statut), mais reste présente en base.
  const count = await prisma.$executeRawUnsafe(
    `UPDATE "Article" SET "statut" = 'Photos prêtes' WHERE "statut" = 'En stock' AND "photosPretes" = true`,
  );
  console.log(`✓ ${count} article(s) basculé(s) « En stock » → « Photos prêtes ».`);
} catch (e) {
  console.error(
    "Échec de la migration (la colonne \"photosPretes\" a-t-elle déjà été supprimée ?) :",
    e,
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
