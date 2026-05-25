"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

import { BillingItem } from "@/types/billing";

const COLORS = [
  "#06B6D4",
  "#8B5CF6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
];

export default function BillingCharts({ billing }: { billing: BillingItem[] }) {
  /* ───────────────────────────── */
  /* PROVIDERS */
  /* ───────────────────────────── */

  const providerMap: Record<string, number> = {};

  billing.forEach((item) => {
    providerMap[item.provider] = (providerMap[item.provider] || 0) + item.cost;
  });

  const providerData = Object.entries(providerMap)

    .map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2)),
    }));

  /* ───────────────────────────── */
  /* SERVICES */
  /* ───────────────────────────── */

  const serviceMap: Record<string, number> = {};

  billing.forEach((item) => {
    serviceMap[item.service] = (serviceMap[item.service] || 0) + item.cost;
  });

  const serviceData = Object.entries(serviceMap)

    .map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2)),
    }))

    .sort((a, b) => b.value - a.value)

    .slice(0, 10);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* PROVIDERS */}

      <div
        className="
          rounded-3xl
          border
          border-[var(--border)]
          bg-[var(--bg-card)]/60
          p-6
        "
      >
        <h2 className="text-xl font-semibold mb-6">Costos por Provider</h2>

        <div className="h-[350px] min-w-0">
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={providerData}
                dataKey="value"
                nameKey="name"
                outerRadius={120}
                label
              >
                {providerData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>

              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SERVICES */}

      <div
        className="
          rounded-3xl
          border
          border-[var(--border)]
          bg-[var(--bg-card)]/60
          p-6
        "
      >
        <h2 className="text-xl font-semibold mb-6">Top Servicios</h2>

        <div className="h-[350px] min-w-0">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={serviceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />

              <XAxis dataKey="name" stroke="#9CA3AF" />

              <YAxis stroke="#9CA3AF" />

              <Tooltip />

              <Bar dataKey="value" fill="#06B6D4" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
