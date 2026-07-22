"use client";

import { useState } from "react";
import { Calendar, ChevronDown, Zap, Clock } from "lucide-react";
import { useStats } from "@/lib/hooks";
import { coef, euros } from "@/lib/calc";
import type { CanalCA, StatutCount, WeekdayPoint } from "@/lib/types";
import { statutColor } from "@/lib/statutColors";
import Loader from "@/components/Loader";

// "9 juin 2026" — date réelle du meilleur jour de la semaine.
const formatDateLongue = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const frNum = (n: number, d = 1) =>
  n.toLocaleString("fr-FR", { maximumFractionDigits: d });


function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-5 py-7 text-[var(--ink)] md:px-[38px] md:py-[30px] md:pb-[46px]">
      {children}
    </main>
  );
}

export default function StatistiquesPage() {
  const { data, isLoading, isError, error } = useStats();

  if (isLoading) {
    return (
      <Frame>
        <Loader label="Chargement des statistiques" />
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

  const totalArticles = data.repartitionStatuts.reduce((s, r) => s + r.count, 0);
  const vendus = data.repartitionStatuts.find((r) => r.statut === "Vendu")?.count ?? 0;
  const pctEcoule = totalArticles ? vendus / totalArticles : 0;
  const jours = data.projection.joursRestants;
  const projectionLongue = jours != null && jours > 365;

  return (
    <Frame>
      {/* TOPBAR */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[14.5px] font-medium text-[var(--muted)]">
            Analyse de la performance de ta revente.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-surface px-3.5 py-2.5 text-[13.5px] font-semibold text-[var(--ink2)]">
            <Calendar className="h-4 w-4" strokeWidth={2} />
            Tout l’historique
            <ChevronDown className="h-[15px] w-[15px] opacity-55" strokeWidth={2} />
          </div>
        </div>
      </div>

      {/* GRADIENT KPIs */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Vitesse de vente */}
        <div
          className="relative overflow-hidden rounded-[22px] px-7 py-6 text-white"
          style={{
            background: "linear-gradient(135deg,#2D6A4F 0%, #1B4332 100%)",
            boxShadow: "0 18px 40px -24px rgba(20,53,40,.7)",
          }}
        >
          <div
            className="pointer-events-none absolute -right-8 -top-12 h-52 w-52 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(124,224,168,.26), transparent 70%)" }}
          />
          <div className="relative flex items-center justify-between">
            <span className="text-[12px] font-bold tracking-[0.08em] text-[#9FD4B5]">
              VITESSE DE VENTE
            </span>
            <div className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-white/[0.13]">
              <Zap className="h-[22px] w-[22px] text-[#CFF0DC]" strokeWidth={2} />
            </div>
          </div>
          <div className="relative mt-4 flex items-baseline gap-2.5">
            <span className="font-grotesk text-[52px] font-bold leading-none tracking-[-0.03em]">
              {frNum(data.vitesse.parJour7)}
            </span>
            <span className="text-[15px] font-semibold text-[#BFE3CE]">
              ventes / jour
            </span>
          </div>
          <div className="relative mt-5 flex gap-6 border-t border-white/[0.13] pt-4">
            <div>
              <div className="text-[12px] font-semibold text-[#9FD4B5]">Moyenne 7 j</div>
              <div className="mt-0.5 font-grotesk text-[18px] font-bold">
                {frNum(data.vitesse.parJour7)} / j
              </div>
            </div>
            <div>
              <div className="text-[12px] font-semibold text-[#9FD4B5]">Moyenne 30 j</div>
              <div className="mt-0.5 font-grotesk text-[18px] font-bold">
                {frNum(data.vitesse.parJour30)} / j
              </div>
            </div>
          </div>
        </div>

        {/* Projection d'écoulement */}
        <div
          className="relative overflow-hidden rounded-[22px] px-7 py-6 text-white"
          style={{
            background: projectionLongue
              ? "linear-gradient(135deg,#E0A06B 0%, #C2603F 100%)"
              : "linear-gradient(135deg,#2D6A4F 0%, #1B4332 100%)",
            boxShadow: projectionLongue
              ? "0 18px 40px -24px rgba(150,72,42,.6)"
              : "0 18px 40px -24px rgba(20,53,40,.7)",
          }}
        >
          <div
            className="pointer-events-none absolute -right-8 -top-12 h-52 w-52 rounded-full"
            style={{
              background: projectionLongue
                ? "radial-gradient(circle, rgba(255,232,210,.3), transparent 70%)"
                : "radial-gradient(circle, rgba(124,224,168,.26), transparent 70%)",
            }}
          />
          <div className="relative flex items-center justify-between">
            <span
              className="text-[12px] font-bold tracking-[0.08em]"
              style={{ color: projectionLongue ? "#FCE4D2" : "#9FD4B5" }}
            >
              PROJECTION D’ÉCOULEMENT
            </span>
            <div className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-white/[0.16]">
              <Clock className="h-[22px] w-[22px] text-[#FFF1E6]" strokeWidth={2} />
            </div>
          </div>
          <div className="relative mt-4 flex items-baseline gap-2.5">
            <span className="font-grotesk text-[52px] font-bold leading-none tracking-[-0.03em]">
              {jours != null ? jours : "—"}
            </span>
            <span
              className="text-[15px] font-semibold"
              style={{ color: projectionLongue ? "#FCE4D2" : "#BFE3CE" }}
            >
              jours pour tout vendre
            </span>
          </div>
          <div className="relative mt-5">
            <div
              className="mb-2 flex justify-between text-[12px] font-semibold"
              style={{ color: projectionLongue ? "#FFEEDF" : "#CFEBDA" }}
            >
              <span>{Math.round(pctEcoule * 100)} % du stock écoulé</span>
              <span>
                {vendus} / {totalArticles}
              </span>
            </div>
            <div className="h-[9px] overflow-hidden rounded-md bg-white/[0.22]">
              <div
                className="h-full rounded-md bg-surface"
                style={{ width: `${Math.round(pctEcoule * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Meilleur jour + Donut */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.45fr_1fr]">
        <WeekdayCard days={data.parJourSemaine} />
        <StatutDonut data={data.repartitionStatuts} total={totalArticles} />
      </div>

      {/* CA par canal */}
      <CanalCard data={data.caParCanal} />

      {/* Marques les plus rentables */}
      <section className="mt-5">
        {/* Cartes mobile (< md) */}
        <h2 className="mb-3 font-grotesk text-[18px] font-bold text-[var(--ink)] md:hidden">
          Marques les plus rentables
        </h2>
        <div className="space-y-3 md:hidden">
          {data.marquesRentables.map((b) => (
            <div key={b.marque} className="rounded-[18px] border border-[var(--border)] bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-grotesk font-bold text-[var(--ink)]">{b.marque}</span>
                <span className="font-grotesk font-bold text-[#2D6A4F]">{euros(b.margeNette)}</span>
              </div>
              <dl className="mt-3 space-y-1.5 text-[14px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--faint-2)]">Coef moyen</dt>
                  <dd className="text-[var(--muted)]">{coef(b.coefMoyen)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--faint-2)]">Vendus</dt>
                  <dd className="text-[var(--ink)]">{b.vendus}</dd>
                </div>
              </dl>
            </div>
          ))}
          {data.marquesRentables.length === 0 && (
            <p className="rounded-[18px] border border-[var(--border)] bg-surface px-4 py-8 text-center text-[var(--faint)]">
              Aucune vente pour le moment.
            </p>
          )}
        </div>
        {/* Tableau (≥ md) */}
        <div className="hidden overflow-hidden rounded-[20px] border border-[var(--border)] bg-surface md:block">
        <h2 className="border-b border-[var(--border)] px-6 py-4 font-grotesk text-[18px] font-bold text-[var(--ink)]">
          Marques les plus rentables
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-[14px]">
            <thead>
              <tr className="bg-[var(--tint)] text-left text-[11.5px] font-bold uppercase tracking-[0.05em] text-[var(--faint)]">
                <th className="px-6 py-3">Marque</th>
                <th className="px-3 py-3 text-right">Marge nette totale</th>
                <th className="px-3 py-3 text-right">Coef moyen</th>
                <th className="px-6 py-3 text-right">Vendus</th>
              </tr>
            </thead>
            <tbody>
              {data.marquesRentables.map((b) => (
                <tr key={b.marque} className="border-t border-[var(--bg)]">
                  <td className="px-6 py-3 font-semibold text-[var(--ink)]">{b.marque}</td>
                  <td className="px-3 py-3 text-right font-semibold text-[#2D6A4F]">
                    {euros(b.margeNette)}
                  </td>
                  <td className="px-3 py-3 text-right text-[var(--muted)]">
                    {coef(b.coefMoyen)}
                  </td>
                  <td className="px-6 py-3 text-right text-[var(--muted)]">{b.vendus}</td>
                </tr>
              ))}
              {data.marquesRentables.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-[var(--faint)]">
                    Aucune vente pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      </section>

      {/* Top 5 articles */}
      <section className="mt-5">
        {/* Cartes mobile (< md) */}
        <h2 className="mb-3 font-grotesk text-[18px] font-bold text-[var(--ink)] md:hidden">
          Top 5 articles (prix de vente)
        </h2>
        <div className="space-y-3 md:hidden">
          {data.topArticles.map((a) => (
            <div key={a.sku} className="rounded-[18px] border border-[var(--border)] bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-grotesk font-bold text-[var(--ink)]">{a.sku}</span>
                <span className="font-grotesk font-bold text-[#2D6A4F]">{euros(a.margeNette)}</span>
              </div>
              <dl className="mt-3 space-y-1.5 text-[14px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--faint-2)]">Marque</dt>
                  <dd className="text-[var(--muted)]">{a.marque}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--faint-2)]">Prix vente</dt>
                  <dd className="text-[var(--ink)]">{euros(a.prixVente)}</dd>
                </div>
              </dl>
            </div>
          ))}
          {data.topArticles.length === 0 && (
            <p className="rounded-[18px] border border-[var(--border)] bg-surface px-4 py-8 text-center text-[var(--faint)]">
              Aucune vente pour le moment.
            </p>
          )}
        </div>
        {/* Tableau (≥ md) */}
        <div className="hidden overflow-hidden rounded-[20px] border border-[var(--border)] bg-surface md:block">
        <h2 className="border-b border-[var(--border)] px-6 py-4 font-grotesk text-[18px] font-bold text-[var(--ink)]">
          Top 5 articles (prix de vente)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-[14px]">
            <thead>
              <tr className="bg-[var(--tint)] text-left text-[11.5px] font-bold uppercase tracking-[0.05em] text-[var(--faint)]">
                <th className="px-6 py-3">SKU</th>
                <th className="px-3 py-3">Marque</th>
                <th className="px-3 py-3 text-right">Prix vente</th>
                <th className="px-6 py-3 text-right">Marge nette</th>
              </tr>
            </thead>
            <tbody>
              {data.topArticles.map((a) => (
                <tr key={a.sku} className="border-t border-[var(--bg)]">
                  <td className="px-6 py-3 font-grotesk font-bold text-[var(--ink)]">
                    {a.sku}
                  </td>
                  <td className="px-3 py-3 text-[var(--muted)]">{a.marque}</td>
                  <td className="px-3 py-3 text-right font-semibold text-[var(--ink)]">
                    {euros(a.prixVente)}
                  </td>
                  <td className="px-6 py-3 text-right font-semibold text-[#2D6A4F]">
                    {euros(a.margeNette)}
                  </td>
                </tr>
              ))}
              {data.topArticles.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-[var(--faint)]">
                    Aucune vente pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      </section>
    </Frame>
  );
}

// ── Meilleur jour de la semaine (barres custom + tooltip) ──
function WeekdayCard({ days }: { days: WeekdayPoint[] }) {
  const [hovered, setHovered] = useState(-1);
  const max = Math.max(1, ...days.map((d) => d.vendus));
  const allZero = days.length === 0 || days.every((d) => d.vendus === 0);
  let bestIdx = 0;
  days.forEach((d, i) => {
    if (d.vendus > days[bestIdx].vendus) bestIdx = i;
  });
  const champion = days[bestIdx];

  return (
    <div className="rounded-[22px] border border-[var(--border)] bg-surface px-6 py-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-grotesk text-[18px] font-bold text-[var(--ink)]">
            Meilleur jour de la semaine
          </h2>
          <p className="mt-1 text-[13px] font-medium text-[var(--faint)]">
            Nombre de ventes par jour
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--faint-2)]">
            {"Basé sur tout l'historique"}
          </p>
        </div>
        {!allZero && champion && champion.vendus > 0 && (
          <span className="rounded-full bg-[#EAF3ED] px-2.5 py-1.5 text-[12px] font-bold text-[#2D6A4F]">
            🏆 {champion.jour}
          </span>
        )}
      </div>
      {allZero ? (
        <div className="flex h-[200px] items-center justify-center">
          <p className="text-[13.5px] font-medium text-[var(--faint-2)]">
            Aucune vente enregistrée pour le moment.
          </p>
        </div>
      ) : (
        <div className="relative mt-5 flex h-[200px] items-stretch gap-3 md:gap-4">
          {days.map((d, i) => {
            const isBest = i === bestIdx && d.vendus > 0;
            const isHover = hovered === i;
            const fill = isHover ? "#2D6A4F" : isBest ? "#1B4332" : "#B7D3C2";
            return (
              <div
                key={i}
                className="flex flex-1 flex-col items-center justify-end h-full"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(-1)}
                title={champion?.dateRecente && isBest ? formatDateLongue(champion.dateRecente) : undefined}
              >
                <div className="relative flex w-full items-end justify-center">
                  {isHover && (
                    <div
                      className="absolute bottom-[calc(100%+4px)] left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-[10px] bg-[var(--ink)] px-2.5 py-1.5 font-grotesk text-[13px] font-bold text-white"
                      style={{ boxShadow: "0 10px 22px -10px rgba(0,0,0,.5)" }}
                    >
                      {d.vendus} vente{d.vendus > 1 ? "s" : ""}
                    </div>
                  )}
                  <div
                    className="w-full max-w-[40px] cursor-pointer transition-colors duration-200"
                    style={{
                      height: `${Math.max(4, Math.round((d.vendus / max) * 180))}px`,
                      background: fill,
                      borderRadius: "8px 8px 4px 4px",
                    }}
                  />
                </div>
                <span className="mt-2.5 text-[12px] font-semibold text-[var(--faint)]">
                  {d.jour.slice(0, 3)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Donut répartition des statuts ──
function StatutDonut({ data, total }: { data: StatutCount[]; total: number }) {
  const r = 58;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  const segments = data.map((s) => {
    const frac = total ? s.count / total : 0;
    const seg = {
      color: statutColor(s.statut).text,
      len: frac * circ,
      offset: -acc,
      statut: s.statut,
      count: s.count,
      pct: Math.round(frac * 100),
    };
    acc += frac * circ;
    return seg;
  });

  return (
    <div className="rounded-[22px] border border-[var(--border)] bg-surface px-6 py-6">
      <h2 className="font-grotesk text-[18px] font-bold text-[var(--ink)]">
        Répartition des statuts
      </h2>
      <p className="mt-1 text-[13px] font-medium text-[var(--faint)]">
        {total.toLocaleString("fr-FR")} articles au total
      </p>
      <div className="mt-2 flex items-center gap-6">
        <div className="relative h-[150px] w-[150px] flex-shrink-0">
          <svg width="150" height="150" viewBox="0 0 150 150" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="75" cy="75" r={r} fill="none" stroke="#EEF2EC" strokeWidth="20" />
            {segments.map((s, i) => (
              <circle
                key={i}
                cx="75"
                cy="75"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="20"
                strokeDasharray={`${s.len} ${circ - s.len}`}
                strokeDashoffset={s.offset}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-grotesk text-[26px] font-bold tracking-[-0.02em]">
              {total.toLocaleString("fr-FR")}
            </span>
            <span className="text-[11px] font-semibold text-[var(--faint-2)]">articles</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3.5">
          {segments.map((s, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span
                className="h-[11px] w-[11px] flex-shrink-0 rounded-[3px]"
                style={{ background: s.color }}
              />
              <span className="flex-1 text-[13.5px] font-semibold text-[var(--ink2)]">
                {s.statut}
              </span>
              <span className="font-grotesk text-[14px] font-bold">{s.count}</span>
              <span className="w-[34px] text-right text-[12px] font-semibold text-[var(--faint-2)]">
                {s.pct} %
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── CA par canal (barres horizontales) ──
function canalInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.trim().slice(0, 1).toUpperCase();
}

function canalStyle(name: string): { square: string; bar: string } {
  if (name === "Vinted" || name === "Vinted Go")
    return { square: "#0BBBC4", bar: "linear-gradient(90deg,#0BBBC4,#089AA2)" };
  if (name.startsWith("Vestiaire"))
    return { square: "var(--ink)", bar: "linear-gradient(90deg,var(--ink2),var(--ink))" };
  return { square: "#2D6A4F", bar: "linear-gradient(90deg,#2D6A4F,#1B4332)" };
}

function CanalCard({ data }: { data: CanalCA[] }) {
  const total = data.reduce((s, c) => s + c.ca, 0);
  return (
    <div className="rounded-[22px] border border-[var(--border)] bg-surface px-6 py-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h2 className="font-grotesk text-[18px] font-bold text-[var(--ink)]">
            CA par canal
          </h2>
          <p className="mt-1 text-[13px] font-medium text-[var(--faint)]">
            Répartition des ventes par plateforme
          </p>
        </div>
        <span className="font-grotesk text-[18px] font-bold">{euros(total)}</span>
      </div>
      {data.length === 0 ? (
        <p className="text-[14px] text-[var(--faint-2)]">Aucune vente pour le moment.</p>
      ) : (
        <div className="flex flex-col gap-[22px]">
          {data.map((c) => {
            const pct = total ? Math.round((c.ca / total) * 100) : 0;
            const st = canalStyle(c.canal);
            return (
              <div key={c.canal}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="inline-flex items-center gap-2.5 text-[14px] font-bold text-[var(--ink)]">
                    <span
                      className="flex h-[26px] w-[26px] items-center justify-center rounded-lg text-[13px] font-extrabold text-white"
                      style={{ background: st.square }}
                    >
                      {canalInitials(c.canal)}
                    </span>
                    {c.canal}
                  </span>
                  <span className="text-[13.5px] font-semibold text-[var(--muted)]">
                    <b className="font-grotesk text-[var(--ink)]">{euros(c.ca)}</b> · {pct} %
                  </span>
                </div>
                <div className="h-[14px] overflow-hidden rounded-lg bg-[#EEF2EC]">
                  <div
                    className="h-full rounded-lg"
                    style={{ width: `${pct}%`, background: st.bar }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
