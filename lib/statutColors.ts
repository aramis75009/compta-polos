// Couleurs de statut en HEX (styles inline) — PAS de classes Tailwind dynamiques,
// car le JIT de Tailwind ne les compile pas en production (Vercel).
export type StatutColor = { bg: string; text: string };

// Palette alignée sur le design MyFlip (Stock.dc.html).
export const STATUT_COLORS: Record<string, StatutColor> = {
  Brouillon:         { bg: "#F1F4EF", text: "#71807A" },
  "En stock":        { bg: "#EAF3ED", text: "#1B4332" },
  "En vente":        { bg: "#E7F0FF", text: "#3B6FD4" },
  "En livraison":    { bg: "#FBF3E2", text: "#B5872E" },
  "À comptabiliser": { bg: "#FBEEE7", text: "#C2603F" },
  Vendu:             { bg: "#E4F3EA", text: "#2D6A4F" },
  "En lavage":       { bg: "#E2F7F8", text: "#0892A0" },
  Perdu:             { bg: "#ECEEF0", text: "#2B3942" },
};

export function statutColor(statut: string): StatutColor {
  return STATUT_COLORS[statut] ?? { bg: "#EEF1ED", text: "#71807A" };
}
