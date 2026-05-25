"use client";

import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import { BillingItem } from "@/types/billing";

import {
  buildMonthlyTrend,
  calculateGrowth,
  calculateBurnRate,
} from "@/lib/billing/trends";

export default function BillingTrends({ billing }: { billing: BillingItem[] }) {
  const trendData = buildMonthlyTrend(billing);

  const growth = calculateGrowth(billing);

  const burnRate = calculateBurnRate(billing);

  return (
    <div className="space-y-6">
      {/* KPIS */}

      <div
        className="
          grid
          grid-cols-1
          md:grid-cols-2
          xl:grid-cols-4
          gap-4
        "
      >
        <Card title="Growth" value={`${growth}%`} />

        <Card title="Burn Rate" value={`$${burnRate}/día`} />

        <Card title="Forecast" value={`$${(burnRate * 30).toFixed(2)}`} />

        <Card title="Months" value={`${trendData.length}`} />
      </div>

      {/* TREND */}

      <div
        className="
          rounded-3xl
          border
          border-[var(--border)]
          bg-[var(--bg-card)]/60
          p-6
        "
      >
        <h2 className="text-2xl font-bold mb-6">Monthly Cost Trends</h2>

        <div className="h-[420px]">
          <ResponsiveContainer width="100%" height={420}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.8} />

                  <stop offset="100%" stopColor="#06B6D4" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />

              <XAxis dataKey="month" stroke="#9CA3AF" />

              <YAxis stroke="#9CA3AF" />

              <Tooltip />

              <Area
                type="monotone"
                dataKey="cost"
                stroke="#06B6D4"
                fill="url(#costGradient)"
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div
      className="
        rounded-3xl
        border
        border-[var(--border)]
        bg-[var(--bg-card)]/60
        p-5
      "
    >
      <p className="text-[var(--text-secondary)] text-sm">{title}</p>

      <h2 className="text-3xl font-bold mt-3">{value}</h2>
    </div>
  );
}
