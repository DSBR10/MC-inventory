"use client";

import { useEffect, useMemo, useState } from "react";

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

      <div className="min-h-screen space-y-5">
        {/* ── Page header ── */}
        <div className="page-section flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-[var(--text-primary)] flex-shrink-0"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #06b6d4)",
                }}
              >
                MC
              </div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                Dashboard
              </h1>
              {refreshing && (
                <span className="flex items-center gap-1.5 text-xs text-cyan-400 bg-cyan-400/10 px-2.5 py-1 rounded-full border border-cyan-400/20">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Actualizando
                </span>
              )}
            </div>
            <p className="text-[var(--text-primary)]/40 text-sm ml-12">
              Inventario Cloud Centralizado
              {lastUpdate && (
                <span className="ml-2 text-[var(--text-primary)]/25">
                  · actualizado {lastUpdate}
                </span>
              )}
            </p>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-2 bg-[var(--bg-card)]/60 border border-[var(--border)] rounded-xl p-1">
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 rounded-lg transition-all ${viewMode === "table" ? "bg-[var(--bg-hover)] text-[var(--text-primary)]" : "text-[var(--text-primary)]/30 hover:text-[var(--text-primary)]/60"}`}
              title="Vista tabla"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`p-2 rounded-lg transition-all ${viewMode === "cards" ? "bg-[var(--bg-hover)] text-[var(--text-primary)]" : "text-[var(--text-primary)]/30 hover:text-[var(--text-primary)]/60"}`}
              title="Vista tarjetas"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Metrics ── */}
        <div className="page-section" style={{ animationDelay: "0.05s" }}>
          <MetricsCards data={filteredData} />
        </div>

        {/* ── Filter panel ── */}
        <div className="page-section" style={{ animationDelay: "0.1s" }}>
          <div
            className="rounded-2xl border border-[var(--border)] overflow-hidden"
            style={{
              background: "var(--glass-bg)",
              backdropFilter: "blur(16px)",
            }}
          >
            {/* Toolbar */}
            <div className="p-4 flex flex-col xl:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-primary)]/25 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar recursos, IDs, IPs, tags..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-primary)]/25 outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                  onFocus={(e) =>
                    (e.target.style.borderColor = "rgba(6,182,212,0.4)")
                  }
                  onBlur={(e) =>
                    (e.target.style.borderColor = "rgba(255,255,255,0.1)")
                  }
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
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                    filtersOpen || activeFiltersCount > 0
                      ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-400"
                      : "bg-[var(--bg-card)]/60 border-[var(--border)] text-[var(--text-primary)]/60 hover:text-[var(--text-primary)] hover:border-white/20"
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Filtros
                  {activeFiltersCount > 0 && (
                    <span className="bg-cyan-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                      {activeFiltersCount}
                    </span>
                  )}
                  {filtersOpen ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                <button
                  onClick={() => exportCSV(filteredData, "inventory.csv")}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--border)] bg-[var(--bg-card)]/60 text-[var(--text-primary)]/60 hover:text-[var(--text-primary)] hover:border-white/20 transition-all"
                >
                  <Download className="w-4 h-4" />
                  CSV
                </button>

                {activeFiltersCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Results summary */}
            <div className="px-4 pb-3 flex items-center gap-2 text-xs text-[var(--text-primary)]/30 border-t border-white/5 pt-3">
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${filteredData.length < data.length ? "bg-amber-400" : "bg-emerald-400"}`}
              />
              Mostrando
              <span className="text-[var(--text-primary)] font-semibold">
                {filteredData.length}
              </span>
              de
              <span className="text-[var(--text-primary)] font-semibold">
                {data.length}
              </span>
              recursos
              {activeFiltersCount > 0 && (
                <span className="text-cyan-400/70 ml-1">
                  · {activeFiltersCount} filtro
                  {activeFiltersCount > 1 ? "s" : ""} activo
                  {activeFiltersCount > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Filter sections */}
            {filtersOpen && (
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
                      <p className="text-xs text-[var(--text-primary)]/30 uppercase tracking-wider mb-3">
                        Sin tags
                      </p>
                      <button
                        onClick={() => setOnlyWithoutTags(!onlyWithoutTags)}
                        className={`px-4 py-2.5 rounded-xl text-sm border transition-all ${
                          onlyWithoutTags
                            ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                            : "bg-[var(--bg-card)]/60 border-[var(--border)] text-[var(--text-primary)]/50 hover:text-[var(--text-primary)] hover:border-white/20"
                        }`}
                      >
                        {onlyWithoutTags ? "✓ " : ""}Recursos sin tags
                      </button>
                    </div>
                  </div>
                </FilterBlock>
              </div>
            )}
          </div>
        </div>

        {/* ── Inventory ── */}
        <div className="page-section" style={{ animationDelay: "0.15s" }}>
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
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-xl border border-[var(--border)] overflow-hidden"
      style={{ background: "rgba(255,255,255,0.02)" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${accentColor}15`, color: accentColor }}
          >
            {icon}
          </div>
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {title}
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-[var(--text-primary)]/30" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--text-primary)]/30" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/5">
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Provider Filter Section (with logos) ── */
function ProviderFilterSection({ values, selected, setSelected }: any) {
  const getProviderLogo = (provider: string) => {
    if (provider === "AWS") return "/logos/aws.svg";
    if (provider === "HUAWEI CLOUD") return "/logos/huawei.svg";
    return null;
  };

  return (
    <div className="pt-3">
      <p className="text-[10px] uppercase tracking-widest text-[var(--text-primary)]/25 mb-2.5">
        Provider
      </p>
      <div className="flex flex-wrap gap-3">
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
              className={`p-3 rounded-lg border transition-all flex items-center justify-center ${
                active
                  ? "bg-cyan-500/20 border-cyan-500/40 shadow-lg shadow-cyan-500/20 scale-105"
                  : "bg-[var(--bg-card)]/60 border-[var(--border)] hover:border-cyan-500/30 hover:bg-[var(--bg-hover)]"
              }`}
            >
              {logo && (
                <Image
                  src={logo}
                  alt={value}
                  width={32}
                  height={32}
                  className="transition-transform"
                />
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
    <div className="pt-3">
      <p className="text-[10px] uppercase tracking-widest text-[var(--text-primary)]/25 mb-2.5">
        {title}
      </p>
      <div className="flex flex-wrap gap-2">
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
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                active
                  ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
                  : coloredStatus
                    ? getStatusChipStyle(value)
                    : "bg-[var(--bg-card)]/60 border-[var(--border)] text-[var(--text-primary)]/50 hover:text-[var(--text-primary)] hover:border-white/20"
              }`}
            >
              {value}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Dropdown Section ── */
function DropdownSection({ title, values, selected, setSelected }: any) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pt-3">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm border transition-all ${
          selected.length > 0
            ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
            : "bg-[var(--bg-card)]/60 border-[var(--border)] text-[var(--text-primary)]/50 hover:text-[var(--text-primary)] hover:border-white/20"
        }`}
      >
        <div className="text-left">
          <span className="text-[10px] uppercase tracking-widest text-[var(--text-primary)]/30 block">
            {title}
          </span>
          <span className="text-xs mt-0.5 block">
            {selected.length === 0
              ? "Todos"
              : `${selected.length} seleccionado${selected.length > 1 ? "s" : ""}`}
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </button>
      {open && (
        <div
          className="mt-1.5 max-h-48 overflow-y-auto rounded-xl border border-[var(--border)] divide-y divide-white/5"
          style={{
            background: "var(--bg-card)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 10px 30px var(--shadow-color)",
          }}
        >
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
                className={`w-full text-left px-4 py-2.5 text-xs transition-colors flex items-center justify-between ${
                  active
                    ? "text-cyan-400 bg-cyan-500/10"
                    : "text-[var(--text-primary)]/60 hover:bg-[var(--bg-card)]/60 hover:text-[var(--text-primary)]"
                }`}
              >
                <span>{value}</span>
                {active && (
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getStatusChipStyle(status: string) {
  const s = status.toLowerCase();
  if (["running", "available", "active", "ok"].includes(s))
    return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20";
  if (["stopped", "terminated"].includes(s))
    return "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20";
  return "bg-[var(--bg-card)]/60 border-[var(--border)] text-[var(--text-primary)]/50 hover:text-[var(--text-primary)] hover:border-white/20";
}
