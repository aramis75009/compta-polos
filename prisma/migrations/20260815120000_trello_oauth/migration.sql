-- Connexion Trello par OAuth 1.0a (15/08/2026).
--
-- ⚠️  MIGRATION ÉCRITE À LA MAIN — cf. l'en-tête de 20260808150000_user_settings.
--     `prisma migrate dev` et `prisma db push` produisent un
--     DROP COLUMN "photosPretes" et un DROP COLUMN "geminiKey" : les refuser.
--
-- Contexte : l'utilisateur devait copier une clé d'API, un jeton et un secret
-- depuis trello.com/app-key. Il clique désormais sur « Connecter Trello » et
-- autorise MyFlip chez Trello ; le jeton ne transite jamais par le navigateur.
--
-- Trello n'a pas d'OAuth 2.0 sur son API REST. L'autre flux (`/1/authorize`) ne
-- sait rendre le jeton qu'au navigateur, d'où le choix d'OAuth 1.0a.
--
-- AUCUNE COLONNE N'EST SUPPRIMÉE. `trelloKey`, `trelloToken` et `trelloSecret`
-- portent les connexions HÉRITÉES — celles saisies à la main avant cette date —
-- et restent lues tant qu'un compte en dépend.

ALTER TABLE "public"."UserSettings"
    -- Jeton d'accès de l'utilisateur, chiffré (AES-256-GCM, lib/crypto.ts).
    ADD COLUMN "trelloOauthToken"         TEXT,
    -- Secret du jeton d'accès, chiffré. Inutilisé aujourd'hui (les appels
    -- passent par key/token), conservé parce qu'il ne se récupère plus après
    -- coup et qu'il est indispensable si l'on doit signer les requêtes.
    ADD COLUMN "trelloOauthTokenSecret"   TEXT,

    -- Jeton de requête, éphémère : il ne vit qu'entre la redirection vers
    -- Trello et le retour. En clair — c'est un identifiant public, que Trello
    -- nous renvoie lui-même dans l'URL de callback.
    ADD COLUMN "trelloOauthRequestToken"  TEXT,
    -- Son secret, lui, est chiffré : il signe l'échange final.
    ADD COLUMN "trelloOauthRequestSecret" TEXT,
    -- Péremption du jeton de requête. Avec le rattachement au userId, c'est la
    -- protection CSRF : passé ce délai, un retour de Trello est refusé même si
    -- le jeton correspond.
    ADD COLUMN "trelloOauthExpire"        TIMESTAMP(3),

    -- Identité du compte Trello connecté, pour l'afficher (« connecté en tant
    -- que … »). Non secrète.
    ADD COLUMN "trelloMembreId"           TEXT,
    ADD COLUMN "trelloMembreNom"          TEXT,

    -- Webhook enregistré sur le board. Stocké pour pouvoir le SUPPRIMER à la
    -- déconnexion : un webhook orphelin continue de frapper l'application, et
    -- Trello finit par le désactiver au lieu de nous le signaler.
    ADD COLUMN "trelloWebhookId"          TEXT;
