-- Avancement du parcours de démarrage (08/08/2026).
--
-- ⚠️  MIGRATION ÉCRITE À LA MAIN — cf. l'en-tête de 20260808150000_user_settings.
--
-- Le message d'accueil vivait dans le localStorage (`myflip_welcomed`) : il ne
-- survivait pas à un changement d'appareil et ne pouvait pas mémoriser où l'on
-- en était. Le parcours de configuration Trello compte plusieurs étapes, dont
-- certaines se font sur Trello : il faut pouvoir s'arrêter et reprendre.

ALTER TABLE "public"."UserSettings"
  ADD COLUMN "onboardingEtape" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "onboardingTermine" BOOLEAN NOT NULL DEFAULT false;

-- Les comptes qui ont déjà un board Trello configuré ont, de fait, terminé le
-- parcours : leur imposer le tutoriel serait absurde.
UPDATE "public"."UserSettings"
   SET "onboardingTermine" = true
 WHERE "trelloBoardId" IS NOT NULL;
