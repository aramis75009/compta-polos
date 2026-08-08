-- Une commande contient plusieurs lots (08/08/2026).
--
-- ⚠️  MIGRATION ÉCRITE À LA MAIN — ne pas la régénérer avec `prisma migrate dev`
--     ni `prisma db push` : ils produisent un DROP COLUMN "photosPretes"
--     (cf. CLAUDE.md et l'en-tête du baseline 20260725000000_init).
--
-- Contexte : une commande chez un grossiste mêle plusieurs sortes de pièces —
-- 50 polos Ralph Lauren et 30 t-shirts Ralph Lauren, qui n'ont ni le même prix
-- d'achat ni la même série de SKU. Le modèle ne savait le représenter qu'en
-- créant deux commandes fictives.
--
-- Les commandes existantes deviennent des commandes à un seul lot, ce qu'elles
-- sont réellement.

CREATE TABLE "public"."Lot" (
    "id" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "marque" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "prefixeSku" TEXT NOT NULL,
    "modeSaisie" TEXT NOT NULL DEFAULT 'LOT',
    "quantite" INTEGER NOT NULL,
    "prixTotal" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Lot_userId_idx" ON "public"."Lot"("userId");
CREATE INDEX "Lot_commandeId_idx" ON "public"."Lot"("commandeId");

ALTER TABLE "public"."Lot"
    ADD CONSTRAINT "Lot_commandeId_fkey" FOREIGN KEY ("commandeId")
    REFERENCES "public"."Commande"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."Lot"
    ADD CONSTRAINT "Lot_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rattachement des articles. Nullable : les articles sans commande n'ont pas
-- de lot, et supprimer un lot ne doit pas emporter les articles déjà vendus.
ALTER TABLE "public"."Article" ADD COLUMN "lotId" TEXT;
CREATE INDEX "Article_lotId_idx" ON "public"."Article"("lotId");

ALTER TABLE "public"."Article"
    ADD CONSTRAINT "Article_lotId_fkey" FOREIGN KEY ("lotId")
    REFERENCES "public"."Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Reprise de l'existant ────────────────────────────────────────────────────
--
-- Un lot par commande. Trois valeurs sont relevées sur les articles réels de la
-- commande plutôt que devinées :
--   • le libellé, depuis `Article.lot` — ce sont les intitulés d'origine
--     (« Short Adidas », « Crazy Polaires »), qu'on ne veut pas reconstruire ;
--   • le préfixe SKU, extrait des SKU existants — aucune règle ne redonne HZT
--     ou ETH à partir de la marque ;
--   • la quantité, comptée, plutôt que `nbArticles` qui pourrait avoir dérivé.
--
-- `gen_random_uuid()` plutôt qu'un cuid : Prisma génère les cuid côté client,
-- pas en base. L'identifiant reste opaque, la forme n'a pas d'importance.
INSERT INTO "public"."Lot" (
    "id", "commandeId", "nom", "marque", "categorie", "prefixeSku",
    "modeSaisie", "quantite", "prixTotal", "createdAt", "userId"
)
SELECT
    gen_random_uuid()::text,
    c."id",
    COALESCE(
        (SELECT a."lot" FROM "public"."Article" a
          WHERE a."commandeId" = c."id" AND a."lot" IS NOT NULL
          GROUP BY a."lot" ORDER BY count(*) DESC LIMIT 1),
        NULLIF(trim(concat_ws(' ', c."categorie", c."marque")), ''),
        'Lot'
    ),
    COALESCE(c."marque", 'Mix'),
    COALESCE(c."categorie", 'Mix'),
    COALESCE(
        (SELECT substring(a."sku" from '^[A-Za-z]+') FROM "public"."Article" a
          WHERE a."commandeId" = c."id" AND a."sku" ~ '^[A-Za-z]+[0-9]+$'
          ORDER BY a."createdAt" ASC LIMIT 1),
        'ART'
    ),
    -- LISSE devient un lot au forfait, DETAILLE un lot saisi pièce par pièce.
    CASE WHEN c."modeSaisie" = 'DETAILLE' THEN 'PIECE' ELSE 'LOT' END,
    GREATEST((SELECT count(*) FROM "public"."Article" a WHERE a."commandeId" = c."id"), 1),
    -- Le prix du lot est hors port : le port est déjà inclus dans coutTotal.
    GREATEST(c."coutTotal" - COALESCE(c."fraisLivraison", 0), 0),
    c."createdAt",
    c."userId"
FROM "public"."Commande" c;

UPDATE "public"."Article" a
   SET "lotId" = l."id"
  FROM "public"."Lot" l
 WHERE l."commandeId" = a."commandeId"
   AND a."lotId" IS NULL;
