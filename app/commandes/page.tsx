"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShoppingBag, HandCoins } from "lucide-react";
import { useCommandeStats, useCommandes, useDeleteCommande } from "@/lib/hooks";
import { coef, euros } from "@/lib/calc";
import type { CommandeDTO } from "@/lib/types";

import NewCommandeModal from "@/components/NewCommandeModal";

// Initiales d'un fournisseur pour le badge carré.
function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Palette des trois états de rentabilité.
const RENTA = {
  encours: { label: "En cours", emoji: "🔴", color: "#C2603F", bg: "#FBEEE7" },
  proche: { label: "Seuil proche", emoji: "🟡", color: "#B5872E", bg: "#FBF3E2" },
  rentable: { label: "Rentabilisée", emoji: "🟢", color: "#2D6A4F", bg: "#E4F3EA" },
} as const;

// Couleur d'un % vendu : <30% rouge, 30-60% ambre, >60% vert.
function pctColor(pct: number): string {
  if (pct < 0.3) return "#C2603F";
  if (pct <= 0.6) return "#B5872E";
  return "#2D6A4F";
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
    <div className="space-y-3 rounded-[16px] border border-[#E4E9E2] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[14px] font-bold text-[#16261D]">Rentabilité</h3>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-bold"
          style={{ backgroundColor: statut.bg, color: statut.color }}
        >
          {statut.emoji} {statut.label}
        </span>
      </div>

      {/* Barre de progression */}
      <div className="h-3 w-full overflow-hidden rounded-full bg-[#EEF2EC]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${width}%`, backgroundColor: statut.color }}
        />
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-[14px] text-[#71807A]">
        <span>
          Investi :{" "}
          <strong className="text-[#16261D]">{euros(investissement)}</strong>
        </span>
        <span>
          Récupéré :{" "}
          <strong className="text-[#16261D]">{euros(montantRecupere)}</strong>
        </span>
        <span>
          Reste :{" "}
          <strong style={{ color: statut.color }}>
            {euros(resteARecuperer)}
          </strong>
        </span>
      </div>

      <p className="text-[12px] text-[#94A29A]">
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
      <div className="px-6 py-4 text-[14px] text-[#94A29A]">
        Chargement du détail…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="px-6 py-4 text-[14px] text-[#C2603F]">
        {error ? (error as Error).message : "Erreur de chargement."}
      </div>
    );
  }
  if (data.rows.length === 0) {
    return (
      <div className="px-6 py-4 text-[14px] text-[#94A29A]">
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
        <table className="w-full min-w-[820px] border-collapse text-[14px]">
          <thead>
            <tr className="text-left text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#8A998F]">
              <th className="px-3 py-2">Catégorie</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">En stock</th>
              <th className="px-3 py-2 text-right">En vente</th>
              <th className="px-3 py-2 text-right">Vendus</th>
              <th className="px-3 py-2 text-right">CA (€)</th>
              <th className="px-3 py-2 text-right">Marge nette (€)</th>
              <th className="px-3 py-2 text-right">Coef moyen</th>
              <th className="px-3 py-2 text-right">% vendu</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => {
              const coefColor =
                coefObjectif == null || r.coefMoyen === 0
                  ? undefined
                  : r.coefMoyen < coefObjectif
                    ? "#C2603F"
                    : "#2D6A4F";
              return (
                <tr key={r.categorie} className="border-t border-[#EEF1EC]">
                  <td className="px-3 py-2 font-semibold text-[#16261D]">
                    {r.categorie}
                  </td>
                  <td className="px-3 py-2 text-right text-[#71807A]">
                    {r.total}
                  </td>
                  <td className="px-3 py-2 text-right text-[#71807A]">
                    {r.enStock}
                  </td>
                  <td className="px-3 py-2 text-right text-[#71807A]">
                    {r.enVente}
                  </td>
                  <td className="px-3 py-2 text-right text-[#71807A]">
                    {r.vendus}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-[#16261D]">
                    {euros(r.ca)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-[#2D6A4F]">
                    {euros(r.margeNette)}
                  </td>
                  <td
                    className="px-3 py-2 text-right font-semibold"
                    style={coefColor ? { color: coefColor } : undefined}
                  >
                    {r.coefMoyen > 0 ? coef(r.coefMoyen) : "—"}
                  </td>
                  <td
                    className="px-3 py-2 text-right font-semibold"
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

// Menu contextuel « ••• » : regroupe les actions d'une ligne.
function ActionsMenu({
  expanded,
  onToggleDetail,
  onVoirArticles,
  onDelete,
}: {
  expanded: boolean;
  onToggleDetail: () => void;
  onVoirArticles: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const item =
    "block w-full px-4 py-2.5 text-left text-[14px] text-[#3C4D44] transition-colors hover:bg-[#F1F4EF]";

  const toggle = () => {
    if (!open) {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen((o) => !o);
  };

  return (
    <div className="flex justify-end">
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label="Actions"
        aria-haspopup="menu"
        className="rounded-full px-3 py-1.5 text-[14px] font-bold leading-none text-[#71807A] transition-colors hover:bg-[#F1F4EF]"
      >
        •••
      </button>
      {open && pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            style={{ position: "fixed", top: pos.top, right: pos.right }}
            className="z-50 w-48 overflow-hidden rounded-[14px] border border-[#E4E9E2] bg-white py-1 shadow-[0_14px_30px_-18px_rgba(20,53,40,.5)]"
          >
            <button
              onClick={() => {
                onToggleDetail();
                setOpen(false);
              }}
              className={item}
            >
              {expanded ? "Masquer le détail" : "Voir le détail"}
            </button>
            <button
              onClick={() => {
                onVoirArticles();
                setOpen(false);
              }}
              className={item}
            >
              Voir les articles
            </button>
            <button
              onClick={() => {
                onDelete();
                setOpen(false);
              }}
              className={`${item} text-[#C2603F] hover:bg-[#FBEEE7]`}
            >
              Supprimer
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Petit graphe linéaire « investissements dans le temps » (aire + ligne animée).
function InvestChart({ months }: { months: { label: string; value: number }[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...months.map((m) => m.value));
  const n = months.length;
  const total = months.reduce((s, m) => s + m.value, 0);
  const avg = n > 0 ? total / n : 0;

  const xs = months.map((_, i) => 50 + (i * 520) / Math.max(1, n - 1));
  const ys = months.map((m) => 178 - (m.value / max) * 126);
  const maxIdx = months.reduce((best, m, i) => (m.value > months[best].value ? i : best), 0);
  const line = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const area = `M${xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ")} L${xs[n - 1].toFixed(1)},178 L${xs[0].toFixed(1)},178 Z`;

  return (
    <div className="rounded-[22px] border border-[#E4E9E2] bg-white px-6 py-6">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <h2 className="font-grotesk text-[18px] font-bold text-[#16261D]">
            Investissements dans le temps
          </h2>
          <p className="mt-1 text-[13px] font-medium text-[#8A998F]">
            Montant investi par mois
          </p>
        </div>
        <span className="rounded-full bg-[#F2F5F0] px-3 py-1.5 text-[12.5px] font-semibold text-[#71807A]">
          {n} mois
        </span>
      </div>
      <svg
        viewBox="0 0 620 216"
        width="100%"
        className="mt-2 block"
        style={{ display: "block", height: "auto", overflow: "visible" }}
        fontFamily="'Space Grotesk', sans-serif"
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1B4332" stopOpacity="0.16" />
            <stop offset="1" stopColor="#1B4332" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Gridlines */}
        <line x1="50" y1="52" x2="570" y2="52" stroke="#EEF2EC" strokeWidth="1" />
        <line x1="50" y1="115" x2="570" y2="115" stroke="#EEF2EC" strokeWidth="1" />
        <line x1="50" y1="178" x2="570" y2="178" stroke="#E4E9E2" strokeWidth="1" />

        {/* Area fill */}
        <path d={area} fill="url(#areaFill)" />

        {/* Animated line */}
        <polyline
          points={line}
          fill="none"
          stroke="#1B4332"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="1200"
          style={{ animation: "drawLine 1.4s ease both" }}
        />

        {/* Value labels */}
        {n <= 8 &&
          xs.map((x, i) => {
            const isFirst = i === 0;
            const isLast = i === n - 1;
            return (
              <text
                key={i}
                x={x.toFixed(1)}
                y={(ys[i] - 11).toFixed(1)}
                textAnchor={isFirst ? "start" : isLast ? "end" : "middle"}
                fill={isFirst || isLast ? "#1B4332" : "#5B6A62"}
                fontSize="11.5"
                fontWeight={isFirst || isLast ? "700" : "600"}
              >
                {euros(months[i].value)}
              </text>
            );
          })}

        {/* Data points */}
        {xs.map((x, i) =>
          i === maxIdx ? (
            <circle
              key={i}
              cx={x}
              cy={ys[i]}
              r="5"
              fill="#1B4332"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHovered(i)}
            />
          ) : (
            <circle
              key={i}
              cx={x}
              cy={ys[i]}
              r="4.5"
              fill="#fff"
              stroke="#1B4332"
              strokeWidth="3"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHovered(i)}
            />
          ),
        )}

        {/* Tooltip on hover */}
        {hovered !== null && (
          <g>
            <rect
              x={Math.max(50, Math.min(xs[hovered] - 36, 534)).toFixed(1)}
              y={(ys[hovered] - 36).toFixed(1)}
              width="72"
              height="24"
              rx="8"
              fill="#16261D"
            />
            <text
              x={Math.max(86, Math.min(xs[hovered], 570)).toFixed(1)}
              y={(ys[hovered] - 19).toFixed(1)}
              textAnchor="middle"
              fill="white"
              fontSize="11"
              fontWeight="700"
            >
              {euros(months[hovered].value)}
            </text>
          </g>
        )}

        {/* Month labels */}
        {xs.map((x, i) => (
          <text
            key={i}
            x={x.toFixed(1)}
            y="202"
            textAnchor="middle"
            fill="#8A998F"
            fontSize="12"
            fontWeight="600"
          >
            {capitalize(months[i].label)}
          </text>
        ))}
      </svg>

      <div className="mt-4 border-t border-[#EEF1EC] pt-3 text-[13px] font-medium text-[#71807A]">
        {"Total : "}
        <strong className="font-bold text-[#1B2A22]">{euros(total)}</strong>
        <span className="mx-2 text-[#C2CDC5]">·</span>
        {"Moy./mois : "}
        <strong className="font-bold text-[#1B2A22]">{euros(avg)}</strong>
      </div>
    </div>
  );
}

export default function CommandesPage() {
  const router = useRouter();
  const { data: commandes = [], isLoading, isError, error } = useCommandes();
  const del = useDeleteCommande();
  const [newCommande, setNewCommande] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleDetail = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  // --- KPIs ---
  const kpis = useMemo(() => {
    const totalInvesti = commandes.reduce((s, c) => s + c.coutTotal, 0);
    const totalArticles = commandes.reduce((s, c) => s + c.nbArticles, 0);
    return {
      totalInvesti,
      nbCommandes: commandes.length,
      prixUnitMoyen: totalArticles > 0 ? totalInvesti / totalArticles : 0,
    };
  }, [commandes]);

  // --- Investissements par mois (6 derniers mois) ---
  const months = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return {
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString("fr-FR", { month: "short" }),
        value: 0,
      };
    });
    for (const c of commandes) {
      const d = new Date(c.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const b = buckets.find((m) => m.key === key);
      if (b) b.value += c.coutTotal;
    }
    return buckets;
  }, [commandes]);

  // --- Agrégation par fournisseur ---
  const suppliers = useMemo(() => {
    const map = new Map<
      string,
      { total: number; articles: number; count: number; last: number }
    >();
    for (const c of commandes) {
      const cur =
        map.get(c.fournisseur) ?? { total: 0, articles: 0, count: 0, last: 0 };
      cur.total += c.coutTotal;
      cur.articles += c.nbArticles;
      cur.count += 1;
      cur.last = Math.max(cur.last, new Date(c.date).getTime());
      map.set(c.fournisseur, cur);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({
        name,
        total: v.total,
        articles: v.articles,
        count: v.count,
        last: v.last,
        unit: v.articles > 0 ? v.total / v.articles : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [commandes]);

  return (
    <main className="min-h-screen bg-[#EEF1EC] px-5 py-7 text-[#16261D] md:px-[38px] md:py-[30px] md:pb-[46px]">
      <header className="mb-[22px] flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-grotesk text-[26px] font-bold tracking-[-0.025em] md:text-[30px]">
            Commandes
          </h1>
          <p className="mt-1.5 text-[14.5px] font-medium text-[#71807A]">
            Tes achats en lot, par fournisseur.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setNewCommande(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1B4332] px-4 py-2.5 text-[13.5px] font-bold text-white shadow-[0_10px_22px_-12px_rgba(20,53,40,.8)] transition-colors hover:bg-[#143528]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.3} />
            Nouvelle commande
          </button>
        </div>
      </header>

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div
          className="rounded-[20px] px-6 py-6 text-white"
          style={{
            background:
              "radial-gradient(120% 130% at 88% 8%, #2D6A4F 0%, #1B4332 55%, #143528 100%)",
            boxShadow: "0 18px 40px -24px rgba(20,53,40,.7)",
          }}
        >
          <div className="text-[12px] font-bold tracking-[0.07em] text-[#9FD4B5]">
            TOTAL INVESTI
          </div>
          <div className="mt-2 font-grotesk text-[34px] font-bold tracking-[-0.025em] md:text-[42px]">
            {euros(kpis.totalInvesti)}
          </div>
          <div className="mt-1.5 text-[13px] font-medium text-[#BBD3C5]">
            {kpis.nbCommandes} commande{kpis.nbCommandes > 1 ? "s" : ""}
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-[20px] border border-[#E4E9E2] bg-white px-6 py-6">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#EAF3ED] text-[#1B4332]">
            <ShoppingBag className="h-[22px] w-[22px]" strokeWidth={2} />
          </div>
          <div>
            <div className="font-grotesk text-[34px] font-bold tracking-[-0.02em]">
              {kpis.nbCommandes}
            </div>
            <div className="text-[12.5px] font-semibold text-[#8A998F]">
              Commandes passées
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-[20px] border border-[#E4E9E2] bg-white px-6 py-6">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#EAF3ED] text-[#1B4332]">
            <HandCoins className="h-[22px] w-[22px]" strokeWidth={2} />
          </div>
          <div>
            <div className="font-grotesk text-[34px] font-bold tracking-[-0.02em]">
              {euros(kpis.prixUnitMoyen)}
            </div>
            <div className="text-[12.5px] font-semibold text-[#8A998F]">
              Prix unitaire moyen
            </div>
          </div>
        </div>
      </div>

      {/* Graphe investissements */}
      <div className="mb-5">
        <InvestChart months={months} />
      </div>

      {/* Par fournisseur */}
      {suppliers.length > 0 && (
        <div className="mb-6">
          <h2 className="mx-0.5 mb-4 font-grotesk text-[19px] font-bold text-[#16261D]">
            Par fournisseur
          </h2>
          <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-2">
            {suppliers.map((s) => (
              <button
                key={s.name}
                onClick={() => router.push(`/stock`)}
                className="rounded-[20px] border border-[#E4E9E2] bg-white px-6 py-5 text-left transition-all hover:border-[#CBD8CE] hover:shadow-[0_14px_30px_-22px_rgba(20,53,40,.5)]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1B4332] font-grotesk text-[15px] font-bold text-white">
                      {initials(s.name)}
                    </div>
                    <div>
                      <div className="text-[15.5px] font-bold tracking-[-0.01em] text-[#16261D]">
                        {s.name}
                      </div>
                      <div className="mt-px text-[12.5px] font-medium text-[#94A29A]">
                        Dernier achat ·{" "}
                        {new Date(s.last).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#EAF3ED] px-2.5 py-1.5 text-[12px] font-bold text-[#2D6A4F]">
                    {s.count} cmd
                  </span>
                </div>
                <div className="mt-5 flex gap-7 border-t border-[#EEF1EC] pt-[18px]">
                  <div>
                    <div className="text-[11.5px] font-semibold text-[#8A998F]">
                      Coût total
                    </div>
                    <div className="mt-0.5 font-grotesk text-[20px] font-bold tracking-[-0.02em]">
                      {euros(s.total)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11.5px] font-semibold text-[#8A998F]">
                      Articles
                    </div>
                    <div className="mt-0.5 font-grotesk text-[20px] font-bold tracking-[-0.02em]">
                      {s.articles}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11.5px] font-semibold text-[#8A998F]">
                      Prix unit.
                    </div>
                    <div className="mt-0.5 font-grotesk text-[20px] font-bold tracking-[-0.02em]">
                      {euros(s.unit)}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Détail des commandes (liste + actions par commande) */}
      <h2 className="mx-0.5 mb-4 font-grotesk text-[19px] font-bold text-[#16261D]">
        Détail des commandes
      </h2>
      <div className="overflow-x-auto rounded-[20px] border border-[#E4E9E2] bg-white">
        <table className="w-full table-fixed border-collapse text-[14px]">
          <colgroup>
            <col className="w-[160px]" />
            <col className="w-[100px]" />
            <col className="w-[80px]" />
            <col className="w-[110px]" />
            <col className="w-[100px]" />
            <col className="w-[64px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-[#E4E9E2] bg-[#F7F9F6] text-left text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#8A998F]">
              <th className="px-6 py-[15px]">Fournisseur</th>
              <th className="px-3 py-[15px]">Date</th>
              <th className="px-3 py-[15px] text-right">Nb art.</th>
              <th className="px-3 py-[15px] text-right">Coût total</th>
              <th className="px-3 py-[15px] text-right">Prix unit.</th>
              <th className="px-3 py-[15px] text-right"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-[#8A998F]">
                  Chargement…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-[#C2603F]">
                  {(error as Error).message}
                </td>
              </tr>
            )}
            {!isLoading && !isError && commandes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-[#8A998F]">
                  Aucune commande.
                </td>
              </tr>
            )}
            {commandes.map((c: CommandeDTO) => {
              const expanded = expandedId === c.id;
              return (
                <FragmentRow key={c.id}>
                  <tr className="border-b border-[#EEF1EC] transition-colors hover:bg-[#F7F9F6]">
                    <td className="px-6 py-3.5 font-semibold text-[#16261D]">
                      <div className="truncate" title={c.fournisseur}>
                        {c.fournisseur}
                      </div>
                      {c.coefObjectif != null && (
                        <div className="mt-0.5 text-[12px] font-normal text-[#94A29A]">
                          Objectif : x{c.coefObjectif}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-[#71807A]">
                      {new Date(c.date).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-3 py-3.5 text-right text-[#71807A]">
                      {c.nbArticles}
                    </td>
                    <td className="px-3 py-3.5 text-right text-[#16261D]">
                      {euros(c.coutTotal)}
                    </td>
                    <td className="px-3 py-3.5 text-right font-semibold text-[#2D6A4F]">
                      {euros(c.prixUnitaire)}
                    </td>
                    <td className="px-3 py-3.5">
                      <ActionsMenu
                        expanded={expanded}
                        onToggleDetail={() => toggleDetail(c.id)}
                        onVoirArticles={() =>
                          router.push(`/stock?commande=${c.id}`)
                        }
                        onDelete={() => {
                          if (
                            confirm(
                              `Supprimer la commande « ${c.fournisseur} » et ses articles ?`,
                            )
                          )
                            del.mutate(c.id);
                        }}
                      />
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-b border-[#EEF1EC] bg-[#F7F9F6]">
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
    </main>
  );
}

// Permet de retourner deux <tr> par commande (ligne + panneau détail).
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
