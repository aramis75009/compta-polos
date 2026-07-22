// Logique de calcul « façon Excel », partagée entre le serveur (écritures API)
// et le client (aperçus en temps réel). Une seule source de vérité pour les
// formules afin d'éviter toute divergence.

/** Taux appliqué au prix de vente pour obtenir la marge nette (TVA 20% sur marge). */
export const TVA_MARGE = 0.0638;

/** Statut « vendu » : déclenche le calcul des champs de vente. */
export const STATUT_VENDU = "Vendu";

/** Liste ordonnée des statuts possibles d'un article. */
export const STATUTS = [
  "Brouillon",
  "En stock",
  "Photos prêtes",
  "En vente",
  "En livraison",
  "À comptabiliser",
  "Vendu",
  "En lavage",
  "Perdu",
] as const;

/** Statut « à comptabiliser » : article livré, en attente de validation comptable. */
export const STATUT_A_COMPTABILISER = "À comptabiliser";

/** Statut « photos prêtes » : article photographié, prêt pour la mise en vente. */
export const STATUT_PHOTOS_PRETES = "Photos prêtes";

export type Statut = (typeof STATUTS)[number];

/** Préfixes SKU connus par marque ; sinon dérivé des initiales. */
const PREFIXES: Record<string, string> = {
  "polo ralph lauren": "PRL",
  lacoste: "LAC",
  "tommy hilfiger": "TH",
};

/** Calcule le préfixe SKU d'une marque (ex. "Lacoste" -> "LAC"). */
export function skuPrefix(marque: string): string {
  const key = marque.trim().toLowerCase();
  if (PREFIXES[key]) return PREFIXES[key];
  const initials = key
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (initials || marque.slice(0, 3)).toUpperCase().slice(0, 4) || "ART";
}

/** Formate un numéro de SKU sur 3 chiffres (1 -> "001"). */
export function skuNumber(n: number): string {
  return String(n).padStart(3, "0");
}

/** Prix unitaire d'une commande = coût total ÷ nombre d'articles. */
export function prixUnitaire(coutTotal: number, nbArticles: number): number {
  if (!nbArticles) return 0;
  return coutTotal / nbArticles;
}

/** Marge brute = prix de vente - prix d'achat. */
export function margeBrute(prixVente: number, prixAchat: number): number {
  return prixVente - prixAchat;
}

/** Marge nette = prix de vente - prix d'achat - (prix de vente × TVA_MARGE). */
export function margeNette(prixVente: number, prixAchat: number): number {
  return prixVente - prixAchat - prixVente * TVA_MARGE;
}

/** Coefficient = prix de vente ÷ prix d'achat. */
export function coefficient(prixVente: number, prixAchat: number): number {
  if (!prixAchat) return 0;
  return prixVente / prixAchat;
}

/**
 * Recalcule les champs dérivés d'un article selon son statut.
 * Si « Vendu » : marges et coef calculés depuis prixVente/prixAchat.
 * Sinon : tous les champs de vente repassent à null.
 */
export function deriveVente(input: {
  statut: string;
  prixAchat: number;
  prixVente: number | null;
  dateVente: Date | null;
}): {
  prixVente: number | null;
  dateVente: Date | null;
  margeBrute: number | null;
  margeNette: number | null;
  coefficient: number | null;
} {
  if (input.statut === STATUT_VENDU && input.prixVente != null) {
    return {
      prixVente: input.prixVente,
      dateVente: input.dateVente ?? new Date(),
      margeBrute: margeBrute(input.prixVente, input.prixAchat),
      margeNette: margeNette(input.prixVente, input.prixAchat),
      coefficient: coefficient(input.prixVente, input.prixAchat),
    };
  }
  return {
    prixVente: null,
    dateVente: null,
    margeBrute: null,
    margeNette: null,
    coefficient: null,
  };
}

/**
 * Tri naturel des chaînes (ex. SKU) : AD1, AD2…AD9, AD10, AD11, LAC1…
 * Le tri SQL classique donnerait AD1, AD10, AD11, AD2… (ordre lexicographique).
 */
export const naturalSort = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

/** Moyenne arithmétique d'une liste (0 si vide). */
export function moyenne(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Formate un montant en euros (fr-FR). */
export function euros(n: number | null | undefined): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(n ?? 0);
}

/** Formate un coefficient (ex. 2.45x). */
export function coef(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n.toFixed(2)}x`;
}

/** Formate un pourcentage (0.42 -> "42%"). */
export function pourcent(n: number): string {
  return `${Math.round(n * 100)}%`;
}
