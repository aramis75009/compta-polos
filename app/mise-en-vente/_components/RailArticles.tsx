"use client";

// Le rail : les 1 à 5 fiches de la session, leur état, et la navigation.
//
// Rendu à partir de 768 px seulement. Sous ce seuil, la page conserve le mode
// mono-article (décision du 11/08/2026 : la mise en vente se fait sur desktop,
// le responsive est un chantier séparé).
//
//   ● PRL1  ✓ prête          ← cliquable, saute à la fiche
//   ● LAC3  ⏳ génération
//   ⚠ ADI7  SKU introuvable
//   ○ TOM2  à compléter
//   [+ ajouter un article]

import { AlertTriangle, Check, Loader2, Plus, X } from "lucide-react";
import {
  fichePrete,
  MAX_FICHES,
  skuEnDoublon,
  type ArticleEnCours,
} from "../_reducer";

type Props = {
  fiches: ArticleEnCours[];
  active: string;
  onActive: (id: string) => void;
  onAjout: () => void;
  onRetrait: (id: string) => void;
};

/** Pastille d'état, à gauche du SKU. */
function Puce({ f, doublon }: { f: ArticleEnCours; doublon: boolean }) {
  if (f.generation.phase === "encours")
    return <Loader2 className="h-[15px] w-[15px] animate-spin text-[var(--acc)]" />;
  if (f.generation.phase === "erreur" || f.lookup.phase === "erreur")
    return <AlertTriangle className="h-[15px] w-[15px] text-[var(--neg)]" />;
  if (f.generation.phase === "ok")
    return <Check className="h-[15px] w-[15px] text-[var(--pos)]" strokeWidth={2.6} />;
  if (doublon)
    return <AlertTriangle className="h-[15px] w-[15px] text-[var(--warn)]" />;
  return (
    <span
      className={`h-[9px] w-[9px] rounded-full ${
        fichePrete(f) ? "bg-[var(--acc)]" : "bg-[var(--border-strong)]"
      }`}
    />
  );
}

/** Une ligne du rail, en clair : ce que l'utilisateur doit comprendre d'un œil. */
function etatLisible(f: ArticleEnCours, doublon: boolean): string {
  if (f.lookup.phase === "encours") return "recherche…";
  if (f.lookup.phase === "erreur") return "SKU introuvable";
  if (f.generation.phase === "encours") return "génération…";
  if (f.generation.phase === "erreur") return "échec";
  if (f.generation.phase === "ok")
    return f.enregistre ? f.enregistre.toLowerCase() : "annonce prête";
  if (doublon) return "SKU en double";
  if (fichePrete(f)) return "prête";
  if (!f.sku.trim()) return "vide";
  return "à compléter";
}

export default function RailArticles({
  fiches,
  active,
  onActive,
  onAjout,
  onRetrait,
}: Props) {
  const doublons = skuEnDoublon(fiches);

  return (
    <div className="hidden w-[210px] flex-none flex-col gap-1.5 md:flex">
      <div className="mb-1 flex items-baseline justify-between px-1">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
          Articles
        </span>
        <span className="font-mono text-[10px] text-[var(--faint)]">
          {fiches.length} / {MAX_FICHES}
        </span>
      </div>

      {fiches.map((f, i) => {
        const doublon = doublons.has(f.sku.trim().toUpperCase());
        const courant = f.id === active;
        return (
          <div
            key={f.id}
            className={`group relative flex items-center gap-2.5 rounded-[14px] border px-3 py-2.5 transition-colors ${
              courant
                ? "border-[var(--acc)] bg-[var(--surface-2)]"
                : "border-[var(--border)] bg-surface hover:border-[var(--border-strong)]"
            }`}
          >
            <button
              type="button"
              onClick={() => onActive(f.id)}
              aria-current={courant}
              className="flex min-h-[36px] flex-1 items-center gap-2.5 text-left"
            >
              <Puce f={f} doublon={doublon} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[12.5px] font-bold text-[var(--ink)]">
                  {f.sku.trim() || `Article ${i + 1}`}
                </span>
                <span className="block truncate text-[11px] text-[var(--faint-2)]">
                  {etatLisible(f, doublon)}
                </span>
              </span>
            </button>
            {fiches.length > 1 && (
              <button
                type="button"
                onClick={() => onRetrait(f.id)}
                aria-label={`Retirer ${f.sku.trim() || `l'article ${i + 1}`}`}
                className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[var(--faint-2)] opacity-0 transition-opacity hover:bg-[var(--tint)] hover:text-[var(--neg)] focus:opacity-100 group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.4} />
              </button>
            )}
          </div>
        );
      })}

      {fiches.length < MAX_FICHES && (
        <button
          type="button"
          onClick={onAjout}
          className="mt-1 flex min-h-[44px] items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-[var(--border-strong)] text-[13px] font-semibold text-[var(--acc)] transition-colors hover:border-[var(--acc)] hover:bg-[var(--surface-2)]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.3} />
          Ajouter
        </button>
      )}
    </div>
  );
}
