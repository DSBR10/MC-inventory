"use client";

import { useMemo, useState } from "react";
import { BillingItem } from "@/types/billing";

import BillingCards from "./BillingCards";
import BillingCharts from "./BillingCharts";
import BillingTable from "./BillingTable";
import BillingTagFilters from "./BillingTagFilters";
import BillingFilters from "./BillingFilters";
import BillingTrends from "./BillingTrends";
import BillingResources from "@/components/billing/BillingResources";

type TagFilter = {
  key: string;
  value: string;
};

type Props = {
  billing: BillingItem[];
  loading: boolean;
};

export default function BillingDashboard({ billing, loading }: Props) {
  const [selectedTags, setSelectedTags] = useState<TagFilter[]>([]);
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("");
  const [service, setService] = useState("");
  const [account, setAccount] = useState("");

  const filteredBilling = useMemo(() => {
    return billing.filter((item) => {
      /* TAG FILTERS — AND por key, OR por value dentro del mismo key */
      if (selectedTags.length > 0) {
        const grouped = selectedTags.reduce<Record<string, string[]>>(
          (acc, t) => {
            if (!acc[t.key]) acc[t.key] = [];
            acc[t.key].push(t.value);
            return acc;
          },
          {},
        );

        const tags = item.tags || {};
        const passes = Object.entries(grouped).every(([key, values]) => {
          const itemValue = tags[key as keyof typeof tags];
          return itemValue && values.includes(itemValue);
        });
        if (!passes) return false;
      }

      /* SEARCH */
      if (search) {
        const q = search.toLowerCase();
        const raw =
          `${item.provider} ${item.service} ${item.accountName} ${JSON.stringify(item.tags)}`.toLowerCase();
        if (!raw.includes(q)) return false;
      }

      if (provider && item.provider !== provider) return false;
      if (service && item.service !== service) return false;
      if (account && item.accountName !== account) return false;

      return true;
    });
  }, [billing, selectedTags, search, provider, service, account]);

  const activeFiltersCount =
    selectedTags.length +
    (search ? 1 : 0) +
    (provider ? 1 : 0) +
    (service ? 1 : 0) +
    (account ? 1 : 0);

  function clearAll() {
    setSelectedTags([]);
    setSearch("");
    setProvider("");
    setService("");
    setAccount("");
  }

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <BillingFilters
        billing={billing}
        search={search}
        setSearch={setSearch}
        provider={provider}
        setProvider={setProvider}
        service={service}
        setService={setService}
        account={account}
        setAccount={setAccount}
      />

      {/* Tag filters — Cost Explorer style */}
      <BillingTagFilters
        billing={billing}
        selectedTags={selectedTags}
        onTagsChange={setSelectedTags}
      />

      {/* Active filter summary */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-2 px-1 text-xs text-[var(--text-secondary)]">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse flex-shrink-0" />
          Mostrando{" "}
          <span className="text-[var(--text-primary)] font-semibold">
            {filteredBilling.length}
          </span>{" "}
          de{" "}
          <span className="text-[var(--text-primary)] font-semibold">
            {billing.length}
          </span>{" "}
          registros con{" "}
          <span className="text-cyan-400 font-semibold">
            {activeFiltersCount}
          </span>{" "}
          filtro{activeFiltersCount > 1 ? "s" : ""} activo
          {activeFiltersCount > 1 ? "s" : ""}
          <button
            onClick={clearAll}
            className="ml-2 text-red-400 hover:text-red-300 underline underline-offset-2 transition-colors"
          >
            Limpiar todo
          </button>
        </div>
      )}

      <BillingCards billing={filteredBilling} />
      <BillingCharts billing={filteredBilling} />
      <BillingResources billing={filteredBilling} />
      <BillingTrends billing={filteredBilling} />
      <BillingTable billing={filteredBilling} loading={loading} />
    </div>
  );
}
