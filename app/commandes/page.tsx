"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCommandeStats, useCommandes, useDeleteCommande } from "@/lib/hooks";
import { euros } from "@/lib/calc";
import NewCommandeModal from "@/components/NewCommandeModal";
import ImportExcelModal from "@/components/ImportExcelModal";

function CommandeDetail({ commandeId }: { commandeId: string }) {
  const { data, isLoading, isError, error } = useCommandeStats(commandeId);

  if (isLoading) {
    return (
      <div className="px-6 py-4 text-body-md text-ink-faint">
        Chargement du détail…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="px-6 py-4 text-body-md text-error">
        {error ? (error as Error).message : "Erreur de chargement."}
      </div>
    );
  }
  if (data.rows.length === 0) {
    return (
      <div className="px-6 py-4 text-body-md text-ink-faint">
        Aucun article dans cette commande.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto px-6 py-4">
      <table className="w-full min-w-[700px] border-collapse text-body-md">
        <thead>
          <tr className="text-left text-label-sm uppercase tracking-wide text-ink-faint">
            <th className="px-3 py-2 font-medium">Catégorie</th>
            <th className="px-3 py-2 text-right font-medium">Total</th>
            <th className="px-3 py-2 text-right font-medium">En stock</th>
            <th className="px-3 py-2 text-right font-medium">En vente</th>
            <th className="px-3 py-2 text-right font-medium">Vendus</th>
            <th className="px-3 py-2 text-right font-medium">CA (€)</th>
            <th className="px-3 py-2 text-right font-medium">Marge nette (€)</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.categorie} className="border-t border-line">
              <td className="px-3 py-2 font-medium text-ink">{r.categorie}</td>
              <td className="px-3 py-2 text-right text-ink-muted">{r.total}</td>
              <td className="px-3 py-2 text-right text-ink-muted">
                {r.enStock}
              </td>
              <td className="px-3 py-2 text-right text-ink-muted">
                {r.enVente}
              </td>
              <td className="px-3 py-2 text-right text-ink-muted">{r.vendus}</td>
              <td className="px-3 py-2 text-right font-medium text-ink">
                {euros(r.ca)}
              </td>
              <td className="px-3 py-2 text-right font-medium text-primary">
                {euros(r.margeNette)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CommandesPage() {
  const router = useRouter();
  const { data: commandes = [], isLoading, isError, error } = useCommandes();
  const del = useDeleteCommande();
  const [newCommande, setNewCommande] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleDetail = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-display-lg text-ink">Commandes</h1>
          <p className="mt-1 text-body-md text-ink-muted">
            Tes commandes fournisseurs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="rounded-full border border-line px-5 py-2.5 text-body-md font-medium text-ink transition-colors hover:bg-surface-container"
          >
            📥 Importer un Excel
          </button>
          <button
            onClick={() => setNewCommande(true)}
            className="rounded-full bg-primary px-5 py-2.5 text-body-md font-medium text-on-primary transition-colors hover:bg-primary-dark"
          >
            + Nouvelle commande
          </button>
        </div>
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
            {commandes.map((c) => {
              const expanded = expandedId === c.id;
              return (
                <FragmentRow key={c.id}>
                  <tr className="border-t border-line transition-colors hover:bg-surface-soft">
                    <td className="px-6 py-3.5 font-medium text-ink">
                      <div>{c.fournisseur}</div>
                      {c.coefObjectif != null && (
                        <div className="mt-0.5 text-label-sm font-normal text-ink-faint">
                          Objectif : x{c.coefObjectif}
                        </div>
                      )}
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
                          onClick={() => toggleDetail(c.id)}
                          className="rounded-full border border-line px-3 py-1.5 text-label-sm font-medium text-ink-muted transition-colors hover:bg-surface-container"
                        >
                          {expanded ? "▲ Détail" : "▼ Détail"}
                        </button>
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
                  {expanded && (
                    <tr className="border-t border-line bg-surface-soft">
                      <td colSpan={6} className="p-0">
                        <CommandeDetail commandeId={c.id} />
                      </td>
                    </tr>
                  )}
                </FragmentRow>
              );
            })}
          </tbody>
        </table>
      </div>

      <NewCommandeModal open={newCommande} onClose={() => setNewCommande(false)} />
      <ImportExcelModal open={importOpen} onClose={() => setImportOpen(false)} />
    </main>
  );
}

// Permet de retourner deux <tr> par commande (ligne + panneau détail).
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
