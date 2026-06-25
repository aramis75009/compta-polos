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
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCalendar } from "@/lib/hooks";
import { coef, euros, moyenne } from "@/lib/calc";
import type { CalendarDay } from "@/lib/types";

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

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

  // Meilleur jour du mois (pour la couronne)
  const bestDayKey = useMemo(() => {
    const days = data?.days ?? [];
    if (days.length === 0) return null;
    return days.reduce((best, d) => (d.ca > best.ca ? d : best)).date;
  }, [data]);

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
              Jour avec ventes
            </span>
            <span className="inline-flex items-center gap-1.5">👑 Meilleur jour du mois</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setCurrent((c) => subMonths(c, 1)); setSelected(null); }}
            aria-label="Mois précédent"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E4E9E2] bg-white text-[#3C4D44] transition-colors hover:border-[#CBD8CE]"
          >
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
          <button
            onClick={() => { setCurrent(startOfMonth(new Date())); setSelected(null); }}
            className="rounded-xl border border-[#E4E9E2] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#3C4D44] transition-colors hover:border-[#CBD8CE]"
          >
            {"Aujourd'hui"}
          </button>
          <button
            onClick={() => { setCurrent((c) => addMonths(c, 1)); setSelected(null); }}
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
        <p className="mb-4 rounded-[14px] border border-[#F3D9CC] bg-[#FBEEE7] px-4 py-3 text-[14px] text-[#C2603F]">
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

      {/* Grille Excel desktop (≥ md) */}
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <div className="min-w-[620px]">
            {/* En-têtes 7 colonnes */}
            <div className="grid grid-cols-7 gap-1.5 px-0.5">
              {JOURS.map((j) => (
                <div
                  key={j}
                  className="py-1.5 text-center text-[11.5px] font-bold uppercase tracking-[0.06em] text-[#6B8077]"
                >
                  {j}
                </div>
              ))}
            </div>

            {/* Semaines */}
            {weeks.map((week, wi) => {
              const daysData = week
                .map((d) => dayMap.get(format(d, "yyyy-MM-dd")))
                .filter((d): d is CalendarDay => !!d);
              const wCa = daysData.reduce((s, d) => s + d.ca, 0);
              const wNet = daysData.reduce((s, d) => s + d.net, 0);
              const wNb = daysData.reduce((s, d) => s + d.nbArticles, 0);
              const wCoefs = daysData.flatMap((d) =>
                d.articles.map((a) => a.coefficient),
              );
              const weekCoef = moyenne(wCoefs);

              return (
                <div key={wi} className="mt-1.5">
                  {/* Rangée des 7 jours */}
                  <div className="grid grid-cols-7 gap-1.5">
                    {week.map((d) => {
                      const key = format(d, "yyyy-MM-dd");
                      const dd = dayMap.get(key);
                      const inMonth = isSameMonth(d, current);
                      const active = selected === key;
                      const hasVente = !!dd && inMonth && dd.ca > 0;
                      const isBest = bestDayKey === key && hasVente;
                      const today = isToday(d) && inMonth;

                      return (
                        <button
                          key={key}
                          onClick={() => setSelected(dd && inMonth ? (active ? null : key) : null)}
                          style={today ? { boxShadow: "inset 0 0 0 2px #1B4332" } : undefined}
                          className={`relative min-h-[82px] overflow-hidden rounded-[10px] p-2 text-left transition-all ${
                            active ? "ring-2 ring-[#1B4332] ring-offset-1" : ""
                          } ${
                            hasVente
                              ? "bg-green-100 hover:bg-green-200"
                              : !inMonth
                                ? "bg-transparent"
                                : "bg-[#F0F3EE] hover:bg-[#E8EDE6]"
                          } ${dd && inMonth ? "cursor-pointer" : "cursor-default"}`}
                        >
                          {isBest && (
                            <span className="absolute right-1 top-0.5 text-[11px] leading-none">
                              👑
                            </span>
                          )}

                          {/* Numéro du jour */}
                          <span
                            className={
                              !inMonth
                                ? "font-grotesk text-[13px] font-bold text-[#C4CFC7]"
                                : today
                                  ? "flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#1B4332] font-grotesk text-[11px] font-bold text-white"
                                  : "font-grotesk text-[13px] font-bold text-[#16261D]"
                            }
                          >
                            {format(d, "d")}
                          </span>

                          {/* Données de vente */}
                          {dd && inMonth && dd.ca > 0 && (
                            <div className="mt-1 space-y-px leading-tight">
                              <div className="text-[10px]">
                                <span className="text-[#8A998F]">CA </span>
                                <span className="font-bold text-[#16261D]">{euros(dd.ca)}</span>
                              </div>
                              <div className="text-[10px]">
                                <span className="text-[#8A998F]">ART</span>{" "}
                                <span className="font-semibold text-[#3C4D44]">{dd.nbArticles}</span>
                              </div>
                              <div className="text-[10px]">
                                <span className="text-[#8A998F]">NET</span>{" "}
                                <span className="font-semibold text-[#2D6A4F]">{euros(dd.net)}</span>
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Ligne récap de semaine */}
                  <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-[8px] bg-[#DDE4DA] px-3.5 py-1.5">
                    <span className="text-[11px] font-bold text-[#4A5E53]">
                      Semaine {wi + 1}
                    </span>
                    {wNb > 0 ? (
                      <>
                        <span className="text-[11px] text-[#71807A]">
                          CA :{" "}
                          <b className="font-bold text-[#16261D]">{euros(wCa)}</b>
                        </span>
                        <span className="text-[11px] text-[#71807A]">
                          {wNb} art.
                        </span>
                        <span className="text-[11px] text-[#71807A]">
                          NET :{" "}
                          <b className="font-bold text-[#2D6A4F]">{euros(wNet)}</b>
                        </span>
                        {weekCoef > 0 && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${coefPill(weekCoef)}`}
                          >
                            {coef(weekCoef)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[11px] text-[#94A29A]">Pas de vente</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panneau détail (sous le calendrier) */}
        {selectedDay && (
          <div className="mt-5 rounded-[20px] border border-[#E4E9E2] bg-white p-5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-grotesk text-[17px] font-bold capitalize text-[#16261D]">
                {new Date(selectedDay.date).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </h2>
              <button
                onClick={() => setSelected(null)}
                aria-label="Fermer"
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#A6B2A9] transition-colors hover:bg-[#F1F4EF] hover:text-[#16261D]"
              >
                <X className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
            </div>

            {/* KPIs */}
            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
              <div
                className="col-span-1 rounded-[14px] p-4 text-white"
                style={{ background: "linear-gradient(135deg,#2D6A4F 0%, #1B4332 100%)" }}
              >
                <div className="text-[10.5px] font-bold tracking-[0.08em] text-[#9FD4B5]">
                  CA
                </div>
                <div className="mt-1 font-grotesk text-[22px] font-bold tracking-[-0.02em]">
                  {euros(selectedDay.ca)}
                </div>
              </div>
              <div className="rounded-[14px] border border-[#E4E9E2] p-4">
                <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8A998F]">
                  Marge nette
                </div>
                <div className="mt-1 font-grotesk text-[20px] font-bold text-[#2D6A4F]">
                  {euros(selectedDay.net)}
                </div>
              </div>
              <div className="rounded-[14px] border border-[#E4E9E2] p-4">
                <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8A998F]">
                  Articles
                </div>
                <div className="mt-1 font-grotesk text-[20px] font-bold text-[#16261D]">
                  {selectedDay.nbArticles}
                </div>
              </div>
              <div className="rounded-[14px] border border-[#E4E9E2] p-4">
                <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#8A998F]">
                  Taux marge
                </div>
                <div className="mt-1 font-grotesk text-[20px] font-bold text-[#16261D]">
                  {selectedDay.ca > 0
                    ? `${Math.round((selectedDay.net / selectedDay.ca) * 100)} %`
                    : "—"}
                </div>
              </div>
            </div>

            {/* Liste articles */}
            <ul className="mt-4 grid grid-cols-1 gap-2 border-t border-[#EEF1EC] pt-4 sm:grid-cols-2 lg:grid-cols-3">
              {selectedDay.articles.map((a) => (
                <li
                  key={a.id}
                  className="rounded-[10px] border border-[#E4E9E2] px-3 py-2.5 text-[12px]"
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
        )}
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
