"use client";

import {
  forwardRef,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
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
import { CANAUX } from "@/lib/canalColors";
import type { ArticleDTO } from "@/lib/types";
import EditableCell from "@/components/EditableCell";
import SellModal from "@/components/SellModal";
import NewCommandeModal from "@/components/NewCommandeModal";
import CanalBadge from "@/components/CanalBadge";
import StatutBadge from "@/components/StatutBadge";
import Modal from "@/components/Modal";
import Loader from "@/components/Loader";
import { toast } from "sonner";
import {
  Package,
  Tag,
  Check,
  HandCoins,
  Plus,
  Download,
  SlidersHorizontal,
  Search,
  FileText,
  X,
} from "lucide-react";

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

// Style "pill" blanc du redesign pour les selects de filtre.
const inputCls =
  "rounded-xl border border-[#E4E9E2] bg-white px-3.5 py-2.5 text-[13.5px] font-semibold text-[#3C4D44] outline-none transition-colors focus:border-[#CBD8CE]";

// Détecte le breakpoint md (768px) pour ne rendre qu'une seule liste virtualisée
// à la fois (sinon deux virtualizers tourneraient, dont un sur du DOM masqué).
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

type RowCallbacks = {
  onToggleSelect: (id: string) => void;
  onPatch: (id: string, patch: ArticlePatch) => void;
  onStatutChange: (a: ArticleDTO, value: string) => void;
  onDelete: (a: ArticleDTO) => void;
  onShowDetail: (a: ArticleDTO) => void;
};

type ArticleRowProps = RowCallbacks & {
  a: ArticleDTO;
  shownColumns: ColumnMeta[];
  isSelected: boolean;
  "data-index"?: number;
};

// Ligne du tableau (desktop). Mémoïsée : avec la virtualisation seules ~20
// lignes existent, et un edit ne re-render que la ligne touchée (props stables).
const ArticleRow = memo(
  forwardRef<HTMLTableRowElement, ArticleRowProps>(function ArticleRow(
    {
      a,
      shownColumns,
      isSelected,
      onToggleSelect,
      onPatch,
      onStatutChange,
      onDelete,
      onShowDetail,
      ...rest
    },
    ref,
  ) {
    const vendu = a.statut === STATUT_VENDU;
    // Coef effectif : pour un article non vendu mais dont le prix de vente est
    // renseigné, on dérive prixVente / prixAchat.
    const coefEffectif =
      a.coefficient ??
      (a.prixVente != null && a.prixAchat ? a.prixVente / a.prixAchat : null);
    const sousObjectif =
      (a.statut === "En vente" || a.statut === "En stock") &&
      a.coefObjectif != null &&
      a.prixVente != null &&
      coefEffectif != null &&
      coefEffectif < a.coefObjectif;
    const cells: Record<SortKey, React.ReactNode> = {
      sku: (
        <td key="sku" className="px-2 py-3 font-grotesk font-bold text-[#16261D]">
          <span className="flex items-center gap-1.5">
            <EditableCell value={a.sku} onSave={(v) => onPatch(a.id, { sku: v })} />
            {a.photosPretes && <PhotosReadyIcon />}
          </span>
        </td>
      ),
      marque: (
        <td key="marque" className="px-2 py-3 text-ink">
          <EditableCell
            value={a.marque}
            onSave={(v) => onPatch(a.id, { marque: v })}
          />
        </td>
      ),
      categorie: (
        <td key="categorie" className="px-2 py-3 text-ink-muted">
          <EditableCell
            value={a.categorie}
            onSave={(v) => onPatch(a.id, { categorie: v })}
          />
        </td>
      ),
      grade: (
        <td key="grade" className="px-2 py-3 text-ink-muted">
          <EditableCell
            value={a.grade}
            onSave={(v) => onPatch(a.id, { grade: v || null })}
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
            onSave={(v) => onPatch(a.id, { prixAchat: Number(v) })}
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
            onSave={(v) => onPatch(a.id, { prixVente: Number(v) })}
          />
        </td>
      ),
      margeBrute: (
        <td key="margeBrute" className="px-3 py-3 text-right text-ink-muted">
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
            <span className="text-ink-muted">{coef(a.coefficient)}</span>
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
              onPatch(a.id, {
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
        ref={ref}
        {...rest}
        className={`border-b border-[#EEF1EC] align-middle transition-[background-color,box-shadow] duration-150 hover:bg-[#F7F9F6] hover:shadow-[inset_3px_0_0_#1B4332] ${
          isSelected ? "bg-[#EAF3ED]" : ""
        }`}
      >
        <td className="px-3 py-3">
          <input
            type="checkbox"
            aria-label={`Sélectionner ${a.sku}`}
            className="h-4 w-4 cursor-pointer accent-[#1B4332]"
            checked={isSelected}
            onChange={() => onToggleSelect(a.id)}
          />
        </td>
        {shownColumns.map((c) => cells[c.key])}
        <td className="px-3 py-3">
          <div className="flex items-center justify-end gap-2.5 text-[#A6B2A9]">
            <button
              onClick={() => onShowDetail(a)}
              className={`transition-colors hover:text-[#1B4332] ${
                a.titreAnnonce ? "text-[#1B4332]" : ""
              }`}
              title={a.titreAnnonce ? "Voir le détail (annonce générée)" : "Voir le détail"}
            >
              <FileText className="h-[17px] w-[17px]" strokeWidth={2} />
            </button>
            <button
              onClick={() => onDelete(a)}
              className="transition-colors hover:text-[#C2603F]"
              title="Supprimer"
            >
              <X className="h-[17px] w-[17px]" strokeWidth={2} />
            </button>
          </div>
        </td>
      </tr>
    );
  }),
);

type ArticleCardProps = {
  a: ArticleDTO;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onShowDetail: (a: ArticleDTO) => void;
  "data-index"?: number;
};

// Carte (mobile). Le wrapper porte le ref de mesure + le gap (pb-3) pour que la
// hauteur mesurée par le virtualizer inclue l'espacement entre cartes.
const ArticleCard = memo(
  forwardRef<HTMLDivElement, ArticleCardProps>(function ArticleCard(
    { a, isSelected, onToggleSelect, onShowDetail, ...rest },
    ref,
  ) {
    return (
      <div ref={ref} {...rest} className="pb-3">
        <div
          className={`flex gap-3 rounded-[18px] border bg-white p-4 ${
            isSelected ? "border-[#1B4332]" : "border-[#E4E9E2]"
          }`}
        >
          <input
            type="checkbox"
            aria-label={`Sélectionner ${a.sku}`}
            className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[#1B4332]"
            checked={isSelected}
            onChange={() => onToggleSelect(a.id)}
          />
          <div
            className="min-w-0 flex-1 cursor-pointer"
            onClick={() => onShowDetail(a)}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-grotesk font-bold text-[#16261D]">
                  {a.sku}
                </span>
                {a.photosPretes && <PhotosReadyIcon />}
                {a.titreAnnonce && (
                  <FileText className="h-4 w-4 text-[#1B4332]" strokeWidth={2} />
                )}
              </span>
              <StatutBadge statut={a.statut} />
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="truncate text-[#71807A]">{a.marque}</span>
              <CanalBadge canal={a.canal} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-md">
              <span className="text-[#3C4D44]">{euros(a.prixAchat)}</span>
              <span className="text-[#A6B2A9]">→</span>
              <span className="text-[#3C4D44]">
                {a.prixVente != null ? euros(a.prixVente) : "—"}
              </span>
              <span className="text-[#A6B2A9]">|</span>
              <span
                className={`font-semibold ${
                  a.margeNette != null && a.margeNette > 0
                    ? "text-[#2D6A4F]"
                    : a.margeNette != null && a.margeNette < 0
                      ? "text-[#C2603F]"
                      : "text-[#71807A]"
                }`}
              >
                {a.margeNette != null ? euros(a.margeNette) : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }),
);

// Carte de la barre de stats (redesign). Variante `dark` = carte verte pleine.
function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  value,
  label,
  dark,
}: {
  icon: typeof Package;
  iconBg?: string;
  iconColor?: string;
  value: string;
  label: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`relative flex items-center gap-3 overflow-hidden rounded-2xl border px-4 py-4 transition-[transform,box-shadow,border-color] duration-[260ms] hover:-translate-y-[3px] ${
        dark
          ? "border-[#1B4332] bg-[#1B4332] text-white shadow-[0_14px_30px_-20px_rgba(20,53,40,.7)] hover:shadow-[0_24px_44px_-22px_rgba(20,53,40,.85)]"
          : "border-[#E4E9E2] bg-white hover:border-[#CBD8CE] hover:shadow-[0_18px_34px_-24px_rgba(20,53,40,.55)]"
      }`}
    >
      {dark && (
        <svg
          width="120" height="120" viewBox="0 0 96 96" fill="none"
          className="pointer-events-none absolute -bottom-8 -right-6 opacity-[.08]"
        >
          <path d="M27 69 V31 L48 54 L69 31 V69" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <div
        className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
        style={{
          background: dark ? "rgba(255,255,255,.13)" : iconBg,
          color: dark ? "#9FD4B5" : iconColor,
        }}
      >
        <Icon className="h-5 w-5" strokeWidth={2} />
      </div>
      <div className="relative min-w-0">
        <div className="font-grotesk text-[23px] font-bold tracking-[-0.02em]">
          {value}
        </div>
        <div
          className={`text-[12px] font-semibold ${
            dark ? "text-[#9FD4B5]" : "text-[#8A998F]"
          }`}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

function StockInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [marque, setMarque] = useState(params.get("marque") ?? "");
  const [statut, setStatut] = useState("");
  // `qInput` pilote le champ (instantané) ; `q` est la valeur débouncée envoyée
  // à l'API → évite une requête réseau (et un refetch de 1000+ lignes) par frappe.
  const [qInput, setQInput] = useState("");
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

  // Débounce de la recherche SKU (300 ms) avant d'attaquer l'API.
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 300);
    return () => clearTimeout(t);
  }, [qInput]);

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
  const [detailTarget, setDetailTarget] = useState<ArticleDTO | null>(null);

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

  const toggleOne = useCallback(
    (id: string) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );

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

  // --- Virtualisation : ne monte que les lignes/cartes visibles (+ overscan).
  // Une seule liste rendue à la fois selon le breakpoint (cf. useIsDesktop).
  const isDesktop = useIsDesktop();
  const showRows = !isLoading && !isError && sorted.length > 0;

  const desktopWrapRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useWindowVirtualizer({
    count: sorted.length,
    estimateSize: () => 49,
    overscan: 8,
    scrollMargin: desktopWrapRef.current?.offsetTop ?? 0,
  });

  const mobileWrapRef = useRef<HTMLDivElement>(null);
  const cardVirtualizer = useWindowVirtualizer({
    count: sorted.length,
    estimateSize: () => 116,
    overscan: 6,
    scrollMargin: mobileWrapRef.current?.offsetTop ?? 0,
  });

  const dItems = rowVirtualizer.getVirtualItems();
  const dPadTop = dItems.length
    ? dItems[0].start - rowVirtualizer.options.scrollMargin
    : 0;
  const dPadBottom = dItems.length
    ? rowVirtualizer.getTotalSize() -
      (dItems[dItems.length - 1].end - rowVirtualizer.options.scrollMargin)
    : 0;

  const mItems = cardVirtualizer.getVirtualItems();
  const mPadTop = mItems.length
    ? mItems[0].start - cardVirtualizer.options.scrollMargin
    : 0;
  const mPadBottom = mItems.length
    ? cardVirtualizer.getTotalSize() -
      (mItems[mItems.length - 1].end - cardVirtualizer.options.scrollMargin)
    : 0;

  const totals = useMemo(() => {
    let enStock = 0;
    let enVente = 0;
    let vendus = 0;
    let ca = 0;
    let net = 0;
    let stockValue = 0; // coût d'achat des articles encore détenus (non vendus/perdus)
    for (const a of articles) {
      if (a.statut === "En stock") enStock += 1;
      if (a.statut === "En vente") enVente += 1;
      if (a.statut === STATUT_VENDU) {
        vendus += 1;
        ca += a.prixVente ?? 0;
        net += a.margeNette ?? 0;
      } else if (a.statut !== "Perdu") {
        stockValue += a.prixAchat ?? 0;
      }
    }
    return {
      total: articles.length,
      enStock,
      enVente,
      vendus,
      ca,
      net,
      stockValue,
    };
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

  const handlePatch = useCallback(
    (id: string, p: ArticlePatch) => update.mutate({ id, patch: p }),
    [update],
  );

  const handleStatutChange = useCallback(
    (a: ArticleDTO, value: string) => {
      if (value === STATUT_VENDU) setSellTarget(a);
      else handlePatch(a.id, { statut: value });
    },
    [handlePatch],
  );

  const handleDelete = useCallback(
    (a: ArticleDTO) => {
      if (confirm(`Supprimer ${a.sku} ?`))
        del.mutate(a.id, {
          onSuccess: () => toast.success(`${a.sku} supprimé.`),
          onError: (e) => toast.error((e as Error).message),
        });
    },
    [del],
  );

  const handleShowDetail = useCallback((a: ArticleDTO) => setDetailTarget(a), []);

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

  // Article « vivant » pour le modal détail : on relit depuis la liste chargée
  // pour que les valeurs dérivées (marge nette) reflètent immédiatement une
  // correction inline (detailTarget est une copie figée au moment du clic).
  const detail = detailTarget
    ? articles.find((a) => a.id === detailTarget.id) ?? detailTarget
    : null;

  return (
    <main className="min-h-screen bg-[#EEF1EC] px-5 py-7 text-[#16261D] md:px-[38px] md:py-[30px] md:pb-[46px]">
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-grotesk text-[26px] font-bold tracking-[-0.025em] md:text-[30px]">
            Stock
          </h1>
          <p className="mt-1.5 text-[14.5px] font-medium text-[#71807A]">
            Double-clic sur une cellule pour la modifier.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative hidden md:block" ref={colsRef}>
            <button
              onClick={() => setColsOpen((o) => !o)}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E4E9E2] bg-white px-3.5 py-2.5 text-[13.5px] font-semibold text-[#3C4D44] transition-colors hover:border-[#CBD8CE]"
            >
              <SlidersHorizontal className="h-4 w-4" strokeWidth={2} />
              Colonnes
            </button>
            {colsOpen && (
              <div className="absolute right-0 z-30 mt-2 w-60 rounded-2xl border border-[#E4E9E2] bg-white p-2 shadow-[0_14px_30px_-18px_rgba(20,53,40,.5)]">
                <p className="px-3 py-2 text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#8A998F]">
                  Colonnes affichées
                </p>
                {COLUMN_META.map((c) => (
                  <label
                    key={c.key}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] ${
                      c.always
                        ? "cursor-default text-[#8A998F]"
                        : "cursor-pointer text-[#3C4D44] hover:bg-[#F1F4EF]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer accent-[#1B4332] disabled:cursor-default"
                      checked={!!visibleCols[c.key]}
                      disabled={c.always}
                      onChange={() => toggleCol(c.key)}
                    />
                    {c.label}
                    {c.always && (
                      <span className="ml-auto text-[11.5px] text-[#A6B2A9]">
                        toujours
                      </span>
                    )}
                  </label>
                ))}
                <label className="flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] text-[#8A998F]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-default accent-[#1B4332]"
                    checked
                    disabled
                    readOnly
                  />
                  Actions
                  <span className="ml-auto text-[11.5px] text-[#A6B2A9]">
                    toujours
                  </span>
                </label>
              </div>
            )}
          </div>
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E4E9E2] bg-white px-3.5 py-2.5 text-[13.5px] font-semibold text-[#3C4D44] transition-colors hover:border-[#CBD8CE]"
          >
            <Download className="h-4 w-4" strokeWidth={2} />
            Exporter CSV
          </button>
          <button
            onClick={() => setNewCommande(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1B4332] px-4 py-2.5 text-[13.5px] font-bold text-white shadow-[0_10px_22px_-12px_rgba(20,53,40,.8)] transition-colors hover:bg-[#143528]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.3} />
            Nouvelle commande
          </button>
        </div>
      </header>

      {/* Barre de stats */}
      <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard
          icon={Package}
          iconBg="#EAF3ED"
          iconColor="#1B4332"
          value={totals.total.toLocaleString("fr-FR")}
          label="Articles au total"
        />
        <StatCard
          icon={Tag}
          iconBg="#E7F0FF"
          iconColor="#3B6FD4"
          value={totals.enVente.toLocaleString("fr-FR")}
          label="En vente"
        />
        <StatCard
          icon={Check}
          iconBg="#E7F4EC"
          iconColor="#2D6A4F"
          value={totals.vendus.toLocaleString("fr-FR")}
          label="Vendus"
        />
        <StatCard
          icon={HandCoins}
          dark
          value={euros(totals.stockValue)}
          label="Valeur du stock"
        />
      </div>

      {/* Filtres */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:flex-wrap">
        <div className="flex w-full items-center gap-2 rounded-xl border border-[#E4E9E2] bg-white px-3.5 py-2.5 md:flex-1">
          <Search className="h-[17px] w-[17px] flex-shrink-0 text-[#9BA89F]" strokeWidth={2} />
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Rechercher un SKU…"
            className="w-full bg-transparent text-[13.5px] font-medium text-[#16261D] outline-none placeholder:text-[#9BA89F]"
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
        {/* Statut select — mobile only ; desktop uses chips below */}
        <select
          value={statut}
          onChange={(e) => setStatut(e.target.value)}
          className={`${inputCls} w-full md:hidden`}
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
        {(marque || statut || qInput || commande) && (
          <button
            onClick={() => {
              setMarque("");
              setStatut("");
              setQInput("");
              setQ("");
              setCommande("");
              router.replace("/stock");
            }}
            className="w-full rounded-xl border border-[#E4E9E2] bg-white px-3.5 py-2.5 text-[13.5px] font-medium text-[#71807A] transition-colors hover:border-[#CBD8CE] md:w-auto"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Chips statut — desktop uniquement */}
      <div className="mb-4 hidden flex-wrap gap-2 md:flex">
        {[{ label: "Tous", value: "" }, ...STATUTS.map((s) => ({ label: s, value: s }))].map((chip) => {
          const active = statut === chip.value;
          const cnt = chip.value === "" ? articles.length : articles.filter((a) => a.statut === chip.value).length;
          return (
            <button
              key={chip.value}
              onClick={() => setStatut(chip.value)}
              className={`inline-flex items-center gap-1.5 rounded-[11px] border px-3.5 py-2 text-[13px] font-bold transition-[border-color,background,box-shadow] duration-200 ${
                active
                  ? "border-[#1B4332] bg-[#1B4332] text-white shadow-[0_8px_20px_-12px_rgba(20,53,40,.8)]"
                  : "border-[#E4E9E2] bg-white text-[#3C4D44] hover:border-[#CBD8CE]"
              }`}
            >
              {chip.label}
              <span
                className={`rounded-full px-1.5 py-px text-[11px] font-bold ${
                  active ? "bg-white/20 text-[#CFE6D8]" : "bg-[#F1F4EF] text-[#8A998F]"
                }`}
              >
                {cnt}
              </span>
            </button>
          );
        })}
      </div>

      {/* Vue cartes mobile (< md) — virtualisée */}
      {!isDesktop && (
        <div ref={mobileWrapRef}>
          {isLoading && <Loader label="Chargement du stock" />}
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
          {showRows && (
            <>
              {mPadTop > 0 && <div aria-hidden style={{ height: mPadTop }} />}
              {mItems.map((vr) => {
                const a = sorted[vr.index];
                return (
                  <ArticleCard
                    key={a.id}
                    data-index={vr.index}
                    ref={cardVirtualizer.measureElement}
                    a={a}
                    isSelected={selected.has(a.id)}
                    onToggleSelect={toggleOne}
                    onShowDetail={handleShowDetail}
                  />
                );
              })}
              {mPadBottom > 0 && (
                <div aria-hidden style={{ height: mPadBottom }} />
              )}
            </>
          )}
        </div>
      )}

      {/* Tableau (≥ md) — virtualisé */}
      {isDesktop && (
      <div
        ref={desktopWrapRef}
        className="overflow-x-auto rounded-[20px] border border-[#E4E9E2] bg-white"
      >
        <table
          style={{ minWidth: Math.max(640, colCount * 96) }}
          className="w-full border-collapse text-body-md"
        >
          <thead>
            <tr className="border-b border-[#E4E9E2] bg-[#F7F9F6] text-left text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#8A998F]">
              <th className="w-10 px-[22px] py-[15px]">
                <input
                  type="checkbox"
                  aria-label="Tout sélectionner"
                  className="h-4 w-4 cursor-pointer accent-[#1B4332]"
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
                  className={`cursor-pointer select-none whitespace-nowrap px-3 py-[15px] transition-colors hover:text-[#3C4D44] ${
                    c.align === "right" ? "text-right" : ""
                  }`}
                >
                  {c.label}
                  {sortIndicator(c.key)}
                </th>
              ))}
              <th className="px-[22px] py-[15px] text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={colCount + 1} className="py-12">
                  <Loader label="Chargement du stock" />
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
            {showRows && (
              <>
                {dPadTop > 0 && (
                  <tr aria-hidden>
                    <td
                      colSpan={colCount}
                      style={{ height: dPadTop, padding: 0, border: 0 }}
                    />
                  </tr>
                )}
                {dItems.map((vr) => {
                  const a = sorted[vr.index];
                  return (
                    <ArticleRow
                      key={a.id}
                      data-index={vr.index}
                      ref={rowVirtualizer.measureElement}
                      a={a}
                      shownColumns={shownColumns}
                      isSelected={selected.has(a.id)}
                      onToggleSelect={toggleOne}
                      onPatch={handlePatch}
                      onStatutChange={handleStatutChange}
                      onDelete={handleDelete}
                      onShowDetail={handleShowDetail}
                    />
                  );
                })}
                {dPadBottom > 0 && (
                  <tr aria-hidden>
                    <td
                      colSpan={colCount}
                      style={{ height: dPadBottom, padding: 0, border: 0 }}
                    />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* Compteur */}
      <div className="mt-5 flex flex-wrap gap-x-7 gap-y-1 text-[14px] text-[#71807A]">
        <span>
          <strong className="font-bold text-[#16261D]">{sorted.length.toLocaleString("fr-FR")}</strong> article(s) affiché(s)
        </span>
        <span>
          <strong className="font-bold text-[#16261D]">{totals.enStock}</strong> en stock
        </span>
        <span>
          <strong className="font-bold text-[#16261D]">{totals.vendus}</strong> vendus
        </span>
        <span>
          Marge nette filtrée :{" "}
          <strong className="font-bold text-[#2D6A4F]">{euros(totals.net)}</strong>
        </span>
      </div>

      {/* Barre d'action de sélection en masse */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 flex justify-center px-4 md:bottom-6 md:left-sidebar">
          <div className="flex flex-wrap items-center gap-3 rounded-full border border-[#E4E9E2] bg-white px-5 py-3 shadow-[0_14px_30px_-18px_rgba(20,53,40,.5)]">
            <span className="text-[14px] font-semibold text-[#16261D]">
              {selected.size} article(s) sélectionné(s)
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-medium text-[#8A998F]">
                Changer le statut
              </span>
              <select
                value={bulkStatut}
                onChange={(e) => setBulkStatut(e.target.value)}
                className="rounded-full border border-[#E4E9E2] bg-white px-3 py-1.5 text-[14px] font-semibold text-[#3C4D44] outline-none focus:border-[#CBD8CE]"
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
              className="rounded-full bg-[#1B4332] px-4 py-1.5 text-[14px] font-bold text-white transition-colors hover:bg-[#143528] disabled:opacity-60"
            >
              {bulk.isPending ? "…" : "Appliquer"}
            </button>
            <button
              onClick={clearSelection}
              className="text-[12px] font-medium text-[#8A998F] hover:text-[#16261D]"
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

      <Modal
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title={detailTarget ? detailTarget.sku : ""}
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-body-md">
              <StatutBadge statut={detail.statut} />
              <span className="text-ink-muted">
                <span className="text-ink-faint">Marque : </span>
                {detail.marque}
              </span>
              <span className="text-ink-muted">
                <span className="text-ink-faint">Catégorie : </span>
                {detail.categorie}
              </span>
              <span className="text-ink-muted">
                <span className="text-ink-faint">Prix achat : </span>
                {euros(detail.prixAchat)}
              </span>
            </div>

            {detail.statut === STATUT_VENDU && (
              <div className="space-y-3 border-t border-line pt-4">
                <h3 className="text-label-sm font-semibold uppercase tracking-wide text-ink-faint">
                  Informations de vente
                </h3>
                <p className="text-label-sm text-ink-faint">
                  Double-clic sur une valeur pour corriger une erreur de saisie.
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-body-md">
                  <div>
                    <span className="mb-0.5 block text-label-sm text-ink-faint">
                      Prix de vente
                    </span>
                    <EditableCell
                      value={detail.prixVente}
                      display={
                        detail.prixVente != null ? euros(detail.prixVente) : "—"
                      }
                      type="number"
                      onSave={(v) =>
                        handlePatch(detail.id, { prixVente: Number(v) })
                      }
                    />
                  </div>
                  <div>
                    <span className="mb-0.5 block text-label-sm text-ink-faint">
                      Date de vente
                    </span>
                    <EditableCell
                      value={detail.dateVente ? detail.dateVente.slice(0, 10) : null}
                      display={
                        detail.dateVente
                          ? new Date(detail.dateVente).toLocaleDateString("fr-FR")
                          : "—"
                      }
                      type="text"
                      onSave={(v) =>
                        handlePatch(detail.id, {
                          dateVente: v ? new Date(v).toISOString() : null,
                        })
                      }
                    />
                  </div>
                  <div>
                    <span className="mb-0.5 block text-label-sm text-ink-faint">
                      Canal
                    </span>
                    <select
                      value={detail.canal ?? ""}
                      onChange={(e) =>
                        handlePatch(detail.id, { canal: e.target.value })
                      }
                      className="mt-0.5 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-body-md text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    >
                      {detail.canal == null && <option value="">—</option>}
                      {CANAUX.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="mb-0.5 block text-label-sm text-ink-faint">
                      Marge nette
                    </span>
                    <span
                      className={`mt-0.5 block px-2 py-1 font-medium ${
                        detail.margeNette != null && detail.margeNette < 0
                          ? "text-error"
                          : "text-primary"
                      }`}
                    >
                      {detail.margeNette != null ? euros(detail.margeNette) : "—"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {detail.titreAnnonce ? (
              <div className="space-y-3 border-t border-line pt-4">
                <h3 className="text-label-sm font-semibold uppercase tracking-wide text-ink-faint">
                  Annonce
                </h3>
                <DetailCopyField label="Titre" value={detail.titreAnnonce} />
                <DetailCopyField
                  label="Description"
                  value={detail.descriptionAnnonce ?? ""}
                  multiline
                />
                <DetailCopyField
                  label="Mots-clés"
                  value={detail.motsClesAnnonce ?? ""}
                />
              </div>
            ) : (
              <p className="border-t border-line pt-4 text-body-md text-ink-faint">
                Aucune annonce générée.{" "}
                <a href="/mise-en-vente" className="text-primary underline">
                  Créer une annonce
                </a>
              </p>
            )}
          </div>
        )}
      </Modal>
    </main>
  );
}

function DetailCopyField({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-md border border-line bg-surface-soft p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-label-sm font-medium uppercase tracking-wide text-ink-faint">
          {label}
        </span>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded-full border border-line bg-surface px-3 py-0.5 text-label-sm font-medium text-ink transition-colors hover:bg-surface-container"
        >
          {copied ? "Copié ✓" : "Copier"}
        </button>
      </div>
      <p className={`text-body-md text-ink ${multiline ? "whitespace-pre-wrap" : ""}`}>
        {value || "—"}
      </p>
    </div>
  );
}

export default function StockPage() {
  return (
    <Suspense>
      <StockInner />
    </Suspense>
  );
}
