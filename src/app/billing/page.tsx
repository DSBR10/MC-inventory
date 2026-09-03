"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  Cloud,
  Database,
  Download,
  Filter,
  Loader2,
  PieChart as PieChartIcon,
  RefreshCw,
  Search,
  Server,
  SlidersHorizontal,
  Tags,
  WalletCards,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import ScrollToTop from "@/components/ui/ScrollToTop";
import type { BillingItem } from "@/types/billing";

type BillingResponse = {
  success: boolean;
  source: "cache" | "fresh";
  timestamp: number;
  refreshing: boolean;
  total: number;
  count: number;
  facets?: {
    accounts?: string[];
    services?: string[];
    tags?: Record<string, string[]>;
  };
  data: BillingItem[];
};

type Filters = {
  start: string;
  end: string;
  accounts: string[];
  service: string;
  tagFilters: Array<{ key: string; value: string }>;
  search: string;
};

type GroupPoint = {
  name: string;
  value: number;
  count?: number;
};

type InventoryResource = {
  provider?: string;
  accountId?: string;
  accountName?: string;
  service?: string;
  resourceType?: string;
  name?: string;
  id?: string;
  tags?: Record<string, string>;
  children?: InventoryResource[];
};

const COLORS = ["#22d3ee", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#60a5fa", "#fb7185", "#2dd4bf"];
const NO_ACCOUNTS_SELECTED = "__NO_ACCOUNTS_SELECTED__";
const COST_TAG_KEYS = ["Cliente", "Proyecto", "CostCenter", "Environment", "Owner", "Application"];
const TAG_ALIASES: Record<string, string[]> = {
  Cliente: ["Cliente", "cliente", "Client", "client", "Customer", "customer"],
  Proyecto: ["Proyecto", "proyecto", "Project", "project"],
  CostCenter: ["CostCenter", "costcenter", "Cost Center", "cost-center", "CentroCosto", "Centro de costo"],
  Environment: ["Environment", "environment", "Env", "env", "Ambiente", "ambiente"],
  Owner: ["Owner", "owner", "Responsable", "responsable"],
  Application: ["Application", "application", "App", "app", "Aplicacion", "Aplicación"],
};

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Pick<BillingResponse, "source" | "timestamp" | "refreshing" | "count"> | null>(null);
  const [filters, setFilters] = useState<Filters>(() => ({
    start: getMonthOffset(-5),
    end: getMonthOffset(0),
    accounts: [],
    service: "",
    tagFilters: [],
    search: "",
  }));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersPanelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!filtersOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!filtersPanelRef.current?.contains(event.target as Node)) setFiltersOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [filtersOpen]);

  const fetchBilling = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        start: filters.start,
        end: filters.end,
        provider: "AWS",
      });
      const [billingResponse, inventoryResponse] = await Promise.all([
        fetch(`/api/billing?${params.toString()}`),
        fetch("/api/inventory"),
      ]);
      const json = (await billingResponse.json()) as BillingResponse;
      if (!billingResponse.ok || !json.success) throw new Error("No se pudo cargar AWS Billing");

      const inventoryJson = inventoryResponse.ok ? await inventoryResponse.json() : { data: [] };
      const inventory = (inventoryJson.data || inventoryJson.inventory || []) as InventoryResource[];
      const tagIndex = buildInventoryTagIndex(inventory);

      setBilling(enrichBillingWithInventoryTags((json.data || []).filter((item) => item.provider === "AWS"), tagIndex));
      setMeta({
        source: json.source,
        timestamp: json.timestamp,
        refreshing: json.refreshing,
        count: json.count,
      });
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Error desconocido");
      setBilling([]);
    } finally {
      setLoading(false);
    }
  }, [filters.start, filters.end]);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  const accountFacets = useMemo(() => buildFacets(billing), [billing]);
  const accountScopedBilling = useMemo(() => {
    if (filters.accounts.includes(NO_ACCOUNTS_SELECTED)) return [];
    if (filters.accounts.length === 0) return billing;
    return billing.filter((item) => filters.accounts.includes(item.accountName));
  }, [billing, filters.accounts]);
  const scopedFacets = useMemo(() => buildFacets(accountScopedBilling), [accountScopedBilling]);

  const filteredBilling = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return billing.filter((item) => {
      if (filters.accounts.includes(NO_ACCOUNTS_SELECTED)) return false;
      if (filters.accounts.length > 0 && !filters.accounts.includes(item.accountName)) return false;
      if (filters.service && item.service !== filters.service) return false;
      if (filters.tagFilters.some((filter) => item.tags?.[filter.key] !== filter.value)) return false;
      if (query) {
        const haystack = [
          item.accountName,
          item.accountId,
          item.service,
          item.region,
          item.resourceName,
          item.resourceId,
          item.usageType,
          JSON.stringify(item.tags || {}),
        ].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [billing, filters.accounts, filters.search, filters.service, filters.tagFilters]);

  const stats = useMemo(() => buildStats(filteredBilling), [filteredBilling]);
  const monthlyTrend = useMemo(() => groupByMonth(filteredBilling), [filteredBilling]);
  const serviceBreakdown = useMemo(() => groupBy(filteredBilling, "service", 10), [filteredBilling]);
  const accountBreakdown = useMemo(() => groupBy(filteredBilling, "accountName", 10), [filteredBilling]);
  const allocationTagKey = useMemo(
    () => chooseAllocationTagKey(filteredBilling, filters.tagFilters),
    [filteredBilling, filters.tagFilters],
  );
  const tagBreakdown = useMemo(() => groupByTag(filteredBilling, allocationTagKey, 8), [filteredBilling, allocationTagKey]);
  const tableRows = useMemo(() => [...filteredBilling].sort((a, b) => b.cost - a.cost), [filteredBilling]);

  const resetFilters = () => {
    setFilters((current) => ({
      ...current,
      accounts: [],
      service: "",
      tagFilters: [],
      search: "",
    }));
  };

  const activeFilterCount = [
    filters.accounts.length > 0,
    Boolean(filters.service),
    filters.tagFilters.length > 0,
    Boolean(filters.search.trim()),
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10">
              <WalletCards className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-[var(--text-primary)]">AWS Billing Center</h1>
                <span className="rounded-md border border-orange-400/30 bg-orange-500/10 px-2 py-1 text-xs font-medium text-orange-200">AWS only</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)]">Costos, tendencias, cuentas, servicios y tags con enfoque FinOps.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => exportBilling(tableRows, "xlsx")} disabled={tableRows.length === 0} className="secondary-button">
            <Download className="h-4 w-4" />
            EXCEL
          </button>
          <button type="button" onClick={() => exportBilling(tableRows, "pdf")} disabled={tableRows.length === 0} className="secondary-button">
            <Download className="h-4 w-4" />
            PDF
          </button>
          <button type="button" onClick={fetchBilling} disabled={loading} className="secondary-button">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Actualizar
          </button>
        </div>
      </section>

      {error && <StatusMessage tone="error" message={error} />}

      <section ref={filtersPanelRef} className="overflow-visible rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]/75 shadow-[0_18px_55px_rgba(0,0,0,0.12)]">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setFiltersOpen((current) => !current)}
            aria-expanded={filtersOpen}
            aria-controls="billing-filter-options"
            className="flex min-w-0 items-center gap-3 text-left"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10">
              <SlidersHorizontal className="h-4.5 w-4.5 text-cyan-300" />
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold tracking-tight text-[var(--text-primary)]">Filtros</span>
                {activeFilterCount > 0 && (
                  <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 text-[11px] font-medium text-cyan-200">
                    {activeFilterCount} activo{activeFilterCount === 1 ? "" : "s"}
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-xs text-[var(--text-secondary)]">Delimita el análisis por periodo, cuenta, servicio o tags.</span>
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--text-secondary)] transition-transform ${filtersOpen ? "rotate-180 text-cyan-300" : ""}`} />
          </button>

          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--text-primary)]">{filteredBilling.length.toLocaleString("es-CO")}</span> de {billing.length.toLocaleString("es-CO")} registros
            </span>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 text-xs font-medium text-[var(--text-secondary)] transition hover:border-cyan-400/40 hover:text-cyan-200"
              >
                <X className="h-3.5 w-3.5" />
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div id="billing-filter-options">
          {filtersOpen && (
            <div className="p-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,1.5fr)_minmax(170px,0.75fr)_minmax(170px,0.75fr)]">
            <Field label="Búsqueda" hint="Cuenta, recurso, tag o usage type">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-300/70" />
                <input
                  value={filters.search}
                  onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                  className="control pl-10 pr-10"
                  placeholder="Buscar en los costos..."
                  aria-label="Buscar en los costos"
                />
                {filters.search && (
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, search: "" }))}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]"
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </Field>
            <Field label="Desde">
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                <input type="month" value={filters.start} onChange={(event) => setFilters((prev) => ({ ...prev, start: event.target.value }))} className="control pl-10" aria-label="Mes inicial" />
              </div>
            </Field>
            <Field label="Hasta">
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                <input type="month" value={filters.end} onChange={(event) => setFilters((prev) => ({ ...prev, end: event.target.value }))} className="control pl-10" aria-label="Mes final" />
              </div>
            </Field>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Field label="Cuenta AWS" hint={`${accountFacets.accounts.length} disponibles`}>
              <MultiSelect
                options={accountFacets.accounts}
                selected={filters.accounts}
                allLabel="Todas las cuentas"
                emptyLabel="Todas las cuentas"
                onChange={(accounts) => setFilters((prev) => ({ ...prev, accounts, service: "", tagFilters: [] }))}
              />
            </Field>
            <Field label="Servicio" hint={`${scopedFacets.services.length} disponibles`}>
              <SearchableSelect
                options={scopedFacets.services}
                value={filters.service}
                allLabel="Todos los servicios"
                placeholder="Buscar servicio"
                onChange={(service) => setFilters((prev) => ({ ...prev, service }))}
              />
            </Field>
          </div>

          <TagFilterBuilder
            tagKeys={scopedFacets.tagKeys}
            tags={scopedFacets.tags}
            selected={filters.tagFilters}
            onChange={(tagFilters) => setFilters((prev) => ({ ...prev, tagFilters }))}
          />

          <div className="mt-5 flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
              {filters.accounts.length > 0 && <ActiveFilter label={getAccountFilterLabel(filters.accounts)} onRemove={() => setFilters((prev) => ({ ...prev, accounts: [], service: "", tagFilters: [] }))} />}
              {filters.service && <ActiveFilter label={`Servicio: ${filters.service}`} onRemove={() => setFilters((prev) => ({ ...prev, service: "" }))} />}
              {filters.search && <ActiveFilter label={`Búsqueda: ${filters.search}`} onRemove={() => setFilters((prev) => ({ ...prev, search: "" }))} />}
              {filters.tagFilters.length > 0 && <span className="text-[var(--text-secondary)]">{filters.tagFilters.length} tag{filters.tagFilters.length === 1 ? "" : "s"} aplicado{filters.tagFilters.length === 1 ? "" : "s"}</span>}
              {activeFilterCount === 0 && <span>Sin filtros adicionales. Mostrando todo el periodo.</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-secondary)]">
              {meta && <span>{meta.source} · {formatDate(meta.timestamp)}</span>}
              {meta?.refreshing && <span className="inline-flex items-center gap-1.5 text-cyan-200"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />Actualizando cache</span>}
            </div>
          </div>
            </div>
          )}
        </div>
      </section>

      {loading ? (
        <LoadingPanel label="Cargando Cost Explorer..." />
      ) : (
        <>
          <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard icon={WalletCards} label="Costo total" value={formatCurrency(stats.total)} detail={`${stats.currency} en ${stats.months} mes(es)`} />
            <KpiCard icon={Activity} label="Variación mensual" value={formatDelta(stats.delta)} detail={stats.delta >= 0 ? "Subió vs mes anterior" : "Bajó vs mes anterior"} trend={stats.delta} />
            <KpiCard icon={Server} label="Top servicio" value={stats.topService.name || "N/A"} detail={formatCurrency(stats.topService.value)} />
            <KpiCard icon={Cloud} label="Top cuenta" value={stats.topAccount.name || "N/A"} detail={formatCurrency(stats.topAccount.value)} />
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
            <ChartCard title="Tendencia mensual" subtitle="Costo mensual AWS en el rango seleccionado" icon={CalendarDays}>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                  <XAxis dataKey="name" stroke="rgb(148,163,184)" fontSize={11} />
                  <YAxis stroke="rgb(148,163,184)" fontSize={11} tickFormatter={(value) => `$${Number(value).toFixed(0)}`} />
                  <Tooltip content={CurrencyTooltip} />
                  <Area type="monotone" dataKey="value" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.16} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Distribución por servicio" subtitle="Participación de los servicios principales" icon={PieChartIcon}>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie data={serviceBreakdown.slice(0, 7)} dataKey="value" nameKey="name" innerRadius={70} outerRadius={112} paddingAngle={2}>
                    {serviceBreakdown.slice(0, 7).map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={CurrencyTooltip} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard title="Top servicios" subtitle="Servicios con mayor gasto acumulado" icon={BarChart3}>
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={serviceBreakdown} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                  <XAxis type="number" stroke="rgb(148,163,184)" fontSize={11} tickFormatter={(value) => `$${Number(value).toFixed(0)}`} />
                  <YAxis type="category" dataKey="name" width={160} stroke="rgb(148,163,184)" fontSize={11} />
                  <Tooltip content={CurrencyTooltip} />
                  <Bar dataKey="value" fill="#22d3ee" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Top cuentas" subtitle="Cuentas AWS con mayor costo" icon={Database}>
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={accountBreakdown} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                  <XAxis type="number" stroke="rgb(148,163,184)" fontSize={11} tickFormatter={(value) => `$${Number(value).toFixed(0)}`} />
                  <YAxis type="category" dataKey="name" width={160} stroke="rgb(148,163,184)" fontSize={11} />
                  <Tooltip content={CurrencyTooltip} />
                  <Bar dataKey="value" fill="#34d399" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>

          <section className="space-y-4">
            <BillingTable rows={tableRows} />
            <BreakdownPanel title={`Cost allocation: ${allocationTagKey}`} items={tagBreakdown} tagKey={allocationTagKey} icon={Tags} />
          </section>
        </>
      )}
      <ScrollToTop />
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  detail,
  trend,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  trend?: number;
}) {
  const TrendIcon = trend === undefined ? null : trend >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)]/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">{label}</p>
          <p className="mt-1 truncate text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10">
          <Icon className="h-5 w-5 text-cyan-300" />
        </div>
      </div>
      <p className={`mt-2 flex items-center gap-1 truncate text-xs ${trend === undefined ? "text-[var(--text-secondary)]" : trend >= 0 ? "text-amber-300" : "text-emerald-300"}`}>
        {TrendIcon && <TrendIcon className="h-3.5 w-3.5" />}
        {detail}
      </p>
    </div>
  );
}

function SelectionMark({ checked }: { checked: boolean }) {
  return (
    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-[var(--border)] bg-transparent"}`} aria-hidden="true">
      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
    </span>
  );
}

function MultiSelect({
  options,
  selected,
  allLabel,
  emptyLabel,
  onChange,
}: {
  options: string[];
  selected: string[];
  allLabel: string;
  emptyLabel: string;
  onChange: (selected: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);
  const noneSelected = selected.includes(NO_ACCOUNTS_SELECTED);
  const allSelected = options.length > 0 && !noneSelected && (selected.length === 0 || selected.length === options.length);
  const filteredOptions = options.filter((option) => option.toLowerCase().includes(query.toLowerCase()));
  const label = selected.length === 0
    ? emptyLabel
    : noneSelected
      ? "Ninguna cuenta seleccionada"
      : allSelected
      ? allLabel
      : `${selected.length} seleccionada(s)`;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const toggleOption = (option: string) => {
    const base = allSelected ? options : noneSelected ? [] : selected;
    const next = base.includes(option) ? base.filter((item) => item !== option) : [...base, option];
    onChange(next.length === 0 ? [NO_ACCOUNTS_SELECTED] : next);
  };

  const selectMatching = () => {
    if (!query.trim() || filteredOptions.length === 0) return;
    onChange(filteredOptions);
  };

  const clearSelection = () => {
    if (!query.trim()) {
      onChange([NO_ACCOUNTS_SELECTED]);
      return;
    }
    if (filteredOptions.length === 0 || noneSelected) return;

    const base = allSelected ? options : selected;
    const visible = new Set(filteredOptions);
    const remaining = base.filter((option) => !visible.has(option));
    onChange(remaining.length > 0 ? remaining : [NO_ACCOUNTS_SELECTED]);
  };

  const selectMatchingDisabled = !query.trim() || filteredOptions.length === 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="control group flex items-center justify-between gap-3 text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="billing-account-options"
      >
        <span className={`truncate ${selected.length > 0 ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>{label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--text-secondary)] transition-transform ${open ? "rotate-180 text-cyan-300" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-40 mt-2 w-full min-w-[260px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
          <div className="border-b border-[var(--border)] p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="control h-9 pl-9" placeholder="Buscar cuenta" aria-label="Buscar cuenta" />
            </div>
          </div>
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
            <button
              type="button"
              onClick={() => onChange(options)}
              className="text-[10px] uppercase tracking-wider font-medium text-[var(--text-primary)]/60 transition-colors hover:text-cyan-300"
            >
              Todo
            </button>
            <span className="text-[var(--text-primary)]/10">|</span>
            <button
              type="button"
              onClick={clearSelection}
              className="text-[10px] uppercase tracking-wider font-medium text-[var(--text-primary)]/60 transition-colors hover:text-red-300"
            >
              Ninguno
            </button>
            <span className="text-[var(--text-primary)]/10">|</span>
            <button
              type="button"
              onClick={selectMatching}
              disabled={selectMatchingDisabled}
              title={selectMatchingDisabled ? "Escribe una búsqueda con coincidencias" : undefined}
              className="text-[10px] uppercase tracking-wider font-medium text-cyan-400/80 transition-colors hover:text-cyan-300 disabled:cursor-not-allowed disabled:text-[var(--text-primary)]/20"
            >
              Seleccionar coincidencias
            </button>
            <span className="ml-auto text-[11px] text-[var(--text-secondary)]">{selected.length}/{options.length}</span>
          </div>
          <div id="billing-account-options" className="max-h-72 overflow-y-auto py-1" role="listbox" aria-label="Cuentas AWS">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-[var(--text-secondary)]">Sin cuentas encontradas</p>
            ) : filteredOptions.map((option) => (
              <button key={option} type="button" onClick={() => toggleOption(option)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-[var(--text-primary)] transition hover:bg-white/5">
                <SelectionMark checked={allSelected || selected.includes(option)} />
                <span className="min-w-0 truncate">{option}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchableSelect({
  options,
  value,
  allLabel,
  placeholder,
  onChange,
}: {
  options: string[];
  value: string;
  allLabel: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);
  const filteredOptions = options.filter((option) => option.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="control flex items-center justify-between gap-3 text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="billing-service-options"
      >
        <span className={`truncate ${value ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>{value || allLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--text-secondary)] transition-transform ${open ? "rotate-180 text-cyan-300" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-40 mt-2 w-full min-w-[240px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
          <div className="border-b border-[var(--border)] p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="control h-9 pl-9" placeholder={placeholder} aria-label={placeholder} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange("");
              setQuery("");
              setOpen(false);
            }}
            className="flex w-full items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-2.5 text-left text-sm text-[var(--text-primary)] transition hover:bg-white/5"
          >
            <span className="flex items-center gap-2.5"><SelectionMark checked={!value} /><span>{allLabel}</span></span>
            <span className="text-xs text-[var(--text-secondary)]">{options.length}</span>
          </button>
          <div id="billing-service-options" className="max-h-72 overflow-y-auto py-1" role="listbox" aria-label="Servicios AWS">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-[var(--text-secondary)]">Sin resultados</div>
            ) : filteredOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onChange(option);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-[var(--text-primary)] transition hover:bg-white/5"
              >
                <SelectionMark checked={value === option} />
                <span className="truncate">{option}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TagFilterBuilder({
  tagKeys,
  tags,
  selected,
  onChange,
}: {
  tagKeys: string[];
  tags: Record<string, string[]>;
  selected: Array<{ key: string; value: string }>;
  onChange: (filters: Array<{ key: string; value: string }>) => void;
}) {
  const [draftKey, setDraftKey] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const effectiveDraftKey = tagKeys.includes(draftKey) ? draftKey : "";
  const effectiveDraftValue = effectiveDraftKey && (tags[effectiveDraftKey] || []).includes(draftValue) ? draftValue : "";
  const availableValues = tags[effectiveDraftKey] || [];
  const canAdd = effectiveDraftKey && effectiveDraftValue && !selected.some((filter) => filter.key === effectiveDraftKey && filter.value === effectiveDraftValue);

  return (
    <div className="mt-5 border-t border-[var(--border)] pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-400/10 text-violet-300">
            <Tags className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Filtrar por tags</p>
            <p className="text-xs text-[var(--text-secondary)]">Combina condiciones AND para afinar el costo.</p>
          </div>
        </div>
        <span className="text-[11px] text-[var(--text-secondary)]">{selected.length} aplicado{selected.length === 1 ? "" : "s"}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(180px,1fr)_minmax(220px,1fr)_auto]">
        <Field label="Tag">
          <select value={effectiveDraftKey} onChange={(event) => { setDraftKey(event.target.value); setDraftValue(""); }} className="control">
            <option value="">Selecciona tag</option>
            {tagKeys.map((tagKey) => <option key={tagKey} value={tagKey}>{tagKey}</option>)}
          </select>
        </Field>
        <Field label="Valor">
          <select value={effectiveDraftValue} onChange={(event) => setDraftValue(event.target.value)} className="control" disabled={!effectiveDraftKey}>
            <option value="">Selecciona valor</option>
            {availableValues.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </Field>
        <button
          type="button"
          disabled={!canAdd}
          onClick={() => {
            if (!canAdd) return;
            onChange([...selected, { key: effectiveDraftKey, value: effectiveDraftValue }]);
            setDraftKey("");
            setDraftValue("");
          }}
          className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-lg bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40 lg:mb-0"
        >
          <Tags className="h-4 w-4" />
          Añadir
        </button>
      </div>
      {selected.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selected.map((filter) => (
            <button
              key={`${filter.key}:${filter.value}`}
              type="button"
              onClick={() => onChange(selected.filter((item) => item.key !== filter.key || item.value !== filter.value))}
              className="inline-flex max-w-full items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/8 px-2.5 py-1.5 text-xs text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-400/15"
            >
              <span className="max-w-[260px] truncate"><span className="text-cyan-300">{filter.key}</span>: {filter.value}</span>
              <X className="h-3.5 w-3.5 shrink-0 text-cyan-200/70" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, subtitle, icon: Icon, children }: { title: string; subtitle: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-cyan-300" />
          <div>
            <h2 className="panel-title">{title}</h2>
            <p className="panel-subtitle">{subtitle}</p>
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

function BreakdownPanel({ title, items, tagKey, icon: Icon }: { title: string; items: GroupPoint[]; tagKey: string; icon: LucideIcon }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const taggedItems = items.filter((item) => item.name !== "Sin tag");
  const untaggedItem = items.find((item) => item.name === "Sin tag");
  const taggedTotal = taggedItems.reduce((sum, item) => sum + item.value, 0);
  return (
    <section className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-cyan-300" />
          <div>
            <h2 className="panel-title">{title}</h2>
            <p className="panel-subtitle">Distribución por {tagKey}. Si CostCenter no tiene cobertura, se usa el tag más representativo.</p>
          </div>
        </div>
      </div>
      {taggedItems.length === 0 ? (
        <EmptyState icon={Tags} title="Sin tags visibles" description="No hay valores útiles para este tag con los filtros actuales." />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_280px]">
          <div className="space-y-3">
            {taggedItems.map((item, index) => {
              const percent = total > 0 ? (item.value / total) * 100 : 0;
              return (
                <div key={item.name} className="rounded-lg border border-[var(--border)] bg-black/10 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-[var(--text-primary)]">{item.name}</span>
                    <span className="text-cyan-200">{formatCurrency(item.value)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: COLORS[index % COLORS.length] }} />
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{percent.toFixed(1)}% del costo filtrado</p>
                </div>
              );
            })}
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Cobertura</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">
              {total > 0 ? `${((taggedTotal / total) * 100).toFixed(1)}%` : "0%"}
            </p>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">Costo con valor para {tagKey}.</p>
            {untaggedItem && (
              <div className="mt-4 rounded-md bg-white/5 p-3">
                <p className="text-xs text-[var(--text-secondary)]">Sin valor en {tagKey}</p>
                <p className="mt-1 font-semibold text-amber-200">{formatCurrency(untaggedItem.value)}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function BillingTable({ rows }: { rows: BillingItem[] }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Detalle de costos</h2>
          <p className="panel-subtitle">Registros ordenados por mayor costo, enriquecidos con tags de inventario cuando aplica.</p>
        </div>
        <span className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-secondary)]">{rows.length} registros</span>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={Filter} title="Sin resultados" description="Ajusta filtros o rango de fechas." />
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 120).map((item, index) => (
            <div key={`${item.accountId}-${item.service}-${item.month}-${index}`} className="grid grid-cols-1 gap-3 rounded-lg border border-[var(--border)] bg-black/10 p-4 xl:grid-cols-[minmax(220px,1.1fr)_minmax(220px,1fr)_120px_minmax(280px,1.3fr)_140px] xl:items-center">
              <div className="min-w-0">
                <p className="truncate font-medium text-[var(--text-primary)]">{item.service}</p>
                <p className="text-xs text-[var(--text-secondary)]">{item.region || "global"}</p>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm text-[var(--text-primary)]">{item.accountName}</p>
                <p className="truncate font-mono text-xs text-[var(--text-secondary)]">{item.accountId}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Mes</p>
                <p className="text-sm text-[var(--text-primary)]">{item.month}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {renderCostTags(item).map(([key, value]) => (
                  <span key={key} className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-[var(--text-secondary)]">{key}: {value}</span>
                ))}
              </div>
              <div className="text-left xl:text-right">
                <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Costo</p>
                <p className="text-lg font-semibold text-cyan-200">{formatCurrency(item.cost, item.currency)}</p>
              </div>
            </div>
          ))}
          {rows.length > 120 && (
            <div className="rounded-lg border border-[var(--border)] bg-white/[0.03] p-3 text-center text-xs text-[var(--text-secondary)]">
              Mostrando los primeros 120 registros por costo. Usa filtros o búsqueda para acotar el detalle.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ActiveFilter({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-cyan-400/20 bg-cyan-400/8 px-2.5 py-1.5 text-cyan-100">
      <span className="max-w-[240px] truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-cyan-200/70 hover:bg-cyan-300/15 hover:text-cyan-100"
        aria-label={`Quitar filtro ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
        <span>{label}</span>
        {hint && <span className="truncate text-[10px] font-normal normal-case tracking-normal text-[var(--text-secondary)]/70">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="flex min-h-96 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)]/70 text-sm text-[var(--text-secondary)]">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center p-6 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white/5">
        <Icon className="h-5 w-5 text-[var(--text-secondary)]" />
      </div>
      <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}

function StatusMessage({ tone, message }: { tone: "error" | "info"; message: string }) {
  return (
    <div className={`rounded-lg border p-4 text-sm ${tone === "error" ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-cyan-500/30 bg-cyan-500/10 text-cyan-100"}`}>
      {message}
    </div>
  );
}

function CurrencyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-slate-950 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium text-[var(--text-primary)]">{label}</p>
      {payload.map((item: any, index: number) => (
        <p key={`${item.name}-${index}`} className="text-cyan-200">{item.name || "Costo"}: {formatCurrency(Number(item.value || 0))}</p>
      ))}
    </div>
  );
}

function enrichBillingWithInventoryTags(items: BillingItem[], tagIndex: Map<string, Record<string, string>>) {
  return items.map((item) => {
    const indexKey = `${item.accountId}::${normalizeServiceName(item.service)}`;
    const inferredTags = tagIndex.get(indexKey) || {};
    const mergedTags = { ...(item.tags || {}) };

    for (const key of COST_TAG_KEYS) {
      const current = mergedTags[key];
      if (!current || current === "Sin tag" || current === "No tag key" || current === "No tag value") {
        if (inferredTags[key]) mergedTags[key] = inferredTags[key];
      }
    }

    return { ...item, tags: cleanTagMap(mergedTags) };
  });
}

function buildInventoryTagIndex(inventory: InventoryResource[]) {
  const stats = new Map<string, Record<string, Map<string, number>>>();

  for (const item of flattenInventory(inventory)) {
    if (item.provider !== "AWS" || !item.accountId || !item.service || !item.tags) continue;
    const normalizedService = normalizeServiceName(item.service);
    const indexKey = `${item.accountId}::${normalizedService}`;

    if (!stats.has(indexKey)) stats.set(indexKey, {});
    const serviceStats = stats.get(indexKey)!;

    for (const targetKey of COST_TAG_KEYS) {
      const value = getCanonicalTagValue(item.tags, targetKey);
      if (!value) continue;
      if (!serviceStats[targetKey]) serviceStats[targetKey] = new Map<string, number>();
      serviceStats[targetKey].set(value, (serviceStats[targetKey].get(value) || 0) + 1);
    }
  }

  const index = new Map<string, Record<string, string>>();
  for (const [indexKey, serviceStats] of stats.entries()) {
    const tags: Record<string, string> = {};
    for (const [tagKey, values] of Object.entries(serviceStats)) {
      const sortedValues = Array.from(values.entries()).sort((a, b) => b[1] - a[1]);
      if (sortedValues.length > 0) {
        tags[tagKey] = sortedValues[0][0];
      }
    }
    index.set(indexKey, tags);
  }

  return index;
}

function flattenInventory(items: InventoryResource[]): InventoryResource[] {
  return items.flatMap((item) => [item, ...flattenInventory(item.children || [])]);
}

function getCanonicalTagValue(tags: Record<string, string>, targetKey: string) {
  const aliases = TAG_ALIASES[targetKey] || [targetKey];
  for (const alias of aliases) {
    const value = tags[alias];
    if (value && value !== "Sin tag") return sanitizeTagValue(value);
  }
  return "";
}

function cleanTagMap(tags: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(tags)
      .filter(([, value]) => value)
      .map(([key, value]) => [key, sanitizeTagValue(String(value))]),
  );
}

function sanitizeTagValue(value: string) {
  return value.replace(/\s+\+\d+$/, "").trim();
}

function normalizeServiceName(service: string) {
  const value = service.toLowerCase();
  if (value.includes("elastic compute") || value === "ec2" || value.includes("ec2")) return "EC2";
  if (value.includes("relational database") || value === "rds" || value.includes("rds")) return "RDS";
  if (value.includes("elastic container") || value === "ecs" || value.includes("ecs")) return "ECS";
  if (value.includes("elastic load balancing") || value === "elb" || value.includes("load balancer")) return "ELB";
  if (value.includes("virtual private cloud") || value === "vpc") return "VPC";
  if (value.includes("simple storage") || value === "s3") return "S3";
  if (value.includes("lambda")) return "LAMBDA";
  if (value.includes("dynamodb")) return "DYNAMODB";
  if (value.includes("cloudwatch")) return "CLOUDWATCH";
  if (value.includes("elastic kubernetes") || value === "eks") return "EKS";
  if (value.includes("cloudfront")) return "CLOUDFRONT";
  if (value.includes("api gateway")) return "APIGATEWAY";
  return service.toUpperCase();
}

function renderCostTags(item: BillingItem) {
  const tags = item.tags || {};
  const preferred = COST_TAG_KEYS
    .map((key) => [key, tags[key] ? sanitizeTagValue(tags[key]) : undefined] as [string, string | undefined])
    .filter(([, value]) => value && value !== "Sin tag")
    .slice(0, 5);

  if (preferred.length > 0) return preferred as Array<[string, string]>;

  return Object.entries(tags)
    .map(([key, value]) => [key, sanitizeTagValue(value || "")] as [string, string])
    .filter(([, value]) => value && value !== "Sin tag")
    .slice(0, 5) as Array<[string, string]>;
}

function buildFacets(items: BillingItem[]) {
  const accounts = Array.from(new Set(items.map((item) => item.accountName))).sort();
  const services = Array.from(new Set(items.map((item) => item.service))).sort();
  const tags: Record<string, string[]> = {};

  for (const item of items) {
    for (const [key, value] of Object.entries(item.tags || {})) {
      if (!value) continue;
      const cleanValue = sanitizeTagValue(value);
      if (!tags[key]) tags[key] = [];
      if (!tags[key].includes(cleanValue)) tags[key].push(cleanValue);
    }
  }

  for (const key of Object.keys(tags)) tags[key].sort();
  return { accounts, services, tags, tagKeys: Object.keys(tags).sort() };
}

function getAccountFilterLabel(accounts: string[]) {
  if (accounts.includes(NO_ACCOUNTS_SELECTED)) return "Ninguna cuenta";
  if (accounts.length === 0) return "Todas las cuentas";
  return `${accounts.length} cuenta(s)`;
}

function buildStats(items: BillingItem[]) {
  const total = sum(items);
  const monthly = groupByMonth(items);
  const current = monthly.at(-1)?.value || 0;
  const previous = monthly.at(-2)?.value || 0;
  const delta = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  const topService = groupBy(items, "service", 1)[0] || { name: "", value: 0 };
  const topAccount = groupBy(items, "accountName", 1)[0] || { name: "", value: 0 };
  return {
    total,
    delta,
    topService,
    topAccount,
    months: monthly.length,
    currency: items[0]?.currency || "USD",
  };
}

function chooseAllocationTagKey(items: BillingItem[], selectedTagFilters: Array<{ key: string; value: string }>) {
  if (selectedTagFilters[0]?.key) return selectedTagFilters[0].key;

  const coverage = COST_TAG_KEYS.map((key) => ({
    key,
    count: items.filter((item) => {
      const value = item.tags?.[key];
      return value && value !== "Sin tag";
    }).length,
  })).sort((a, b) => b.count - a.count);

  return coverage[0]?.count > 0 ? coverage[0].key : "CostCenter";
}

function groupByMonth(items: BillingItem[]) {
  const map = new Map<string, number>();
  for (const item of items) map.set(item.month, (map.get(item.month) || 0) + item.cost);
  return Array.from(map.entries()).map(([name, value]) => ({ name, value: round(value) })).sort((a, b) => a.name.localeCompare(b.name));
}

function groupBy(items: BillingItem[], key: "service" | "accountName", limit: number): GroupPoint[] {
  const map = new Map<string, { value: number; count: number }>();
  for (const item of items) {
    const name = item[key] || "Sin dato";
    const current = map.get(name) || { value: 0, count: 0 };
    map.set(name, { value: current.value + item.cost, count: current.count + 1 });
  }
  return Array.from(map.entries())
    .map(([name, data]) => ({ name, value: round(data.value), count: data.count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function groupByTag(items: BillingItem[], tagKey: string, limit: number): GroupPoint[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const name = item.tags?.[tagKey] ? sanitizeTagValue(item.tags[tagKey]) : "Sin tag";
    map.set(name, (map.get(name) || 0) + item.cost);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value: round(value) }))
    .sort((a, b) => {
      if (a.name === "Sin tag") return 1;
      if (b.name === "Sin tag") return -1;
      return b.value - a.value;
    })
    .slice(0, limit);
}

function sum(items: BillingItem[]) {
  return items.reduce((total, item) => total + item.cost, 0);
}

function round(value: number) {
  return Number(value.toFixed(2));
}

function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value || 0);
}

function formatDelta(value: number) {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatDate(value: number) {
  return new Date(value).toLocaleString("es-CO", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function getMonthOffset(offset: number) {
  const date = new Date();
  date.setMonth(date.getMonth() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

async function exportBilling(rows: BillingItem[], format: "xlsx" | "pdf") {
  const filename = `aws-billing-${new Date().toISOString().replace(/[:.]/g, "-")}.${format}`;
  const orderedRows = [...rows].sort((a, b) => (
    a.month.localeCompare(b.month)
    || a.accountName.localeCompare(b.accountName)
    || a.service.localeCompare(b.service)
  ));
  const exportRows = orderedRows.map((row) => ({
    Mes: row.month,
    Cuenta: row.accountName,
    "Account ID": row.accountId,
    Servicio: row.service,
    Region: row.region || "global",
    Costo: round(row.cost),
    Moneda: row.currency,
    Tags: renderCostTags(row).map(([key, value]) => `${key}: ${value}`).join("; "),
  }));

  if (format === "xlsx") {
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet(exportRows);
    sheet["!cols"] = [
      { wch: 10 },
      { wch: 28 },
      { wch: 18 },
      { wch: 34 },
      { wch: 14 },
      { wch: 12 },
      { wch: 10 },
      { wch: 54 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "AWS Billing");
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    downloadBlob(buffer, filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return;
  }

  const { jsPDF } = await import("jspdf");
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default || autoTableModule.autoTable;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(16);
  doc.text("AWS Billing Center", 40, 40);
  doc.setFontSize(9);
  doc.text(`Generado: ${new Date().toLocaleString("es-CO")}`, 40, 58);
  doc.text(`Registros: ${orderedRows.length}`, 40, 72);
  autoTable(doc, {
    startY: 90,
    head: [["Mes", "Cuenta", "Servicio", "Region", "Costo", "Tags"]],
    body: exportRows.slice(0, 300).map((row) => [
      row.Mes,
      row.Cuenta,
      row.Servicio,
      row.Region,
      formatCurrency(Number(row.Costo)),
      row.Tags,
    ]),
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 56 },
      1: { cellWidth: 120 },
      2: { cellWidth: 165 },
      3: { cellWidth: 70 },
      4: { cellWidth: 80, halign: "right" },
      5: { cellWidth: 300 },
    },
  });
  doc.save(filename);
}

function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
