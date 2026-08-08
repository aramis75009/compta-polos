-- Secret d'API Trello, pour valider la signature des webhooks (08/08/2026).
--
-- ⚠️  MIGRATION ÉCRITE À LA MAIN — cf. l'en-tête de 20260808150000_user_settings.
--
-- L'endpoint `/api/webhooks/trello` est public et non authentifié. Depuis qu'il
-- route les événements vers un compte d'après l'id du board, une requête forgée
-- pourrait faire basculer les articles d'un utilisateur en « À comptabiliser ».
-- La signature `x-trello-webhook` (HMAC-SHA1 du corps + URL de rappel) ferme
-- cette porte. Le secret se trouve sur https://trello.com/app-key — il est
-- distinct de la clé et du token.

ALTER TABLE "public"."UserSettings" ADD COLUMN "trelloSecret" TEXT;
