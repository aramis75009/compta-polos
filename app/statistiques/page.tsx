"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useStats } from "@/lib/hooks";
import { coef, euros } from "@/lib/calc";
import { statutColor } from "@/lib/statutColors";
import { canalColor } from "@/lib/canalColors";

// Couleur vive (texte) du statut, pour le donut et la légende.
const hex = (statut: string) => statutColor(statut).text;

// "9 juin 2026" — date réelle du meilleur jour de la semaine.
const formatDateLongue = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-line bg-surface p-6 shadow-card">
      <h2 className="mb-4 text-headline-md text-ink">{title}</h2>
      {children}
    </section>
  );
}

export default function StatistiquesPage() {
  const { data, isLoading, isError, error } = useStats();

  if (isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-8">
        <p className="text-body-md text-ink-faint">Chargement des statistiques…</p>
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
        <h1 className="text-2xl font-bold text-ink md:text-4xl">Statistiques</h1>
        <p className="mt-1 text-sm text-ink-muted md:text-base">
          Analyse de ton activité de revente.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Vitesse de vente */}
        <Card title="Vitesse de vente">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md border border-line p-4">
              <p className="text-label-sm uppercase text-ink-faint">
                Moyenne 7 jours
              </p>
              <p className="mt-1 text-headline-md text-ink">
                {data.vitesse.parJour7}
                <span className="text-body-md text-ink-faint"> /jour</span>
              </p>
              <p className="text-label-sm text-ink-faint">
                {data.vitesse.total7} vendus sur 7j
              </p>
            </div>
            <div className="rounded-md border border-line p-4">
              <p className="text-label-sm uppercase text-ink-faint">
                Moyenne 30 jours
              </p>
              <p className="mt-1 text-headline-md text-ink">
                {data.vitesse.parJour30}
                <span className="text-body-md text-ink-faint"> /jour</span>
              </p>
              <p className="text-label-sm text-ink-faint">
                {data.vitesse.total30} vendus sur 30j
              </p>
            </div>
          </div>
        </Card>

        {/* Projection */}
        <Card title="Projection">
          <p className="text-body-md text-ink-muted">
            Articles restants à vendre :{" "}
            <strong className="text-ink">{data.projection.restants}</strong>
          </p>
          <p className="mt-1 text-body-md text-ink-muted">
            Cadence actuelle :{" "}
            <strong className="text-ink">
              {data.projection.cadenceParJour} /jour
            </strong>
          </p>
          <p className="mt-4 text-body-md text-ink-muted">
            À ce rythme, tout sera vendu dans :
          </p>
          <p className="text-stat-lg text-primary">
            {data.projection.joursRestants != null
              ? `${data.projection.joursRestants} j`
              : "—"}
          </p>
        </Card>

        {/* Meilleur jour de la semaine */}
        <Card title="Meilleur jour de la semaine">
          {(() => {
            const meilleur = data.parJourSemaine
              .filter((j) => j.vendus > 0)
              .sort((a, b) => b.vendus - a.vendus)[0];
            if (!meilleur) return null;
            return (
              <div className="mb-4">
                <p className="text-headline-md text-ink">
                  {meilleur.jour}
                  {meilleur.dateRecente && (
                    <span className="ml-2 text-body-md font-normal text-ink-muted">
                      {formatDateLongue(meilleur.dateRecente)}
                    </span>
                  )}
                </p>
                <p className="text-body-md text-ink-muted">
                  {meilleur.vendus} vente{meilleur.vendus > 1 ? "s" : ""} ·{" "}
                  {euros(meilleur.ca)}
                </p>
              </div>
            );
          })()}
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.parJourSemaine}
                margin={{ top: 5, right: 8, bottom: 5, left: 0 }}
              >
                <XAxis
                  dataKey="jour"
                  stroke="#717972"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#eaeaea" }}
                  tickFormatter={(v: string) => v.slice(0, 3)}
                />
                <YAxis
                  stroke="#717972"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(26,83,54,0.06)" }}
                  contentStyle={{
                    background: "#ffffff",
                    border: "1px solid #eaeaea",
                    borderRadius: 12,
                  }}
                  formatter={(v) => [String(v), "Vendus"]}
                />
                <Bar dataKey="vendus" fill="#1a5336" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Répartition des statuts */}
        <Card title="Répartition des statuts">
          <div className="flex items-center gap-4">
            <div className="h-64 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.repartitionStatuts}
                    dataKey="count"
                    nameKey="statut"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {data.repartitionStatuts.map((s) => (
                      <Cell
                        key={s.statut}
                        fill={hex(s.statut)}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#ffffff",
                      border: "1px solid #eaeaea",
                      borderRadius: 12,
                    }}
                    formatter={(v, n) => [String(v), String(n)]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5 text-label-sm">
              {data.repartitionStatuts.map((s) => (
                <li key={s.statut} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: hex(s.statut) }}
                  />
                  <span className="text-ink-muted">{s.statut}</span>
                  <span className="font-semibold text-ink">{s.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        {/* CA par canal de vente (barres horizontales) */}
        <Card title="CA par canal">
          {data.caParCanal.length === 0 ? (
            <p className="text-body-md text-ink-faint">
              Aucune vente pour le moment.
            </p>
          ) : (
            <div
              className="w-full"
              style={{ height: Math.max(160, data.caParCanal.length * 48) }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={data.caParCanal}
                  margin={{ top: 5, right: 16, bottom: 5, left: 8 }}
                >
                  <XAxis
                    type="number"
                    stroke="#717972"
                    fontSize={12}
                    tickLine={false}
                    axisLine={{ stroke: "#eaeaea" }}
                    tickFormatter={(v: number) => euros(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="canal"
                    stroke="#717972"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={130}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(26,83,54,0.06)" }}
                    contentStyle={{
                      background: "#ffffff",
                      border: "1px solid #eaeaea",
                      borderRadius: 12,
                    }}
                    formatter={(v) => [euros(Number(v)), "CA"]}
                  />
                  <Bar dataKey="ca" radius={[0, 6, 6, 0]} maxBarSize={32}>
                    {data.caParCanal.map((d) => (
                      <Cell key={d.canal} fill={canalColor(d.canal).bg} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Marques les plus rentables */}
      <section className="mt-5 overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <h2 className="border-b border-line px-6 py-4 text-headline-md text-ink">
          Marques les plus rentables
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-body-md">
            <thead>
              <tr className="text-left text-label-sm uppercase tracking-wide text-ink-faint">
                <th className="sticky left-0 z-10 bg-surface px-6 py-3 font-medium">
                  Marque
                </th>
                <th className="px-3 py-3 text-right font-medium">Marge nette totale</th>
                <th className="px-3 py-3 text-right font-medium">Coef moyen</th>
                <th className="px-6 py-3 text-right font-medium">Vendus</th>
              </tr>
            </thead>
            <tbody>
              {data.marquesRentables.map((b) => (
                <tr key={b.marque} className="border-t border-line">
                  <td className="sticky left-0 z-10 bg-surface px-6 py-3 font-medium text-ink">
                    {b.marque}
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-primary">
                    {euros(b.margeNette)}
                  </td>
                  <td className="px-3 py-3 text-right text-ink-muted">
                    {coef(b.coefMoyen)}
                  </td>
                  <td className="px-6 py-3 text-right text-ink-muted">
                    {b.vendus}
                  </td>
                </tr>
              ))}
              {data.marquesRentables.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-ink-faint">
                    Aucune vente pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top 5 articles */}
      <section className="mt-5 overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <h2 className="border-b border-line px-6 py-4 text-headline-md text-ink">
          Top 5 articles (prix de vente)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-body-md">
            <thead>
              <tr className="text-left text-label-sm uppercase tracking-wide text-ink-faint">
                <th className="px-6 py-3 font-medium">SKU</th>
                <th className="px-3 py-3 font-medium">Marque</th>
                <th className="px-3 py-3 text-right font-medium">Prix vente</th>
                <th className="px-6 py-3 text-right font-medium">Marge nette</th>
              </tr>
            </thead>
            <tbody>
              {data.topArticles.map((a) => (
                <tr key={a.sku} className="border-t border-line">
                  <td className="px-6 py-3 font-mono text-ink">{a.sku}</td>
                  <td className="px-3 py-3 text-ink-muted">{a.marque}</td>
                  <td className="px-3 py-3 text-right font-medium text-ink">
                    {euros(a.prixVente)}
                  </td>
                  <td className="px-6 py-3 text-right font-medium text-primary">
                    {euros(a.margeNette)}
                  </td>
                </tr>
              ))}
              {data.topArticles.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-ink-faint">
                    Aucune vente pour le moment.
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
