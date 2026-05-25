"use client";

import { useEffect, useState } from "react";

import { BillingItem } from "@/types/billing";

import BillingDashboard from "@/components/billing/BillingDashboard";

import BillingResources from "@/components/billing/BillingResources";

import BillingDateFilters from "@/components/billing/BillingDateFilters";

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingItem[]>([]);

  const [loading, setLoading] = useState(true);

  const [start, setStart] = useState("2026-01");

  const [end, setEnd] = useState("2026-05");

  useEffect(() => {
    async function loadBilling() {
      try {
        setLoading(true);

        const response = await fetch(`/api/billing?start=${start}&end=${end}`);

        const json = await response.json();

        setBilling(json.data || []);
      } catch (error) {
        console.error("Billing fetch error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadBilling();
  }, [start, end]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Billing Center</h1>

        <p className="text-[var(--text-secondary)] mt-2">
          Multi-cloud FinOps, costos, tendencias, tags y consumo empresarial.
        </p>
      </div>

      <BillingDateFilters
        start={start}
        end={end}
        onStartChange={setStart}
        onEndChange={setEnd}
      />

      <BillingDashboard billing={billing} loading={loading} />

      <BillingResources billing={billing} />
    </div>
  );
}
