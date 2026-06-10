"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCommandes, useDeleteCommande } from "@/lib/hooks";
import { euros } from "@/lib/calc";
import NewCommandeModal from "@/components/NewCommandeModal";

export default function CommandesPage() {
  const router = useRouter();
  const { data: commandes = [], isLoading, isError, error } = useCommandes();
  const del = useDeleteCommande();
  const [newCommande, setNewCommande] = useState(false);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-display-lg text-ink">Commandes</h1>
          <p className="mt-1 text-body-md text-ink-muted">
            Tes commandes fournisseurs.
          </p>
        </div>
        <button
          onClick={() => setNewCommande(true)}
          className="rounded-full bg-primary px-5 py-2.5 text-body-md font-medium text-on-primary transition-colors hover:bg-primary-dark"
        >
          + Nouvelle commande
        </button>
      </header>

      <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
        <table className="w-full min-w-[800px] border-collapse text-body-md">
          <thead>
            <tr className="text-left text-label-sm uppercase tracking-wide text-ink-faint">
              <th className="px-6 py-3.5 font-medium">Fournisseur</th>
              <th className="px-3 py-3.5 font-medium">Date</th>
              <th className="px-3 py-3.5 text-right font-medium">Nb articles</th>
              <th className="px-3 py-3.5 text-right font-medium">Coût total</th>
              <th className="px-3 py-3.5 text-right font-medium">Prix unitaire</th>
              <th className="px-6 py-3.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-ink-faint">
                  Chargement…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-error">
                  {(error as Error).message}
                </td>
              </tr>
            )}
            {!isLoading && !isError && commandes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-ink-faint">
                  Aucune commande.
                </td>
              </tr>
            )}
            {commandes.map((c) => (
              <tr
                key={c.id}
                className="border-t border-line transition-colors hover:bg-surface-soft"
              >
                <td className="px-6 py-3.5 font-medium text-ink">
                  {c.fournisseur}
                </td>
                <td className="px-3 py-3.5 text-ink-muted">
                  {new Date(c.date).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-3 py-3.5 text-right text-ink-muted">
                  {c.nbArticles}
                </td>
                <td className="px-3 py-3.5 text-right text-ink">
                  {euros(c.coutTotal)}
                </td>
                <td className="px-3 py-3.5 text-right font-medium text-primary">
                  {euros(c.prixUnitaire)}
                </td>
                <td className="px-6 py-3.5">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => router.push(`/stock?commande=${c.id}`)}
                      className="rounded-full border border-line px-3 py-1.5 text-label-sm font-medium text-ink-muted transition-colors hover:bg-surface-container"
                    >
                      Voir les articles
                    </button>
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Supprimer la commande « ${c.fournisseur} » et ses articles ?`,
                          )
                        )
                          del.mutate(c.id);
                      }}
                      className="rounded-full border border-line px-3 py-1.5 text-label-sm font-medium text-error transition-colors hover:bg-error-container"
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <NewCommandeModal open={newCommande} onClose={() => setNewCommande(false)} />
    </main>
  );
}
