"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Cloud,
  Database,
  Shield,
  RotateCcw,
  Filter,
  ChevronDown,
  ChevronUp,
  Download,
  Search,
  X,
  RefreshCw,
  LayoutGrid,
  List,
  BarChart3,
  Activity,
} from "lucide-react";
import Image from "next/image";

import { InventoryItem } from "@/types/inventory";
import InventoryTable from "@/components/inventory/InventoryTable";
import InventoryCards from "@/components/inventory/InventoryCards";
import MetricsCards from "@/components/inventory/MetricsCards";
import ResourceModal from "@/components/inventory/ResourceModal";
import ScrollToTop from "@/components/ui/ScrollToTop";
import ECSHierarchicalView from "@/components/ECSHierarchicalView";
import { exportCSV } from "@/lib/inventory/exportCsv";

type SortField =
  | "name"
  | "provider"
  | "service"
  | "status"
  | "host"
  | "account";

/* ── Loading skeleton ── */
function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-[#080c14] flex items-center justify-center z-50">
      <style jsx global>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        .shimmer {
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.03) 25%,
            rgba(255, 255, 255, 0.07) 50%,
            rgba(255, 255, 255, 0.03) 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
      `}</style>
      <div className="text-center space-y-6">
        <div className="relative mx-auto w-20 h-20">
          <div
            className="absolute inset-0 rounded-2xl animate-ping opacity-20"
            style={{ background: "linear-gradient(135deg, #7c3aed, #06b6d4)" }}
          />
          <div
            className="relative w-20 h-20 rounded-2xl flex items-center justify-center font-bold text-2xl text-[var(--text-primary)]"
            style={{ background: "linear-gradient(135deg, #7c3aed, #06b6d4)" }}
          >
            MC
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            MC Inventory
          </h1>
          <p className="text-[var(--text-primary)]/40 text-sm">
            Cargando inventario cloud...
          </p>
        </div>
        <div className="flex justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mobileView, setMobileView] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [onlyWithoutTags, setOnlyWithoutTags] = useState(false);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [lastUpdate, setLastUpdate] = useState<string>("");

  /* ── Fetch ── */
  useEffect(() => {
    let mounted = true;
    const load = async (initial = false) => {
      try {
        if (initial) setLoading(true);
        else setRefreshing(true);
        const res = await fetch("/api/inventory", { cache: "no-store" });
        const json = await res.json();
        if (!mounted) return;
        setData(json.data);
        setLastUpdate(
          new Date(json.timestamp).toLocaleTimeString("es-CO", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      } catch (err) {
        console.error("Inventory fetch error:", err);
      } finally {
        if (!mounted) return;
        setLoading(false);
        setRefreshing(false);
      }
    };
    load(true);
    const interval = setInterval(() => load(false), 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  /* ── Responsive ── */
  useEffect(() => {
    const check = () => setMobileView(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  /* ── Filter options ── */
  const providerFilteredData = useMemo(
    () =>
      selectedProviders.length === 0
        ? data
        : data.filter((i) => selectedProviders.includes(i.provider || "")),
    [data, selectedProviders],
  );

  const providers = useMemo(
    () => [...new Set(data.map((i) => i.provider || "N/A"))].sort(),
    [data],
  );
  const services = useMemo(
    () => [...new Set(providerFilteredData.map((i) => i.service))].sort(),
    [providerFilteredData],
  );
  const accounts = useMemo(
    () => [...new Set(providerFilteredData.map((i) => i.accountName))].sort(),
    [providerFilteredData],
  );
  const statuses = useMemo(
    () => [...new Set(providerFilteredData.map((i) => i.status))].sort(),
    [providerFilteredData],
  );
  const clients = useMemo(
    () =>
      [
        ...new Set(
          providerFilteredData
            .map((i) => i.tags?.cliente || i.tags?.Cliente)
            .filter(Boolean),
        ),
      ].sort(),
    [providerFilteredData],
  );
  const projects = useMemo(
    () =>
      [
        ...new Set(
          providerFilteredData
            .map((i) => i.tags?.proyecto || i.tags?.Proyecto)
            .filter(Boolean),
        ),
      ].sort(),
    [providerFilteredData],
  );

  /* ── Filtered + sorted data ── */
  const filteredData = useMemo(() => {
    const result = data.filter((item) => {
      const q = search.toLowerCase();
      const tagText = Object.entries(item.tags || {})
        .map(([k, v]) => `${k} ${v}`)
        .join(" ")
        .toLowerCase();
      const searchMatch =
        item.name.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.host.toLowerCase().includes(q) ||
        tagText.includes(q);
      const providerMatch =
        selectedProviders.length === 0 ||
        selectedProviders.includes(item.provider || "");
      const serviceMatch =
        selectedServices.length === 0 ||
        selectedServices.includes(item.service);
      const accountMatch =
        selectedAccounts.length === 0 ||
        selectedAccounts.includes(item.accountName);
      const statusMatch =
        selectedStatuses.length === 0 || selectedStatuses.includes(item.status);
      const clientMatch =
        selectedClients.length === 0 ||
        selectedClients.includes(
          item.tags?.cliente || item.tags?.Cliente || "",
        );
      const projectMatch =
        selectedProjects.length === 0 ||
        selectedProjects.includes(
          item.tags?.proyecto || item.tags?.Proyecto || "",
        );
      const noTagsMatch =
        !onlyWithoutTags || !item.tags || Object.keys(item.tags).length === 0;
      return (
        searchMatch &&
        providerMatch &&
        serviceMatch &&
        accountMatch &&
        statusMatch &&
        clientMatch &&
        projectMatch &&
        noTagsMatch
      );
    });

    result.sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      const map: Record<SortField, string> = {
        name: a.name,
        provider: a.provider || "",
        service: a.service,
        status: a.status,
        host: a.host,
        account: a.accountName,
      };
      const mapB: Record<SortField, string> = {
        name: b.name,
        provider: b.provider || "",
        service: b.service,
        status: b.status,
        host: b.host,
        account: b.accountName,
      };
      return map[sortField].localeCompare(mapB[sortField]) * dir;
    });
    return result;
  }, [
    data,
    search,
    selectedProviders,
    selectedServices,
    selectedClients,
    selectedProjects,
    selectedAccounts,
    selectedStatuses,
    onlyWithoutTags,
    sortField,
    sortDirection,
  ]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((p) => (p === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDirection("asc");
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedProviders([]);
    setSelectedServices([]);
    setSelectedClients([]);
    setSelectedProjects([]);
    setSelectedAccounts([]);
    setSelectedStatuses([]);
    setOnlyWithoutTags(false);
  };

  const activeFiltersCount =
    selectedProviders.length +
    selectedServices.length +
    selectedClients.length +
    selectedProjects.length +
    selectedAccounts.length +
    selectedStatuses.length +
    (search ? 1 : 0) +
    (onlyWithoutTags ? 1 : 0);

  if (loading) return <LoadingScreen />;

  return (
    <>
      <style jsx global>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .page-section {
          animation: fadeUp 0.4s ease both;
        }
        .filter-panel {
          animation: slideIn 0.25s ease both;
        }
      `}</style>

      <div className="min-h-screen space-y-6">
        {/* ── Page header ── */}
        <div className="page-section">
          <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] p-5"
            style={{ background: "var(--glass-bg)", backdropFilter: "blur(16px)" }}
          >
            {/* Decorative gradient glow */}
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-20 blur-3xl pointer-events-none"
              style={{ background: "linear-gradient(135deg, var(--gradient-start), var(--gradient-end))" }}
            />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-10 blur-3xl pointer-events-none"
              style={{ background: "linear-gradient(135deg, var(--gradient-secondary-start), var(--gradient-secondary-end))" }}
            />

            <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl animate-ping opacity-15"
                    style={{ background: "linear-gradient(135deg, var(--gradient-start), var(--gradient-end))" }}
                  />
                  <div
                    className="relative w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-lg"
                    style={{ background: "linear-gradient(135deg, var(--gradient-start), var(--gradient-end))" }}
                  >
                    <BarChart3 size={18} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
                      Dashboard
                    </h1>
                    {refreshing && (
                      <span className="flex items-center gap-1.5 text-[11px] text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded-full border border-cyan-400/20">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Actualizando
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--text-primary)]/40 mt-0.5">
                    <Activity size={12} className="inline mr-1.5 -mt-0.5 text-[var(--primary)]/50" />
                    Inventario Cloud Centralizado
                    {lastUpdate && (
                      <span className="ml-2 text-[var(--text-primary)]/20">
                        · actualizado <span className="text-[var(--text-primary)]/40 font-medium">{lastUpdate}</span>
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* View toggle */}
                <div className="flex items-center gap-1 bg-[var(--bg-card)]/80 border border-[var(--border)] rounded-xl p-1">
                  <button
                    onClick={() => setViewMode("table")}
                    className={`p-2 rounded-lg transition-all duration-200 ${
                      viewMode === "table"
                        ? "bg-[var(--bg-hover)] text-[var(--text-primary)] shadow-sm"
                        : "text-[var(--text-primary)]/30 hover:text-[var(--text-primary)]/60"
                    }`}
                    title="Vista tabla"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("cards")}
                    className={`p-2 rounded-lg transition-all duration-200 ${
                      viewMode === "cards"
                        ? "bg-[var(--bg-hover)] text-[var(--text-primary)] shadow-sm"
                        : "text-[var(--text-primary)]/30 hover:text-[var(--text-primary)]/60"
                    }`}
                    title="Vista tarjetas"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Metrics ── */}
        <div className="page-section" style={{ animationDelay: "0.05s" }}>
          <MetricsCards data={filteredData} />
        </div>

        {/* ── Filter panel ── */}
        <div className="page-section" style={{ animationDelay: "0.1s" }}>
          <div
            className="rounded-2xl border border-[var(--border)] overflow-hidden transition-all duration-300"
            style={{
              background: "var(--glass-bg)",
              backdropFilter: "blur(16px)",
            }}
          >
            {/* Toolbar */}
            <div className="p-4 flex flex-col xl:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1 group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-primary)]/20 pointer-events-none transition-colors group-focus-within:text-cyan-400/60" />
                <input
                  type="text"
                  placeholder="Buscar recursos, IDs, IPs, tags..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-primary)]/25 outline-none transition-all duration-200 border focus:border-cyan-500/40"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-primary)]/30 hover:text-[var(--text-primary)]/70 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setFiltersOpen(!filtersOpen)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 ${
                    filtersOpen || activeFiltersCount > 0
                      ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-400 shadow-sm shadow-cyan-500/10"
                      : "bg-[var(--bg-card)]/60 border-[var(--border)] text-[var(--text-primary)]/60 hover:text-[var(--text-primary)] hover:border-white/20 hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Filtros
                  {activeFiltersCount > 0 && (
                    <span className="bg-cyan-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                      {activeFiltersCount}
                    </span>
                  )}
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      filtersOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <button
                  onClick={() => exportCSV(filteredData, "inventory.csv")}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--border)] bg-[var(--bg-card)]/60 text-[var(--text-primary)]/60 hover:text-[var(--text-primary)] hover:border-white/20 hover:bg-[var(--bg-hover)] transition-all duration-200"
                >
                  <Download className="w-4 h-4" />
                  CSV
                </button>

                {activeFiltersCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/30 transition-all duration-200"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Results summary */}
            <div className="px-5 py-2.5 flex items-center gap-3 text-xs border-t border-white/5 bg-[var(--bg-hover)]/30">
              <div className="flex items-center gap-2 flex-1">
                <div
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    filteredData.length < data.length ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.4)]" : "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]"
                  }`}
                />
                <span className="text-[var(--text-primary)]/30">
                  Mostrando
                </span>
                <span className="text-[var(--text-primary)] font-semibold tabular-nums">
                  {filteredData.length}
                </span>
                <span className="text-[var(--text-primary)]/20">
                  de
                </span>
                <span className="text-[var(--text-primary)] font-semibold tabular-nums">
                  {data.length}
                </span>
                <span className="text-[var(--text-primary)]/30">
                  recursos
                </span>
                {activeFiltersCount > 0 && (
                  <>
                    <span className="text-[var(--text-primary)]/10">·</span>
                    <span className="text-cyan-400/80 font-medium">
                      {activeFiltersCount} filtro{activeFiltersCount > 1 ? "s" : ""} activo{activeFiltersCount > 1 ? "s" : ""}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Filter sections */}
            <div
              className="overflow-hidden transition-all duration-300 ease-in-out"
              style={{
                maxHeight: filtersOpen ? "2000px" : "0",
                opacity: filtersOpen ? 1 : 0,
              }}
            >
              <div className="filter-panel border-t border-[var(--border)] p-4 space-y-4">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <FilterBlock
                    title="Infraestructura"
                    icon={<Cloud className="w-4 h-4" />}
                    accentColor="#06b6d4"
                  >
                    <ProviderFilterSection
                      values={providers}
                      selected={selectedProviders}
                      setSelected={setSelectedProviders}
                    />
                    <DropdownSection
                      title="Servicios"
                      values={services}
                      selected={selectedServices}
                      setSelected={setSelectedServices}
                    />
                    <DropdownSection
                      title="Cuentas"
                      values={accounts}
                      selected={selectedAccounts}
                      setSelected={setSelectedAccounts}
                    />
                  </FilterBlock>

                  <FilterBlock
                    title="Operación"
                    icon={<Database className="w-4 h-4" />}
                    accentColor="#8b5cf6"
                  >
                    <FilterSection
                      title="Estado"
                      values={statuses}
                      selected={selectedStatuses}
                      setSelected={setSelectedStatuses}
                      coloredStatus
                    />
                  </FilterBlock>
                </div>

                <FilterBlock
                  title="Etiquetas"
                  icon={<Shield className="w-4 h-4" />}
                  accentColor="#f59e0b"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <DropdownSection
                      title="Cliente"
                      values={clients}
                      selected={selectedClients}
                      setSelected={setSelectedClients}
                    />
                    <DropdownSection
                      title="Proyecto"
                      values={projects}
                      selected={selectedProjects}
                      setSelected={setSelectedProjects}
                    />
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-[var(--text-primary)]/25 mb-2.5">
                        Sin tags
                      </p>
                      <button
                        onClick={() => setOnlyWithoutTags(!onlyWithoutTags)}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm border transition-all duration-200 ${
                          onlyWithoutTags
                            ? "bg-amber-500/15 border-amber-500/30 text-amber-400 shadow-sm shadow-amber-500/10"
                            : "bg-[var(--bg-card)]/60 border-[var(--border)] text-[var(--text-primary)]/50 hover:text-[var(--text-primary)] hover:border-white/20 hover:bg-[var(--bg-hover)]"
                        }`}
                      >
                        {onlyWithoutTags && (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        Recursos sin tags
                      </button>
                    </div>
                  </div>
                </FilterBlock>
              </div>
            </div>
          </div>
        </div>

        {/* ── Inventory ── */}
        <div className="page-section" style={{ animationDelay: "0.15s" }}>
          {/* Section header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
                <Database size={12} className="text-[var(--primary)]" />
              </div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                {filteredData.length === 1 ? "1 recurso" : `${filteredData.length} recursos`}
              </h2>
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-[var(--border)] to-transparent" />
          </div>

          {/* Inventory view */}
          {(() => {
            // Only show ECS hierarchical view when explicitly filtered to ECS only
            const isECSFiltered =
              selectedServices.length === 1 && selectedServices[0] === "ECS";

            if (isECSFiltered) {
              const hasECSResources = filteredData.some(
                (item) =>
                  item.service === "ECS" && item.resourceType === "CLUSTER",
              );
              if (hasECSResources) {
                return (
                  <ECSHierarchicalView
                    data={filteredData}
                    onSelect={setSelectedItem}
                  />
                );
              }
            }

            if (mobileView || viewMode === "cards") {
              return (
                <InventoryCards
                  data={filteredData}
                  onSelect={setSelectedItem}
                />
              );
            }

            return (
              <InventoryTable
                data={filteredData}
                onSelect={setSelectedItem}
                onSort={handleSort}
                sortField={sortField}
                sortDirection={sortDirection}
              />
            );
          })()}
        </div>
      </div>

      <ResourceModal
        item={selectedItem}
        allItems={data}
        onNavigate={setSelectedItem}
        onClose={() => setSelectedItem(null)}
      />
      <ScrollToTop />
    </>
  );
}

/* ── Filter Block ── */
function FilterBlock({ title, icon, accentColor, children }: any) {
  const [open, setOpen] = useState(true);
  return (
    <div
      className="rounded-xl border border-[var(--border)] overflow-hidden transition-all duration-300"
      style={{ background: "rgba(255,255,255,0.02)" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
            style={{ background: `${accentColor}15`, color: accentColor }}
          >
            {icon}
          </div>
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {title}
          </span>
        </div>
        <div
          className="transition-transform duration-200"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
        >
          <ChevronDown className="w-4 h-4 text-[var(--text-primary)]/30" />
        </div>
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: open ? "2000px" : "0",
          opacity: open ? 1 : 0,
        }}
      >
        <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Provider Filter Section (with logos) ── */
function ProviderFilterSection({ values, selected, setSelected }: any) {
  const getProviderLogo = (provider: string) => {
    if (provider === "AWS") return "/logos/aws.svg";
    if (provider === "HUAWEI CLOUD") return "/logos/huawei-buena.svg";
    return null;
  };

  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-[var(--text-primary)]/25 mb-2.5">
        Provider
      </p>
      <div className="flex flex-wrap gap-2">
        {values.map((value: string) => {
          const active = selected.includes(value);
          const logo = getProviderLogo(value);
          return (
            <button
              key={value}
              onClick={() =>
                setSelected((p: string[]) =>
                  active ? p.filter((v) => v !== value) : [...p, value],
                )
              }
              title={value}
              className={`relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border transition-all duration-200 group ${
                active
                  ? "bg-cyan-500/15 border-cyan-500/40 shadow-lg shadow-cyan-500/15"
                  : "bg-[var(--bg-card)]/60 border-[var(--border)] hover:border-cyan-500/30 hover:bg-[var(--bg-hover)] hover:shadow-sm"
              }`}
            >
              {logo && (
                <div className="relative w-7 h-7 flex items-center justify-center">
                  <Image
                    src={logo}
                    alt={value}
                    width={28}
                    height={28}
                    className={`transition-transform duration-200 ${active ? "scale-110" : "group-hover:scale-105"}`}
                  />
                </div>
              )}
              <span
                className={`text-xs font-medium transition-colors ${
                  active ? "text-cyan-400" : "text-[var(--text-primary)]/50 group-hover:text-[var(--text-primary)]/80"
                }`}
              >
                {value === "HUAWEI CLOUD" ? "Huawei" : value}
              </span>
              {active && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-cyan-500 rounded-full flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Filter Section (chips) ── */
function FilterSection({
  title,
  values,
  selected,
  setSelected,
  coloredStatus,
}: any) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-[var(--text-primary)]/25 mb-2.5">
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value: string) => {
          const active = selected.includes(value);
          return (
            <button
              key={value}
              onClick={() =>
                setSelected((p: string[]) =>
                  active ? p.filter((v) => v !== value) : [...p, value],
                )
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
                active
                  ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400 shadow-sm shadow-cyan-500/10"
                  : coloredStatus
                    ? getStatusChipStyle(value)
                    : "bg-[var(--bg-card)]/60 border-[var(--border)] text-[var(--text-primary)]/50 hover:text-[var(--text-primary)] hover:border-white/20 hover:bg-[var(--bg-hover)]"
              }`}
            >
              <span className="flex items-center gap-1.5">
                {active && (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {value}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Dropdown Section (with search, click-outside, select all/none) ── */
function DropdownSection({ title, values, selected, setSelected }: any) {
  const [open, setOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filtered = useMemo(
    () => values.filter((v: string) => v.toLowerCase().includes(dropdownSearch.toLowerCase())),
    [values, dropdownSearch],
  );

  const selectAll = useCallback(() => {
    setSelected((p: string[]) => {
      const existing = new Set(p);
      values.forEach((v: string) => existing.add(v));
      return [...existing];
    });
  }, [values, setSelected]);

  const deselectAll = useCallback(() => {
    setSelected((p: string[]) => p.filter((v: string) => !values.includes(v)));
  }, [values, setSelected]);

  const allSelected = values.length > 0 && values.every((v: string) => selected.includes(v));

  return (
    <div className="pt-3 relative" ref={containerRef}>
      <button
        onClick={() => { setOpen(!open); setDropdownSearch(""); }}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm border transition-all ${
          selected.length > 0
            ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
            : "bg-[var(--bg-card)]/60 border-[var(--border)] text-[var(--text-primary)]/50 hover:text-[var(--text-primary)] hover:border-white/20"
        }`}
      >
        <div className="text-left min-w-0 flex-1">
          <span className="text-[10px] uppercase tracking-widest text-[var(--text-primary)]/30 block">
            {title}
          </span>
          <span className="text-xs mt-0.5 block truncate">
            {selected.length === 0
              ? "Todos"
              : `${selected.length} seleccionado${selected.length > 1 ? "s" : ""}`}
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
        )}
      </button>
      {open && (
        <div
          className="mt-1.5 rounded-xl border border-[var(--border)] overflow-hidden animate-fadeSlide"
          style={{
            background: "var(--bg-card)",
            boxShadow: "0 10px 30px var(--shadow-color)",
          }}
        >
          {/* Search inside dropdown */}
          <div className="relative border-b border-white/5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-primary)]/25 pointer-events-none" />
            <input
              type="text"
              placeholder={`Buscar ${title.toLowerCase()}...`}
              value={dropdownSearch}
              onChange={(e) => setDropdownSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-primary)]/25 bg-transparent outline-none"
            />
          </div>
          {/* Select all / None */}
          <div className="flex gap-2 px-3 py-2 border-b border-white/5">
            <button
              onClick={selectAll}
              className={`text-[10px] uppercase tracking-wider font-medium transition-colors ${
                allSelected
                  ? "text-cyan-400"
                  : "text-[var(--text-primary)]/30 hover:text-cyan-400"
              }`}
            >
              Todo
            </button>
            <span className="text-[var(--text-primary)]/10">|</span>
            <button
              onClick={deselectAll}
              className="text-[10px] uppercase tracking-wider font-medium text-[var(--text-primary)]/30 hover:text-red-400 transition-colors"
            >
              Ninguno
            </button>
            <span className="flex-1" />
            <span className="text-[10px] text-[var(--text-primary)]/20">
              {selected.length}/{values.length}
            </span>
          </div>
          {/* Items */}
          <div className="max-h-48 overflow-y-auto divide-y divide-white/5">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-[var(--text-primary)]/20">
                Sin resultados
              </div>
            ) : (
              filtered.map((value: string) => {
                const active = selected.includes(value);
                return (
                  <button
                    key={value}
                    onClick={() =>
                      setSelected((p: string[]) =>
                        active ? p.filter((v) => v !== value) : [...p, value],
                      )
                    }
                    className={`w-full text-left px-4 py-2.5 text-xs transition-colors flex items-center justify-between ${
                      active
                        ? "text-cyan-400 bg-cyan-500/10"
                        : "text-[var(--text-primary)]/60 hover:bg-white/[0.03] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <span className="truncate pr-2">{value}</span>
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                        active
                          ? "bg-cyan-500 border-cyan-500"
                          : "border-white/20 bg-transparent"
                      }`}
                    >
                      {active && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getStatusChipStyle(status: string) {
  const s = status.toLowerCase();
  if (["running", "available", "active", "ok", "in-use", "associated"].includes(s))
    return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/30";
  if (["stopped", "terminated", "stopping", "shutting-down", "deleted", "failed"].includes(s))
    return "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/30";
  if (["pending", "provisioning", "creating", "updating", "rebooting"].includes(s))
    return "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/30";
  if (["paused", "suspended", "standby"].includes(s))
    return "bg-sky-500/10 border-sky-500/20 text-sky-400 hover:bg-sky-500/20 hover:border-sky-500/30";
  return "bg-[var(--bg-card)]/60 border-[var(--border)] text-[var(--text-primary)]/50 hover:text-[var(--text-primary)] hover:border-white/20 hover:bg-[var(--bg-hover)]";
}
