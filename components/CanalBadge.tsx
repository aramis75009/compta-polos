import { canalColor } from "@/lib/canalColors";

// Badge de canal de vente en lecture seule (couleurs en style inline).
export default function CanalBadge({ canal }: { canal: string | null }) {
  if (!canal) return <span className="text-ink-faint">—</span>;
  const c = canalColor(canal);
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-label-sm font-medium"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {canal}
    </span>
  );
}
