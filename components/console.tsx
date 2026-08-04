// Primitives de mise en page « Direction C — Console tactile », partagées par
// le Dashboard et les Statistiques : les deux écrans posaient jusqu'ici les
// mêmes chaînes de classes, au demi-pixel près, chacun de son côté.
//
// Conventions de la maquette conservées telles quelles : valeurs arbitraires
// (l'échelle Tailwind ne sait pas exprimer 10,5 / 12,5 / 9,5 px) et bascule des
// grilles à `min-[900px]:`, ni `md:` (768) ni `lg:` (1024).

import type { ReactNode } from "react";

/** Conteneur de page : colonne unique, padding et gouttière de la maquette. */
export function Frame({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col gap-[14px] bg-[var(--bg)] p-[14px] text-[var(--ink)] [animation:stepIn_.2s_ease_both] min-[900px]:p-[18px]">
      {children}
    </main>
  );
}

/**
 * Coquille de module : le conteneur récurrent de Direction C (rayon 26,
 * fond `--mod`, filet `--line`). `padding` est passé en classe plutôt qu'en
 * prop numérique parce que la maquette alterne 16 / 18 / 20 / 22 / 24 px selon
 * la densité du contenu, et que `overflow-hidden` doit sauter dès qu'un module
 * contient un tableau à défilement horizontal.
 */
export function Module({
  children,
  className = "p-[18px]",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[26px] border border-[var(--border)] bg-surface ${className}`}
    >
      {children}
    </section>
  );
}

/** Micro-libellé mono : l'étiquette de section de Direction C. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[10.5px] tracking-[0.2em] text-[var(--faint)]">
      {children}
    </div>
  );
}

/**
 * Titre de carte (15px/600), l'autre niveau de titre de la maquette, avec son
 * `aside` mono facultatif. La marge basse varie d'une carte à l'autre : elle
 * passe donc par `className`, qui REMPLACE la valeur par défaut — deux classes
 * `mb-*` concaténées se départageraient à l'ordre de la feuille de style.
 */
export function CardTitle({
  children,
  aside,
  className = "mb-[14px]",
}: {
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${className}`}>
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
        {children}
      </span>
      {aside && (
        <span className="flex-none font-mono text-[10px] text-[var(--faint)]">
          {aside}
        </span>
      )}
    </div>
  );
}
