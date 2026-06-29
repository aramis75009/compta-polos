"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FileSpreadsheet, Plus } from "lucide-react";
import { toast } from "sonner";
import { useCommandeStats, useCommandes, useDeleteCommande } from "@/lib/hooks";
import { coef, euros } from "@/lib/calc";
import type { CommandeDTO } from "@/lib/types";
import Loader from "@/components/Loader";
import NewCommandeModal from "@/components/NewCommandeModal";

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function getRenta(recovered: number, invested: number) {
  if (recovered >= invested)
    return { label: "Rentabilisée", color: "#2D6A4F", bg: "#E4F3EA", key: "rentable" as const };
  if (recovered < invested * 0.5)
    return { label: "En cours", color: "#C2603F", bg: "#FBEEE7", key: "encours" as const };
  return { label: "Seuil proche", color: "#B5872E", bg: "#FBF3E2", key: "proche" as const };
}

function pctColor(pct: number) {
  if (pct < 0.3) return "#C2603F";
  if (pct <= 0.6) return "#B5872E";
  return "#2D6A4F";
}

// ── Line chart ─────────────────────────────────────────────────────────────────
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
    <div style={{ borderRadius: 22, background: "#fff", border: "1px solid #E4E9E2", padding: "24px 26px 18px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: "var(--font-grotesk)", fontWeight: 700, fontSize: 18, color: "#16261D" }}>
            Investissements dans le temps
          </h2>
          <p style={{ margin: "5px 0 0", fontSize: 13, color: "#8A998F", fontWeight: 500 }}>
            Montant investi par mois
          </p>
        </div>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#71807A", background: "#F2F5F0", padding: "7px 13px", borderRadius: 20 }}>
          {n} mois
        </span>
      </div>
      <svg
        viewBox="0 0 620 216"
        width="100%"
        style={{ display: "block", height: "auto", overflow: "visible", marginTop: 14, fontFamily: "var(--font-grotesk)" }}
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1B4332" stopOpacity="0.16" />
            <stop offset="1" stopColor="#1B4332" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="50" y1="52" x2="570" y2="52" stroke="#EEF2EC" strokeWidth="1" />
        <line x1="50" y1="115" x2="570" y2="115" stroke="#EEF2EC" strokeWidth="1" />
        <line x1="50" y1="178" x2="570" y2="178" stroke="#E4E9E2" strokeWidth="1" />
        <path d={area} fill="url(#areaFill)" />
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
        {xs.map((x, i) =>
          i === maxIdx ? (
            <circle key={i} cx={x} cy={ys[i]} r="5" fill="#1B4332" style={{ cursor: "pointer" }} onMouseEnter={() => setHovered(i)} />
          ) : (
            <circle key={i} cx={x} cy={ys[i]} r="4.5" fill="#fff" stroke="#1B4332" strokeWidth="3" style={{ cursor: "pointer" }} onMouseEnter={() => setHovered(i)} />
          ),
        )}
        {hovered !== null && (
          <g>
            <rect
              x={Math.max(50, Math.min(xs[hovered] - 36, 534)).toFixed(1)}
              y={(ys[hovered] - 36).toFixed(1)}
              width="72" height="24" rx="8" fill="#16261D"
            />
            <text
              x={Math.max(86, Math.min(xs[hovered], 570)).toFixed(1)}
              y={(ys[hovered] - 19).toFixed(1)}
              textAnchor="middle" fill="white" fontSize="11" fontWeight="700"
            >
              {euros(months[hovered].value)}
            </text>
          </g>
        )}
        {xs.map((x, i) => (
          <text key={i} x={x.toFixed(1)} y="202" textAnchor="middle" fill="#8A998F" fontSize="12" fontWeight="600">
            {capitalize(months[i].label)}
          </text>
        ))}
      </svg>
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #EEF1EC", fontSize: 13, fontWeight: 500, color: "#71807A" }}>
        {"Total : "}
        <strong style={{ color: "#1B2A22", fontWeight: 700 }}>{euros(total)}</strong>
        <span style={{ color: "#C2CDC5", margin: "0 8px" }}>·</span>
        {"Moy./mois : "}
        <strong style={{ color: "#1B2A22", fontWeight: 700 }}>{euros(avg)}</strong>
      </div>
    </div>
  );
}

// ── Detail panel (inside the slide-down) ──────────────────────────────────────
function CommandeDetailPanel({
  commandeId,
  coutTotal,
  coefObjectif,
}: {
  commandeId: string;
  coutTotal: number;
  coefObjectif: number | null;
}) {
  const { data: stats, isLoading } = useCommandeStats(commandeId);

  if (isLoading) {
    return (
      <div style={{ padding: "24px 0", display: "flex", justifyContent: "center" }}>
        <Loader size="sm" />
      </div>
    );
  }
  if (!stats || stats.rows.length === 0) {
    return (
      <p style={{ margin: 0, padding: "16px 0", fontSize: 14, color: "#94A29A" }}>
        Aucun article dans cette commande.
      </p>
    );
  }

  const montantRecupere = stats.rows.reduce((s, r) => s + r.ca, 0);
  const totalVendus = stats.rows.reduce((s, r) => s + r.vendus, 0);
  const panierMoyen = totalVendus > 0 ? montantRecupere / totalVendus : 0;
  const resteARecuperer = Math.max(0, coutTotal - montantRecupere);
  const ratio = coutTotal > 0 ? montantRecupere / coutTotal : 0;
  const width = Math.min(100, Math.round(ratio * 100));
  const statut = getRenta(montantRecupere, coutTotal);
  const seuilArticles = panierMoyen > 0 ? Math.ceil(resteARecuperer / panierMoyen) : null;

  return (
    <div>
      {/* Rentabilité card */}
      <div style={{ borderRadius: 14, border: "1px solid #E4E9E2", background: "#FAFCF9", padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#16261D" }}>Rentabilité</h3>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: statut.bg, color: statut.color }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: statut.color, display: "inline-block" }} />
            {statut.label}
          </span>
        </div>
        <div style={{ height: 11, width: "100%", borderRadius: 8, background: "#EAEFE8", overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 8, width: `${width}%`, background: statut.color, transition: "width .8s cubic-bezier(.34,1.2,.5,1)" }} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 26px", marginTop: 12, fontSize: 13.5, color: "#71807A" }}>
          <span>Investi&nbsp;: <strong style={{ color: "#16261D" }}>{euros(coutTotal)}</strong></span>
          <span>Récupéré&nbsp;: <strong style={{ color: "#16261D" }}>{euros(montantRecupere)}</strong></span>
          <span>Reste&nbsp;: <strong style={{ color: statut.color }}>{euros(resteARecuperer)}</strong></span>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "#94A29A" }}>
          {montantRecupere >= coutTotal
            ? "✓ Investissement entièrement récupéré."
            : seuilArticles != null
              ? `Seuil de rentabilité : vendre ${seuilArticles} article${seuilArticles > 1 ? "s" : ""} de plus au panier moyen de ${euros(panierMoyen)}.`
              : "Aucune vente : panier moyen indisponible pour estimer le seuil."}
        </p>
      </div>

      {/* Category table (grid, no <table>) */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 760 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr .8fr .8fr .8fr .8fr 1fr 1.1fr 1fr .9fr", gap: 8, padding: "0 8px 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "#9BA89F" }}>
            <div>Catégorie</div>
            <div style={{ textAlign: "right" }}>Total</div>
            <div style={{ textAlign: "right" }}>En stock</div>
            <div style={{ textAlign: "right" }}>En vente</div>
            <div style={{ textAlign: "right" }}>Vendus</div>
            <div style={{ textAlign: "right" }}>CA (€)</div>
            <div style={{ textAlign: "right" }}>Marge nette</div>
            <div style={{ textAlign: "right" }}>Coef moyen</div>
            <div style={{ textAlign: "right" }}>% vendu</div>
          </div>
          {stats.rows.map((r) => {
            const cc =
              coefObjectif == null || r.coefMoyen === 0
                ? "#16261D"
                : r.coefMoyen < coefObjectif
                  ? "#C2603F"
                  : "#2D6A4F";
            return (
              <div key={r.categorie} style={{ display: "grid", gridTemplateColumns: "1.4fr .8fr .8fr .8fr .8fr 1fr 1.1fr 1fr .9fr", gap: 8, padding: "10px 8px", borderTop: "1px solid #EEF1EC", fontSize: 13.5, fontVariantNumeric: "tabular-nums" as const }}>
                <div style={{ fontWeight: 600, color: "#16261D" }}>{r.categorie}</div>
                <div style={{ textAlign: "right", color: "#71807A" }}>{r.total}</div>
                <div style={{ textAlign: "right", color: "#71807A" }}>{r.enStock}</div>
                <div style={{ textAlign: "right", color: "#71807A" }}>{r.enVente}</div>
                <div style={{ textAlign: "right", color: "#71807A" }}>{r.vendus}</div>
                <div style={{ textAlign: "right", fontWeight: 600, color: "#16261D" }}>{euros(r.ca)}</div>
                <div style={{ textAlign: "right", fontWeight: 600, color: "#2D6A4F" }}>{euros(r.margeNette)}</div>
                <div style={{ textAlign: "right", fontWeight: 700, color: cc }}>{r.coefMoyen > 0 ? coef(r.coefMoyen) : "—"}</div>
                <div style={{ textAlign: "right", fontWeight: 700, color: pctColor(r.pctVendu) }}>{Math.round(r.pctVendu * 100)}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Commande card row ──────────────────────────────────────────────────────────
function CommandeRow({
  c,
  index,
  expanded,
  onToggle,
}: {
  c: CommandeDTO;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const del = useDeleteCommande();
  const [menuOpen, setMenuOpen] = useState(false);
  const [cardHovered, setCardHovered] = useState(false);
  const [rowHovered, setRowHovered] = useState(false);
  const { data: stats } = useCommandeStats(c.id);

  const montantRecupere = stats?.rows.reduce((s, r) => s + r.ca, 0) ?? null;
  const statut = montantRecupere !== null ? getRenta(montantRecupere, c.coutTotal) : null;

  const handleDelete = () => {
    setMenuOpen(false);
    if (confirm(`Supprimer la commande « ${c.fournisseur} » et ses articles ?`)) {
      del.mutate(c.id, {
        onSuccess: () => toast.success("Commande supprimée."),
        onError: (e) => toast.error((e as Error).message),
      });
    }
  };

  const COL = "minmax(150px,1.6fr) 110px 80px 120px 110px 150px 168px";

  return (
    <div
      onMouseEnter={() => setCardHovered(true)}
      onMouseLeave={() => setCardHovered(false)}
      style={{
        borderRadius: 16,
        background: "#fff",
        border: `1px solid ${cardHovered ? "#CBD8CE" : "#E4E9E2"}`,
        boxShadow: cardHovered ? "0 16px 34px -22px rgba(20,53,40,.5)" : "none",
        transform: cardHovered ? "translateY(-2px)" : "translateY(0)",
        position: "relative",
        transition: "border-color .2s, box-shadow .25s, transform .25s",
        animation: `rowIn .5s ${index * 65}ms both`,
      }}
    >
      {/* Desktop row */}
      <div
        className="hidden md:grid"
        style={{
          gridTemplateColumns: COL,
          gap: 14,
          alignItems: "center",
          padding: "15px 22px",
          cursor: "pointer",
          borderRadius: 16,
          background: rowHovered ? "#F5F9F3" : "transparent",
          transition: "background .2s",
        }}
        onClick={onToggle}
        onMouseEnter={() => setRowHovered(true)}
        onMouseLeave={() => setRowHovered(false)}
      >
        {/* Fournisseur */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: "#16261D", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {c.fournisseur}
          </div>
          {c.coefObjectif != null && (
            <div style={{ marginTop: 2, fontSize: 12, fontWeight: 500, color: "#94A29A" }}>
              Objectif&nbsp;: ×{c.coefObjectif}
            </div>
          )}
        </div>

        <div style={{ fontSize: 13.5, color: "#71807A", fontWeight: 500 }}>
          {new Date(c.date).toLocaleDateString("fr-FR")}
        </div>

        <div style={{ fontSize: 13.5, color: "#71807A", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          {c.nbArticles}
        </div>

        <div style={{ fontSize: 13.5, color: "#16261D", textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {euros(c.coutTotal)}
        </div>

        <div style={{ fontSize: 13.5, color: "#2D6A4F", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {euros(c.prixUnitaire)}
        </div>

        {/* Rentabilité badge */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          {statut ? (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "6px 12px 6px 11px", borderRadius: 20, fontSize: 12, fontWeight: 700,
              background: statut.bg, color: statut.color,
              animation: statut.key === "encours" ? "pulseBadge 1.9s ease-in-out infinite" : "none",
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%", background: statut.color, display: "inline-block",
                animation: statut.key === "encours" ? "pulseDot 1.5s ease-in-out infinite" : "none",
              }} />
              {statut.label}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "#C2CDC5" }}>—</span>
          )}
        </div>

        {/* Actions */}
        <div
          style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, position: "relative" }}
          onClick={(e) => e.stopPropagation()}
        >
          <ToggleBtn expanded={expanded} onToggle={onToggle} />

          {/* ⋯ context menu */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <DotsBtn onClick={() => setMenuOpen((o) => !o)} />
            {menuOpen && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(false)} />
                <div style={{
                  position: "absolute", top: 38, right: 0, zIndex: 50,
                  width: 184, background: "#fff", border: "1px solid #E4E9E2",
                  borderRadius: 14, padding: 6,
                  boxShadow: "0 18px 38px -18px rgba(20,53,40,.45)",
                  animation: "modalIn .16s ease both",
                }}>
                  <MenuBtn
                    label="Voir les articles"
                    color="#3C4D44"
                    hoverBg="#F1F4EF"
                    onClick={() => { router.push(`/stock?commande=${c.id}`); setMenuOpen(false); }}
                  />
                  <MenuBtn
                    label="Supprimer"
                    color="#C2603F"
                    hoverBg="#FBEEE7"
                    onClick={handleDelete}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile card */}
      <div
        className="md:hidden flex items-center justify-between gap-3 p-4 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#1B4332", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-grotesk)", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
            {initials(c.fournisseur)}
          </div>
          <div className="min-w-0">
            <div style={{ fontWeight: 700, fontSize: 15, color: "#16261D" }} className="truncate">{c.fournisseur}</div>
            <div style={{ fontSize: 12.5, color: "#8A998F", marginTop: 1 }}>
              {new Date(c.date).toLocaleDateString("fr-FR")} · {c.nbArticles} art.
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15.5, color: "#16261D", fontFamily: "var(--font-grotesk)" }}>{euros(c.coutTotal)}</div>
          {statut && <div style={{ fontSize: 11.5, fontWeight: 700, color: statut.color }}>{statut.label}</div>}
        </div>
      </div>

      {/* Slide-down detail panel */}
      <div style={{ display: "grid", gridTemplateRows: expanded ? "1fr" : "0fr", transition: "grid-template-rows .4s cubic-bezier(.4,0,.2,1)" }}>
        <div style={{ overflow: "hidden", minHeight: 0 }}>
          <div style={{ opacity: expanded ? 1 : 0, transition: "opacity .3s ease .06s", padding: "2px 22px 22px" }}>
            <CommandeDetailPanel
              commandeId={c.id}
              coutTotal={c.coutTotal}
              coefObjectif={c.coefObjectif}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Small stateless helpers to avoid anonymous inline functions in JSX
function ToggleBtn({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: h ? "#E4F0E3" : "#F1F5EF",
        border: `1px solid ${h ? "#BFD4BD" : "#E0E8DD"}`,
        borderRadius: 10, padding: "7px 12px",
        fontSize: 12.5, fontWeight: 700, color: "#1B4332",
        fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
        transition: "background .2s, border-color .2s",
      }}
    >
      {expanded ? "Masquer" : "Voir le détail"}
      <ChevronDown strokeWidth={2.4} style={{ width: 14, height: 14, transform: `rotate(${expanded ? 180 : 0}deg)`, transition: "transform .35s" }} />
    </button>
  );
}

function DotsBtn({ onClick }: { onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      aria-label="Actions"
      style={{
        width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: h ? "#EEF2EC" : "transparent", border: "none", borderRadius: 8,
        color: h ? "#3C4D44" : "#8A998F", fontSize: 17, fontWeight: 700, lineHeight: 1, cursor: "pointer",
        transition: "background .2s, color .2s",
      }}
    >
      ⋯
    </button>
  );
}

function MenuBtn({ label, color, hoverBg, onClick }: { label: string; color: string; hoverBg: string; onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: "block", width: "100%", textAlign: "left",
        padding: "9px 12px", border: "none",
        background: h ? hoverBg : "transparent",
        borderRadius: 9, fontSize: 13.5, fontWeight: 600, color,
        cursor: "pointer", transition: "background .15s", fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function CommandesPage() {
  const router = useRouter();
  const { data: commandes = [], isLoading, isError, error } = useCommandes();
  const [newCommande, setNewCommande] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleDetail = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  const kpis = useMemo(() => {
    const totalInvesti = commandes.reduce((s, c) => s + c.coutTotal, 0);
    const totalArticles = commandes.reduce((s, c) => s + c.nbArticles, 0);
    return {
      totalInvesti,
      nbCommandes: commandes.length,
      prixUnitMoyen: totalArticles > 0 ? totalInvesti / totalArticles : 0,
    };
  }, [commandes]);

  const months = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("fr-FR", { month: "short" }), value: 0 };
    });
    for (const c of commandes) {
      const d = new Date(c.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const b = buckets.find((m) => m.key === key);
      if (b) b.value += c.coutTotal;
    }
    return buckets;
  }, [commandes]);

  const suppliers = useMemo(() => {
    const map = new Map<string, { total: number; articles: number; count: number; last: number }>();
    for (const c of commandes) {
      const cur = map.get(c.fournisseur) ?? { total: 0, articles: 0, count: 0, last: 0 };
      cur.total += c.coutTotal;
      cur.articles += c.nbArticles;
      cur.count += 1;
      cur.last = Math.max(cur.last, new Date(c.date).getTime());
      map.set(c.fournisseur, cur);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, total: v.total, articles: v.articles, count: v.count, last: v.last, unit: v.articles > 0 ? v.total / v.articles : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [commandes]);

  return (
    <main className="min-h-screen bg-[#EEF1EC] px-5 py-7 text-[#16261D] md:px-[38px] md:py-[30px] md:pb-[56px]">

      {/* Header */}
      <header
        className="mb-[22px] flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
        style={{ animation: "fadeUp .4s both" }}
      >
        <div>
          <h1 style={{ margin: 0, fontFamily: "var(--font-grotesk)", fontWeight: 700, fontSize: 30, letterSpacing: "-.025em" }}>
            Commandes
          </h1>
          <p style={{ margin: "7px 0 0", color: "#71807A", fontSize: 14.5, fontWeight: 500 }}>
            Tes achats en lot, par fournisseur.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-[11px]">
          <button
            onClick={() => toast.info("Import Excel — bientôt disponible.")}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E4E9E2] bg-white px-[15px] py-2.5 text-[13.5px] font-semibold text-[#3C4D44] transition-colors hover:border-[#CBD8CE]"
          >
            <FileSpreadsheet className="h-4 w-4" strokeWidth={2} />
            Importer un Excel
          </button>
          <button
            onClick={() => setNewCommande(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1B4332] px-[17px] py-[11px] text-[13.5px] font-bold text-white transition-[background,transform] hover:-translate-y-px hover:bg-[#143528]"
            style={{ boxShadow: "0 10px 22px -12px rgba(20,53,40,.8)" }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.3} />
            Nouvelle commande
          </button>
        </div>
      </header>

      {/* KPIs */}
      <div
        className="mb-5 grid grid-cols-1 gap-[18px] sm:grid-cols-3"
        style={{ animation: "fadeUp .45s both" }}
      >
        <div style={{
          borderRadius: 20,
          background: "radial-gradient(120% 130% at 88% 8%, #2D6A4F 0%, #1B4332 55%, #143528 100%)",
          color: "#fff", padding: "24px 26px",
          boxShadow: "0 18px 40px -24px rgba(20,53,40,.7)",
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".07em", color: "#9FD4B5" }}>TOTAL INVESTI</div>
          <div style={{ fontFamily: "var(--font-grotesk)", fontWeight: 700, fontSize: 42, letterSpacing: "-.025em", marginTop: 8, fontVariantNumeric: "tabular-nums" }}>
            {euros(kpis.totalInvesti)}
          </div>
          <div style={{ fontSize: 13, color: "#BBD3C5", fontWeight: 500, marginTop: 6 }}>
            {kpis.nbCommandes} commande{kpis.nbCommandes > 1 ? "s" : ""} · 6 derniers mois
          </div>
        </div>

        <div style={{ borderRadius: 20, background: "#fff", border: "1px solid #E4E9E2", padding: "24px 26px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#EAF3ED", color: "#1B4332", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-grotesk)", fontWeight: 700, fontSize: 34, letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums" }}>{kpis.nbCommandes}</div>
              <div style={{ fontSize: 12.5, color: "#8A998F", fontWeight: 600 }}>Commandes passées</div>
            </div>
          </div>
        </div>

        <div style={{ borderRadius: 20, background: "#fff", border: "1px solid #E4E9E2", padding: "24px 26px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#EAF3ED", color: "#1B4332", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-grotesk)", fontWeight: 700, fontSize: 34, letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums" }}>{euros(kpis.prixUnitMoyen)}</div>
              <div style={{ fontSize: 12.5, color: "#8A998F", fontWeight: 600 }}>Prix unitaire moyen</div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="mb-5" style={{ animation: "fadeUp .45s .06s both" }}>
        <InvestChart months={months} />
      </div>

      {/* Suppliers */}
      {suppliers.length > 0 && (
        <div className="mb-6" style={{ animation: "fadeUp .45s .12s both" }}>
          <h2 style={{ margin: "2px 2px 16px", fontFamily: "var(--font-grotesk)", fontWeight: 700, fontSize: 19, color: "#16261D" }}>
            Par fournisseur
          </h2>
          <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-2">
            {suppliers.map((s) => (
              <SupplierCard key={s.name} s={s} onClick={() => router.push("/stock")} />
            ))}
          </div>
        </div>
      )}

      {/* Commandes list */}
      <div style={{ animation: "fadeUp .45s .18s both" }}>
        <h2 style={{ margin: "2px 2px 14px", fontFamily: "var(--font-grotesk)", fontWeight: 700, fontSize: 19, color: "#16261D" }}>
          Détail des commandes
        </h2>

        {/* Column headers (desktop only) */}
        <div
          className="hidden md:grid"
          style={{
            gridTemplateColumns: "minmax(150px,1.6fr) 110px 80px 120px 110px 150px 168px",
            gap: 14, alignItems: "center",
            padding: "0 22px 11px",
            fontSize: 11, fontWeight: 700, letterSpacing: ".06em", color: "#9BA89F", textTransform: "uppercase",
          }}
        >
          <div>Fournisseur</div>
          <div>Date</div>
          <div style={{ textAlign: "right" }}>Nb art.</div>
          <div style={{ textAlign: "right" }}>Coût total</div>
          <div style={{ textAlign: "right" }}>Prix unit.</div>
          <div style={{ textAlign: "center" }}>Rentabilité</div>
          <div />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {isLoading && (
            <div className="py-16 flex justify-center">
              <Loader label="Chargement des commandes" />
            </div>
          )}
          {isError && (
            <p className="py-10 text-center text-[14px] text-[#C2603F]">
              {(error as Error).message}
            </p>
          )}
          {!isLoading && !isError && commandes.length === 0 && (
            <p className="py-10 text-center text-[14px] text-[#8A998F]">
              Aucune commande. Crée ta première commande !
            </p>
          )}
          {commandes.map((c: CommandeDTO, i) => (
            <CommandeRow
              key={c.id}
              c={c}
              index={i}
              expanded={expandedId === c.id}
              onToggle={() => toggleDetail(c.id)}
            />
          ))}
        </div>
      </div>

      <NewCommandeModal open={newCommande} onClose={() => setNewCommande(false)} />
    </main>
  );
}

// Supplier card with hover state
function SupplierCard({
  s,
  onClick,
}: {
  s: { name: string; total: number; articles: number; count: number; last: number; unit: number };
  onClick: () => void;
}) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        borderRadius: 20,
        background: h ? "#FCFDFB" : "#fff",
        border: `1px solid ${h ? "#CBD8CE" : "#E4E9E2"}`,
        padding: "22px 24px",
        textAlign: "left",
        cursor: "pointer",
        boxShadow: h ? "0 16px 32px -22px rgba(20,53,40,.55)" : "none",
        transform: h ? "translateY(-3px)" : "translateY(0)",
        transition: "border-color .2s, box-shadow .2s, transform .2s, background .2s",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "#1B4332", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-grotesk)", fontWeight: 700, fontSize: 15 }}>
            {initials(s.name)}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15.5, letterSpacing: "-.01em", color: "#16261D" }}>{s.name}</div>
            <div style={{ fontSize: 12.5, color: "#94A29A", fontWeight: 500, marginTop: 1 }}>
              Dernier achat · {new Date(s.last).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#2D6A4F", background: "#EAF3ED", padding: "5px 10px", borderRadius: 18 }}>
          {s.count} cmd
        </span>
      </div>
      <div style={{ display: "flex", gap: 26, marginTop: 20, paddingTop: 18, borderTop: "1px solid #EEF1EC" }}>
        <div>
          <div style={{ fontSize: 11.5, color: "#8A998F", fontWeight: 600 }}>Coût total</div>
          <div style={{ fontFamily: "var(--font-grotesk)", fontWeight: 700, fontSize: 20, letterSpacing: "-.02em", marginTop: 3 }}>{euros(s.total)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11.5, color: "#8A998F", fontWeight: 600 }}>Articles</div>
          <div style={{ fontFamily: "var(--font-grotesk)", fontWeight: 700, fontSize: 20, letterSpacing: "-.02em", marginTop: 3 }}>{s.articles}</div>
        </div>
        <div>
          <div style={{ fontSize: 11.5, color: "#8A998F", fontWeight: 600 }}>Prix unit.</div>
          <div style={{ fontFamily: "var(--font-grotesk)", fontWeight: 700, fontSize: 20, letterSpacing: "-.02em", marginTop: 3 }}>{euros(s.unit)}</div>
        </div>
      </div>
    </button>
  );
}
