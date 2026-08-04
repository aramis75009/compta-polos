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
import type { ArticleDTO, CompteVente } from "@/lib/types";
import SellDialog from "@/components/SellDialog";
import StatutBadge from "@/components/StatutBadge";
import { celebrateSale } from "@/lib/celebrate";
import { CardTitle, Frame, Module } from "@/components/console";

/**
 * Module de tête. La maquette remplit d'accent celui qui porte le nombre
 * d'articles en attente — c'est la seule valeur sur laquelle on agit, les
 * deux autres ne font que situer.
 */
function Tete({
  label,
  children,
  accent = false,
}: {
  label: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[22px] p-5 ${
        accent
          ? "bg-[var(--acc)] text-[var(--acc-ink)]"
          : "border border-[var(--border)] bg-surface"
      }`}
    >
      <div
        className={`font-mono text-[9.5px] uppercase tracking-[0.16em] ${
          accent ? "opacity-70" : "text-[var(--faint)]"
        }`}
      >
        {label}
      </div>
      {children}
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

  const confirm = (
    prixVente: number,
    dateVenteISO: string,
    canal: string,
    compteVente: CompteVente,
  ) => {
    if (!target) return;
    valider.mutate(
      { id: target.id, prixVente, dateVente: dateVenteISO, canal, compteVente },
      {
        onSuccess: ({ article }) => {
          setTarget(null);
          // Même célébration que la vente depuis le Stock : confettis + toast.
          celebrateSale(article.prixVente ?? prixVente, article.margeNette);
        },
      },
    );
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    supprimer.mutate(toDelete.id, { onSuccess: () => setToDelete(null) });
  };

  // Rendus deux fois (carte mobile, ligne de tableau) : une seule définition.
  const remettre = (a: ArticleDTO) =>
    remettreEnStock.mutate({ id: a.id, patch: { statut: "En stock" } });
  const remiseEnCours = (a: ArticleDTO) =>
    remettreEnStock.isPending && remettreEnStock.variables?.id === a.id;

  const showEmpty = !isLoading && !isError && articles.length === 0;

  return (
    <Frame>
      {/* Le titre et le kicker « VENTES EN ATTENTE » sont posés par la TopBar. */}
      <section className="grid grid-cols-1 gap-[14px] min-[900px]:grid-cols-3">
        <Tete label="Ventes en attente" accent>
          <div className="mt-2 text-[34px] font-bold tabular-nums">
            {articles.length}
          </div>
        </Tete>
        <Tete label="Ventes comptabilisées">
          <div className="mt-2 text-[34px] font-bold tabular-nums">
            {dashboard ? dashboard.vendus.toLocaleString("fr-FR") : "—"}
          </div>
        </Tete>
        <Tete label="Synchro">
          <div className="mt-3 flex items-center gap-2.5">
            <span className="inline-block h-[9px] w-[9px] flex-none rounded-full bg-[var(--pos)]" />
            <span className="text-[15px] font-semibold">Temps réel</span>
          </div>
          <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">
            Trello · étiquette « à comptabiliser »
          </div>
        </Tete>
      </section>

      {/* Empty state (synchro auto, pas de bouton) */}
      {showEmpty && (
        <div className="rounded-[26px] border border-[var(--border)] bg-surface px-8 py-[70px] text-center">
          <div
            className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full shadow-[var(--shadow)]"
            style={{
              background: "var(--acc-soft)",
              animation: "pop .6s cubic-bezier(.2,.8,.2,1) both",
            }}
          >
            <Check className="h-12 w-12 text-[var(--acc)]" strokeWidth={2.6} />
          </div>
          <h2 className="text-[24px] font-bold tracking-[-0.02em] text-[var(--ink)]">
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
        <div className="rounded-[20px] border border-[var(--border)] bg-surface px-6 py-10 text-center font-mono text-[12px] text-[var(--neg)]">
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
                className="rounded-[22px] border border-[var(--border)] bg-surface p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[12.5px] font-bold text-[var(--ink)]">
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
                    className="w-full rounded-xl bg-[var(--acc)] px-4 py-3 text-[13.5px] font-bold text-[var(--acc-ink)] transition-colors hover:bg-[var(--acc-hover)]"
                  >
                    Valider
                  </button>
                  <button
                    onClick={() => remettre(a)}
                    disabled={remiseEnCours(a)}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-surface px-4 py-3 text-[13.5px] font-semibold text-[var(--acc)] transition-colors hover:bg-[var(--tint)] disabled:opacity-50"
                  >
                    <RotateCw className="h-4 w-4" strokeWidth={2} />
                    Remettre en stock
                  </button>
                  <button
                    onClick={() => setToDelete(a)}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-[13.5px] font-semibold text-[var(--neg)] transition-colors hover:border-[var(--neg)]"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2} />
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Tableau (≥ md) */}
          <Module className="hidden overflow-hidden md:block">
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3 pt-[18px]">
              <CardTitle className="">File d&apos;attente comptable</CardTitle>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">
                {articles.length} EN ATTENTE
              </span>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-[14px]">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--tint)] text-left font-mono text-[9.5px] font-medium uppercase tracking-[0.14em] text-[var(--faint)]">
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
                        <span className="font-mono text-[12.5px] font-bold text-[var(--ink)]">
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
                          className="rounded-full bg-[var(--acc)] px-4 py-1.5 text-[12.5px] font-bold text-[var(--acc-ink)] transition-colors hover:bg-[var(--acc-hover)]"
                        >
                          Valider
                        </button>
                        <button
                          onClick={() => remettre(a)}
                          disabled={remiseEnCours(a)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-[var(--acc)] transition-colors hover:bg-[var(--tint)] disabled:opacity-50"
                          title="Remettre en stock"
                        >
                          <RotateCw className="h-3.5 w-3.5" strokeWidth={2} />
                          Remettre en stock
                        </button>
                        <button
                          onClick={() => setToDelete(a)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--neg)] transition-colors hover:border-[var(--neg)]"
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
          </Module>
        </>
      )}

      <SellDialog
        open={!!target}
        sku={target?.sku}
        defaultPrix={target?.prixVente}
        defaultCanal={target?.canal}
        defaultCompteVente={target?.compteVente}
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
            <h2 className="text-[17px] font-bold tracking-[-0.02em] text-[var(--ink)]">
              Supprimer l’article
            </h2>
            <p className="mt-2 text-[14px] text-[var(--muted)]">
              Supprimer l’article{" "}
              <span className="font-mono text-[12.5px] font-bold text-[var(--ink)]">
                {toDelete.sku}
              </span>{" "}
              ? Cette action est irréversible.
            </p>
            {supprimer.isError && (
              <p className="mt-3 font-mono text-[12px] text-[var(--neg)]">
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
                className="rounded-full bg-[var(--neg)] px-4 py-1.5 text-[13px] font-bold text-[var(--bg)] transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {supprimer.isPending ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Frame>
  );
}
