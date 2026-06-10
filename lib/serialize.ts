import { prixUnitaire } from "./calc";
import type { ArticleDTO } from "./types";
import type { Prisma } from "@prisma/client";

export type ArticleWithCommande = Prisma.ArticleGetPayload<{
  include: { commande: true };
}>;

/** Convertit un article Prisma (+ sa commande) en DTO renvoyé par l'API. */
export function toDTO(a: ArticleWithCommande): ArticleDTO {
  return {
    id: a.id,
    sku: a.sku,
    marque: a.marque,
    categorie: a.categorie,
    grade: a.grade,
    statut: a.statut,
    prixAchat: a.prixAchat,
    prixVente: a.prixVente,
    margeBrute: a.margeBrute,
    margeNette: a.margeNette,
    coefficient: a.coefficient,
    dateVente: a.dateVente ? a.dateVente.toISOString() : null,
    transporteur: a.transporteur,
    trelloCardId: a.trelloCardId,
    commandeId: a.commandeId,
    prixUnitaire: a.commande
      ? prixUnitaire(a.commande.coutTotal, a.commande.nbArticles)
      : null,
  };
}
