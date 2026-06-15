"use client";

import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useDashboard } from "@/lib/hooks";
import { coef, euros, pourcent } from "@/lib/calc";
import KpiCard from "@/components/KpiCard";

export default function DashboardPage() {
  const router = useRouter();
  const { data, isLoading, isError, error } = useDashboard();

  if (isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-8">
        <p className="text-body-md text-ink-faint">Chargement du dashboard…</p>
      </main>
    );
  }
  if (isError || !data) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-8">
        <p className="text-body-md text-error">
          {error ? (error as Error).message : "Erreur de chargement."}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-ink md:text-4xl">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-ink-muted md:text-base">
          Vue d&apos;ensemble de ton activité.
        </p>
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        <KpiCard label="CA Total" value={euros(data.caTotal)} variant="primary" />
        <KpiCard label="Marge Nette" value={euros(data.margeNetteTotal)} />
        <KpiCard
          label="Articles en stock"
          value={String(data.enStock)}
          badge={`${data.totalArticles} au total`}
        />
        <KpiCard
          label="% vendu"
          value={pourcent(data.pctVendu)}
          badge={`${data.vendus} vendus`}
        />
      </div>

      {/* Graphique CA par semaine */}
      <section className="mt-8 rounded-card border border-line bg-surface p-6 shadow-card">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="text-headline-md text-ink">CA par semaine</h2>
          <span className="text-label-sm text-ink-faint">
            8 dernières semaines
          </span>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.caParSemaine}
              margin={{ top: 5, right: 8, bottom: 5, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eaeaea" vertical={false} />
              <XAxis
                dataKey="semaine"
                stroke="#717972"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: "#eaeaea" }}
              />
              <YAxis
                stroke="#717972"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(26,83,54,0.06)" }}
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #eaeaea",
                  borderRadius: 12,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
                }}
                labelStyle={{ color: "#1a1c1c", fontWeight: 600 }}
                formatter={(v) => [euros(Number(v)), "CA"]}
              />
              <Bar dataKey="ca" fill="#1a5336" radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Récap par marque */}
      <section className="mt-8 overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <h2 className="border-b border-line px-6 py-4 text-headline-md text-ink">
          Par marque
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-body-md">
            <thead>
              <tr className="text-left text-label-sm uppercase tracking-wide text-ink-faint">
                <th className="sticky left-0 z-10 bg-surface px-6 py-3 font-medium">
                  Marque
                </th>
                <th className="px-3 py-3 text-right font-medium">Total</th>
                <th className="px-3 py-3 text-right font-medium">En stock</th>
                <th className="px-3 py-3 text-right font-medium">Vendus</th>
                <th className="px-3 py-3 text-right font-medium">CA</th>
                <th className="px-3 py-3 text-right font-medium">Marge nette</th>
                <th className="px-3 py-3 text-right font-medium">Coef moyen</th>
                <th className="px-3 py-3 text-right font-medium">Panier moyen</th>
                <th className="px-6 py-3 text-right font-medium">% vendu</th>
              </tr>
            </thead>
            <tbody>
              {data.parMarque.map((b) => (
                <tr
                  key={b.marque}
                  onClick={() =>
                    router.push(`/stock?marque=${encodeURIComponent(b.marque)}`)
                  }
                  className="cursor-pointer border-t border-line transition-colors hover:bg-surface-soft"
                >
                  <td className="sticky left-0 z-10 bg-surface px-6 py-3.5 font-medium text-ink">
                    {b.marque}
                  </td>
                  <td className="px-3 py-3.5 text-right text-ink-muted">
                    {b.total}
                  </td>
                  <td className="px-3 py-3.5 text-right text-ink-muted">
                    {b.enStock}
                  </td>
                  <td className="px-3 py-3.5 text-right text-ink-muted">
                    {b.vendus}
                  </td>
                  <td className="px-3 py-3.5 text-right font-medium text-ink">
                    {euros(b.ca)}
                  </td>
                  <td className="px-3 py-3.5 text-right font-medium text-primary">
                    {euros(b.margeNette)}
                  </td>
                  <td className="px-3 py-3.5 text-right text-ink-muted">
                    {coef(b.coefMoyen)}
                  </td>
                  <td className="px-3 py-3.5 text-right text-ink-muted">
                    {euros(b.panierMoyen)}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <span className="inline-flex items-center rounded-full bg-surface-container px-2.5 py-1 text-label-sm text-ink-muted">
                      {pourcent(b.pctVendu)}
                    </span>
                  </td>
                </tr>
              ))}
              {data.parMarque.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-10 text-center text-body-md text-ink-faint"
                  >
                    Aucune donnée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
