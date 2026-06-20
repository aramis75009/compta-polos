"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { euros } from "@/lib/calc";
import type { WeekPoint } from "@/lib/types";

// Graphique « CA par semaine » isolé dans son propre module : recharts (~lourd)
// est ainsi sorti du bundle initial du Dashboard et chargé dynamiquement
// (next/dynamic, ssr:false) côté client uniquement.
export default function WeeklyCaChart({ data }: { data: WeekPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 8, bottom: 5, left: 0 }}>
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
  );
}
