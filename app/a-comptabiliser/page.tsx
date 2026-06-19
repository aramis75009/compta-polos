"use client";

import { useMemo, useState } from "react";
import {
  useArticles,
  useComptabiliser,
  useDeleteArticle,
  useUpdateArticle,
} from "@/lib/hooks";
import { euros, naturalSort, STATUT_A_COMPTABILISER } from "@/lib/calc";
import type { ArticleDTO } from "@/lib/types";
import SellModal from "@/components/SellModal";
import StatutBadge from "@/components/StatutBadge";

const IconTrash = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    className="h-4 w-4"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
  </svg>
);

const IconRefresh = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    className="h-4 w-4"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
  </svg>
);

export default function AComptabiliserPage() {
  const { data: articles = [], isLoading, isError, error } = useArticles({
    statut: STATUT_A_COMPTABILISER,
  });
  // Tri naturel des SKU (l'API ne trie plus côté serveur).
  const sorted = useMemo(
    () => [...articles].sort((a, b) => naturalSort(a.sku, b.sku)),
    [articles],
  );
  const valider = useComptabiliser();
  const remettreEnStock = useUpdateArticle();
  const supprimer = useDeleteArticle();
  const [target, setTarget] = useState<ArticleDTO | null>(null);
  const [toDelete, setToDelete] = useState<ArticleDTO | null>(null);

  const confirm = (prixVente: number, dateVenteISO: string, canal: string) => {
    if (!target) return;
    valider.mutate(
      { id: target.id, prixVente, dateVente: dateVenteISO, canal },
      { onSuccess: () => setTarget(null) },
    );
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    supprimer.mutate(toDelete.id, { onSuccess: () => setToDelete(null) });
  };

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-error md:text-4xl">
          À comptabiliser
        </h1>
        <p className="mt-1 text-sm text-ink-muted md:text-base">
          Articles livrés en attente de validation comptable.
        </p>
      </header>

      {/* Vue cartes mobile (< md) */}
      <div className="space-y-3 md:hidden">
        {isLoading && (
          <p className="rounded-card border border-line bg-surface px-4 py-6 text-center text-ink-faint shadow-card">
            Chargement…
          </p>
        )}
        {isError && (
          <p className="rounded-card border border-line bg-surface px-4 py-6 text-center text-error shadow-card">
            {(error as Error).message}
          </p>
        )}
        {!isLoading && !isError && articles.length === 0 && (
          <p className="rounded-card border border-line bg-surface px-4 py-6 text-center text-ink-faint shadow-card">
            Rien à comptabiliser. 🎉
          </p>
        )}
        {sorted.map((a) => (
          <div
            key={a.id}
            className="rounded-card border border-line bg-surface p-4 shadow-card"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono font-semibold text-ink">
                {a.sku}
              </span>
              <StatutBadge statut={a.statut} />
            </div>
            <dl className="mt-3 space-y-1.5 text-body-md">
              <div className="flex justify-between gap-2">
                <dt className="text-ink-faint">Marque</dt>
                <dd className="text-ink">{a.marque}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-faint">Catégorie</dt>
                <dd className="text-ink-muted">{a.categorie}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-faint">Prix achat</dt>
                <dd className="text-ink">{euros(a.prixAchat)}</dd>
              </div>
            </dl>
            <div className="mt-4 space-y-2">
              <button
                onClick={() => setTarget(a)}
                className="w-full rounded-full bg-primary px-4 py-3 text-label-sm font-medium text-on-primary transition-colors hover:bg-primary-dark"
              >
                Valider
              </button>
              <button
                onClick={() =>
                  remettreEnStock.mutate({
                    id: a.id,
                    patch: { statut: "En stock" },
                  })
                }
                disabled={
                  remettreEnStock.isPending &&
                  remettreEnStock.variables?.id === a.id
                }
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-mint/40 bg-mint/10 px-4 py-3 text-label-sm font-medium text-primary transition-colors hover:bg-mint/20 disabled:opacity-50"
              >
                {IconRefresh}
                Remettre en stock
              </button>
              <button
                onClick={() => setToDelete(a)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-error/30 bg-error/10 px-4 py-3 text-label-sm font-medium text-error transition-colors hover:bg-error/20"
              >
                {IconTrash}
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Tableau (≥ md) */}
      <div className="hidden overflow-x-auto rounded-card border border-line bg-surface shadow-card md:block">
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
            {sorted.map((a) => (
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
                <td className="px-6 py-3.5">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setTarget(a)}
                      className="rounded-full bg-primary px-4 py-1.5 text-label-sm font-medium text-on-primary transition-colors hover:bg-primary-dark"
                    >
                      Valider
                    </button>
                    <button
                      onClick={() =>
                        remettreEnStock.mutate({
                          id: a.id,
                          patch: { statut: "En stock" },
                        })
                      }
                      disabled={
                        remettreEnStock.isPending &&
                        remettreEnStock.variables?.id === a.id
                      }
                      className="inline-flex items-center gap-1.5 rounded-full border border-mint/40 bg-mint/10 px-3 py-1.5 text-label-sm font-medium text-primary transition-colors hover:bg-mint/20 disabled:opacity-50"
                    >
                      {IconRefresh}
                      Remettre en stock
                    </button>
                    <button
                      onClick={() => setToDelete(a)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-error/30 bg-error/10 px-3 py-1.5 text-label-sm font-medium text-error transition-colors hover:bg-error/20"
                    >
                      {IconTrash}
                      Supprimer
                    </button>
                  </div>
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

      {toDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !supprimer.isPending && setToDelete(null)}
        >
          <div
            className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-headline-md text-ink">Supprimer l’article</h2>
            <p className="mt-2 text-body-md text-ink-muted">
              Supprimer l’article{" "}
              <span className="font-mono text-ink">{toDelete.sku}</span> ? Cette
              action est irréversible.
            </p>
            {supprimer.isError && (
              <p className="mt-3 text-body-sm text-error">
                {(supprimer.error as Error).message}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setToDelete(null)}
                disabled={supprimer.isPending}
                className="rounded-full bg-surface-soft px-4 py-1.5 text-label-sm font-medium text-ink-muted transition-colors hover:bg-line disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                disabled={supprimer.isPending}
                className="rounded-full bg-error px-4 py-1.5 text-label-sm font-medium text-white transition-colors hover:bg-error/90 disabled:opacity-50"
              >
                {supprimer.isPending ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
