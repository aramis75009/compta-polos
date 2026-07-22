"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Loader from "@/components/Loader";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { fr } from "date-fns/locale";
import { X } from "lucide-react";
import { useCalendar } from "@/lib/hooks";
import { coef, euros, moyenne } from "@/lib/calc";
import type { CalendarDay } from "@/lib/types";

const JOURS = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];

/* ─── CountUp ────────────────────────────────────────────────────────────── */
function CountUp({
  value,
  duration = 850,
  fmt = (v: number) => String(Math.round(v)),
}: {
  value: number;
  duration?: number;
  fmt?: (v: number) => string;
}) {
  const [display, setDisplay] = useState(0);
  const lastRef = useRef(0);

  useEffect(() => {
    const from = lastRef.current;
    const t0 = performance.now();
    let raf: number;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (value - from) * e);
      if (p < 1) raf = requestAnimationFrame(step);
      else lastRef.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{fmt(display)}</>;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function coefPillStyle(v: number): React.CSSProperties {
  let color = "#C2603F",
    background = "#FBEEE7";
  if (v >= 2.3) {
    color = "#2D6A4F";
    background = "#E4F3EA";
  } else if (v >= 2.0) {
    color = "#B5872E";
    background = "#FBF3E2";
  }
  return {
    fontFamily: "var(--font-grotesk)",
    fontWeight: 700,
    fontSize: 12.5,
    color,
    background,
    padding: "3px 9px",
    borderRadius: 16,
    display: "inline-block",
    whiteSpace: "nowrap",
  };
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function CalendrierPage() {
  const [current, setCurrent] = useState(() => startOfMonth(new Date()));
  const [dir, setDir] = useState<"init" | "next" | "prev">("init");
  const month = format(current, "yyyy-MM");
  const { data, isLoading, isError } = useCalendar(month);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const dayMap = useMemo(() => {
    const m = new Map<string, CalendarDay>();
    for (const d of data?.days ?? []) m.set(d.date, d);
    return m;
  }, [data]);

  const weeks = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(current), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(current), { weekStartsOn: 1 });
    const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const result: Date[][] = [];
    for (let i = 0; i < allDays.length; i += 7) result.push(allDays.slice(i, i + 7));
    return result;
  }, [current]);

  const monthly = useMemo(() => {
    const days = data?.days ?? [];
    const coefs = days.flatMap((d) => d.articles.map((a) => a.coefficient));
    const ca = data?.total.ca ?? 0;
    const nb = data?.total.nbArticles ?? 0;
    return {
      ca,
      nb,
      net: data?.total.net ?? 0,
      coefMoyen: moyenne(coefs),
      panierMoyen: nb ? ca / nb : 0,
    };
  }, [data]);

  const selectedDay = selected ? dayMap.get(selected) : undefined;

  function navigate(delta: number) {
    setDir(delta > 0 ? "next" : "prev");
    setCurrent((c) => (delta > 0 ? addMonths(c, 1) : subMonths(c, 1)));
    setSelected(null);
    setHovered(null);
  }

  function goToday() {
    const n = startOfMonth(new Date());
    const cur = current.getFullYear() * 12 + current.getMonth();
    const tgt = n.getFullYear() * 12 + n.getMonth();
    setDir(tgt >= cur ? "next" : "prev");
    setCurrent(n);
    setSelected(null);
    setHovered(null);
  }

  const gridAnim =
    dir === "next"
      ? "gridFadeR .5s cubic-bezier(.22,1,.36,1) both"
      : dir === "prev"
        ? "gridFadeL .5s cubic-bezier(.22,1,.36,1) both"
        : "gridFadeUp .5s cubic-bezier(.22,1,.36,1) both";

  return (
    <main className="min-h-screen bg-[var(--bg)] px-5 py-7 text-[var(--ink)] md:px-[38px] md:py-[30px] md:pb-[46px]">

      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <div
        className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
        style={{ animation: "fadeUp .4s both" }}
      >
        <div>
          <p className="text-[14.5px] font-medium text-[var(--muted)]">
            Tes ventes jour par jour — la couronne marque le meilleur jour de chaque semaine.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate(-1)}
            aria-label="Mois précédent"
            className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-[var(--border)] bg-surface text-[var(--ink2)] transition-all hover:-translate-x-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--tint)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={goToday}
            className="h-10 rounded-[11px] border border-[var(--border)] bg-surface px-4 text-[13.5px] font-semibold text-[var(--ink2)] transition-all hover:border-[var(--border-strong)] hover:bg-[var(--tint)]"
          >
            Aujourd&apos;hui
          </button>
          <button
            onClick={() => navigate(1)}
            aria-label="Mois suivant"
            className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-[var(--border)] bg-surface text-[var(--ink2)] transition-all hover:translate-x-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--tint)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Mois + légende ──────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-4" style={{ animation: "fadeUp .4s .04s both" }}>
        <h2 className="font-grotesk text-[21px] font-bold capitalize tracking-[-0.01em]">
          {format(current, "MMMM yyyy", { locale: fr })}
        </h2>
        <div className="flex-1" />
        <div className="hidden items-center gap-4 text-[12px] font-semibold text-[var(--faint)] md:flex">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-[13px] w-[13px] rounded-[4px] bg-[#E4F1E9]" />
            Jour avec ventes
          </span>
          <span>👑 Meilleur jour</span>
        </div>
      </div>

      {isError && (
        <p className="mb-4 rounded-[14px] border border-[#F3D9CC] bg-[#FBEEE7] px-4 py-3 text-[14px] text-[#C2603F]">
          Erreur lors du chargement du calendrier.
        </p>
      )}

      {/* ── Vue liste mobile ─────────────────────────────────────────────── */}
      <div className="space-y-2 md:hidden">
        {isLoading ? (
          <Loader label="Chargement du calendrier" />
        ) : (data?.days ?? []).length === 0 ? (
          <p className="rounded-[18px] border border-[var(--border)] bg-surface px-4 py-6 text-center text-[14px] text-[var(--faint)]">
            Aucune vente ce mois-ci.
          </p>
        ) : (
          [...(data?.days ?? [])].sort((a, b) => a.date.localeCompare(b.date)).map((dd) => {
            const active = selected === dd.date;
            return (
              <div
                key={dd.date}
                className={`overflow-hidden rounded-[18px] border bg-surface transition-colors ${active ? "border-[#1B4332]" : "border-[var(--border)]"}`}
              >
                <button
                  onClick={() => setSelected(active ? null : dd.date)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="font-semibold capitalize text-[var(--ink)]">
                      {new Date(dd.date + "T00:00:00").toLocaleDateString("fr-FR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </div>
                    <div className="mt-0.5 text-[12px] text-[var(--faint-2)]">
                      {dd.nbArticles} article{dd.nbArticles > 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-grotesk font-bold text-[var(--ink)]">{euros(dd.ca)}</div>
                    <div className="text-[12px] text-[#2D6A4F]">NET {euros(dd.net)}</div>
                  </div>
                </button>
                {active && (
                  <ul className="space-y-2 border-t border-[var(--bg)] px-4 py-3">
                    {dd.articles.map((a) => (
                      <li key={a.id} className="rounded-[10px] border border-[var(--border)] px-3 py-2 text-[12px]">
                        <div className="flex justify-between gap-2">
                          <span className="font-grotesk font-bold text-[var(--ink)]">{a.sku}</span>
                          <span className="font-semibold text-[var(--ink)]">{euros(a.prixVente)}</span>
                        </div>
                        <div className="mt-0.5 flex justify-between gap-2 text-[var(--faint-2)]">
                          <span className="truncate">{a.marque}</span>
                          <span className="shrink-0">{coef(a.coefficient)} · NET {euros(a.margeNette)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Grille desktop ───────────────────────────────────────────────── */}
      <div className="hidden md:block">
        <div
          className="rounded-[22px] border border-[var(--border)] bg-surface shadow-[0_1px_2px_rgba(22,38,29,.03)]"
          style={{ padding: "18px 20px", animation: "fadeUp .45s .06s both" }}
        >
          {/* En-têtes jours */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr) 0.82fr", gap: 9, paddingBottom: 12 }}>
            {JOURS.map((j) => (
              <span
                key={j}
                style={{
                  fontSize: 11.5, fontWeight: 700, color: "#BE6E26", textAlign: "center",
                  letterSpacing: ".04em", background: "#FBEEDD", border: "1px solid #F3DCC0",
                  borderRadius: 9, padding: "7px 0",
                }}
              >
                {j}
              </span>
            ))}
            <span
              style={{
                fontSize: 11.5, fontWeight: 700, color: "#1B4332", textAlign: "center",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              RÉCAP SEMAINE
            </span>
          </div>

          {/* Corps */}
          {isLoading ? (
            <div className="flex justify-center py-14">
              <Loader label="Chargement du calendrier" />
            </div>
          ) : (
            <div key={format(current, "yyyy-MM") + "-" + dir} style={{ animation: gridAnim }}>
              {weeks.map((week, wi) => {
                const daysData = week
                  .map((d) => dayMap.get(format(d, "yyyy-MM-dd")))
                  .filter(Boolean) as CalendarDay[];
                const wca = daysData.reduce((s, d) => s + d.ca, 0);
                const wnet = daysData.reduce((s, d) => s + d.net, 0);
                const wnb = daysData.reduce((s, d) => s + d.nbArticles, 0);
                const wcoefs = daysData.flatMap((d) => d.articles.map((a) => a.coefficient));
                const wcoef = moyenne(wcoefs);
                const wpanier = wnb ? wca / wnb : 0;
                const topDayKey =
                  daysData.length > 0
                    ? daysData.reduce((b, d) => (d.ca > b.ca ? d : b)).date
                    : null;

                return (
                  <div
                    key={wi}
                    style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr) 0.82fr", gap: 9, marginBottom: 9 }}
                  >
                    {/* Cellules jours */}
                    {week.map((d, di) => {
                      const key = format(d, "yyyy-MM-dd");
                      const dd = dayMap.get(key);
                      const inMonth = isSameMonth(d, current);
                      const hasSale = !!dd && inMonth && dd.ca > 0;
                      const isTopDay = topDayKey === key && hasSale;
                      const today = isToday(d) && inMonth;
                      const isHov = hovered === key && hasSale;
                      const cellIdx = wi * 7 + di;

                      const cellBg =
                        isHov ? "#C2E2CF" : !inMonth ? "transparent" : hasSale ? "#E4F1E9" : "#FFFFFF";
                      const cellShadow =
                        isHov
                          ? "0 22px 40px -14px rgba(27,67,50,.5), inset 0 0 0 1.5px #1B4332"
                          : today
                            ? "inset 0 0 0 2px #1B4332"
                            : "none";

                      return (
                        <div
                          key={key}
                          onClick={() => { if (hasSale) setSelected(key); }}
                          onMouseEnter={() => { if (hasSale) setHovered(key); else setHovered(null); }}
                          onMouseLeave={() => setHovered(null)}
                          style={{
                            minHeight: 94,
                            borderRadius: 13,
                            padding: "9px 11px",
                            background: cellBg,
                            border: !inMonth
                              ? "1px solid transparent"
                              : hasSale
                                ? "1px solid transparent"
                                : "1px solid var(--bg)",
                            boxShadow: cellShadow,
                            opacity: inMonth ? 1 : 0.5,
                            cursor: hasSale ? "pointer" : "default",
                            display: "flex",
                            flexDirection: "column",
                            position: "relative",
                            transition:
                              "transform .2s cubic-bezier(.22,1,.36,1), box-shadow .2s ease, background .2s ease",
                            transform: isHov ? "translateY(-6px) scale(1.045)" : undefined,
                            zIndex: isHov ? 5 : undefined,
                            animation: `cellPop .5s cubic-bezier(.22,1,.36,1) ${cellIdx * 0.014}s backwards`,
                          }}
                        >
                          {/* Numéro + couronne */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span
                              style={
                                today
                                  ? {
                                      width: 24, height: 24, borderRadius: "50%",
                                      background: "#1B4332", color: "#fff",
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      fontFamily: "var(--font-grotesk)", fontWeight: 700, fontSize: 13,
                                    }
                                  : {
                                      fontFamily: "var(--font-grotesk)",
                                      fontWeight: 700, fontSize: 14,
                                      color: inMonth ? "var(--ink)" : "#C4CFC7",
                                    }
                              }
                            >
                              {format(d, "d")}
                            </span>
                            {isTopDay && (
                              <span
                                style={{ fontSize: 12, display: "inline-block", animation: "crownFloat 2.6s ease-in-out infinite" }}
                              >
                                👑
                              </span>
                            )}
                          </div>

                          {/* Données vente */}
                          {hasSale && dd && (
                            <div style={{ marginTop: "auto" }}>
                              <div style={{ fontFamily: "var(--font-grotesk)", fontWeight: 700, fontSize: 14, color: "var(--ink)", letterSpacing: "-0.01em" }}>
                                {euros(dd.ca)}
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: "#5E7268", marginTop: 2 }}>
                                NET {euros(dd.net)}
                              </div>
                              <div style={{ fontSize: 10.5, fontWeight: 500, color: "var(--faint-2)", marginTop: 1 }}>
                                {dd.nbArticles} art.
                              </div>
                            </div>
                          )}

                          {/* Tooltip hover */}
                          {isHov && hasSale && dd && (
                            <div
                              style={{
                                position: "absolute", bottom: "calc(100% + 9px)", left: "50%",
                                transform: "translateX(-50%)", whiteSpace: "nowrap",
                                background: "var(--ink)", color: "#fff", padding: "8px 12px",
                                borderRadius: 10, fontSize: 11, fontWeight: 600, letterSpacing: ".01em",
                                boxShadow: "0 12px 28px -8px rgba(22,38,29,.55)",
                                zIndex: 30, pointerEvents: "none",
                                animation: "tipIn .16s ease both",
                              }}
                            >
                              {euros(dd.ca)} · {dd.nbArticles} art. · clique pour le détail
                              <span
                                style={{
                                  position: "absolute", top: "100%", left: "50%",
                                  transform: "translateX(-50%)", width: 0, height: 0,
                                  borderLeft: "6px solid transparent", borderRight: "6px solid transparent",
                                  borderTop: "6px solid var(--ink)",
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Récap semaine */}
                    <div
                      style={{
                        borderRadius: 13, background: "#fff",
                        border: "1px solid #E7EDE5", borderLeft: "3px solid #1B4332",
                        padding: "11px 13px", display: "flex", flexDirection: "column",
                        transition: "box-shadow .18s ease, transform .18s ease",
                      }}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.boxShadow = "0 10px 22px -14px rgba(22,38,29,.25)";
                        el.style.transform = "translateY(-2px)";
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.boxShadow = "";
                        el.style.transform = "";
                      }}
                    >
                      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".07em", color: "#9BA89F" }}>
                        CA SEMAINE
                      </span>
                      <span style={{ fontFamily: "var(--font-grotesk)", fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em", color: "var(--ink)", marginTop: 2 }}>
                        {euros(wca)}
                      </span>
                      <div style={{ height: 1, background: "#ECEFEA", margin: "9px 0" }} />
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <RecapRow label="Net" value={euros(wnet)} valueColor="#2D6A4F" />
                        <RecapRow label="Articles" value={String(wnb)} />
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--faint-2)" }}>Coef</span>
                          <span style={coefPillStyle(wcoef)}>{coef(wcoef)}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--faint-2)" }}>Panier</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "var(--font-grotesk)", fontWeight: 700, fontSize: 12, color: "var(--ink)", whiteSpace: "nowrap" }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--faint-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
                              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                            </svg>
                            {euros(wpanier)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Bande totaux du mois ──────────────────────────────────────── */}
        <div
          className="mt-[18px] flex items-center rounded-[20px] border border-[var(--border)] bg-surface px-2 py-5 shadow-[0_1px_2px_rgba(22,38,29,.03)]"
          style={{ animation: "fadeUp .45s .16s both" }}
        >
          <MetricBand label="CA TOTAL" value={<CountUp value={monthly.ca} fmt={euros} />} />
          <div className="h-[42px] w-px bg-[var(--border)]" />
          <MetricBand label="ARTICLES VENDUS" value={<CountUp value={monthly.nb} fmt={(v) => String(Math.round(v))} />} />
          <div className="h-[42px] w-px bg-[var(--border)]" />
          <MetricBand
            label="MARGE NETTE"
            accent
            value={<CountUp value={monthly.net} fmt={euros} />}
          />
          <div className="h-[42px] w-px bg-[var(--border)]" />
          <MetricBand
            label="COEF MOYEN"
            value={
              <CountUp
                value={monthly.coefMoyen}
                fmt={(v) =>
                  v
                    ? v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "×"
                    : "0,00×"
                }
              />
            }
          />
          <div className="h-[42px] w-px bg-[var(--border)]" />
          <MetricBand label="PANIER MOYEN" value={<CountUp value={monthly.panierMoyen} fmt={euros} />} />
        </div>
      </div>

      {/* ── Modal détail du jour ─────────────────────────────────────────── */}
      {selectedDay && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-6"
          style={{ background: "rgba(22,38,29,.4)", animation: "overlayIn .2s ease both" }}
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-[448px] rounded-[22px] bg-surface p-[26px] shadow-[0_30px_80px_-20px_rgba(22,38,29,.55)]"
            style={{ animation: "modalIn .34s cubic-bezier(.22,1,.36,1) both" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-[12px] font-semibold text-[var(--faint)]">Détail du jour</div>
                <div className="mt-0.5 font-grotesk text-[23px] font-bold capitalize tracking-[-0.02em]">
                  {new Date(selectedDay.date + "T00:00:00").toLocaleDateString("fr-FR", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric",
                  })}
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="flex h-[34px] w-[34px] items-center justify-center rounded-[11px] bg-[var(--tint)] text-[var(--faint-2)] transition-colors hover:bg-[#E7EDE5] hover:text-[var(--ink2)]"
              >
                <X className="h-4 w-4" strokeWidth={2.2} />
              </button>
            </div>

            {/* Carte CA avec sheen */}
            <div
              className="relative mb-[14px] overflow-hidden rounded-[16px] p-5 text-white"
              style={{ background: "radial-gradient(120% 130% at 88% 8%, #2D6A4F, #1B4332)" }}
            >
              <div
                className="pointer-events-none absolute inset-y-0 left-0"
                style={{
                  width: "34%",
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent)",
                  animation: "sheen 2.4s ease-in-out .25s infinite",
                }}
              />
              <div className="relative text-[11px] font-bold tracking-[.07em] text-[#9FD4B5]">
                CHIFFRE D&apos;AFFAIRES
              </div>
              <div className="relative mt-1 font-grotesk text-[34px] font-bold tracking-[-0.02em]">
                <CountUp value={selectedDay.ca} duration={600} fmt={euros} />
              </div>
            </div>

            {/* Lignes détail */}
            <div className="flex flex-col gap-2.5">
              <ModalRow label="Marge nette" value={euros(selectedDay.net)} />
              <ModalRow label="Articles vendus" value={String(selectedDay.nbArticles)} />
              <ModalRow
                label="Taux de marge"
                value={
                  selectedDay.ca > 0
                    ? `${Math.round((selectedDay.net / selectedDay.ca) * 100)} %`
                    : "—"
                }
                accent
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ─── Sous-composants ────────────────────────────────────────────────────── */
function RecapRow({ label, value, valueColor = "var(--ink)" }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--faint-2)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-grotesk)", fontWeight: 700, fontSize: 12, color: valueColor, whiteSpace: "nowrap" }}>
        {value}
      </span>
    </div>
  );
}

function MetricBand({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="flex-1 px-[14px] text-center">
      <div className="text-[11.5px] font-bold tracking-[.05em] text-[var(--faint)]">{label}</div>
      <div className={`mt-[5px] font-grotesk text-[26px] font-bold tracking-[-0.02em] ${accent ? "text-[#2D6A4F]" : "text-[var(--ink)]"}`}>
        {value}
      </div>
    </div>
  );
}

function ModalRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-[13px] bg-[var(--tint)] px-[15px] py-[13px] transition-colors hover:bg-[var(--tint)]">
      <span className="text-[13.5px] font-semibold text-[var(--muted)]">{label}</span>
      <span className={`font-grotesk text-[16px] font-bold ${accent ? "text-[#2D6A4F]" : "text-[var(--ink)]"}`}>
        {value}
      </span>
    </div>
  );
}
