// Badge de canal de vente en lecture seule (pill subtile + pastille colorée,
// style redesign). Couleurs en inline (le JIT Tailwind ne compile pas les
// classes dynamiques). Utilisé uniquement par la page Stock.

type CanalPill = { bg: string; text: string; dot: string };

const CANAL_PILL: Record<string, CanalPill> = {
  Vinted: { bg: "#E2F7F8", text: "#0892A0", dot: "#0BBBC4" },
  "Vinted Go": { bg: "#E6EEFB", text: "#1D4ED8", dot: "#0047AB" },
  "Vestiaire Collective": { bg: "#ECEEF0", text: "#2B3942", dot: "#16261D" },
  Leboncoin: { bg: "#FFEDE5", text: "#C2410C", dot: "#FF6B35" },
  "En main propre": { bg: "#EEF1ED", text: "#52635A", dot: "#6B7280" },
  Autre: { bg: "#EEF1ED", text: "#52635A", dot: "#94A29A" },
};

function canalPill(canal: string): CanalPill {
  return CANAL_PILL[canal] ?? CANAL_PILL.Autre;
}

export default function CanalBadge({ canal }: { canal: string | null }) {
  if (!canal) return <span className="text-[#A6B2A9]">—</span>;
  const c = canalPill(canal);
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12.5px] font-bold"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      <span
        className="h-[7px] w-[7px] flex-shrink-0 rounded-full"
        style={{ backgroundColor: c.dot }}
      />
      {canal}
    </span>
  );
}
