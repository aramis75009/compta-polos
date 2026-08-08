-- Réglages et secrets par utilisateur (08/08/2026).
--
-- ⚠️  MIGRATION ÉCRITE À LA MAIN — ne pas la régénérer avec `prisma migrate dev`
--     ni `prisma db push` : ils produisent un DROP COLUMN "photosPretes"
--     (cf. CLAUDE.md et l'en-tête du baseline 20260725000000_init).
--
-- Contexte : les clés IA et l'accès Trello vivaient dans les variables
-- d'environnement du déploiement, donc communes à tous les comptes. Le webhook
-- Trello comparait le board reçu à un `TRELLO_BOARD_ID` unique — impossible à
-- deux utilisateurs. Cette table porte les réglages par compte.
--
-- Les colonnes de secrets contiennent du chiffré (AES-256-GCM, lib/crypto.ts),
-- jamais du clair. Les identifiants de board et d'étiquettes restent en clair :
-- ils ne sont pas des secrets et servent de critère de recherche.

CREATE TABLE "public"."UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    "geminiKey" TEXT,
    "anthropicKey" TEXT,
    "openrouterKey" TEXT,

    "trelloKey" TEXT,
    "trelloToken" TEXT,

    "trelloBoardId" TEXT,
    "trelloLabelId" TEXT,
    "trelloComptabiliseLabelId" TEXT,

    "modeleIA" TEXT,
    "objectifMensuel" DOUBLE PRECISION,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- Un seul jeu de réglages par compte.
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "public"."UserSettings"("userId");

-- Clé de routage du webhook Trello : l'appel entrant n'a pas de session, il ne
-- porte que l'id du board. L'unicité garantit qu'il désigne un seul utilisateur.
CREATE UNIQUE INDEX "UserSettings_trelloBoardId_key" ON "public"."UserSettings"("trelloBoardId");

ALTER TABLE "public"."UserSettings"
    ADD CONSTRAINT "UserSettings_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
