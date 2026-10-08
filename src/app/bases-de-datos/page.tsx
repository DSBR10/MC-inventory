"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Database,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
} from "lucide-react";

import { InventoryItem } from "@/types/inventory";
import StatusBadge from "@/components/inventory/StatusBadge";
import ResourceModal from "@/components/inventory/ResourceModal";
import {
  exportInventoryToExcel,
  exportInventoryToPDF,
} from "@/lib/inventory/exportCsv";
import toast from "react-hot-toast";

const DB_SERVICES = new Set(["RDS", "Aurora", "DocumentDB", "DDS", "ElastiCache"]);

type SortField = "name" | "provider" | "accountName" | "status" | "engine" | "accountId";

function engineOf(item: InventoryItem): string {
  return item.operatingSystem || item.engine || "N/A";
}

function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-[#080c14] flex items-center justify-center z-50">
      <div className="text-center space-y-6 flex flex-col items-center">
        <div className="relative w-20 h-20">
          <div
            className="relative flex items-center justify-center w-20 h-20 rounded-2xl"
            style={{ background: "linear-gradient(135deg, #7c3aed, #06b6d4)" }}
          >
            <Database size={40} className="text-white" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Inventario de Bases de datos</h1>
          <p className="text-[var(--text-primary)]/40 text-sm">Cargando bases de datos...</p>
        </div>
        <div className="flex justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BasesDeDatosPage() {
  const [allData, setAllData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filterProvider, setFilterProvider] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAccount, setFilterAccount] = useState("all");
  const [filterEngine, setFilterEngine] = useState("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const loadData = useCallback(async (initial = false) => {
    try {
      if (initial) setLoading(true);
      else setRefreshing(true);
      const res = await fetch("/api/inventory", { cache: "no-store" });
      const json = await res.json();
      setAllData(Array.isArray(json.data) ? json.data : []);
    } catch {
      toast.error("Error cargando inventario");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.hidden) return;
      if (selectedItem) return;
      loadData(false);
    }, 60000);
    return () => clearInterval(interval);
  }, [loadData, selectedItem]);

  const dbData = useMemo(() => allData.filter((item) => DB_SERVICES.has(item.service)), [allData]);

  const uniqueProviders = useMemo(() => [...new Set(dbData.map((i) => i.provider || "N/A"))].sort(), [dbData]);
  const uniqueStatuses = useMemo(() => [...new Set(dbData.map((i) => i.status || "unknown"))].sort(), [dbData]);
  const uniqueAccounts = useMemo(() => [...new Set(dbData.map((i) => i.accountName || "N/A"))].sort(), [dbData]);
  const uniqueEngines = useMemo(() => [...new Set(dbData.map(engineOf))].sort(), [dbData]);

  const filteredData = useMemo(() => {
    let data = dbData;
    if (filterProvider !== "all") data = data.filter((i) => (i.provider || "N/A") === filterProvider);
    if (filterStatus !== "all") data = data.filter((i) => (i.status || "unknown") === filterStatus);
    if (filterAccount !== "all") data = data.filter((i) => (i.accountName || "N/A") === filterAccount);
    if (filterEngine !== "all") data = data.filter((i) => engineOf(i) === filterEngine);
    const q = search.trim().toLowerCase();
    if (q) {
      data = data.filter((i) =>
        (i.name || "").toLowerCase().includes(q) ||
        (i.id || "").toLowerCase().includes(q) ||
        (i.host || "").toLowerCase().includes(q) ||
        (i.accountName || "").toLowerCase().includes(q) ||
        engineOf(i).toLowerCase().includes(q) ||
        (i.instanceType || "").toLowerCase().includes(q),
      );
    }
    return data;
  }, [dbData, filterProvider, filterStatus, filterAccount, filterEngine, search]);

  const sortedData = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const val = (i: InventoryItem): string => {
      switch (sortField) {
        case "name": return i.name || "";
        case "provider": return i.provider || "";
        case "accountName": return i.accountName || "";
        case "status": return i.status || "";
        case "engine": return engineOf(i);
        case "accountId": return i.accountId || "";
        default: return "";
      }
    };
    return [...filteredData].sort((a, b) => val(a).localeCompare(val(b), undefined, { numeric: true, sensitivity: "base" }) * dir);
  }, [filteredData, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = useMemo(
    () => sortedData.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sortedData, safePage, pageSize],
  );

  const awsCount = dbData.filter((i) => i.provider === "AWS").length;
  const huaweiCount = dbData.filter((i) => i.provider === "HUAWEI CLOUD").length;
  const runningCount = dbData.filter((i) => ["available", "active", "running", "ok"].includes((i.status || "").toLowerCase())).length;

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const resetFilters = () => {
    setSearch("");
    setFilterProvider("all");
    setFilterStatus("all");
    setFilterAccount("all");
    setFilterEngine("all");
    setCurrentPage(1);
  };

  if (loading) return <LoadingScreen />;

  const headers: { key: SortField; label: string }[] = [
    { key: "provider", label: "Provider" },
    { key: "accountName", label: "Cuenta" },
    { key: "name", label: "Base de datos" },
    { key: "engine", label: "Motor" },
    { key: "status", label: "Estado" },
    { key: "accountId", label: "Endpoint" },
  ];

  return (
    <div className="min-h-screen space-y-6">
      <div className="page-section">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] p-5" style={{ background: "var(--glass-bg)", backdropFilter: "blur(16px)" }}>
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: "linear-gradient(135deg, var(--gradient-start), var(--gradient-end))" }} />
          <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-xl opacity-15" style={{ background: "linear-gradient(135deg, var(--gradient-start), var(--gradient-end))" }} />
                <div className="relative w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-lg" style={{ background: "linear-gradient(135deg, var(--gradient-start), var(--gradient-end))" }}>
                  <Database size={18} />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Inventario de Bases de datos</h1>
                  {refreshing && <span className="flex items-center gap-1.5 text-[11px] text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded-full border border-cyan-400/20"><RefreshCw className="w-3 h-3 animate-spin" />Actualizando</span>}
                </div>
                <p className="text-sm text-[var(--text-primary)]/40 mt-0.5">
                  RDS (AWS) + RDS (Huawei Cloud) · <span className="text-[var(--text-primary)] font-semibold">{sortedData.length}</span> bases de datos
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { void exportInventoryToExcel(sortedData, "databases-report.xlsx"); }} disabled={sortedData.length === 0} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/60 px-4 py-2.5 text-sm font-medium text-[var(--text-primary)]/70 transition-all duration-200 hover:border-emerald-400/30 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40">
                <FileSpreadsheet className="h-4 w-4 text-emerald-300" />Excel
              </button>
              <button type="button" onClick={() => { void exportInventoryToPDF(sortedData, "databases-report.pdf"); }} disabled={sortedData.length === 0} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/60 px-4 py-2.5 text-sm font-medium text-[var(--text-primary)]/70 transition-all duration-200 hover:border-rose-400/30 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40">
                <FileText className="h-4 w-4 text-rose-300" />PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="page-section" style={{ animationDelay: "0.05s" }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total", value: dbData.length, color: "#8b5cf6" },
            { label: "AWS RDS", value: awsCount, color: "#f59e0b" },
            { label: "Huawei RDS", value: huaweiCount, color: "#ef4444" },
            { label: "Disponibles", value: runningCount, color: "#10b981" },
          ].map((m) => (
            <div key={m.label} className="rounded-2xl border border-[var(--border)] p-4 bg-[var(--bg-card)]/80 backdrop-blur-xl">
              <p className="text-[10px] tracking-widest uppercase font-semibold text-[var(--text-secondary)]">{m.label}</p>
              <p className="text-2xl font-bold tracking-tight tabular-nums" style={{ color: m.color }}>{m.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="page-section" style={{ animationDelay: "0.1s" }}>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
          <div className="p-3 flex flex-col lg:flex-row gap-3">
            <div className="relative w-full lg:max-w-xs group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-primary)]/20 pointer-events-none transition-colors group-focus-within:text-cyan-400/60" />
              <input
                type="text"
                placeholder="Buscar bases de datos..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                aria-label="Buscar bases de datos"
                className="w-full pl-9 pr-9 py-2 rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/40 outline-none transition-all duration-200 bg-[var(--bg-hover)]/40 border border-[var(--border)] focus:border-cyan-500/40"
              />
              {search && <button type="button" onClick={() => { setSearch(""); setCurrentPage(1); }} aria-label="Limpiar búsqueda" className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-primary)]/30 hover:text-[var(--text-primary)]/70 transition-colors"><X className="w-3.5 h-3.5" /></button>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={filterProvider} aria-label="Filtrar por proveedor" onChange={(e) => { setFilterProvider(e.target.value); setCurrentPage(1); }} className="h-9 rounded-lg border border-[var(--border)] bg-[var(--bg-hover)]/60 text-xs text-[var(--text-primary)]/70 px-2.5 outline-none cursor-pointer min-w-[130px]">
                <option value="all">Proveedor</option>
                {uniqueProviders.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={filterStatus} aria-label="Filtrar por estado" onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }} className="h-9 rounded-lg border border-[var(--border)] bg-[var(--bg-hover)]/60 text-xs text-[var(--text-primary)]/70 px-2.5 outline-none cursor-pointer min-w-[130px]">
                <option value="all">Estado</option>
                {uniqueStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterAccount} aria-label="Filtrar por cuenta" onChange={(e) => { setFilterAccount(e.target.value); setCurrentPage(1); }} className="h-9 rounded-lg border border-[var(--border)] bg-[var(--bg-hover)]/60 text-xs text-[var(--text-primary)]/70 px-2.5 outline-none cursor-pointer min-w-[140px]">
                <option value="all">Cuenta</option>
                {uniqueAccounts.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={filterEngine} aria-label="Filtrar por motor" onChange={(e) => { setFilterEngine(e.target.value); setCurrentPage(1); }} className="h-9 rounded-lg border border-[var(--border)] bg-[var(--bg-hover)]/60 text-xs text-[var(--text-primary)]/70 px-2.5 outline-none cursor-pointer min-w-[140px]">
                <option value="all">Motor</option>
                {uniqueEngines.map((eng) => <option key={eng} value={eng}>{eng}</option>)}
              </select>
              {(search || filterProvider !== "all" || filterStatus !== "all" || filterAccount !== "all" || filterEngine !== "all") && (
                <button type="button" onClick={resetFilters} aria-label="Limpiar filtros" className="h-9 px-2.5 rounded-lg border border-[var(--border)] text-[11px] flex items-center gap-1 text-[var(--text-primary)]/40 hover:text-[var(--text-primary)]/70 hover:bg-[var(--bg-hover)] transition-all"><X size={12} /> Limpiar</button>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--text-primary)]/40 lg:ml-auto">
              <span className="text-[var(--text-primary)] font-semibold tabular-nums">{sortedData.length}</span>de {dbData.length} bases de datos
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: "1050px" }}>
              <thead className="sticky top-0 z-10">
                <tr className="bg-[var(--bg-card)] border-b border-[var(--border)]">
                  {headers.map((h) => {
                    const active = sortField === h.key;
                    return (
                      <th key={h.key} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap text-[var(--text-primary)]/50">
                        <button type="button" onClick={() => handleSort(h.key)} className="flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]/80">
                          {h.label}
                          {active
                            ? (sortDir === "asc" ? <ArrowUp size={12} className="text-cyan-400" /> : <ArrowDown size={12} className="text-cyan-400" />)
                            : <ChevronsUpDown size={12} className="opacity-30" />}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]/50">
                {sortedData.length === 0 ? (
                  <tr><td colSpan={headers.length} className="px-4 py-12 text-center text-[var(--text-primary)]/30">No se encontraron bases de datos</td></tr>
                ) : (
                  paginated.map((item) => (
                    <tr key={`${item.provider}-${item.id}`} onClick={() => setSelectedItem(item)} title="Ver detalle" className="hover:bg-[var(--bg-hover)]/50 transition-colors cursor-pointer">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)] text-xs">{item.provider}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-primary)]/70 whitespace-nowrap">{item.accountName}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-[var(--text-primary)] font-medium max-w-[220px] truncate" title={item.name}>{item.name}</p>
                        <p className="text-[11px] text-[var(--text-secondary)] font-mono max-w-[220px] truncate" title={item.id}>{item.id}</p>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap"><span className="font-mono text-cyan-300/90">{engineOf(item)}</span></td>
                      <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={item.status} /></td>
                      <td className="px-4 py-3 text-xs text-[var(--text-primary)]/70 max-w-[240px] truncate" title={item.host}>{item.host || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--text-primary)]/50 tabular-nums">Página {safePage} de {totalPages} · {sortedData.length} registros</span>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="rounded-lg border border-[var(--border)] bg-[var(--bg-hover)] text-xs text-[var(--text-primary)]/70 px-2 py-1 outline-none cursor-pointer">
                {[10, 50, 100, 500].map((s) => (<option key={s} value={s}>{s} por página</option>))}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} aria-label="Página anterior" className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)]/50 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"><ChevronLeft className="w-4 h-4" /></button>
              <button type="button" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} aria-label="Página siguiente" className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)]/50 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </div>

      {selectedItem && (
        <ResourceModal
          item={selectedItem}
          allItems={dbData}
          onNavigate={setSelectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
