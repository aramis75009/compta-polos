"use client";

import { useMemo, useState } from "react";
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
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  X,
} from "lucide-react";
import { useCalendar } from "@/lib/hooks";
import { coef, euros, moyenne } from "@/lib/calc";
import type { CalendarDay } from "@/lib/types";

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// Pill coef selon le barème du redesign : ≥2,3 vert / 2,0–2,29 ambre / <2 rouge.
function coefPill(c: number): string {
  if (c >= 2.3) return "bg-[#E4F3EA] text-[#2D6A4F]";
  if (c >= 2.0) return "bg-[#FBF3E2] text-[#B5872E]";
  return "bg-[#FBEEE7] text-[#C2603F]";
}

export default function CalendrierPage() {
  const [current, setCurrent] = useState(() => startOfMonth(new Date()));
  const month = format(current, "yyyy-MM");
  const { data, isLoading, isError } = useCalendar(month);
  const [selected, setSelected] = useState<string | null>(null);

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
    for (let i = 0; i < allDays.length; i += 7) {
      result.push(allDays.slice(i, i + 7));
    }
    return result;
  }, [current]);

  // Totaux mensuels (coef moyen + panier moyen dérivés des ventes du mois).
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

  return (
    <main className="min-h-screen bg-[#EEF1EC] px-5 py-7 text-[#16261D] md:px-[38px] md:py-[30px] md:pb-[46px]">
      {/* En-tête / navigation */}
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-grotesk text-[26px] font-bold tracking-[-0.025em] md:text-[30px]">
            Calendrier
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-medium text-[#71807A]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-[4px] bg-green-100 ring-1 ring-[#CDE3D5]" />
              Vente
            </span>
            <span className="inline-flex items-center gap-1.5">👑 Meilleur jour</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setCurrent((c) => subMonths(c, 1));
              setSelected(null);
            }}
            aria-label="Mois précédent"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E4E9E2] bg-white text-[#3C4D44] transition-colors hover:border-[#CBD8CE]"
          >
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
          <button
            onClick={() => {
              setCurrent(startOfMonth(new Date()));
              setSelected(null);
            }}
            className="rounded-xl border border-[#E4E9E2] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#3C4D44] transition-colors hover:border-[#CBD8CE]"
          >
            Aujourd’hui
          </button>
          <button
            onClick={() => {
              setCurrent((c) => addMonths(c, 1));
              setSelected(null);
            }}
            aria-label="Mois suivant"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E4E9E2] bg-white text-[#3C4D44] transition-colors hover:border-[#CBD8CE]"
          >
            <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Titre de mois */}
      <h2 className="mb-3 font-grotesk text-[21px] font-bold capitalize tracking-[-0.01em]">
        {format(current, "MMMM yyyy", { locale: fr })}
      </h2>

      {isError && (
        <p className="mb-4 hidden rounded-[14px] border border-[#F3D9CC] bg-[#FBEEE7] px-4 py-3 text-[14px] text-[#C2603F] md:block">
          Erreur lors du chargement du calendrier.
        </p>
      )}

      {/* Vue liste mobile (< md) */}
      <div className="space-y-2 md:hidden">
        {(() => {
          const days = [...(data?.days ?? [])].sort((a, b) =>
            a.date.localeCompare(b.date),
          );
          if (days.length === 0) {
            return (
              <p className="rounded-[18px] border border-[#E4E9E2] bg-white px-4 py-6 text-center text-[14px] text-[#8A998F]">
                {isLoading
                  ? "Chargement…"
                  : isError
                    ? "Erreur lors du chargement du calendrier."
                    : "Aucune vente ce mois-ci."}
              </p>
            );
          }
          return days.map((dd) => {
            const active = selected === dd.date;
            return (
              <div
                key={dd.date}
                className={`overflow-hidden rounded-[18px] border bg-white transition-colors ${
                  active ? "border-[#1B4332]" : "border-[#E4E9E2]"
                }`}
              >
                <button
                  onClick={() => setSelected(active ? null : dd.date)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="font-semibold capitalize text-[#16261D]">
                      {new Date(dd.date).toLocaleDateString("fr-FR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </div>
                    <div className="mt-0.5 text-[12px] text-[#94A29A]">
                      {dd.nbArticles} article{dd.nbArticles > 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-grotesk font-bold text-[#16261D]">
                      {euros(dd.ca)}
                    </div>
                    <div className="text-[12px] text-[#2D6A4F]">
                      NET {euros(dd.net)}
                    </div>
                  </div>
                </button>
                {active && (
                  <ul className="space-y-2 border-t border-[#EEF1EC] px-4 py-3">
                    {dd.articles.map((a) => (
                      <li
                        key={a.id}
                        className="rounded-[10px] border border-[#E4E9E2] px-3 py-2 text-[12px]"
                      >
                        <div className="flex justify-between gap-2">
                          <span className="font-grotesk font-bold text-[#16261D]">
                            {a.sku}
                          </span>
                          <span className="font-semibold text-[#16261D]">
                            {euros(a.prixVente)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex justify-between gap-2 text-[#94A29A]">
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

      <div className="hidden gap-5 md:flex">
        {/* Grille */}
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="min-w-[820px]">
            {/* En-têtes de colonnes : 7 jours + récap */}
            <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_1.05fr] gap-2 px-0.5 text-[11.5px] font-bold uppercase tracking-[0.06em]">
              {JOURS.map((j) => (
                <div key={j} className="px-2 py-1 text-[#B58A4A]">
                  {j}
                </div>
              ))}
              <div className="px-2 py-1 text-[#B58A4A]">Récap</div>
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

              const topDayKey =
                daysData.length > 0
                  ? daysData.reduce((best, d) => (d.ca > best.ca ? d : best)).date
                  : null;

              return (
                <div
                  key={wi}
                  className="mt-2 grid grid-cols-[repeat(7,minmax(0,1fr))_1.05fr] gap-2"
                >
                  {week.map((d) => {
                    const key = format(d, "yyyy-MM-dd");
                    const dd = dayMap.get(key);
                    const inMonth = isSameMonth(d, current);
                    const active = selected === key;
                    // Vert UNI fixe dès qu'il y a une vente (pas de heatmap).
                    const hasVente = !!dd && inMonth && dd.ca > 0;
                    const isTopDay =
                      topDayKey === key && dd && dd.ca > 0 && inMonth;
                    const today = isToday(d) && inMonth;

                    return (
                      <button
                        key={key}
                        onClick={() => setSelected(dd ? key : null)}
                        className={`relative min-h-[96px] overflow-hidden rounded-[13px] p-2 text-left transition-all ${
                          !inMonth
                            ? "border border-transparent bg-[#F5F6F4] opacity-40 cursor-default"
                            : hasVente
                              ? "bg-green-100 border border-[#CDE3D5] cursor-pointer"
                              : `bg-white border border-[#E4E9E2] ${dd ? "cursor-pointer" : "cursor-default"}`
                        } ${(active || today) && inMonth ? "ring-2 ring-[#1B4332]" : ""}`}
                      >
                        {isTopDay && (
                          <span className="absolute right-1 top-0.5 text-[13px] leading-none">
                            👑
                          </span>
                        )}

                        <span
                          className={
                            !inMonth
                              ? "font-grotesk text-[13px] font-bold text-[#C4CFC7]"
                              : today
                                ? "flex h-6 w-6 items-center justify-center rounded-full bg-[#1B4332] font-grotesk text-[12px] font-bold text-white"
                                : "font-grotesk text-[13px] font-bold text-[#16261D]"
                          }
                        >
                          {format(d, "d")}
                        </span>

                        {dd && inMonth && dd.ca > 0 && (
                          <div className="mt-1 leading-tight">
                            <div className="font-grotesk font-bold text-[14px] text-[#16261D]">
                              {euros(dd.ca)}
                            </div>
                            <div className="text-[11px] text-[#71807A]">
                              ART {dd.nbArticles}
                            </div>
                            <div className="text-[12px] font-semibold text-[#2D6A4F]">
                              NET {euros(dd.net)}
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}

                  {/* Récap de la semaine */}
                  <div className="min-h-[96px] rounded-[13px] border border-[#E4E9E2] bg-white p-2.5 leading-tight">
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#B58A4A]">
                      Récap
                    </div>
                    <div className="text-[11px] font-semibold text-[#8A998F]">
                      CA
                    </div>
                    <div className="font-grotesk text-[15px] font-bold text-[#16261D]">
                      {euros(ca)}
                    </div>
                    <div className="mt-1 text-[11px] text-[#71807A]">
                      {nb} art. · <span className="text-[#94A29A]">NET</span>{" "}
                      <span className="font-semibold text-[#2D6A4F]">
                        {euros(net)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${coefPill(weekCoef)}`}
                      >
                        {coef(weekCoef)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#71807A]">
                        <ShoppingCart className="h-3 w-3" strokeWidth={2} />
                        {euros(panierMoyen)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panneau latéral */}
        <aside className="hidden w-[300px] shrink-0 lg:block">
          {selectedDay ? (
            <div className="rounded-[20px] border border-[#E4E9E2] bg-white p-5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-grotesk text-[16px] font-bold capitalize text-[#16261D]">
                  {new Date(selectedDay.date).toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </h2>
                <button
                  onClick={() => setSelected(null)}
                  aria-label="Fermer"
                  className="text-[#A6B2A9] transition-colors hover:text-[#16261D]"
                >
                  <X className="h-[18px] w-[18px]" strokeWidth={2} />
                </button>
              </div>

              <div
                className="mt-4 rounded-[16px] p-4 text-white"
                style={{
                  background: "linear-gradient(135deg,#2D6A4F 0%, #1B4332 100%)",
                }}
              >
                <div className="text-[11px] font-bold tracking-[0.08em] text-[#9FD4B5]">
                  CHIFFRE D’AFFAIRES
                </div>
                <div className="mt-1 font-grotesk text-[28px] font-bold tracking-[-0.02em]">
                  {euros(selectedDay.ca)}
                </div>
              </div>

              <div className="mt-4 space-y-2.5">
                <div className="flex items-center justify-between text-[13.5px]">
                  <span className="text-[#71807A]">Marge nette</span>
                  <span className="font-grotesk font-bold text-[#2D6A4F]">
                    {euros(selectedDay.net)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[13.5px]">
                  <span className="text-[#71807A]">Articles vendus</span>
                  <span className="font-grotesk font-bold text-[#16261D]">
                    {selectedDay.nbArticles}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[13.5px]">
                  <span className="text-[#71807A]">Taux de marge</span>
                  <span className="font-grotesk font-bold text-[#16261D]">
                    {selectedDay.ca > 0
                      ? `${Math.round((selectedDay.net / selectedDay.ca) * 100)} %`
                      : "—"}
                  </span>
                </div>
              </div>

              <ul className="mt-4 space-y-2 border-t border-[#EEF1EC] pt-4">
                {selectedDay.articles.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-[10px] border border-[#E4E9E2] px-3 py-2 text-[12px]"
                  >
                    <div className="flex justify-between">
                      <span className="font-grotesk font-bold text-[#16261D]">
                        {a.sku}
                      </span>
                      <span className="font-semibold text-[#16261D]">
                        {euros(a.prixVente)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex justify-between text-[#94A29A]">
                      <span className="truncate">{a.marque}</span>
                      <span className="shrink-0">
                        {coef(a.coefficient)} · NET {euros(a.margeNette)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-[20px] border border-[#E4E9E2] bg-white px-6 py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F1F4EF] text-[#9BA89F]">
                <CalendarIcon className="h-6 w-6" strokeWidth={2} />
              </div>
              <p className="text-[13.5px] font-medium text-[#8A998F]">
                {isLoading
                  ? "Chargement…"
                  : "Clique sur un jour avec des ventes pour voir le détail."}
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* Total du mois (bande) */}
      <div className="mt-6 grid grid-cols-2 gap-y-4 rounded-[20px] border border-[#E4E9E2] bg-white px-6 py-5 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x lg:divide-[#EEF1EC]">
        <Metric label="CA TOTAL" value={euros(monthly.ca)} />
        <Metric label="ARTICLES VENDUS" value={String(monthly.nb)} />
        <Metric label="MARGE NETTE" value={euros(monthly.net)} accent />
        <Metric label="COEF MOYEN" value={coef(monthly.coefMoyen)} />
        <Metric label="PANIER MOYEN" value={euros(monthly.panierMoyen)} />
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="lg:px-6 lg:first:pl-0">
      <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#8A998F]">
        {label}
      </div>
      <div
        className={`mt-1 font-grotesk text-[22px] font-bold tracking-[-0.02em] md:text-[26px] ${
          accent ? "text-[#2D6A4F]" : "text-[#16261D]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
