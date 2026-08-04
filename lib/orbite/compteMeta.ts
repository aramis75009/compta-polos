// Métadonnées des comptes de vente.
//
// ⚠️ Le nombre d'avis n'est PAS en base et ne peut pas l'être : Vinted n'expose
// aucune API publique, et scraper la plateforme expose à un bannissement du
// compte. Ces valeurs sont donc une SAISIE MANUELLE assumée — à mettre à jour
// ici à la main quand le compteur d'avis bouge. Ne jamais tenter de les
// récupérer automatiquement.

import type { CompteVente } from "@prisma/client";

export type CompteMeta = {
  /** Nom affiché dans la scène et le panneau de détail. */
  label: string;
  /** Avis publics du compte, relevés à la main. Pilote la taille de la lune. */
  avis: number;
};

/** Clé = valeur de l'enum Prisma `CompteVente`, en minuscules. */
export const COMPTE_META: Record<string, CompteMeta> = {
  vinted_pro: { label: "Compte Pro", avis: 700 },
  vinted_second: { label: "Secondaire", avis: 400 },
  vestiaire_collective: { label: "Vestiaire", avis: 0 },
};

/** Compte non renseigné (ventes antérieures au champ `compteVente`). */
export const COMPTE_INCONNU: CompteMeta = { label: "Non attribué", avis: 0 };

/** Identifiant stable d'un compte pour la scène (enum → clé minuscule). */
export function compteId(compte: CompteVente | null): string {
  return compte ? compte.toLowerCase() : "inconnu";
}

/** Métadonnées d'un compte, avec repli sur « Non attribué ». */
export function compteMeta(compte: CompteVente | null): CompteMeta {
  return metaFromId(compteId(compte));
}

/** Métadonnées à partir de l'identifiant de scène déjà normalisé. */
export function metaFromId(id: string): CompteMeta {
  return COMPTE_META[id] ?? COMPTE_INCONNU;
}

/**
 * Rayon relatif de la lune à partir des avis : 0.5 de base, +1 pour 1000 avis,
 * borné à 1.4 pour qu'aucune lune n'écrase la planète.
 */
export function sizeFromAvis(avis: number): number {
  return Math.min(1.4, Math.max(0.5, 0.5 + avis / 1000));
}
