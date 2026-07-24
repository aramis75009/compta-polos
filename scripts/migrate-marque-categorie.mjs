// Migration one-shot : sépare le libellé de lot en marque réelle + type d'article.
// Le libellé d'origine est conservé dans la nouvelle colonne `lot`.
// Appliquée le 24/07/2026 sur les 1 243 articles existants ; conservée pour
// mémoire de l'arbitrage marque/catégorie lot par lot.
// Usage : node --env-file=.env scripts/migrate-marque-categorie.mjs [--apply]
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Les 9 premiers viennent de MARQUE_LISTING_MAP (déjà utilisé pour les annonces),
// les 8 suivants de l'arbitrage de l'utilisateur sur les lots multimarques.
const MAP = {
  "Polo Ralph Lauren": { marque: "Ralph Lauren", categorie: "Polo" },
  "Polo Tommy Hilfiger": { marque: "Tommy Hilfiger", categorie: "Polo" },
  "Half Zip Ralph Lauren": { marque: "Ralph Lauren", categorie: "Pull" },
  "Half Zip Tommy Hilfinger": { marque: "Tommy Hilfiger", categorie: "Pull" },
  "Torsadé Ralph Lauren": { marque: "Ralph Lauren", categorie: "Pull" },
  "Short de bain Ralph Lauren": { marque: "Ralph Lauren", categorie: "Short de bain" },
  "Pull Lacoste": { marque: "Lacoste", categorie: "Pull" },
  "Chemise Dickies": { marque: "Dickies", categorie: "Chemise" },
  "Short Adidas": { marque: "Adidas", categorie: "Short" },
  "Pull Ethnic": { marque: "Mix", categorie: "Pull" },
  "Mix short de sport de marque": { marque: "Mix", categorie: "Short" },
  "Mix Helly Hansen": { marque: "Helly Hansen", categorie: "Mix" },
  "Pull COOGI style": { marque: "COOGI", categorie: "Pull" },
  "Mix TNF/PAT/COL": { marque: "TNF/PAT/COL", categorie: "Polaire" },
  "Crazy Polaires": { marque: "Mix", categorie: "Polaire" },
  "Crazy Coupe-vent": { marque: "Mix", categorie: "Coupe-vent" },
  "Pulls islandais": { marque: "Mix", categorie: "Pull" },
};

const articles = await prisma.article.findMany({
  select: { id: true, sku: true, marque: true, categorie: true, lot: true },
});

// Le lot d'origine = la valeur actuelle de `lot` si la migration a déjà tourné,
// sinon `marque` (qui porte encore le libellé de lot). Idempotent.
const lotOf = (a) => a.lot ?? a.marque;

const inconnus = new Map();
for (const a of articles) {
  if (!MAP[lotOf(a)]) inconnus.set(lotOf(a), (inconnus.get(lotOf(a)) ?? 0) + 1);
}
if (inconnus.size > 0) {
  console.error("Libellés non couverts par la table de correspondance :");
  for (const [k, n] of inconnus) console.error(`  "${k}" (${n} articles)`);
  process.exit(1);
}

const parLot = new Map();
for (const a of articles) {
  const lot = lotOf(a);
  parLot.set(lot, (parLot.get(lot) ?? 0) + 1);
}

console.log(APPLY ? "APPLICATION" : "SIMULATION (relancer avec --apply)");
for (const [lot, n] of [...parLot].sort((x, y) => y[1] - x[1])) {
  const { marque, categorie } = MAP[lot];
  console.log(
    `${String(n).padStart(4)} | ${lot.padEnd(30)} -> marque="${marque}" categorie="${categorie}"`,
  );
}

if (APPLY) {
  let total = 0;
  for (const [lot] of parLot) {
    const { marque, categorie } = MAP[lot];
    // On cible par lot si déjà rempli, sinon par l'ancien libellé dans `marque`.
    const r = await prisma.article.updateMany({
      where: { OR: [{ lot }, { lot: null, marque: lot }] },
      data: { lot, marque, categorie },
    });
    total += r.count;
  }
  console.log(`\n${total} articles mis à jour.`);
}

await prisma.$disconnect();
