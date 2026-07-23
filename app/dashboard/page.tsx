"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Package,
  HandCoins,
  TrendingUp,
  TrendingDown,
  Calendar,
  ChevronDown,
  Check,
} from "lucide-react";
import { useDashboard, type DashboardPeriode } from "@/lib/hooks";
import { euros } from "@/lib/calc";
import type { BrandRow, DashboardDelta, WeekPoint } from "@/lib/types";
import Loader from "@/components/Loader";
import WelcomeModal from "@/components/WelcomeModal";

const PERIODES: { key: DashboardPeriode; label: string }[] = [
  { key: "all", label: "Tout l'historique" },
  { key: "month", label: "Ce mois" },
  { key: "30j", label: "30 derniers jours" },
  { key: "3m", label: "3 derniers mois" },
];

// ─────────────────────────────────────────────────────────────────────────
// Helpers d'affichage
// ─────────────────────────────────────────────────────────────────────────

// Date du jour en français, capitalisée (« Mardi 24 juin 2026 »).
function todayLabel(): string {
  const s = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Pourcentage signé : 0.154 → « +15,4 % », -0.062 → « −6,2 % ». null si pas de base.
function signedPct(p: number | null): string | null {
  if (p == null || !Number.isFinite(p)) return null;
  const sign = p >= 0 ? "+" : "−";
  return `${sign}${(Math.abs(p) * 100).toFixed(1).replace(".", ",")} %`;
}

// Euros signés : 1689 → « +1 689,00 € », -420 → « −420,00 € ».
function signedEur(n: number): string {
  const sign = n >= 0 ? "+" : "−";
  return `${sign}${euros(Math.abs(n))}`;
}

// Pourcentage entier (0.488 → « 49 % »).
const pctInt = (n: number) => `${Math.round(n * 100)} %`;

// Initiales d'une marque pour le badge carré (Polo Ralph Lauren → « PR »).
function initials(marque: string): string {
  const words = marque.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return marque.trim().slice(0, 2).toUpperCase();
}

// Coefficient formaté façon design (« 2,34× »).
const coefLabel = (n: number) => `${n.toFixed(2).replace(".", ",")}×`;

// Code couleur du coef (barème handoff) → classes pill.
function coefPillClasses(n: number): string {
  if (n >= 2.3) return "text-[#2D6A4F] bg-[#E4F3EA]";
  if (n >= 2.0) return "text-[#B5872E] bg-[#FBF3E2]";
  return "text-[#C2603F] bg-[#FBEEE7]";
}

// ─────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────

const name = process.env.NEXT_PUBLIC_USER_NAME ?? "Alex";

export default function DashboardPage() {
  const [periode, setPeriode] = useState<DashboardPeriode>("all");
  const [showDropdown, setShowDropdown] = useState(false);
  const { data, isLoading, isError, error } = useDashboard(periode);

  if (isLoading && !data) {
    return (
      <Frame>
        <Loader label="Chargement du dashboard" />
      </Frame>
    );
  }
  if (isError || !data) {
    return (
      <Frame>
        <p className="text-[#C2603F]">
          {error ? (error as Error).message : "Erreur de chargement."}
        </p>
      </Frame>
    );
  }

  const periodeLabel = PERIODES.find((p) => p.key === periode)?.label ?? "Tout l’historique";

  return (
    <Frame>
      <WelcomeModal />
      {/* TOPBAR */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-grotesk text-[26px] font-bold tracking-[-0.025em] text-[var(--ink)] md:text-[30px]">
            Bonjour {name} 👋
          </h1>
          <p className="mt-1.5 text-[14.5px] font-medium text-[var(--muted)]">
            {todayLabel()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Dropdown période */}
          <div className="relative">
            {showDropdown && (
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowDropdown(false)}
              />
            )}
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="relative z-20 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-surface px-3.5 py-2.5 text-[13.5px] font-semibold text-[var(--ink2)] transition-colors hover:border-[var(--border-strong)]"
            >
              <Calendar className="h-4 w-4" strokeWidth={2} />
              {periodeLabel}
              <ChevronDown
                className={`h-[15px] w-[15px] opacity-55 transition-transform ${showDropdown ? "rotate-180" : ""}`}
                strokeWidth={2}
              />
            </button>
            {showDropdown && (
              <div className="absolute right-0 top-full z-20 mt-1 w-[210px] overflow-hidden rounded-[14px] border border-[var(--border)] bg-surface py-1 shadow-[0_10px_30px_-10px_rgba(0,0,0,.15)]">
                {PERIODES.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => {
                      setPeriode(p.key);
                      setShowDropdown(false);
                    }}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-[13.5px] font-semibold transition-colors hover:bg-[var(--tint)] ${
                      periode === p.key ? "text-[#1B4332]" : "text-[var(--ink2)]"
                    }`}
                  >
                    {p.label}
                    {periode === p.key && (
                      <Check className="h-[14px] w-[14px] text-[#1B4332]" strokeWidth={2.5} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* HERO + MARGE */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.55fr_1fr]">
        <HeroCard
          ca={data.caTotal}
          delta={data.caDelta}
          spark={data.caParSemaine}
          periodeLabel={periodeLabel}
        />
        <MargeCard total={data.margeNetteTotal} moyenne={data.margeMoyenne} delta={data.margeDelta} />
      </div>

      {/* 2 PETITS KPI */}
      <div className="mb-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <StockCard enStock={data.enStock} total={data.totalArticles} />
        <TauxVenteCard pct={data.pctVendu} vendus={data.vendus} />
      </div>

      {/* CHART CA PAR SEMAINE — keyé sur la période pour rejouer la cascade */}
      <WeeklyBars key={periode} data={data.caParSemaine} />

      {/* PAR MARQUE */}
      <BrandGrid brands={data.parMarque} />
    </Frame>
  );
}

// Conteneur principal : fond app + padding du handoff.
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-5 py-7 text-[var(--ink)] md:px-[38px] md:py-[30px] md:pb-[46px]">
      {children}
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Hero (CA total)
// ─────────────────────────────────────────────────────────────────────────

const HERO_PARTICLES = [
  { left: "18%", top: "30%", size: 5,   anim: "drift",  dur: 7,   delay: 0,   opacity: .5  },
  { left: "34%", top: "64%", size: 3,   anim: "driftB", dur: 9,   delay: .8,  opacity: .35 },
  { left: "52%", top: "22%", size: 4,   anim: "drift",  dur: 8,   delay: 1.4, opacity: .45 },
  { left: "62%", top: "70%", size: 6,   anim: "driftB", dur: 11,  delay: .4,  opacity: .3  },
  { left: "72%", top: "40%", size: 3,   anim: "drift",  dur: 6.5, delay: 1.1, opacity: .5  },
  { left: "44%", top: "46%", size: 2.5, anim: "driftB", dur: 10,  delay: 2,   opacity: .4  },
  { left: "26%", top: "52%", size: 3.5, anim: "drift",  dur: 8.5, delay: 1.7, opacity: .35 },
  { left: "80%", top: "60%", size: 4,   anim: "driftB", dur: 7.5, delay: .2,  opacity: .4  },
  { left: "12%", top: "70%", size: 2.5, anim: "drift",  dur: 9.5, delay: 2.4, opacity: .45 },
] as const;

function HeroCard({
  ca,
  delta,
  spark,
  periodeLabel,
}: {
  ca: number;
  delta: DashboardDelta;
  spark: WeekPoint[];
  periodeLabel: string;
}) {
  const pct = signedPct(delta.pct);
  const positive = delta.pct == null || delta.pct >= 0;
  return (
    <div
      className="relative overflow-hidden rounded-[22px] px-7 py-7 text-white shadow-[0_18px_40px_-22px_rgba(20,53,40,.7)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_30px_60px_-26px_rgba(20,53,40,.85)] md:px-8"
      style={{
        background:
          "radial-gradient(120% 130% at 88% 8%, #2D6A4F 0%, #1B4332 46%, #143528 100%)",
      }}
    >
      {/* ATLAS watermark */}
      <svg
        width="300" height="300" viewBox="0 0 96 96" fill="none"
        className="pointer-events-none absolute -bottom-[70px] -right-[46px] opacity-[.06]"
      >
        <path d="M27 69 V31 L48 54 L69 31 V69" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {/* halo animé */}
      <div
        className="pointer-events-none absolute -right-8 -top-16 h-60 w-60 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(116,217,162,.28), transparent 70%)",
          animation: "floatGlow 9s ease-in-out infinite",
        }}
      />
      {/* particules */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {HERO_PARTICLES.map((p, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: p.left, top: p.top,
              width: p.size, height: p.size,
              background: "#A8D5B5",
              opacity: p.opacity,
              boxShadow: "0 0 6px rgba(168,213,181,.7)",
              animation: `${p.anim} ${p.dur}s ease-in-out ${p.delay}s infinite, twinkle ${p.dur * 0.6}s ease-in-out ${p.delay}s infinite`,
            }}
          />
        ))}
      </div>
      {/* sheen */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-20"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,.07), transparent)",
          animation: "sheen 6.5s ease-in-out 1.2s infinite",
        }}
      />
      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="text-[12px] font-bold tracking-[0.1em] text-[#9FD4B5]">
            CA TOTAL
          </span>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11.5px] font-semibold text-[#BFE3CE]">
            {periodeLabel}
          </span>
        </div>
        <Sparkline points={spark} />
      </div>
      <div className="relative mt-3.5 font-grotesk text-[44px] font-bold leading-none tracking-[-0.03em] md:text-[62px]">
        {euros(ca)}
      </div>
      <div className="relative mt-4 flex flex-wrap items-center gap-3.5">
        {pct && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-bold"
            style={{
              background: positive
                ? "rgba(124,224,168,.18)"
                : "rgba(224,160,107,.2)",
              color: positive ? "#A6ECC4" : "#F0C29B",
            }}
          >
            {positive ? (
              <TrendingUp className="h-[15px] w-[15px]" strokeWidth={2.4} />
            ) : (
              <TrendingDown className="h-[15px] w-[15px]" strokeWidth={2.4} />
            )}
            {pct}
          </span>
        )}
        <span className="text-[13.5px] font-medium text-[#BBD3C5]">
          vs mois dernier · {signedEur(delta.abs)}
        </span>
      </div>
    </div>
  );
}

// Mini-courbe SVG dérivée des 8 dernières semaines.
function Sparkline({ points }: { points: WeekPoint[] }) {
  const vals = points.map((p) => p.ca);
  const max = Math.max(1, ...vals);
  const min = Math.min(...vals, 0);
  const n = vals.length;
  const pts = vals.map((v, i) => ({
    x: n > 1 ? 2 + (i * 70) / (n - 1) : 37,
    y: 28 - ((v - min) / (max - min || 1)) * 25,
  }));
  const d =
    pts.length > 0
      ? `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} ${pts
          .slice(1)
          .map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          .join(" ")}`
      : "";
  return (
    <svg width="74" height="34" viewBox="0 0 74 34" fill="none" className="opacity-90">
      <path
        d={d}
        fill="none"
        stroke="#7CE0A8"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={100}
        style={{
          strokeDasharray: 100,
          animation: "atlas-draw 4.5s ease-in-out 0.3s infinite",
        }}
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Marge nette
// ─────────────────────────────────────────────────────────────────────────

function MargeCard({
  total,
  moyenne,
  delta,
}: {
  total: number;
  moyenne: number;
  delta: DashboardDelta;
}) {
  const pct = signedPct(delta.pct);
  const positive = delta.pct == null || delta.pct >= 0;
  return (
    <div className="flex flex-col justify-between rounded-[22px] border border-[var(--border)] bg-surface px-6 py-6 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-[var(--border-strong)] hover:shadow-[0_24px_44px_-28px_rgba(20,53,40,.5)]">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[12.5px] font-bold uppercase tracking-[0.04em] text-[var(--faint)]">
            Marge nette
          </div>
          <div className="mt-2.5 font-grotesk text-[36px] font-bold tracking-[-0.02em] text-[var(--ink)] md:text-[40px]">
            {euros(total)}
          </div>
        </div>
        <div className="flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-[13px] bg-[#EAF3ED] text-[#1B4332]">
          <HandCoins className="h-[22px] w-[22px]" strokeWidth={2} />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        {pct && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-bold ${
              positive ? "bg-[#E7F4EC] text-[#2D6A4F]" : "bg-[#FBEEE7] text-[#B5613B]"
            }`}
          >
            {positive ? (
              <TrendingUp className="h-[13px] w-[13px]" strokeWidth={2.6} />
            ) : (
              <TrendingDown className="h-[13px] w-[13px]" strokeWidth={2.6} />
            )}
            {pct}
          </span>
        )}
        <span className="text-[12.5px] font-medium text-[var(--faint-2)]">
          marge moyenne {pctInt(moyenne)}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// KPI : Articles en stock
// ─────────────────────────────────────────────────────────────────────────

function StockCard({ enStock, total }: { enStock: number; total: number }) {
  return (
    <div className="flex items-center gap-5 rounded-[22px] border border-[var(--border)] bg-surface px-6 py-[22px] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-[var(--border-strong)] hover:shadow-[0_24px_44px_-28px_rgba(20,53,40,.5)]">
      <div className="flex h-[50px] w-[50px] flex-shrink-0 items-center justify-center rounded-[14px] bg-[#EAF3ED] text-[#1B4332]">
        <Package className="h-6 w-6" strokeWidth={2} />
      </div>
      <div className="flex-1">
        <div className="text-[12.5px] font-bold uppercase tracking-[0.04em] text-[var(--faint)]">
          Articles en stock
        </div>
        <div className="mt-1.5 flex items-baseline gap-2.5">
          <span className="font-grotesk text-[36px] font-bold tracking-[-0.02em] text-[var(--ink)]">
            {enStock}
          </span>
          <span className="text-[13px] font-semibold text-[var(--faint-2)]">
            / {total.toLocaleString("fr-FR")} au total
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// KPI : Taux de vente (anneau)
// ─────────────────────────────────────────────────────────────────────────

function TauxVenteCard({ pct, vendus }: { pct: number; vendus: number }) {
  const r = 24;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, Math.max(0, pct)));
  return (
    <div className="flex items-center gap-5 rounded-[22px] border border-[var(--border)] bg-surface px-6 py-[22px] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-[var(--border-strong)] hover:shadow-[0_24px_44px_-28px_rgba(20,53,40,.5)]">
      <div className="relative h-[58px] w-[58px] flex-shrink-0">
        <svg width="58" height="58" viewBox="0 0 58 58" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="29" cy="29" r={r} fill="none" stroke="#EAF0EB" strokeWidth="7" />
          <circle
            cx="29"
            cy="29"
            r={r}
            fill="none"
            stroke="#1B4332"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-grotesk text-[15px] font-bold text-[#1B4332]">
          {pctInt(pct)}
        </span>
      </div>
      <div className="flex-1">
        <div className="text-[12.5px] font-bold uppercase tracking-[0.04em] text-[var(--faint)]">
          Taux de vente
        </div>
        <div className="mt-1.5 flex items-baseline gap-2.5">
          <span className="font-grotesk text-[36px] font-bold tracking-[-0.02em] text-[var(--ink)]">
            {pctInt(pct)}
          </span>
          <span className="text-[13px] font-semibold text-[var(--faint-2)]">
            {vendus.toLocaleString("fr-FR")} vendus
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Graphe : CA par semaine (barres custom + tooltip au survol)
// ─────────────────────────────────────────────────────────────────────────

function WeeklyBars({ data }: { data: WeekPoint[] }) {
  const [hovered, setHovered] = useState(-1);
  const max = Math.max(1, ...data.map((d) => d.ca));
  let bestIdx = 0;
  data.forEach((d, i) => {
    if (d.ca > data[bestIdx].ca) bestIdx = i;
  });
  return (
    <div className="mb-5 rounded-[22px] border border-[var(--border)] bg-surface px-6 py-6 transition-[box-shadow,border-color] duration-300 hover:border-[var(--border-strong)] hover:shadow-[0_24px_50px_-32px_rgba(20,53,40,.45)] md:px-7">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <h2 className="font-grotesk text-[19px] font-bold tracking-[-0.01em] text-[var(--ink)]">
            CA par semaine
          </h2>
          <div className="mt-2 flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--faint)]">
              <span className="h-[9px] w-[9px] rounded-[3px] bg-[#1B4332]" />
              Meilleure semaine
            </span>
          </div>
        </div>
        <span className="rounded-full bg-[var(--tint)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--muted)]">
          8 dernières semaines
        </span>
      </div>

      <div className="relative mt-4 h-[248px]">
        {/* gridlines */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[26px] top-0 flex flex-col justify-between">
          <div className="border-t border-dashed border-[#EAEEE7]" />
          <div className="border-t border-dashed border-[#EAEEE7]" />
          <div className="border-t border-dashed border-[#EAEEE7]" />
          <div className="border-t border-dashed border-[#EAEEE7]" />
          <div className="border-t border-[var(--border)]" />
        </div>
        {/* bars */}
        <div className="absolute inset-0 flex items-stretch gap-2 md:gap-3.5">
          {data.map((d, i) => {
            const isBest = i === bestIdx && d.ca > 0;
            const isHover = hovered === i;
            const fill = isHover
              ? "linear-gradient(180deg,#3A8463,#1B4332)"
              : isBest
                ? "linear-gradient(180deg,#2D6A4F,#1B4332)"
                : "linear-gradient(180deg,#B8D4C4,#9DBEAD)";
            const boxShadow = isHover
              ? "0 12px 24px -8px rgba(27,67,50,.7)"
              : isBest
                ? "0 10px 22px -10px rgba(27,67,50,.6)"
                : "none";
            const height = `${Math.round((d.ca / max) * 100)}%`;
            return (
              <div
                key={i}
                className="flex flex-1 flex-col items-center"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(-1)}
              >
                <div className="relative flex w-full flex-1 items-end justify-center">
                  {isHover && (
                    <div
                      className="absolute bottom-[calc(100%-2px)] left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-[11px] bg-[var(--ink)] px-3 py-2 text-white"
                      style={{ boxShadow: "0 10px 22px -10px rgba(0,0,0,.5)" }}
                    >
                      <div className="font-grotesk text-[14.5px] font-bold">
                        {euros(d.ca)}
                      </div>
                      <div className="mt-0.5 text-[11px] font-semibold text-[#9FD4B5]">
                        {d.semaine}
                      </div>
                    </div>
                  )}
                  <div
                    className="w-full max-w-[46px] cursor-pointer transition-[background,box-shadow] duration-200"
                    style={{
                      height,
                      background: fill,
                      borderRadius: "9px 9px 5px 5px",
                      boxShadow,
                      transformOrigin: "bottom",
                      animation: `growBar .55s cubic-bezier(.22,1,.36,1) ${(i * 0.05).toFixed(2)}s both`,
                    }}
                  />
                </div>
                <span className={`mt-2.5 text-[12px] font-semibold transition-colors ${isHover || isBest ? "font-bold text-[var(--ink)]" : "text-[var(--faint)]"}`}>
                  {d.semaine}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Par marque
// ─────────────────────────────────────────────────────────────────────────

function BrandGrid({ brands }: { brands: BrandRow[] }) {
  const router = useRouter();
  return (
    <div>
      <div className="mx-0.5 mb-4 flex items-center justify-between">
        <h2 className="font-grotesk text-[19px] font-bold tracking-[-0.01em] text-[var(--ink)]">
          Par marque
        </h2>
        <Link
          href="/stock"
          className="text-[13px] font-semibold text-[var(--muted)] transition-colors hover:text-[#1B4332]"
        >
          Voir le détail →
        </Link>
      </div>

      {brands.length === 0 ? (
        <div className="rounded-[20px] border border-[var(--border)] bg-surface px-6 py-12 text-center text-[var(--faint)]">
          Aucune donnée.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {brands.map((b) => (
            <button
              key={b.marque}
              onClick={() =>
                router.push(`/stock?marque=${encodeURIComponent(b.marque)}`)
              }
              className="group rounded-[20px] border border-[var(--border)] bg-surface px-6 py-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-[var(--border-strong)] hover:shadow-[0_22px_40px_-26px_rgba(20,53,40,.55)]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-[#1B4332] font-grotesk text-[15px] font-bold text-white">
                    {initials(b.marque)}
                  </div>
                  <div>
                    <div className="text-[15.5px] font-bold tracking-[-0.01em] text-[var(--ink)]">
                      {b.marque}
                    </div>
                    <div className="mt-px text-[12.5px] font-medium text-[var(--faint-2)]">
                      {b.enStock} en stock · {b.vendus} vendus
                    </div>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1.5 text-[12px] font-bold ${coefPillClasses(
                    b.coefMoyen,
                  )}`}
                >
                  {coefLabel(b.coefMoyen)}
                </span>
              </div>

              <div className="mb-1 mt-4 flex items-baseline gap-3">
                <span className="font-grotesk text-[28px] font-bold tracking-[-0.02em] text-[var(--ink)]">
                  {euros(b.ca)}
                </span>
                <span className="text-[13px] font-semibold text-[var(--faint-2)]">
                  {euros(b.margeNette)} de marge
                </span>
              </div>

              <div className="mb-1.5 mt-3.5 flex items-center justify-between text-[12px] font-semibold text-[var(--faint)]">
                <span>Taux de vente</span>
                <span className="font-bold text-[#1B4332]">{pctInt(b.pctVendu)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-md bg-[#EEF2EC]">
                <div
                  className="h-full rounded-md"
                  style={{
                    width: `${Math.round(b.pctVendu * 100)}%`,
                    background: "linear-gradient(90deg,#2D6A4F,#1B4332)",
                  }}
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
