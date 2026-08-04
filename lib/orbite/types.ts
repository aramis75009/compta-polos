// Types partagés de la vue Orbite.
// Une seule forme pour les deux sources : le mock (lib/orbite/mockOrbite.ts)
// et l'API réelle (app/api/orbite/route.ts). La scène 3D ne sait pas laquelle
// des deux l'alimente.

/** Le centre de l'univers : la planète. Porte les totaux servant aux ratios. */
export type OrbiteCenter = {
  label: string;
  caTotal: number;
  ventesTotal: number;
};

/** Un compte de vente = une lune. `size` est le rayon relatif (∝ avis). */
export type OrbiteCompte = {
  id: string;
  label: string;
  avis: number;
  ca: number;
  ventes: number;
  panierMoyen: number;
  size: number;
};

/** Article affiché dans le top 3 d'une marque. */
export type OrbiteMarqueArticle = {
  sku: string;
  prixVente: number;
  statut: string;
};

/** Une marque = un anneau orbital. `ca` pilote l'épaisseur, `rentable` la couleur. */
export type OrbiteMarque = {
  nom: string;
  ca: number;
  ventes: number;
  rentable: boolean;
  coefMoyen: number;
  margeNetteMoyenne: number;
  topArticles: OrbiteMarqueArticle[];
};

/** Une vente récente = un point lumineux. `position` est déterministe (dérivée de l'id). */
export type OrbiteVente = {
  id: string;
  sku: string;
  position: [number, number, number];
  prixVente: number;
  margeNette: number;
  coefficient: number;
  canal: string | null;
  compteVente: string | null;
  dateVente: string | null;
};

/** Charge utile complète de la scène. */
export type OrbiteData = {
  center: OrbiteCenter;
  comptes: OrbiteCompte[];
  marques: OrbiteMarque[];
  ventesRecentes: OrbiteVente[];
};

/** Corps sélectionné dans la scène. `id` = id du compte, nom de marque, ou id de vente. */
export type OrbiteSelection = {
  kind: "compte" | "marque" | "vente";
  id: string;
};

// ── Géométrie de la scène ────────────────────────────────────────────────
// Centralisée ici pour que la caméra et les corps s'accordent sur les mêmes
// positions : le focus au clic vise exactement le corps affiché.

/** Rayon de l'orbite d'une lune, par index de compte. */
export function moonOrbitRadius(index: number): number {
  return 3.1 + index * 1.35;
}

/** Vitesse angulaire d'une lune (rad/s) : les orbites lointaines sont plus lentes. */
export function moonSpeed(index: number): number {
  return 0.19 - index * 0.05;
}

/** Angle de départ d'une lune, réparti pour éviter les alignements. */
export function moonStartAngle(index: number): number {
  return index * Math.PI * 0.7;
}

/**
 * Position d'une lune à l'instant `t` (secondes d'horloge de la scène).
 * Fonction pure : la scène, la lune et le contrôleur de caméra l'évaluent
 * indépendamment et tombent toujours d'accord.
 */
export function moonPositionAt(
  index: number,
  t: number,
): [number, number, number] {
  const r = moonOrbitRadius(index);
  const a = moonStartAngle(index) + moonSpeed(index) * t;
  return [Math.cos(a) * r, Math.sin(a * 0.5) * 0.3, Math.sin(a) * r];
}

/** Rayon visuel d'une lune à partir de sa `size` relative. */
export function moonRadius(size: number): number {
  return 0.3 * size;
}

/** Rayon de l'anneau d'une marque, par index (les plus gros CA au plus près). */
export function ringRadius(index: number): number {
  return 1.75 + index * 0.42;
}

/**
 * Inclinaison d'un anneau. Les valeurs alternent franchement de signe : des
 * inclinaisons trop proches empileraient les anneaux en un bandeau illisible.
 */
const RING_TILTS: [number, number][] = [
  [0.16, 0.08],
  [-0.44, 0.32],
  [0.64, -0.24],
  [-0.28, -0.48],
  [0.88, 0.2],
  [-0.62, 0.54],
];

export function ringTilt(index: number): [number, number] {
  return RING_TILTS[index % RING_TILTS.length];
}

/** Hash FNV-1a 32 bits — donne un entier stable à partir d'une chaîne. */
function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Position d'un point de vente, dérivée de son id : même id → même position,
 * entre deux rendus comme entre deux requêtes. Réparti sur une coquille juste
 * au-dessus de la planète (rayon 1) pour rester visible.
 */
export function ventePositionFromId(id: string): [number, number, number] {
  const h = hash32(id);
  const theta = ((h & 0xffff) / 0xffff) * Math.PI * 2;
  const phi = Math.acos(2 * (((h >>> 16) & 0xffff) / 0xffff) - 1);
  const r = 1.3 + (((h >>> 8) & 0xff) / 0xff) * 0.3;
  const round = (n: number) => Math.round(n * 10000) / 10000;
  return [
    round(r * Math.sin(phi) * Math.cos(theta)),
    round(r * Math.cos(phi)),
    round(r * Math.sin(phi) * Math.sin(theta)),
  ];
}
