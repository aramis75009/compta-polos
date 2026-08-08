-- Deux modes de saisie des commandes (08/08/2026).
--
-- ⚠️  MIGRATION ÉCRITE À LA MAIN — ne pas la régénérer avec `prisma migrate dev`
--     ni `prisma db push` : ils produisent un DROP COLUMN "photosPretes"
--     (cf. CLAUDE.md et l'en-tête du baseline 20260725000000_init).
--
-- Contexte : `Article.prixAchat` est déjà une colonne par article, le modèle
-- supportait donc nativement des prix hétérogènes. Seule la logique de création
-- imposait l'uniformité. Ces deux colonnes rendent le mode explicite.

-- Part du coût total correspondant au transport. Nullable : les commandes
-- existantes n'ont jamais distingué le port du reste.
ALTER TABLE "public"."Commande" ADD COLUMN "fraisLivraison" DOUBLE PRECISION;

-- LISSE = comportement historique. Le défaut vaut rétroactivement pour les
-- 7 commandes existantes, dont les articles portent bien un prix uniforme.
ALTER TABLE "public"."Commande" ADD COLUMN "modeSaisie" TEXT NOT NULL DEFAULT 'LISSE';
