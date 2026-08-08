-- Cloisonnement par utilisateur (08/08/2026).
--
-- ⚠️  MIGRATION ÉCRITE À LA MAIN — ne pas la régénérer avec `prisma migrate dev`
--     ni `prisma db push` : ils produisent un DROP COLUMN "photosPretes",
--     colonne présente en base mais volontairement absente du schéma Prisma
--     (cf. CLAUDE.md et l'en-tête du baseline 20260725000000_init).
--
-- Ce que fait cette migration :
--   1. deux champs d'identité sur User (prenom, plan)
--   2. userId nullable sur Article / Commande / PromptTemplate
--   3. backfill de tout l'existant vers le compte le plus ancien
--   4. passage en NOT NULL + clés étrangères
--   5. le SKU passe d'unique GLOBAL à unique PAR UTILISATEUR

-- ── 1. Identité utilisateur ──────────────────────────────────────────────────
ALTER TABLE "public"."User" ADD COLUMN "prenom" TEXT;
ALTER TABLE "public"."User" ADD COLUMN "plan" TEXT;

-- ── 2. Colonnes de rattachement, d'abord nullables ───────────────────────────
ALTER TABLE "public"."Article" ADD COLUMN "userId" TEXT;
ALTER TABLE "public"."Commande" ADD COLUMN "userId" TEXT;
ALTER TABLE "public"."PromptTemplate" ADD COLUMN "userId" TEXT;

-- ── 3. Backfill ──────────────────────────────────────────────────────────────
-- Garde-fou : sans utilisateur en base, le NOT NULL de l'étape 4 échouerait sur
-- une violation de contrainte illisible. On échoue ici, avec un message clair.
DO $$
DECLARE
  nb_users INTEGER;
  nb_lignes INTEGER;
BEGIN
  SELECT count(*) INTO nb_users FROM "public"."User";
  SELECT count(*) INTO nb_lignes FROM "public"."Article";

  IF nb_users = 0 AND nb_lignes > 0 THEN
    RAISE EXCEPTION
      'Aucun utilisateur en base alors que % articles existent. Créer le compte propriétaire (node scripts/init-user.mjs) avant de rejouer cette migration.',
      nb_lignes;
  END IF;
END $$;

-- Tout l'existant appartient au compte le plus ancien. Pas d'id en dur : la
-- sous-requête reste juste si la migration est rejouée sur une autre base.
UPDATE "public"."Article"
   SET "userId" = (SELECT "id" FROM "public"."User" ORDER BY "createdAt" ASC LIMIT 1)
 WHERE "userId" IS NULL;

UPDATE "public"."Commande"
   SET "userId" = (SELECT "id" FROM "public"."User" ORDER BY "createdAt" ASC LIMIT 1)
 WHERE "userId" IS NULL;

UPDATE "public"."PromptTemplate"
   SET "userId" = (SELECT "id" FROM "public"."User" ORDER BY "createdAt" ASC LIMIT 1)
 WHERE "userId" IS NULL;

-- ── 4. Verrouillage ──────────────────────────────────────────────────────────
ALTER TABLE "public"."Article" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "public"."Commande" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "public"."PromptTemplate" ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "public"."Article"
  ADD CONSTRAINT "Article_userId_fkey" FOREIGN KEY ("userId")
  REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."Commande"
  ADD CONSTRAINT "Commande_userId_fkey" FOREIGN KEY ("userId")
  REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."PromptTemplate"
  ADD CONSTRAINT "PromptTemplate_userId_fkey" FOREIGN KEY ("userId")
  REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 5. Le SKU devient unique par utilisateur ─────────────────────────────────
-- Sans cela, le second compte ne pourrait pas avoir son propre PRL-001.
DROP INDEX "public"."Article_sku_key";
CREATE UNIQUE INDEX "Article_userId_sku_key" ON "public"."Article"("userId" ASC, "sku" ASC);

-- ── 6. Index de rattachement ─────────────────────────────────────────────────
CREATE INDEX "Article_userId_idx" ON "public"."Article"("userId" ASC);
CREATE INDEX "Commande_userId_idx" ON "public"."Commande"("userId" ASC);
CREATE INDEX "PromptTemplate_userId_idx" ON "public"."PromptTemplate"("userId" ASC);

-- `estDefaut` n'est plus un singleton global mais un singleton par utilisateur :
-- l'index simple ne sert plus à rien, le composite évite un scan complet.
DROP INDEX "public"."PromptTemplate_estDefaut_idx";
CREATE INDEX "PromptTemplate_userId_estDefaut_idx" ON "public"."PromptTemplate"("userId" ASC, "estDefaut" ASC);
