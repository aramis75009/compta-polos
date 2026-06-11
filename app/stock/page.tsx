"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArticlePatch,
  useArticles,
  useBulkUpdateStatus,
  useCommandes,
  useDeleteArticle,
  useUpdateArticle,
} from "@/lib/hooks";
import { coef, euros, naturalSort, STATUT_VENDU, STATUTS } from "@/lib/calc";
import { statutColor } from "@/lib/statutColors";
import type { ArticleDTO } from "@/lib/types";
import EditableCell from "@/components/EditableCell";
import SellModal from "@/components/SellModal";
import NewCommandeModal from "@/components/NewCommandeModal";
import CanalBadge from "@/components/CanalBadge";

type SortKey =
  | "sku"
  | "marque"
  | "categorie"
  | "grade"
  | "statut"
  | "prixAchat"
  | "prixVente"
  | "margeBrute"
  | "margeNette"
  | "coefficient"
  | "dateVente"
  | "canal";

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "sku", label: "SKU" },
  { key: "marque", label: "Marque" },
  { key: "categorie", label: "Catégorie" },
  { key: "grade", label: "Grade" },
  { key: "statut", label: "Statut" },
  { key: "prixAchat", label: "Prix achat", align: "right" },
  { key: "prixVente", label: "Prix vente", align: "right" },
  { key: "margeBrute", label: "Marge brute", align: "right" },
  { key: "margeNette", label: "Marge nette", align: "right" },
  { key: "coefficient", label: "Coef", align: "right" },
  { key: "dateVente", label: "Date vente" },
  { key: "canal", label: "Canal" },
];

function compare(a: ArticleDTO, b: ArticleDTO, key: SortKey): number {
  const va = a[key];
  const vb = b[key];
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  if (typeof va === "number" && typeof vb === "number") return va - vb;
  // Tri naturel pour les colonnes texte (SKU : AD1, AD2…AD10).
  return naturalSort(String(va), String(vb));
}

const inputCls =
  "rounded-md border border-line bg-surface px-3 py-2 text-body-md text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

function StockInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [marque, setMarque] = useState(params.get("marque") ?? "");
  const [statut, setStatut] = useState("");
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sku");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Filtre par commande : initialisé depuis l'URL (lien "Voir les articles"),
  // puis pilotable via le dropdown. Synchronisé si l'URL change.
  const commandeParam = params.get("commande") ?? "";
  const [commande, setCommande] = useState(commandeParam);
  useEffect(() => {
    setCommande(commandeParam);
  }, [commandeParam]);

  const { data: commandes = [] } = useCommandes();

  const { data: articles = [], isLoading, isError, error } = useArticles({
    marque: marque || undefined,
    statut: statut || undefined,
    q: q || undefined,
    commande: commande || undefined,
  });

  const update = useUpdateArticle();
  const del = useDeleteArticle();
  const bulk = useBulkUpdateStatus();

  const [newCommande, setNewCommande] = useState(false);
  const [sellTarget, setSellTarget] = useState<ArticleDTO | null>(null);

  // --- Sélection en masse ---
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatut, setBulkStatut] = useState("En stock");

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clearSelection = () => setSelected(new Set());

  const applyBulk = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    bulk.mutate(
      { ids, statut: bulkStatut },
      { onSuccess: clearSelection },
    );
  };

  // Liste des marques pour le filtre (calculée depuis les données chargées).
  const marqueOptions = useMemo(() => {
    const set = new Set(articles.map((a) => a.marque));
    if (marque) set.add(marque);
    return Array.from(set).sort();
  }, [articles, marque]);

  const sorted = useMemo(() => {
    const copy = [...articles];
    copy.sort((a, b) => {
      const c = compare(a, b, sortKey);
      return sortDir === "asc" ? c : -c;
    });
    return copy;
  }, [articles, sortKey, sortDir]);

  const totals = useMemo(() => {
    let enStock = 0;
    let vendus = 0;
    let ca = 0;
    let net = 0;
    for (const a of articles) {
      if (a.statut === "En stock") enStock += 1;
      if (a.statut === STATUT_VENDU) {
        vendus += 1;
        ca += a.prixVente ?? 0;
        net += a.margeNette ?? 0;
      }
    }
    return { total: articles.length, enStock, vendus, ca, net };
  }, [articles]);

  // Export CSV des lignes actuellement affichées (filtres + tri respectés).
  const exportCSV = () => {
    const commandeName = (id: string | null) => {
      if (!id) return "";
      const c = commandes.find((x) => x.id === id);
      return c ? `${c.fournisseur} (${new Date(c.date).toLocaleDateString("fr-FR")})` : "";
    };
    const headers = [
      "SKU",
      "Marque",
      "Catégorie",
      "Grade",
      "Statut",
      "Canal",
      "Prix achat",
      "Prix vente",
      "Marge brute",
      "Marge nette",
      "Coef",
      "Date vente",
      "Transporteur",
      "Commande",
    ];
    const esc = (v: unknown) =>
      `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = sorted.map((a) =>
      [
        a.sku,
        a.marque,
        a.categorie,
        a.grade ?? "",
        a.statut,
        a.canal ?? "",
        a.prixAchat,
        a.prixVente ?? "",
        a.margeBrute ?? "",
        a.margeNette ?? "",
        a.coefficient ?? "",
        a.dateVente ? new Date(a.dateVente).toLocaleDateString("fr-FR") : "",
        a.transporteur ?? "",
        commandeName(a.commandeId),
      ]
        .map(esc)
        .join(";"),
    );
    const csv = [headers.map(esc).join(";"), ...lines].join("\r\n");
    // BOM pour qu'Excel reconnaisse l'UTF-8.
    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);
    const link = document.createElement("a");
    link.href = url;
    link.download = `myflip-stock-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const patch = (id: string, p: ArticlePatch) =>
    update.mutate({ id, patch: p });

  const onStatutChange = (a: ArticleDTO, value: string) => {
    if (value === STATUT_VENDU) {
      setSellTarget(a);
    } else {
      patch(a.id, { statut: value });
    }
  };

  const confirmSell = (
    prixVente: number,
    dateVenteISO: string,
    canal: string,
  ) => {
    if (!sellTarget) return;
    update.mutate(
      {
        id: sellTarget.id,
        patch: {
          statut: STATUT_VENDU,
          prixVente,
          dateVente: dateVenteISO,
          canal,
        },
      },
      { onSuccess: () => setSellTarget(null) },
    );
  };

  const sortIndicator = (key: SortKey) =>
    key === sortKey ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-display-lg text-ink">Stock</h1>
          <p className="mt-1 text-body-md text-ink-muted">
            Double-clic sur une cellule pour la modifier.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportCSV}
            className="rounded-full border border-line px-5 py-2.5 text-body-md font-medium text-ink transition-colors hover:bg-surface-container"
          >
            📤 Exporter CSV
          </button>
          <button
            onClick={() => setNewCommande(true)}
            className="rounded-full bg-primary px-5 py-2.5 text-body-md font-medium text-on-primary transition-colors hover:bg-primary-dark"
          >
            + Nouvelle commande
          </button>
        </div>
      </header>

      {/* Filtres */}
      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
          >
            <circle cx="11" cy="11" r="7" strokeWidth="1.6" />
            <path d="m21 21-4.3-4.3" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un SKU…"
            className={`${inputCls} rounded-full pl-9`}
          />
        </div>
        <select
          value={marque}
          onChange={(e) => setMarque(e.target.value)}
          className={inputCls}
        >
          <option value="">Toutes les marques</option>
          {marqueOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={statut}
          onChange={(e) => setStatut(e.target.value)}
          className={inputCls}
        >
          <option value="">Tous les statuts</option>
          {STATUTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={commande}
          onChange={(e) => setCommande(e.target.value)}
          className={inputCls}
        >
          <option value="">Toutes les commandes</option>
          {commandes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fournisseur} — {new Date(c.date).toLocaleDateString("fr-FR")}
            </option>
          ))}
        </select>
        {(marque || statut || q || commande) && (
          <button
            onClick={() => {
              setMarque("");
              setStatut("");
              setQ("");
              setCommande("");
              router.replace("/stock");
            }}
            className="rounded-full border border-line px-4 py-2 text-body-md text-ink-muted transition-colors hover:bg-surface-container"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Tableau */}
      <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
        <table className="w-full min-w-[1240px] border-collapse text-body-md">
          <thead>
            <tr className="text-left text-label-sm uppercase tracking-wide text-ink-faint">
              <th className="w-10 px-3 py-3.5">
                <input
                  type="checkbox"
                  aria-label="Tout sélectionner"
                  className="h-4 w-4 cursor-pointer accent-primary"
                  checked={
                    sorted.length > 0 && sorted.every((a) => selected.has(a.id))
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelected(new Set(sorted.map((a) => a.id)));
                    } else {
                      clearSelection();
                    }
                  }}
                />
              </th>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className={`cursor-pointer select-none whitespace-nowrap px-3 py-3.5 font-medium transition-colors hover:text-ink ${
                    c.align === "right" ? "text-right" : ""
                  }`}
                >
                  {c.label}
                  {sortIndicator(c.key)}
                </th>
              ))}
              <th className="px-3 py-3.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={14} className="px-3 py-10 text-center text-ink-faint">
                  Chargement…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={14} className="px-3 py-10 text-center text-error">
                  {(error as Error).message}
                </td>
              </tr>
            )}
            {!isLoading && !isError && sorted.length === 0 && (
              <tr>
                <td colSpan={14} className="px-3 py-10 text-center text-ink-faint">
                  Aucun article.
                </td>
              </tr>
            )}
            {sorted.map((a) => {
              const vendu = a.statut === STATUT_VENDU;
              // Coef effectif : pour un article non vendu mais dont le prix de
              // vente est renseigné, on dérive prixVente / prixAchat.
              const coefEffectif =
                a.coefficient ??
                (a.prixVente != null && a.prixAchat
                  ? a.prixVente / a.prixAchat
                  : null);
              const sousObjectif =
                (a.statut === "En vente" || a.statut === "En stock") &&
                a.coefObjectif != null &&
                a.prixVente != null &&
                coefEffectif != null &&
                coefEffectif < a.coefObjectif;
              return (
                <tr
                  key={a.id}
                  className={`border-t border-line transition-colors hover:bg-surface-soft ${
                    selected.has(a.id) ? "bg-primary/5" : ""
                  }`}
                >
                  <td className="px-3 py-1">
                    <input
                      type="checkbox"
                      aria-label={`Sélectionner ${a.sku}`}
                      className="h-4 w-4 cursor-pointer accent-primary"
                      checked={selected.has(a.id)}
                      onChange={() => toggleOne(a.id)}
                    />
                  </td>
                  <td className="px-1 py-1 font-mono text-ink">
                    <EditableCell
                      value={a.sku}
                      onSave={(v) => patch(a.id, { sku: v })}
                    />
                  </td>
                  <td className="px-1 py-1 text-ink">
                    <EditableCell
                      value={a.marque}
                      onSave={(v) => patch(a.id, { marque: v })}
                    />
                  </td>
                  <td className="px-1 py-1 text-ink-muted">
                    <EditableCell
                      value={a.categorie}
                      onSave={(v) => patch(a.id, { categorie: v })}
                    />
                  </td>
                  <td className="px-1 py-1 text-ink-muted">
                    <EditableCell
                      value={a.grade}
                      onSave={(v) => patch(a.id, { grade: v || null })}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <select
                      value={a.statut}
                      onChange={(e) => onStatutChange(a, e.target.value)}
                      style={{
                        backgroundColor: statutColor(a.statut).bg,
                        color: statutColor(a.statut).text,
                      }}
                      className="cursor-pointer rounded-full border-0 px-2.5 py-1 text-label-sm font-medium outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {STATUTS.map((s) => (
                        <option
                          key={s}
                          value={s}
                          style={{ backgroundColor: "#ffffff", color: "#1a1c1c" }}
                        >
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1 text-ink">
                    <EditableCell
                      value={a.prixAchat}
                      display={euros(a.prixAchat)}
                      type="number"
                      align="right"
                      onSave={(v) => patch(a.id, { prixAchat: Number(v) })}
                    />
                  </td>
                  <td className="px-1 py-1 text-ink">
                    <EditableCell
                      value={a.prixVente}
                      display={a.prixVente != null ? euros(a.prixVente) : "—"}
                      type="number"
                      align="right"
                      editable={vendu}
                      onSave={(v) => patch(a.id, { prixVente: Number(v) })}
                    />
                  </td>
                  <td className="px-3 py-1 text-right text-ink-muted">
                    {a.margeBrute != null ? euros(a.margeBrute) : "—"}
                  </td>
                  <td
                    className={`px-3 py-1 text-right font-medium ${
                      a.margeNette != null && a.margeNette < 0
                        ? "text-error"
                        : "text-primary"
                    }`}
                  >
                    {a.margeNette != null ? euros(a.margeNette) : "—"}
                  </td>
                  <td className="px-3 py-1 text-right">
                    {sousObjectif ? (
                      <span
                        className="inline-flex items-center gap-1 font-semibold"
                        style={{ color: "#EA580C" }}
                        title={`Objectif : x${a.coefObjectif}`}
                      >
                        ⚠️ {coef(coefEffectif)}
                      </span>
                    ) : (
                      <span className="text-ink-muted">
                        {coef(a.coefficient)}
                      </span>
                    )}
                  </td>
                  <td className="px-1 py-1 text-ink-muted">
                    <EditableCell
                      value={a.dateVente ? a.dateVente.slice(0, 10) : null}
                      display={
                        a.dateVente
                          ? new Date(a.dateVente).toLocaleDateString("fr-FR")
                          : "—"
                      }
                      type="text"
                      editable={vendu}
                      onSave={(v) =>
                        patch(a.id, {
                          dateVente: v ? new Date(v).toISOString() : null,
                        })
                      }
                    />
                  </td>
                  <td className="px-2 py-1">
                    <CanalBadge canal={a.canal} />
                  </td>
                  <td className="px-3 py-1 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Supprimer ${a.sku} ?`)) del.mutate(a.id);
                      }}
                      className="text-ink-faint transition-colors hover:text-error"
                      title="Supprimer"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Compteur */}
      <div className="mt-5 flex flex-wrap gap-x-8 gap-y-1 text-body-md text-ink-muted">
        <span>
          <strong className="text-ink">{totals.total}</strong> articles
        </span>
        <span>
          <strong className="text-ink">{totals.enStock}</strong> en stock
        </span>
        <span>
          <strong className="text-ink">{totals.vendus}</strong> vendus
        </span>
        <span>
          CA : <strong className="text-ink">{euros(totals.ca)}</strong>
        </span>
        <span>
          Marge nette :{" "}
          <strong className="text-primary">{euros(totals.net)}</strong>
        </span>
      </div>

      {/* Barre d'action de sélection en masse */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 flex justify-center px-4 md:bottom-6 md:left-sidebar">
          <div className="flex flex-wrap items-center gap-3 rounded-full border border-line bg-surface px-5 py-3 shadow-card-hover">
            <span className="text-body-md font-medium text-ink">
              {selected.size} article(s) sélectionné(s)
            </span>
            <div className="flex items-center gap-2">
              <span className="text-label-sm text-ink-faint">
                Changer le statut
              </span>
              <select
                value={bulkStatut}
                onChange={(e) => setBulkStatut(e.target.value)}
                className="rounded-full border border-line bg-surface px-3 py-1.5 text-body-md text-ink outline-none focus:border-primary"
              >
                {STATUTS.filter((s) => s !== STATUT_VENDU).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={applyBulk}
              disabled={bulk.isPending}
              className="rounded-full bg-primary px-4 py-1.5 text-body-md font-medium text-on-primary transition-colors hover:bg-primary-dark disabled:opacity-60"
            >
              {bulk.isPending ? "…" : "Appliquer"}
            </button>
            <button
              onClick={clearSelection}
              className="text-label-sm text-ink-faint hover:text-ink"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <NewCommandeModal
        open={newCommande}
        onClose={() => setNewCommande(false)}
      />
      <SellModal
        open={!!sellTarget}
        sku={sellTarget?.sku}
        defaultCanal={sellTarget?.canal}
        pending={update.isPending}
        error={update.isError ? (update.error as Error).message : null}
        onClose={() => setSellTarget(null)}
        onConfirm={confirmSell}
      />
    </main>
  );
}

export default function StockPage() {
  return (
    <Suspense>
      <StockInner />
    </Suspense>
  );
}
