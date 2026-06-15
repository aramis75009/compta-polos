"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import StatutBadge from "@/components/StatutBadge";

// Petit indicateur vert : les photos de l'article sont prêtes (retouchées
// et téléchargées depuis la page Photos).
function PhotosReadyIcon() {
  return (
    <span
      title="Photos prêtes"
      className="inline-flex shrink-0 text-mint"
      aria-label="Photos prêtes"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        className="h-4 w-4"
        strokeWidth="1.7"
        strokeLinejoin="round"
      >
        <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
        <circle cx="12" cy="13" r="3.5" />
      </svg>
    </span>
  );
}

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
  | "canal"
  | "transporteur";

type ColumnMeta = {
  key: SortKey;
  label: string;
  align?: "right";
  always?: boolean; // colonne non masquable
  defaultVisible: boolean;
};

const COLUMN_META: ColumnMeta[] = [
  { key: "sku", label: "SKU", always: true, defaultVisible: true },
  { key: "marque", label: "Marque", defaultVisible: true },
  { key: "categorie", label: "Catégorie", defaultVisible: true },
  { key: "grade", label: "Grade", defaultVisible: false },
  { key: "statut", label: "Statut", defaultVisible: true },
  { key: "prixAchat", label: "Prix achat", align: "right", defaultVisible: true },
  { key: "prixVente", label: "Prix vente", align: "right", defaultVisible: false },
  { key: "margeBrute", label: "Marge brute", align: "right", defaultVisible: false },
  { key: "margeNette", label: "Marge nette", align: "right", defaultVisible: true },
  { key: "coefficient", label: "Coef", align: "right", defaultVisible: true },
  { key: "dateVente", label: "Date vente", defaultVisible: false },
  { key: "canal", label: "Canal", defaultVisible: true },
  { key: "transporteur", label: "Transporteur", defaultVisible: false },
];

const COLUMN_STORAGE_KEY = "myflip-columns";

const defaultColumnVisibility = (): Record<string, boolean> =>
  Object.fromEntries(COLUMN_META.map((c) => [c.key, c.defaultVisible]));

// Extracteurs de valeur pour l'export CSV (une fonction par colonne).
const CSV_VALUE: Record<SortKey, (a: ArticleDTO) => string | number> = {
  sku: (a) => a.sku,
  marque: (a) => a.marque,
  categorie: (a) => a.categorie,
  grade: (a) => a.grade ?? "",
  statut: (a) => a.statut,
  prixAchat: (a) => a.prixAchat,
  prixVente: (a) => a.prixVente ?? "",
  margeBrute: (a) => a.margeBrute ?? "",
  margeNette: (a) => a.margeNette ?? "",
  coefficient: (a) => a.coefficient ?? "",
  dateVente: (a) =>
    a.dateVente ? new Date(a.dateVente).toLocaleDateString("fr-FR") : "",
  canal: (a) => a.canal ?? "",
  transporteur: (a) => a.transporteur ?? "",
};

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

  // --- Colonnes masquables (préférences persistées dans localStorage) ---
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(
    defaultColumnVisibility,
  );
  const [colsOpen, setColsOpen] = useState(false);
  const colsRef = useRef<HTMLDivElement>(null);

  // Chargement des préférences au montage (client uniquement).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLUMN_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, boolean>;
      setVisibleCols((prev) => {
        const next = { ...prev };
        for (const c of COLUMN_META) {
          if (c.always) next[c.key] = true;
          else if (typeof saved[c.key] === "boolean") next[c.key] = saved[c.key];
        }
        return next;
      });
    } catch {
      /* préférences invalides : on garde les valeurs par défaut */
    }
  }, []);

  // Fermeture du menu au clic extérieur.
  useEffect(() => {
    if (!colsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (colsRef.current && !colsRef.current.contains(e.target as Node)) {
        setColsOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [colsOpen]);

  const toggleCol = (key: SortKey) => {
    const meta = COLUMN_META.find((c) => c.key === key);
    if (meta?.always) return;
    setVisibleCols((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* stockage indisponible : on ignore */
      }
      return next;
    });
  };

  const shownColumns = COLUMN_META.filter((c) => visibleCols[c.key]);
  const colCount = shownColumns.length + 2; // case à cocher + actions

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

  // Export CSV des lignes affichées (filtres, tri ET colonnes visibles respectés).
  const exportCSV = () => {
    const commandeName = (id: string | null) => {
      if (!id) return "";
      const c = commandes.find((x) => x.id === id);
      return c ? `${c.fournisseur} (${new Date(c.date).toLocaleDateString("fr-FR")})` : "";
    };
    const cols = COLUMN_META.filter((c) => visibleCols[c.key]);
    const headers = [...cols.map((c) => c.label), "Commande"];
    const esc = (v: unknown) =>
      `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = sorted.map((a) =>
      [...cols.map((c) => CSV_VALUE[c.key](a)), commandeName(a.commandeId)]
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
          <h1 className="text-2xl font-bold text-ink md:text-4xl">Stock</h1>
          <p className="mt-1 text-sm text-ink-muted md:text-base">
            Double-clic sur une cellule pour la modifier.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:flex-wrap">
          <div className="relative hidden md:block" ref={colsRef}>
            <button
              onClick={() => setColsOpen((o) => !o)}
              className="rounded-full border border-line px-5 py-2.5 text-body-md font-medium text-ink transition-colors hover:bg-surface-container"
            >
              Colonnes ⚙️
            </button>
            {colsOpen && (
              <div className="absolute right-0 z-30 mt-2 w-60 rounded-card border border-line bg-surface p-2 shadow-card-hover">
                <p className="px-3 py-2 text-label-sm uppercase tracking-wide text-ink-faint">
                  Colonnes affichées
                </p>
                {COLUMN_META.map((c) => (
                  <label
                    key={c.key}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-body-md ${
                      c.always
                        ? "cursor-default text-ink-faint"
                        : "cursor-pointer text-ink hover:bg-surface-container"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer accent-primary disabled:cursor-default"
                      checked={!!visibleCols[c.key]}
                      disabled={c.always}
                      onChange={() => toggleCol(c.key)}
                    />
                    {c.label}
                    {c.always && (
                      <span className="ml-auto text-label-sm text-ink-faint">
                        toujours
                      </span>
                    )}
                  </label>
                ))}
                <label className="flex cursor-default items-center gap-2.5 rounded-md px-3 py-2 text-body-md text-ink-faint">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-default accent-primary"
                    checked
                    disabled
                    readOnly
                  />
                  Actions
                  <span className="ml-auto text-label-sm text-ink-faint">
                    toujours
                  </span>
                </label>
              </div>
            )}
          </div>
          <button
            onClick={exportCSV}
            className="w-full rounded-full border border-line px-5 py-2.5 text-body-md font-medium text-ink transition-colors hover:bg-surface-container md:w-auto"
          >
            📤 Exporter CSV
          </button>
          <button
            onClick={() => setNewCommande(true)}
            className="w-full rounded-full bg-primary px-5 py-2.5 text-body-md font-medium text-on-primary transition-colors hover:bg-primary-dark md:w-auto"
          >
            + Nouvelle commande
          </button>
        </div>
      </header>

      {/* Filtres */}
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:flex-wrap">
        <div className="relative w-full md:w-auto">
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
            className={`${inputCls} w-full rounded-full pl-9 md:w-auto`}
          />
        </div>
        <select
          value={marque}
          onChange={(e) => setMarque(e.target.value)}
          className={`${inputCls} w-full md:w-auto`}
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
          className={`${inputCls} w-full md:w-auto`}
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
          className={`${inputCls} w-full md:w-auto`}
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
            className="w-full rounded-full border border-line px-4 py-2 text-body-md text-ink-muted transition-colors hover:bg-surface-container md:w-auto"
          >
            Réinitialiser
          </button>
        )}
      </div>

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
        {!isLoading && !isError && sorted.length === 0 && (
          <p className="rounded-card border border-line bg-surface px-4 py-6 text-center text-ink-faint shadow-card">
            Aucun article.
          </p>
        )}
        {sorted.map((a) => (
          <div
            key={a.id}
            className={`flex gap-3 rounded-card border bg-surface p-4 shadow-card ${
              selected.has(a.id) ? "border-primary" : "border-line"
            }`}
          >
            <input
              type="checkbox"
              aria-label={`Sélectionner ${a.sku}`}
              className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-primary"
              checked={selected.has(a.id)}
              onChange={() => toggleOne(a.id)}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-mono font-semibold text-ink">
                    {a.sku}
                  </span>
                  {a.photosPretes && <PhotosReadyIcon />}
                </span>
                <StatutBadge statut={a.statut} />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="truncate text-ink-muted">{a.marque}</span>
                <CanalBadge canal={a.canal} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-md">
                <span className="text-ink">{euros(a.prixAchat)}</span>
                <span className="text-ink-faint">→</span>
                <span className="text-ink">
                  {a.prixVente != null ? euros(a.prixVente) : "—"}
                </span>
                <span className="text-ink-faint">|</span>
                <span
                  className={`font-medium ${
                    a.margeNette != null && a.margeNette > 0
                      ? "text-primary"
                      : a.margeNette != null && a.margeNette < 0
                        ? "text-error"
                        : "text-ink-muted"
                  }`}
                >
                  {a.margeNette != null ? euros(a.margeNette) : "—"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tableau (≥ md) */}
      <div className="hidden overflow-x-auto rounded-card border border-line bg-surface shadow-card md:block">
        <table
          style={{ minWidth: Math.max(640, colCount * 96) }}
          className="w-full border-collapse text-body-md"
        >
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
              {shownColumns.map((c) => (
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
                <td colSpan={colCount} className="px-3 py-10 text-center text-ink-faint">
                  Chargement…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={colCount} className="px-3 py-10 text-center text-error">
                  {(error as Error).message}
                </td>
              </tr>
            )}
            {!isLoading && !isError && sorted.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-3 py-10 text-center text-ink-faint">
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
              // Cellules indexées par clé de colonne : on n'affiche que les
              // colonnes visibles, dans l'ordre de COLUMN_META.
              const cells: Record<SortKey, React.ReactNode> = {
                sku: (
                  <td key="sku" className="px-2 py-3 font-mono text-ink">
                    <span className="flex items-center gap-1.5">
                      <EditableCell
                        value={a.sku}
                        onSave={(v) => patch(a.id, { sku: v })}
                      />
                      {a.photosPretes && <PhotosReadyIcon />}
                    </span>
                  </td>
                ),
                marque: (
                  <td key="marque" className="px-2 py-3 text-ink">
                    <EditableCell
                      value={a.marque}
                      onSave={(v) => patch(a.id, { marque: v })}
                    />
                  </td>
                ),
                categorie: (
                  <td key="categorie" className="px-2 py-3 text-ink-muted">
                    <EditableCell
                      value={a.categorie}
                      onSave={(v) => patch(a.id, { categorie: v })}
                    />
                  </td>
                ),
                grade: (
                  <td key="grade" className="px-2 py-3 text-ink-muted">
                    <EditableCell
                      value={a.grade}
                      onSave={(v) => patch(a.id, { grade: v || null })}
                    />
                  </td>
                ),
                statut: (
                  <td key="statut" className="px-2 py-3">
                    <select
                      value={a.statut}
                      onChange={(e) => onStatutChange(a, e.target.value)}
                      style={{
                        backgroundColor: statutColor(a.statut).bg,
                        color: statutColor(a.statut).text,
                      }}
                      className="cursor-pointer rounded-full border-0 px-3 py-1 text-label-sm font-medium outline-none focus:ring-2 focus:ring-primary/30"
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
                ),
                prixAchat: (
                  <td key="prixAchat" className="px-2 py-3 text-ink">
                    <EditableCell
                      value={a.prixAchat}
                      display={euros(a.prixAchat)}
                      type="number"
                      align="right"
                      onSave={(v) => patch(a.id, { prixAchat: Number(v) })}
                    />
                  </td>
                ),
                prixVente: (
                  <td key="prixVente" className="px-2 py-3 text-ink">
                    <EditableCell
                      value={a.prixVente}
                      display={a.prixVente != null ? euros(a.prixVente) : "—"}
                      type="number"
                      align="right"
                      editable={vendu}
                      onSave={(v) => patch(a.id, { prixVente: Number(v) })}
                    />
                  </td>
                ),
                margeBrute: (
                  <td
                    key="margeBrute"
                    className="px-3 py-3 text-right text-ink-muted"
                  >
                    {a.margeBrute != null ? euros(a.margeBrute) : "—"}
                  </td>
                ),
                margeNette: (
                  <td
                    key="margeNette"
                    className={`px-3 py-3 text-right font-medium ${
                      a.margeNette != null && a.margeNette < 0
                        ? "text-error"
                        : "text-primary"
                    }`}
                  >
                    {a.margeNette != null ? euros(a.margeNette) : "—"}
                  </td>
                ),
                coefficient: (
                  <td key="coefficient" className="px-3 py-3 text-right">
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
                ),
                dateVente: (
                  <td key="dateVente" className="px-2 py-3 text-ink-muted">
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
                ),
                canal: (
                  <td key="canal" className="px-2 py-3">
                    <CanalBadge canal={a.canal} />
                  </td>
                ),
                transporteur: (
                  <td key="transporteur" className="px-3 py-3 text-ink-muted">
                    {a.transporteur ?? "—"}
                  </td>
                ),
              };
              return (
                <tr
                  key={a.id}
                  className={`border-t border-line align-middle transition-colors hover:bg-surface-soft ${
                    selected.has(a.id) ? "bg-primary/5" : ""
                  }`}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Sélectionner ${a.sku}`}
                      className="h-4 w-4 cursor-pointer accent-primary"
                      checked={selected.has(a.id)}
                      onChange={() => toggleOne(a.id)}
                    />
                  </td>
                  {shownColumns.map((c) => cells[c.key])}
                  <td className="px-3 py-3 text-right">
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
