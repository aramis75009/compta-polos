// Jetons visuels partagés par les écrans de la mise en vente.
// Relevés sur Direction C : les valeurs au demi-pixel viennent des maquettes,
// pas de tailwind.config.ts, qui décrit encore l'ancien design.

export const cardCls =
  "rounded-[20px] border border-[var(--border)] bg-surface shadow-[var(--shadow)]";

export const labelCls =
  "text-[11.5px] font-bold uppercase tracking-[0.05em] text-[var(--faint)]";

export const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-surface px-3.5 py-2.5 text-[14px] text-[var(--ink)] outline-none transition-colors focus:border-[var(--acc)]";

export const btnGhost =
  "inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--border)] bg-surface px-4 text-[13.5px] font-semibold text-[var(--ink2)] transition-colors hover:border-[var(--border-strong)]";

/** Chip de sélection (marque, catégorie, taille, état, matière). 44px = cible tactile. */
export function Chip({
  value,
  active,
  onClick,
}: {
  value: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-[44px] items-center justify-center rounded-xl border-[1.5px] px-4 text-[13.5px] font-semibold transition-all ${
        active
          ? "border-[var(--acc)] bg-[var(--acc)] text-[var(--acc-ink)] shadow-[var(--shadow)]"
          : "border-[var(--border)] bg-surface text-[var(--ink2)] hover:border-[var(--border-strong)]"
      }`}
    >
      {value}
    </button>
  );
}
