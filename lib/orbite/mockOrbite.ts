// Données mockées de la scène Orbite.
//
// La page consomme désormais /api/orbite (données réelles) ; ce fichier reste
// la référence de forme et sert de jeu d'essai pour développer la scène 3D
// sans base (importer `mockOrbite` à la place de la query).

import {
  ventePositionFromId,
  type OrbiteData,
  type OrbiteVente,
} from "./types";

export type {
  OrbiteCenter,
  OrbiteCompte,
  OrbiteData,
  OrbiteMarque,
  OrbiteMarqueArticle,
  OrbiteSelection,
  OrbiteVente,
} from "./types";

/** Fabrique un point de vente mocké, position dérivée de l'id comme côté API. */
function vente(
  id: string,
  sku: string,
  prixVente: number,
  prixAchat: number,
  compteVente: string,
): OrbiteVente {
  const margeNette = prixVente - prixAchat - prixVente * 0.0638;
  return {
    id,
    sku,
    position: ventePositionFromId(id),
    prixVente,
    margeNette: Math.round(margeNette * 100) / 100,
    coefficient: Math.round((prixVente / prixAchat) * 100) / 100,
    canal: "Vinted",
    compteVente,
    dateVente: `2026-07-${String(10 + (id.length % 15)).padStart(2, "0")}T12:00:00.000Z`,
  };
}

export const mockOrbite: OrbiteData = {
  center: { label: "MyFlip", caTotal: 1246.35, ventesTotal: 96 },

  comptes: [
    {
      id: "vinted_pro",
      label: "Compte Pro",
      avis: 700,
      ca: 834.05,
      ventes: 64,
      panierMoyen: 18.56,
      size: 1.0,
    },
    {
      id: "vinted_second",
      label: "Secondaire",
      avis: 400,
      ca: 412.3,
      ventes: 32,
      panierMoyen: 12.88,
      size: 0.62,
    },
  ],

  marques: [
    {
      nom: "Ralph Lauren",
      ca: 520,
      ventes: 28,
      rentable: true,
      coefMoyen: 3.42,
      margeNetteMoyenne: 12.8,
      topArticles: [
        { sku: "PRL8", prixVente: 32, statut: "Vendu" },
        { sku: "PRL23", prixVente: 28, statut: "Vendu" },
        { sku: "PRL34", prixVente: 25, statut: "Vendu" },
      ],
    },
    {
      nom: "Lacoste",
      ca: 340,
      ventes: 19,
      rentable: true,
      coefMoyen: 3.05,
      margeNetteMoyenne: 10.4,
      topArticles: [
        { sku: "LAC37", prixVente: 27, statut: "Vendu" },
        { sku: "LAC19", prixVente: 22, statut: "Vendu" },
        { sku: "LAC4", prixVente: 20, statut: "Vendu" },
      ],
    },
    {
      nom: "Adidas",
      ca: 210,
      ventes: 17,
      rentable: false,
      coefMoyen: 1.68,
      margeNetteMoyenne: -1.2,
      topArticles: [
        { sku: "ADI51", prixVente: 18, statut: "Vendu" },
        { sku: "ADI17", prixVente: 15, statut: "Vendu" },
        { sku: "ADI36", prixVente: 12, statut: "Vendu" },
      ],
    },
    {
      nom: "Tommy Hilfiger",
      ca: 180,
      ventes: 12,
      rentable: true,
      coefMoyen: 2.74,
      margeNetteMoyenne: 8.1,
      topArticles: [
        { sku: "TH12", prixVente: 24, statut: "Vendu" },
        { sku: "TH25", prixVente: 19, statut: "Vendu" },
        { sku: "TH3", prixVente: 16, statut: "Vendu" },
      ],
    },
    {
      nom: "Mix",
      ca: 120,
      ventes: 13,
      rentable: false,
      coefMoyen: 1.41,
      margeNetteMoyenne: -0.6,
      topArticles: [
        { sku: "MIX7", prixVente: 14, statut: "Vendu" },
        { sku: "MIX2", prixVente: 11, statut: "Vendu" },
        { sku: "MIX9", prixVente: 9, statut: "Vendu" },
      ],
    },
    {
      nom: "COOGI",
      ca: 85,
      ventes: 7,
      rentable: true,
      coefMoyen: 2.9,
      margeNetteMoyenne: 7.4,
      topArticles: [
        { sku: "COO15", prixVente: 21, statut: "Vendu" },
        { sku: "COO3", prixVente: 17, statut: "Vendu" },
        { sku: "COO8", prixVente: 13, statut: "Vendu" },
      ],
    },
  ],

  ventesRecentes: [
    vente("v1", "PRL8", 32, 9, "VINTED_PRO"),
    vente("v2", "LAC37", 27, 9, "VINTED_PRO"),
    vente("v3", "ADI51", 18, 11, "VINTED_SECOND"),
    vente("v4", "TH12", 24, 9, "VINTED_PRO"),
    vente("v5", "PRL23", 28, 9, "VINTED_PRO"),
    vente("v6", "COO15", 21, 8, "VINTED_SECOND"),
    vente("v7", "LAC19", 22, 9, "VINTED_PRO"),
    vente("v8", "ADI17", 15, 11, "VINTED_SECOND"),
    vente("v9", "PRL34", 25, 9, "VINTED_PRO"),
    vente("v10", "TH25", 19, 9, "VINTED_PRO"),
    vente("v11", "MIX7", 14, 10, "VINTED_SECOND"),
    vente("v12", "COO3", 17, 8, "VINTED_PRO"),
    vente("v13", "LAC4", 20, 9, "VINTED_PRO"),
    vente("v14", "ADI36", 12, 11, "VINTED_SECOND"),
  ],
};
