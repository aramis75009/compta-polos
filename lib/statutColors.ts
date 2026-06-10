// Couleurs de badge par statut (classes Tailwind : fond + texte).
// Utilisé par le tableau Stock (select stylé en badge), le ChatBot et les pages.
export const STATUT_BADGE: Record<string, string> = {
  "En stock": "bg-[#FFF9C4] text-[#856400]",
  "En vente": "bg-[#DBEAFE] text-[#1D4ED8]",
  "En livraison": "bg-[#FFEDD5] text-[#C2410C]",
  "À comptabiliser": "bg-[#FEE2E2] text-[#DC2626]",
  Vendu: "bg-[#DCFCE7] text-[#16A34A]",
  "En lavage": "bg-[#E0F2FE] text-[#0369A1]",
  Litige: "bg-[#FEF3C7] text-[#D97706]",
  Perdu: "bg-[#F3F4F6] text-[#6B7280]",
  Fake: "bg-[#F3E8FF] text-[#7E22CE]",
};

export function statutBadge(statut: string): string {
  return STATUT_BADGE[statut] ?? "bg-[#F3F4F6] text-[#6B7280]";
}
