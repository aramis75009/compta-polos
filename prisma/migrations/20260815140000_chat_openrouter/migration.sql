-- L'assistant conversationnel (la bulle) passe par OpenRouter (15/08/2026).
--
-- ⚠️  MIGRATION ÉCRITE À LA MAIN — cf. l'en-tête de 20260808150000_user_settings.
--     `prisma migrate dev` et `prisma db push` produisent un
--     DROP COLUMN "photosPretes" et un DROP COLUMN "geminiKey" : les refuser.
--
-- Contexte : jusqu'ici, `/api/chat` appelait l'API Anthropic directement avec
-- `UserSettings.anthropicKey`. Il appelle désormais OpenRouter, comme la
-- génération d'annonces, avec `openrouterKey`. `modeleChatIA` porte le choix
-- de modèle de l'assistant — séparé de `modeleIA` (annonces) parce que les
-- deux catalogues n'ont pas les mêmes exigences (cf. `lib/modelesIA.ts`).
--
-- AUCUNE COLONNE N'EST SUPPRIMÉE. `anthropicKey` n'est plus lue mais reste en
-- base, comme `geminiKey` avant elle.

ALTER TABLE "public"."UserSettings"
    ADD COLUMN "modeleChatIA" TEXT;
