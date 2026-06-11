import { statutColor } from "@/lib/statutColors";

// Badge de statut en lecture seule (couleurs en style inline).
export default function StatutBadge({ statut }: { statut: string }) {
  const c = statutColor(statut);
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-label-sm font-medium"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {statut}
    </span>
  );
}
