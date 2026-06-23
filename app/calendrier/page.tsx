"use client";

import { useMemo, useState, type CSSProperties } from "react";
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
import { useCalendar } from "@/lib/hooks";
import { coef, euros, moyenne } from "@/lib/calc";
import type { CalendarDay } from "@/lib/types";

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const navBtn =
  "flex-1 whitespace-nowrap rounded-full border border-line px-3 py-2 text-center text-body-md text-ink-muted transition-colors hover:bg-surface-container md:flex-none md:px-4";

// ── 1. Heatmap : vert d'autant plus intense que le CA est élevé ──
function heatmapStyle(ratio: number): CSSProperties {
  if (ratio <= 0) return {};
  const lightness = Math.round(97 - ratio * 38); // 97% (quasi-blanc) → 59% (vert soutenu)
  const saturation = Math.round(45 + ratio * 45); // 45% → 90%
  return { backgroundColor: `hsl(142, ${saturation}%, ${lightness}%)` };
}

// ── 2. Badges articles (dots) : jusqu'à 5 cercles, puis "+X" ──
function ArticleDots({ count }: { count: number }) {
  if (count === 0) return null;
  const shown = Math.min(count, 5);
  const extra = count > 5 ? count - 5 : 0;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {Array.from({ length: shown }).map((_, i) => (
        <span
          key={i}
          className="inline-block h-2 w-2 rounded-full bg-primary"
          style={{ opacity: 0.5 + (i / shown) * 0.5 }}
        />
      ))}
      {extra > 0 && (
        <span className="text-[10px] font-bold text-primary">+{extra}</span>
      )}
    </div>
  );
}

// ── 4. Couleur du coefficient (récap semaine) ──
function coefColorClass(c: number): string {
  if (c >= 2.5) return "text-emerald-600 font-bold";
  if (c >= 1.8) return "text-amber-500 font-semibold";
  return "text-red-500 font-semibold";
}

export default function CalendrierPage() {
  const [current, setCurrent] = useState(() => startOfMonth(new Date()));
  const month = format(current, "yyyy-MM");
  const { data, isLoading } = useCalendar(month);
  const [selected, setSelected] = useState<string | null>(null);

  const dayMap = useMemo(() => {
    const m = new Map<string, CalendarDay>();
    for (const d of data?.days ?? []) m.set(d.date, d);
    return m;
  }, [data]);

  // Max CA et NET du mois pour la heatmap et la barre de progression
  const maxCA = useMemo(() => {
    const vals = Array.from(dayMap.values()).map((d) => d.ca);
    return vals.length ? Math.max(...vals) : 1;
  }, [dayMap]);

  const maxNET = useMemo(() => {
    const vals = Array.from(dayMap.values()).map((d) => d.net);
    return vals.length ? Math.max(...vals, 1) : 1;
  }, [dayMap]);

  const weeks = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(current), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(current), { weekStartsOn: 1 });
    const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const result: Date[][] = [];
    for (let i = 0; i < allDays.length; i += 7) {
      result.push(allDays.slice(i, i + 7));
    }
    return result;
  }, [current]);

  const selectedDay = selected ? dayMap.get(selected) : undefined;

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      {/* En-tête / navigation */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold capitalize text-ink md:text-4xl">
          {format(current, "MMMM yyyy", { locale: fr })}
        </h1>
        <div className="flex w-full gap-2 md:w-auto">
          <button
            onClick={() => { setCurrent((c) => subMonths(c, 1)); setSelected(null); }}
            className={navBtn}
          >
            ← Précédent
          </button>
          <button
            onClick={() => { setCurrent(startOfMonth(new Date())); setSelected(null); }}
            className={navBtn}
          >
            Aujourd&apos;hui
          </button>
          <button
            onClick={() => { setCurrent((c) => addMonths(c, 1)); setSelected(null); }}
            className={navBtn}
          >
            Suivant →
          </button>
        </div>
      </div>

      {/* Vue liste mobile (< md) */}
      <div className="space-y-2 md:hidden">
        {(() => {
          const days = [...(data?.days ?? [])].sort((a, b) =>
            a.date.localeCompare(b.date),
          );
          if (days.length === 0) {
            return (
              <p className="rounded-card border border-line bg-surface px-4 py-6 text-center text-body-md text-ink-faint shadow-card">
                {isLoading ? "Chargement…" : "Aucune vente ce mois-ci."}
              </p>
            );
          }
          return days.map((dd) => {
            const active = selected === dd.date;
            return (
              <div
                key={dd.date}
                className={`overflow-hidden rounded-card border bg-surface shadow-card transition-colors ${
                  active ? "border-primary" : "border-line"
                }`}
              >
                <button
                  onClick={() => setSelected(active ? null : dd.date)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="font-semibold capitalize text-ink">
                      {new Date(dd.date).toLocaleDateString("fr-FR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </div>
                    <div className="mt-0.5 text-label-sm text-ink-faint">
                      {dd.nbArticles} article{dd.nbArticles > 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold text-ink">{euros(dd.ca)}</div>
                    <div className="text-label-sm text-primary">
                      NET {euros(dd.net)}
                    </div>
                  </div>
                </button>
                {active && (
                  <ul className="space-y-2 border-t border-line px-4 py-3">
                    {dd.articles.map((a) => (
                      <li
                        key={a.id}
                        className="rounded-md border border-line px-3 py-2 text-label-sm"
                      >
                        <div className="flex justify-between gap-2">
                          <span className="font-mono text-ink">{a.sku}</span>
                          <span className="font-semibold text-ink">
                            {euros(a.prixVente)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex justify-between gap-2 text-ink-faint">
                          <span className="truncate">{a.marque}</span>
                          <span className="shrink-0">
                            {coef(a.coefficient)} · NET {euros(a.margeNette)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          });
        })()}
      </div>

      <div className="hidden gap-4 md:flex">
        {/* Grille */}
        <div className="flex-1 overflow-x-auto">
          <div className="min-w-[900px]">
            {/* En-têtes de colonnes : 7 jours + récap */}
            <div className="grid grid-cols-8 gap-2 px-1 text-label-sm font-medium uppercase tracking-wide text-ink-faint">
              {JOURS.map((j) => (
                <div key={j} className="px-2 py-1">
                  {j}
                </div>
              ))}
              <div className="px-2 py-1 text-primary">Récap semaine</div>
            </div>

            {weeks.map((week, wi) => {
              const daysData = week
                .map((d) => dayMap.get(format(d, "yyyy-MM-dd")))
                .filter((d): d is CalendarDay => !!d);
              const ca = daysData.reduce((s, d) => s + d.ca, 0);
              const net = daysData.reduce((s, d) => s + d.net, 0);
              const nb = daysData.reduce((s, d) => s + d.nbArticles, 0);
              const coefs = daysData.flatMap((d) =>
                d.articles.map((a) => a.coefficient),
              );
              const weekCoef = moyenne(coefs);
              const panierMoyen = nb ? ca / nb : 0;

              // ── 5. Meilleur jour de la semaine (couronne) ──
              const topDayKey =
                daysData.length > 0
                  ? daysData.reduce((best, d) => (d.ca > best.ca ? d : best))
                      .date
                  : null;

              return (
                <div key={wi} className="mt-2 grid grid-cols-8 gap-2">
                  {week.map((d) => {
                    const key = format(d, "yyyy-MM-dd");
                    const dd = dayMap.get(key);
                    const inMonth = isSameMonth(d, current);
                    const active = selected === key;
                    const caRatio = dd && inMonth ? dd.ca / maxCA : 0;
                    const netRatio = dd && inMonth ? dd.net / maxNET : 0;
                    // ── 5. Couronne uniquement si > 0€ et dans le mois ──
                    const isTopDay =
                      topDayKey === key && dd && dd.ca > 0 && inMonth;

                    return (
                      <button
                        key={key}
                        onClick={() => setSelected(dd ? key : null)}
                        style={dd && inMonth ? heatmapStyle(caRatio) : {}}
                        className={`relative min-h-[96px] overflow-hidden rounded-md border p-2 text-left transition-all ${
                          active
                            ? "border-primary shadow-card ring-1 ring-primary/30"
                            : "border-line hover:border-line-strong"
                        } ${
                          !dd || !inMonth
                            ? "bg-surface-soft text-ink-faint"
                            : ""
                        } ${dd ? "cursor-pointer" : "cursor-default"}`}
                      >
                        {/* ── 5. Badge couronne top jour ── */}
                        {isTopDay && (
                          <span className="absolute right-1 top-0.5 text-[13px] leading-none">
                            👑
                          </span>
                        )}

                        <div className="flex items-center justify-between">
                          <span
                            className={`text-label-sm ${
                              isToday(d)
                                ? "flex h-6 w-6 items-center justify-center rounded-full bg-primary font-semibold text-on-primary"
                                : "text-ink-muted"
                            }`}
                          >
                            {format(d, "d")}
                          </span>
                        </div>

                        {dd && inMonth && (
                          <>
                            <div className="mt-1 space-y-0.5 text-label-sm leading-tight">
                              {/* CA en gras */}
                              <div className="font-bold text-ink">
                                {euros(dd.ca)}
                              </div>
                              {/* NET en couleur primaire */}
                              <div className="font-medium text-primary">
                                NET {euros(dd.net)}
                              </div>
                            </div>

                            {/* ── 2. Badges articles (dots) ── */}
                            <ArticleDots count={dd.nbArticles} />

                            {/* ── 3. Barre de progression NET ── */}
                            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/5">
                              <div
                                className="h-full bg-primary/50 transition-all duration-300"
                                style={{ width: `${Math.round(netRatio * 100)}%` }}
                              />
                            </div>
                          </>
                        )}
                      </button>
                    );
                  })}

                  {/* ── 4. Récap de la semaine redesigné ── */}
                  <div className="relative min-h-[96px] overflow-hidden rounded-md border border-primary/40 bg-gradient-to-b from-primary/10 to-primary/5 p-2.5 text-label-sm leading-tight">
                    {/* CA */}
                    <div className="text-[9px] font-bold uppercase tracking-widest text-ink-faint">
                      CA
                    </div>
                    <div className="text-[15px] font-bold text-ink">
                      {euros(ca)}
                    </div>

                    {/* NET encadré */}
                    <div className="mt-1 rounded bg-primary/15 px-1.5 py-0.5 text-center">
                      <span className="text-[9px] font-bold uppercase tracking-wide text-primary/60">
                        NET{" "}
                      </span>
                      <span className="font-bold text-primary">
                        {euros(net)}
                      </span>
                    </div>

                    {/* Nb articles badge */}
                    <div className="mt-1.5 flex items-center gap-1">
                      <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary/25 px-1 text-[10px] font-bold text-primary">
                        {nb}
                      </span>
                      <span className="text-ink-faint">art.</span>
                    </div>

                    {/* Coeff coloré */}
                    <div className={`mt-0.5 text-[11px] ${coefColorClass(weekCoef)}`}>
                      {coef(weekCoef)}
                    </div>

                    {/* Panier moyen */}
                    <div className="text-[10px] text-ink-faint">
                      🛒 {euros(panierMoyen)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panneau latéral : articles vendus le jour sélectionné */}
        <aside className="hidden w-72 shrink-0 rounded-card border border-line bg-surface p-5 shadow-card lg:block">
          {selectedDay ? (
            <>
              <h2 className="text-title-sm font-semibold capitalize text-ink">
                {new Date(selectedDay.date).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </h2>
              <div className="mt-3 grid grid-cols-3 gap-2 text-label-sm">
                <div>
                  <div className="text-ink-faint">CA</div>
                  <div className="font-semibold text-ink">
                    {euros(selectedDay.ca)}
                  </div>
                </div>
                <div>
                  <div className="text-ink-faint">Articles</div>
                  <div className="font-semibold text-ink">
                    {selectedDay.nbArticles}
                  </div>
                </div>
                <div>
                  <div className="text-ink-faint">NET</div>
                  <div className="font-semibold text-primary">
                    {euros(selectedDay.net)}
                  </div>
                </div>
              </div>
              <ul className="mt-4 space-y-2">
                {selectedDay.articles.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-md border border-line px-3 py-2 text-label-sm"
                  >
                    <div className="flex justify-between">
                      <span className="font-mono text-ink">{a.sku}</span>
                      <span className="font-semibold text-ink">
                        {euros(a.prixVente)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex justify-between text-ink-faint">
                      <span>{a.marque}</span>
                      <span>
                        {coef(a.coefficient)} · NET {euros(a.margeNette)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-body-md text-ink-faint">
              {isLoading
                ? "Chargement…"
                : "Clique sur un jour avec des ventes pour voir le détail."}
            </p>
          )}
        </aside>
      </div>

      {/* Total mensuel */}
      <div className="mt-6 flex flex-wrap gap-x-8 gap-y-1 rounded-card border border-line bg-surface px-6 py-4 text-body-md shadow-card">
        <span className="font-semibold text-ink">Total du mois :</span>
        <span className="text-ink-muted">
          CA :{" "}
          <strong className="text-ink">{euros(data?.total.ca ?? 0)}</strong>
        </span>
        <span className="text-ink-muted">
          Articles :{" "}
          <strong className="text-ink">{data?.total.nbArticles ?? 0}</strong>
        </span>
        <span className="text-ink-muted">
          NET :{" "}
          <strong className="text-primary">
            {euros(data?.total.net ?? 0)}
          </strong>
        </span>
      </div>
    </main>
  );
}
