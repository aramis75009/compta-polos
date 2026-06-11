"use client";

import { useState } from "react";
import { useArticles, useComptabiliser } from "@/lib/hooks";
import { euros, STATUT_A_COMPTABILISER } from "@/lib/calc";
import type { ArticleDTO } from "@/lib/types";
import SellModal from "@/components/SellModal";
import StatutBadge from "@/components/StatutBadge";

export default function AComptabiliserPage() {
  const { data: articles = [], isLoading, isError, error } = useArticles({
    statut: STATUT_A_COMPTABILISER,
  });
  const valider = useComptabiliser();
  const [target, setTarget] = useState<ArticleDTO | null>(null);

  const confirm = (prixVente: number, dateVenteISO: string, canal: string) => {
    if (!target) return;
    valider.mutate(
      { id: target.id, prixVente, dateVente: dateVenteISO, canal },
      { onSuccess: () => setTarget(null) },
    );
  };

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-8">
      <header className="mb-6">
        <h1 className="text-display-lg text-error">À comptabiliser</h1>
        <p className="mt-1 text-body-md text-ink-muted">
          Articles livrés en attente de validation comptable.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
        <table className="w-full min-w-[900px] border-collapse text-body-md">
          <thead>
            <tr className="text-left text-label-sm uppercase tracking-wide text-ink-faint">
              <th className="sticky left-0 z-10 bg-surface px-6 py-3.5 font-medium">
                SKU
              </th>
              <th className="px-3 py-3.5 font-medium">Marque</th>
              <th className="px-3 py-3.5 font-medium">Catégorie</th>
              <th className="px-3 py-3.5 text-right font-medium">Prix achat</th>
              <th className="px-3 py-3.5 font-medium">Transporteur</th>
              <th className="px-3 py-3.5 text-right font-medium">Prix vente</th>
              <th className="px-3 py-3.5 font-medium">Date vente</th>
              <th className="px-6 py-3.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-ink-faint">
                  Chargement…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-error">
                  {(error as Error).message}
                </td>
              </tr>
            )}
            {!isLoading && !isError && articles.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-ink-faint">
                  Rien à comptabiliser. 🎉
                </td>
              </tr>
            )}
            {articles.map((a) => (
              <tr
                key={a.id}
                className="border-t border-line transition-colors hover:bg-surface-soft"
              >
                <td className="sticky left-0 z-10 bg-surface px-6 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-ink">{a.sku}</span>
                    <StatutBadge statut={a.statut} />
                  </div>
                </td>
                <td className="px-3 py-3.5 text-ink">{a.marque}</td>
                <td className="px-3 py-3.5 text-ink-muted">{a.categorie}</td>
                <td className="px-3 py-3.5 text-right text-ink">
                  {euros(a.prixAchat)}
                </td>
                <td className="px-3 py-3.5 text-ink-muted">
                  {a.transporteur ?? "—"}
                </td>
                <td className="px-3 py-3.5 text-right text-ink-muted">
                  {a.prixVente != null ? euros(a.prixVente) : "—"}
                </td>
                <td className="px-3 py-3.5 text-ink-muted">
                  {a.dateVente
                    ? new Date(a.dateVente).toLocaleDateString("fr-FR")
                    : "—"}
                </td>
                <td className="px-6 py-3.5 text-right">
                  <button
                    onClick={() => setTarget(a)}
                    className="rounded-full bg-primary px-4 py-1.5 text-label-sm font-medium text-on-primary transition-colors hover:bg-primary-dark"
                  >
                    Valider
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SellModal
        open={!!target}
        sku={target?.sku}
        defaultPrix={target?.prixVente}
        defaultCanal={target?.canal}
        pending={valider.isPending}
        error={valider.isError ? (valider.error as Error).message : null}
        onClose={() => setTarget(null)}
        onConfirm={confirm}
      />
    </main>
  );
}
