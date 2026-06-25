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
import { useCalendar } from "@/lib/hooks";
import { coef, euros, moyenne } from "@/lib/calc";
import type { CalendarDay } from "@/lib/types";

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const navBtn =
  "flex-1 whitespace-nowrap rounded-full border border-[#E4E9E2] px-3 py-2 text-center text-[14px] text-[#71807A] transition-colors hover:bg-[#F7F9F6] md:flex-none md:px-4";

function coefColorClass(c: number): string {
  if (c >= 2.5) return "text-[#2D6A4F] font-bold";
  if (c >= 1.8) return "text-[#B5872E] font-semibold";
  return "text-[#C2603F] font-semibold";
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

  const selectedDay = selected ? dayMap.get(selected) : undefined;

  return (
    <main className="min-h-screen bg-[#EEF1EC] px-5 py-7 text-[#16261D] md:px-[38px] md:py-[30px] md:pb-[46px]">
      {/* En-tête / navigation */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-grotesk text-[26px] font-bold capitalize tracking-[-0.025em] text-[#16261D] md:text-[30px]">
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
            {"Aujourd'hui"}
          </button>
          <button
            onClick={() => { setCurrent((c) => addMonths(c, 1)); setSelected(null); }}
            className={navBtn}
          >
            Suivant →
          </button>
        </div>
      </div>

      {/* Bandeau d'erreur desktop */}
      {isError && (
        <p className="mb-4 hidden rounded-[13px] border border-[#F3D9CC] bg-[#FBEEE7] px-4 py-3 text-[14px] text-[#C2603F] shadow-sm md:block">
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
              <p className="rounded-[13px] border border-[#E4E9E2] bg-white px-4 py-6 text-center text-[14px] text-[#94A29A] shadow-sm">
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
                className={`overflow-hidden rounded-[13px] border bg-white shadow-sm transition-colors ${
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
                    <div className="font-grotesk font-semibold text-[#16261D]">
                      {euros(dd.ca)}
                    </div>
                    <div className="text-[12px] text-[#2D6A4F]">
                      NET {euros(dd.net)}
                    </div>
                  </div>
                </button>
                {active && (
                  <ul className="space-y-2 border-t border-[#E4E9E2] px-4 py-3">
                    {dd.articles.map((a) => (
                      <li
                        key={a.id}
                        className="rounded-md border border-[#E4E9E2] px-3 py-2 text-[12px]"
                      >
                        <div className="flex justify-between gap-2">
                          <span className="font-grotesk text-[#16261D]">{a.sku}</span>
                          <span className="font-grotesk font-semibold text-[#16261D]">
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

      <div className="hidden gap-4 md:flex">
        {/* Grille */}
        <div className="flex-1 overflow-x-auto">
          <div className="min-w-[900px]">
            {/* En-têtes de colonnes : 7 jours + récap */}
            <div className="grid grid-cols-8 gap-2 px-1 text-[12px] font-medium uppercase tracking-wide">
              {JOURS.map((j) => (
                <div
                  key={j}
                  className="rounded-md bg-amber-50 px-2 py-1 text-amber-600"
                >
                  {j}
                </div>
              ))}
              <div className="px-2 py-1 text-[#2D6A4F]">Récap semaine</div>
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
                    const hasVente = !!dd && inMonth && dd.ca > 0;
                    const isTopDay =
                      topDayKey === key && dd && dd.ca > 0 && inMonth;

                    return (
                      <button
                        key={key}
                        onClick={() => setSelected(dd ? key : null)}
                        className={`relative min-h-[96px] overflow-hidden rounded-md border p-2 text-left transition-all ${
                          active
                            ? "border-[#1B4332] shadow-sm ring-1 ring-[#1B4332]/30"
                            : "border-[#E4E9E2] hover:border-[#CBD8CE]"
                        } ${
                          hasVente
                            ? "bg-green-100"
                            : !inMonth
                              ? "bg-[#F0F3EE]"
                              : !dd
                                ? "bg-[#F7F9F6] text-[#94A29A]"
                                : ""
                        } ${dd ? "cursor-pointer" : "cursor-default"}`}
                      >
                        {isTopDay && (
                          <span className="absolute right-1 top-0.5 text-[13px] leading-none">
                            👑
                          </span>
                        )}

                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[12px] ${
                              !inMonth
                                ? "text-gray-300"
                                : isToday(d)
                                  ? "flex h-6 w-6 items-center justify-center rounded-full bg-[#1B4332] font-semibold text-white"
                                  : "text-[#71807A]"
                            }`}
                          >
                            {format(d, "d")}
                          </span>
                        </div>

                        {dd && inMonth && (
                          <>
                            <div className="mt-1 space-y-0.5 text-[12px] leading-tight">
                              <div className="font-grotesk font-bold text-[#16261D]">
                                {euros(dd.ca)}
                              </div>
                              <div className="font-medium text-[#2D6A4F]">
                                NET {euros(dd.net)}
                              </div>
                            </div>
                            <div className="mt-1 text-[12px] text-[#94A29A]">
                              {dd.nbArticles} art.
                            </div>
                          </>
                        )}
                      </button>
                    );
                  })}

                  {/* Récap de la semaine */}
                  <div className="min-h-[96px] rounded-md border border-[#1B4332]/40 bg-[#1B4332]/5 p-2.5 text-[12px] leading-tight">
                    <div className="text-[12px] text-[#94A29A]">CA</div>
                    <div className="font-grotesk font-bold text-[#16261D]">
                      {euros(ca)}
                    </div>
                    <div className="mt-1 text-[#71807A]">
                      {nb} art. ·{" "}
                      <span className="text-[#94A29A]">NET</span>{" "}
                      <span className="font-grotesk font-semibold text-[#2D6A4F]">
                        {euros(net)}
                      </span>
                    </div>
                    <div className={`mt-1 ${coefColorClass(weekCoef)}`}>
                      {coef(weekCoef)}
                    </div>
                    <div className="mt-0.5 text-[#94A29A]">
                      🛒 {euros(panierMoyen)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panneau latéral : articles vendus le jour sélectionné */}
        <aside className="hidden w-72 shrink-0 rounded-[13px] border border-[#E4E9E2] bg-white p-5 shadow-sm lg:block">
          {selectedDay ? (
            <>
              <h2 className="text-[15px] font-bold capitalize text-[#16261D]">
                {new Date(selectedDay.date).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </h2>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                <div>
                  <div className="text-[#94A29A]">CA</div>
                  <div className="font-grotesk font-semibold text-[#16261D]">
                    {euros(selectedDay.ca)}
                  </div>
                </div>
                <div>
                  <div className="text-[#94A29A]">Articles</div>
                  <div className="font-grotesk font-semibold text-[#16261D]">
                    {selectedDay.nbArticles}
                  </div>
                </div>
                <div>
                  <div className="text-[#94A29A]">NET</div>
                  <div className="font-grotesk font-semibold text-[#2D6A4F]">
                    {euros(selectedDay.net)}
                  </div>
                </div>
              </div>
              <ul className="mt-4 space-y-2">
                {selectedDay.articles.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-md border border-[#E4E9E2] px-3 py-2 text-[12px]"
                  >
                    <div className="flex justify-between">
                      <span className="font-grotesk text-[#16261D]">{a.sku}</span>
                      <span className="font-grotesk font-semibold text-[#16261D]">
                        {euros(a.prixVente)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex justify-between text-[#94A29A]">
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
            <p className="text-[14px] text-[#94A29A]">
              {isLoading
                ? "Chargement…"
                : "Clique sur un jour avec des ventes pour voir le détail."}
            </p>
          )}
        </aside>
      </div>

      {/* Total mensuel */}
      <div className="mt-6 flex flex-wrap gap-x-8 gap-y-1 rounded-[13px] border border-[#E4E9E2] bg-white px-6 py-4 text-[14px] shadow-sm">
        <span className="font-semibold text-[#16261D]">Total du mois :</span>
        <span className="text-[#71807A]">
          CA :{" "}
          <strong className="font-grotesk text-[#16261D]">
            {euros(data?.total.ca ?? 0)}
          </strong>
        </span>
        <span className="text-[#71807A]">
          Articles :{" "}
          <strong className="font-grotesk text-[#16261D]">
            {data?.total.nbArticles ?? 0}
          </strong>
        </span>
        <span className="text-[#71807A]">
          NET :{" "}
          <strong className="font-grotesk text-[#2D6A4F]">
            {euros(data?.total.net ?? 0)}
          </strong>
        </span>
      </div>
    </main>
  );
}
