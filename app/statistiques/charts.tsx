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
import { euros } from "@/lib/calc";
import { statutColor } from "@/lib/statutColors";
import { canalColor } from "@/lib/canalColors";
import type { CanalCA, StatutCount, WeekdayPoint } from "@/lib/types";

// Tous les graphiques recharts de la page Stats sont regroupés ici pour être
// sortis du bundle initial : la page les importe via next/dynamic (ssr:false).

const hex = (statut: string) => statutColor(statut).text;

export function WeekdayChart({ data }: { data: WeekdayPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 8, bottom: 5, left: 0 }}>
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
  );
}

export function StatutPie({ data }: { data: StatutCount[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="statut"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
        >
          {data.map((s) => (
            <Cell key={s.statut} fill={hex(s.statut)} />
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
  );
}

export function CanalChart({ data }: { data: CanalCA[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        layout="vertical"
        data={data}
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
          {data.map((d) => (
            <Cell key={d.canal} fill={canalColor(d.canal).bg} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
