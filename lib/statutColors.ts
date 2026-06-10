// Couleurs de statut en HEX (styles inline) — PAS de classes Tailwind dynamiques,
// car le JIT de Tailwind ne les compile pas en production (Vercel).
export type StatutColor = { bg: string; text: string };

export const STATUT_COLORS: Record<string, StatutColor> = {
  "En stock": { bg: "#FFF9C4", text: "#856400" },
  "En vente": { bg: "#DBEAFE", text: "#1D4ED8" },
  "En livraison": { bg: "#FFEDD5", text: "#C2410C" },
  "À comptabiliser": { bg: "#FEE2E2", text: "#DC2626" },
  Vendu: { bg: "#DCFCE7", text: "#16A34A" },
  "En lavage": { bg: "#E0F2FE", text: "#0369A1" },
  Litige: { bg: "#FEF3C7", text: "#D97706" },
  Perdu: { bg: "#F3F4F6", text: "#6B7280" },
  Fake: { bg: "#F3E8FF", text: "#7E22CE" },
};

export function statutColor(statut: string): StatutColor {
  return STATUT_COLORS[statut] ?? { bg: "#F3F4F6", text: "#6B7280" };
}
