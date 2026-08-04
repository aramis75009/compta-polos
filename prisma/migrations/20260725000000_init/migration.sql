-- Baseline initialisé le 25/07/2026 depuis l'état réel de la base Neon.
-- La base avait été créée via `prisma db push` (pas de migration history).
-- Ce baseline capture l'état exact au moment de l'ajout de la feature Orbite.
--
-- ⚠️  photosPretes : colonne présente en base (bool, default false) mais
--     VOLONTAIREMENT absente du schéma Prisma. Ne JAMAIS la supprimer.
--     Toute future migration doit vérifier qu'aucun DROP COLUMN photosPretes
--     n'est généré. Si c'est le cas, STOPPER et signaler.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."CompteVente" AS ENUM ('VINTED_PRO', 'VINTED_SECOND', 'VESTIAIRE_COLLECTIVE');

-- CreateTable
CREATE TABLE "public"."Article" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "marque" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "grade" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'En stock',
    "prixAchat" DOUBLE PRECISION NOT NULL,
    "prixVente" DOUBLE PRECISION,
    "margeNette" DOUBLE PRECISION,
    "coefficient" DOUBLE PRECISION,
    "dateVente" TIMESTAMP(3),
    "commandeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "margeBrute" DOUBLE PRECISION,
    "transporteur" TEXT,
    "trelloCardId" TEXT,
    "canal" TEXT DEFAULT 'Vinted',
    "photosPretes" BOOLEAN NOT NULL DEFAULT false,
    "descriptionAnnonce" TEXT,
    "motsClesAnnonce" TEXT,
    "titreAnnonce" TEXT,
    "lot" TEXT,
    "compteVente" "public"."CompteVente",

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Commande" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fournisseur" TEXT NOT NULL,
    "coutTotal" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categorie" TEXT,
    "grade" TEXT,
    "marque" TEXT,
    "nbArticles" INTEGER NOT NULL,
    "coefObjectif" DOUBLE PRECISION DEFAULT 2.5,

    CONSTRAINT "Commande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PromptTemplate" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "marque" TEXT,
    "categorie" TEXT,
    "contenu" TEXT NOT NULL,
    "estDefaut" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resetToken" TEXT,
    "resetTokenExp" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Article_commandeId_idx" ON "public"."Article"("commandeId" ASC);

-- CreateIndex
CREATE INDEX "Article_dateVente_idx" ON "public"."Article"("dateVente" ASC);

-- CreateIndex
CREATE INDEX "Article_lot_idx" ON "public"."Article"("lot" ASC);

-- CreateIndex
CREATE INDEX "Article_marque_idx" ON "public"."Article"("marque" ASC);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "Article_sku_key" ON "public"."Article"("sku" ASC);

-- CreateIndex
CREATE INDEX "Article_statut_idx" ON "public"."Article"("statut" ASC);

-- CreateIndex
CREATE INDEX "Article_trelloCardId_idx" ON "public"."Article"("trelloCardId" ASC);

-- CreateIndex
CREATE INDEX "PromptTemplate_categorie_idx" ON "public"."PromptTemplate"("categorie" ASC);

-- CreateIndex
CREATE INDEX "PromptTemplate_estDefaut_idx" ON "public"."PromptTemplate"("estDefaut" ASC);

-- CreateIndex
CREATE INDEX "PromptTemplate_marque_idx" ON "public"."PromptTemplate"("marque" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- AddForeignKey
ALTER TABLE "public"."Article" ADD CONSTRAINT "Article_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "public"."Commande"("id") ON DELETE SET NULL ON UPDATE CASCADE;
