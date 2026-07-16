"use client";

import { useMemo, useState } from "react";
import { Check, RotateCw, Trash2 } from "lucide-react";
import {
  useArticles,
  useComptabiliser,
  useDashboard,
  useDeleteArticle,
  useUpdateArticle,
} from "@/lib/hooks";
import { euros, naturalSort, STATUT_A_COMPTABILISER } from "@/lib/calc";
import Loader from "@/components/Loader";
import type { ArticleDTO } from "@/lib/types";
import SellModal from "@/components/SellModal";
import StatutBadge from "@/components/StatutBadge";

// Petite carte KPI du redesign.
function KpiMini({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[18px] border border-[var(--border)] bg-surface px-[22px] py-5">
      <div
        className={`font-grotesk text-[30px] font-bold tracking-[-0.02em] ${
          accent ? "text-[#2D6A4F]" : "text-[var(--ink)]"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-[12.5px] font-semibold text-[var(--faint)]">
        {label}
      </div>
    </div>
  );
}

export default function AComptabiliserPage() {
  const { data: articles = [], isLoading, isError, error } = useArticles({
    statut: STATUT_A_COMPTABILISER,
  });
  const { data: dashboard } = useDashboard();
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

  const showEmpty = !isLoading && !isError && articles.length === 0;

  return (
    <main className="min-h-screen bg-[var(--bg)] px-5 py-7 text-[var(--ink)] md:px-[38px] md:py-[30px] md:pb-[46px]">
      <header className="mb-[22px]">
        <h1 className="font-grotesk text-[26px] font-bold tracking-[-0.025em] text-[var(--ink)] md:text-[30px]">
          À comptabiliser
        </h1>
        <p className="mt-1.5 text-[14.5px] font-medium text-[var(--muted)]">
          Les ventes en attente de saisie comptable.
        </p>
      </header>

      {/* Mini stats */}
      <div className="mb-[22px] grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiMini
          value={String(articles.length)}
          label="Ventes en attente"
          accent={articles.length === 0}
        />
        <KpiMini
          value={dashboard ? dashboard.vendus.toLocaleString("fr-FR") : "—"}
          label="Ventes comptabilisées"
        />
        <KpiMini value="Temps réel" label="Synchronisation" />
      </div>

      {/* Empty state (synchro auto, pas de bouton) */}
      {showEmpty && (
        <div className="rounded-[24px] border border-[var(--border)] bg-surface px-8 py-[70px] text-center">
          <div
            className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full shadow-[0_16px_30px_-16px_rgba(45,106,79,.55)]"
            style={{
              background:
                "radial-gradient(circle at 30% 25%, #E4F3EA, #CDEAD9)",
              animation: "pop .6s cubic-bezier(.2,.8,.2,1) both",
            }}
          >
            <Check className="h-12 w-12 text-[#1B4332]" strokeWidth={2.6} />
          </div>
          <h2 className="font-grotesk text-[24px] font-bold tracking-[-0.02em] text-[var(--ink)]">
            Tout est à jour !
          </h2>
          <p className="mx-auto mt-2.5 max-w-[400px] text-[14.5px] font-medium leading-[1.55] text-[var(--muted)]">
            Aucune vente n’attend d’être comptabilisée. Les nouvelles ventes
            apparaissent ici automatiquement dès leur synchronisation.
          </p>
        </div>
      )}

      {/* États chargement / erreur */}
      {isLoading && <Loader />}
      {isError && (
        <div className="rounded-[20px] border border-[var(--border)] bg-surface px-6 py-10 text-center text-[#C2603F]">
          {(error as Error).message}
        </div>
      )}

      {/* Liste (s'il y a des éléments en attente) */}
      {!isLoading && !isError && articles.length > 0 && (
        <>
          {/* Vue cartes mobile (< md) */}
          <div className="space-y-3 md:hidden">
            {sorted.map((a) => (
              <div
                key={a.id}
                className="rounded-[18px] border border-[var(--border)] bg-surface p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-grotesk font-bold text-[var(--ink)]">
                    {a.sku}
                  </span>
                  <StatutBadge statut={a.statut} />
                </div>
                <dl className="mt-3 space-y-1.5 text-[14px]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-[var(--faint-2)]">Marque</dt>
                    <dd className="text-[var(--ink)]">{a.marque}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[var(--faint-2)]">Catégorie</dt>
                    <dd className="text-[var(--muted)]">{a.categorie}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[var(--faint-2)]">Prix achat</dt>
                    <dd className="text-[var(--ink)]">{euros(a.prixAchat)}</dd>
                  </div>
                </dl>
                <div className="mt-4 space-y-2">
                  <button
                    onClick={() => setTarget(a)}
                    className="w-full rounded-xl bg-[#1B4332] px-4 py-3 text-[13.5px] font-bold text-white transition-colors hover:bg-[#143528]"
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
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-surface px-4 py-3 text-[13.5px] font-semibold text-[#1B4332] transition-colors hover:bg-[var(--tint)] disabled:opacity-50"
                  >
                    <RotateCw className="h-4 w-4" strokeWidth={2} />
                    Remettre en stock
                  </button>
                  <button
                    onClick={() => setToDelete(a)}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#F3D9CC] bg-[#FBEEE7] px-4 py-3 text-[13.5px] font-semibold text-[#C2603F] transition-colors hover:bg-[#F6E1D6]"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2} />
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Tableau (≥ md) */}
          <div className="hidden overflow-x-auto rounded-[20px] border border-[var(--border)] bg-surface md:block">
            <table className="w-full min-w-[900px] border-collapse text-[14px]">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--tint)] text-left text-[11.5px] font-bold uppercase tracking-[0.05em] text-[var(--faint)]">
                  <th className="px-[22px] py-[15px]">SKU</th>
                  <th className="px-3 py-[15px]">Marque</th>
                  <th className="px-3 py-[15px]">Catégorie</th>
                  <th className="px-3 py-[15px] text-right">Prix achat</th>
                  <th className="px-3 py-[15px]">Transporteur</th>
                  <th className="px-3 py-[15px] text-right">Prix vente</th>
                  <th className="px-3 py-[15px]">Date vente</th>
                  <th className="px-[22px] py-[15px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-[var(--bg)] transition-colors hover:bg-[var(--tint)]"
                  >
                    <td className="px-[22px] py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-grotesk font-bold text-[var(--ink)]">
                          {a.sku}
                        </span>
                        <StatutBadge statut={a.statut} />
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-[var(--ink2)]">{a.marque}</td>
                    <td className="px-3 py-3.5 text-[var(--muted)]">{a.categorie}</td>
                    <td className="px-3 py-3.5 text-right text-[var(--ink2)]">
                      {euros(a.prixAchat)}
                    </td>
                    <td className="px-3 py-3.5 text-[var(--muted)]">
                      {a.transporteur ?? "—"}
                    </td>
                    <td className="px-3 py-3.5 text-right text-[var(--muted)]">
                      {a.prixVente != null ? euros(a.prixVente) : "—"}
                    </td>
                    <td className="px-3 py-3.5 text-[var(--muted)]">
                      {a.dateVente
                        ? new Date(a.dateVente).toLocaleDateString("fr-FR")
                        : "—"}
                    </td>
                    <td className="px-[22px] py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setTarget(a)}
                          className="rounded-full bg-[#1B4332] px-4 py-1.5 text-[12.5px] font-bold text-white transition-colors hover:bg-[#143528]"
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
                          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-[#1B4332] transition-colors hover:bg-[var(--tint)] disabled:opacity-50"
                          title="Remettre en stock"
                        >
                          <RotateCw className="h-3.5 w-3.5" strokeWidth={2} />
                          Remettre en stock
                        </button>
                        <button
                          onClick={() => setToDelete(a)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#F3D9CC] bg-[#FBEEE7] px-3 py-1.5 text-[12.5px] font-semibold text-[#C2603F] transition-colors hover:bg-[#F6E1D6]"
                          title="Supprimer"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

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
            className="w-full max-w-md rounded-[20px] border border-[var(--border)] bg-surface p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-grotesk text-[20px] font-bold text-[var(--ink)]">
              Supprimer l’article
            </h2>
            <p className="mt-2 text-[14px] text-[var(--muted)]">
              Supprimer l’article{" "}
              <span className="font-grotesk font-bold text-[var(--ink)]">
                {toDelete.sku}
              </span>{" "}
              ? Cette action est irréversible.
            </p>
            {supprimer.isError && (
              <p className="mt-3 text-[13px] text-[#C2603F]">
                {(supprimer.error as Error).message}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setToDelete(null)}
                disabled={supprimer.isPending}
                className="rounded-full border border-[var(--border)] bg-surface px-4 py-1.5 text-[13px] font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--tint)] disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                disabled={supprimer.isPending}
                className="rounded-full bg-[#C2603F] px-4 py-1.5 text-[13px] font-bold text-white transition-colors hover:bg-[#A84F31] disabled:opacity-50"
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
