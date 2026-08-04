// Backfill : attribue compteVente = VINTED_PRO aux articles vendus
// existants. Idempotent — ne réécrit jamais un compteVente déjà non null.
// Usage : node --env-file=.env scripts/backfill-compte-vente.mjs [--apply]
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Articles vendus (statut "Vendu") ou ayant une dateVente non nulle,
// mais dont le compteVente n'est pas encore renseigné.
const articles = await prisma.article.findMany({
  where: {
    compteVente: null,
    OR: [{ statut: "Vendu" }, { dateVente: { not: null } }],
  },
  select: { id: true, sku: true, statut: true, dateVente: true },
});

console.log(
  `${articles.length} article(s) vendu(s) avec compteVente NULL détecté(s).`,
);

if (articles.length === 0) {
  console.log("Rien à faire.");
} else {
  for (const a of articles) {
    console.log(
      `  ${a.sku} | statut="${a.statut}" | dateVente=${a.dateVente ? a.dateVente.toISOString().slice(0, 10) : "null"} → VINTED_PRO`,
    );
  }

  if (APPLY) {
    const r = await prisma.article.updateMany({
      where: {
        compteVente: null,
        OR: [{ statut: "Vendu" }, { dateVente: { not: null } }],
      },
      data: { compteVente: "VINTED_PRO" },
    });
    console.log(`\n${r.count} article(s) mis à jour.`);
  } else {
    console.log("\nSIMULATION — relancer avec --apply pour appliquer.");
  }
}

await prisma.$disconnect();
