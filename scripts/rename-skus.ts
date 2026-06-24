// Renomme les SKU des polos selon les nouvelles conventions de marque.
//   Lacoste            → PLAC1, PLAC2, PLAC3...
//   Tommy Hilfiger     → PTH1, PTH2, PTH3...
//   Polo Ralph Lauren  → PRL1, PRL2, PRL3...
//
// Pour chaque marque : récupère tous les articles triés par SKU actuel, puis
// réattribue les SKU dans l'ordre. À lancer avec :
//   npx tsx scripts/rename-skus.ts
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { prisma } from "../lib/prisma";

// marque (valeur exacte en base) → préfixe du nouveau SKU
const CONVENTIONS: { marque: string; prefixe: string }[] = [
  { marque: "Lacoste", prefixe: "PLAC" },
  { marque: "Tommy Hilfiger", prefixe: "PTH" },
  { marque: "Polo Ralph Lauren", prefixe: "PRL" },
];

async function main() {
  // 1. Diagnostic : marques et nombre d'articles trouvés (avant tout update).
  console.log("=== Articles trouvés par marque ===");
  for (const { marque } of CONVENTIONS) {
    const count = await prisma.article.count({ where: { marque } });
    console.log(`  ${marque} : ${count} article(s)`);
  }
  console.log("");

  // 2. Réattribution des SKU, marque par marque.
  for (const { marque, prefixe } of CONVENTIONS) {
    const articles = await prisma.article.findMany({
      where: { marque },
      orderBy: { sku: "asc" },
    });

    if (articles.length === 0) {
      console.log(`--- ${marque} : aucun article, ignoré ---`);
      continue;
    }

    console.log(`--- ${marque} (${articles.length}) ---`);
    let index = 1;
    for (const article of articles) {
      const nouveauSku = `${prefixe}${index}`;
      if (article.sku === nouveauSku) {
        console.log(`  ${article.sku} (inchangé)`);
      } else {
        await prisma.article.update({
          where: { id: article.id },
          data: { sku: nouveauSku },
        });
        console.log(`  ${article.sku} → ${nouveauSku}`);
      }
      index++;
    }
    console.log("");
  }

  console.log("✅ Renommage terminé.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
