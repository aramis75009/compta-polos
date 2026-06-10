// Couleurs de badge par statut (classes Tailwind : fond + texte).
// Utilisé par le tableau Stock (select stylé en badge) et le ChatBot.
export const STATUT_BADGE: Record<string, string> = {
  "En stock": "bg-surface-container text-ink-muted",
  "En vente": "bg-mint/15 text-primary",
  "En livraison": "bg-[#e8f4ff] text-[#1a4fa0]",
  Vendu: "bg-primary/10 text-primary",
  "En lavage": "bg-amber-50 text-amber-700",
  Litige: "bg-error-container text-on-error-container",
  Perdu: "bg-surface-container text-ink-faint",
  Fake: "bg-error-container text-on-error-container",
};

export function statutBadge(statut: string): string {
  return STATUT_BADGE[statut] ?? "bg-surface-container text-ink-muted";
}
