"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCommandeStats, useCommandes, useDeleteCommande } from "@/lib/hooks";
import { coef, euros } from "@/lib/calc";

import NewCommandeModal from "@/components/NewCommandeModal";
import ImportExcelModal from "@/components/ImportExcelModal";

// Palette des trois états de rentabilité.
const RENTA = {
  encours: { label: "En cours", emoji: "🔴", color: "#DC2626", bg: "#FEE2E2" },
  proche: { label: "Seuil proche", emoji: "🟡", color: "#D97706", bg: "#FEF3C7" },
  rentable: { label: "Rentabilisée", emoji: "🟢", color: "#16A34A", bg: "#DCFCE7" },
} as const;

// Couleur d'un % vendu : <30% rouge, 30-60% orange, >60% vert.
function pctColor(pct: number): string {
  if (pct < 0.3) return "#DC2626";
  if (pct <= 0.6) return "#D97706";
  return "#16A34A";
}

function RentabiliteIndicateur({
  montantRecupere,
  investissement,
  panierMoyen,
}: {
  montantRecupere: number;
  investissement: number;
  panierMoyen: number;
}) {
  const resteARecuperer = Math.max(0, investissement - montantRecupere);
  const ratio = investissement > 0 ? montantRecupere / investissement : 0;
  const width = Math.min(100, Math.round(ratio * 100));

  const statut =
    montantRecupere >= investissement
      ? RENTA.rentable
      : montantRecupere < investissement * 0.5
        ? RENTA.encours
        : RENTA.proche;

  const seuilArticles =
    panierMoyen > 0 ? Math.ceil(resteARecuperer / panierMoyen) : null;

  return (
    <div className="space-y-3 rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-body-md font-semibold text-ink">Rentabilité</h3>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-label-sm font-medium"
          style={{ backgroundColor: statut.bg, color: statut.color }}
        >
          {statut.emoji} {statut.label}
        </span>
      </div>

      {/* Barre de progression */}
      <div className="h-3 w-full overflow-hidden rounded-full bg-surface-container">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${width}%`, backgroundColor: statut.color }}
        />
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-body-md text-ink-muted">
        <span>
          Investi : <strong className="text-ink">{euros(investissement)}</strong>
        </span>
        <span>
          Récupéré :{" "}
          <strong className="text-ink">{euros(montantRecupere)}</strong>
        </span>
        <span>
          Reste :{" "}
          <strong style={{ color: statut.color }}>
            {euros(resteARecuperer)}
          </strong>
        </span>
      </div>

      <p className="text-label-sm text-ink-faint">
        {montantRecupere >= investissement
          ? "✓ Investissement entièrement récupéré."
          : seuilArticles != null
            ? `Seuil de rentabilité : vendre ${seuilArticles} article${
                seuilArticles > 1 ? "s" : ""
              } supplémentaire${seuilArticles > 1 ? "s" : ""} au panier moyen actuel de ${euros(panierMoyen)}.`
            : "Aucune vente encore : panier moyen indisponible pour estimer le seuil."}
      </p>
    </div>
  );
}

function CommandeDetail({
  commandeId,
  coutTotal,
  coefObjectif,
}: {
  commandeId: string;
  coutTotal: number;
  coefObjectif: number | null;
}) {
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

  const montantRecupere = data.rows.reduce((s, r) => s + r.ca, 0);
  const totalVendus = data.rows.reduce((s, r) => s + r.vendus, 0);
  const panierMoyen = totalVendus > 0 ? montantRecupere / totalVendus : 0;

  return (
    <div className="space-y-4 px-6 py-4">
      <RentabiliteIndicateur
        montantRecupere={montantRecupere}
        investissement={coutTotal}
        panierMoyen={panierMoyen}
      />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-body-md">
          <thead>
            <tr className="text-left text-label-sm uppercase tracking-wide text-ink-faint">
              <th className="px-3 py-2 font-medium">Catégorie</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
              <th className="px-3 py-2 text-right font-medium">En stock</th>
              <th className="px-3 py-2 text-right font-medium">En vente</th>
              <th className="px-3 py-2 text-right font-medium">Vendus</th>
              <th className="px-3 py-2 text-right font-medium">CA (€)</th>
              <th className="px-3 py-2 text-right font-medium">Marge nette (€)</th>
              <th className="px-3 py-2 text-right font-medium">Coef moyen</th>
              <th className="px-3 py-2 text-right font-medium">% vendu</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => {
              const coefColor =
                coefObjectif == null || r.coefMoyen === 0
                  ? undefined
                  : r.coefMoyen < coefObjectif
                    ? "#DC2626"
                    : "#16A34A";
              return (
                <tr key={r.categorie} className="border-t border-line">
                  <td className="px-3 py-2 font-medium text-ink">
                    {r.categorie}
                  </td>
                  <td className="px-3 py-2 text-right text-ink-muted">
                    {r.total}
                  </td>
                  <td className="px-3 py-2 text-right text-ink-muted">
                    {r.enStock}
                  </td>
                  <td className="px-3 py-2 text-right text-ink-muted">
                    {r.enVente}
                  </td>
                  <td className="px-3 py-2 text-right text-ink-muted">
                    {r.vendus}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-ink">
                    {euros(r.ca)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-primary">
                    {euros(r.margeNette)}
                  </td>
                  <td
                    className="px-3 py-2 text-right font-medium"
                    style={coefColor ? { color: coefColor } : undefined}
                  >
                    {r.coefMoyen > 0 ? coef(r.coefMoyen) : "—"}
                  </td>
                  <td
                    className="px-3 py-2 text-right font-medium"
                    style={{ color: pctColor(r.pctVendu) }}
                  >
                    {Math.round(r.pctVendu * 100)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
                        <CommandeDetail
                          commandeId={c.id}
                          coutTotal={c.coutTotal}
                          coefObjectif={c.coefObjectif}
                        />
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
