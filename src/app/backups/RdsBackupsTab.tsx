"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Database,
  Search,
  X,
  Cloud,
  HardDrive,
  CheckCircle2,
  XCircle,
  Clock3,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Filter,
} from "lucide-react";
import toast from "react-hot-toast";

type RdsBackupRecord = {
  id: string;
  provider: "AWS" | "HUAWEI CLOUD";
  accountId: string;
  accountName: string;
  region: string;
  dbInstanceId: string;
  dbInstanceName: string;
  engine: string;
  snapshotId: string;
  snapshotName: string;
  snapshotType: string;
  status: string;
  sizeBytes: number | null;
  snapshotCreatedAt: string | null;
  snapshotCompletedAt: string | null;
  raw: Record<string, unknown>;
  collectedAt: string;
};

type RdsSummary = {
  total: number;
  byProvider: Array<{ provider: string; total: number }>;
  byStatus: Array<{ status: string; total: number }>;
  byAccount: Array<{ provider: string; accountId: string; accountName: string; total: number; lastBackup: string | null }>;
  byEngine: Array<{ engine: string; total: number }>;
  totalBytes: number;
};

type SortField = "snapshotCreatedAt" | "snapshotCompletedAt" | "sizeBytes" | "dbInstanceName" | "engine" | "status" | "accountName";
type SortDir = "asc" | "desc";

function formatBogota(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CO", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function statusStyle(status: string): string {
  const s = status.toUpperCase();
  if (["COMPLETED", "AVAILABLE"].includes(s)) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (["IN_PROGRESS", "CREATING", "BUILDING"].includes(s)) return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  if (["FAILED", "ERROR"].includes(s)) return "bg-red-500/10 text-red-400 border-red-500/20";
  return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
}

const COLUMNS: { key: SortField; label: string }[] = [
  { key: "accountName", label: "Cuenta" },
  { key: "dbInstanceName", label: "Instancia" },
  { key: "engine", label: "Motor" },
  { key: "status", label: "Estado" },
  { key: "sizeBytes", label: "Tamaño" },
  { key: "snapshotCreatedAt", label: "Fecha creación" },
  { key: "snapshotCompletedAt", label: "Completado" },
];

export default function RdsBackupsTab() {
  const [records, setRecords] = useState<RdsBackupRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [summary, setSummary] = useState<RdsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("");
  const [status, setStatus] = useState("");
  const [engine, setEngine] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>("snapshotCreatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<RdsBackupRecord | null>(null);

  const activeFilterCount = [provider, status, engine, from, to].filter(Boolean).length;

  const fetchData = useCallback(async (p: number, ps: number) => {
    const params = new URLSearchParams({ page: String(p), pageSize: String(ps) });
    if (provider) params.set("provider", provider);
    if (status) params.set("status", status);
    if (engine) params.set("engine", engine);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (search.trim()) params.set("search", search.trim());
    const res = await fetch(`/api/backups/rds?${params.toString()}`);
    if (!res.ok) throw new Error("No se pudieron cargar los backups RDS");
    const json = await res.json();
    setRecords(json.records || []);
    setTotal(json.total || 0);
    setSummary(json.summary || null);
  }, [provider, status, engine, from, to, search]);

  useEffect(() => {
    setLoading(true);
    fetchData(page, pageSize).catch(() => toast.error("Error cargando backups RDS")).finally(() => setLoading(false));
  }, [page, pageSize, fetchData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sortedRecords = [...records].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    const va = a[sortField];
    const vb = b[sortField];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
    return String(va).localeCompare(String(vb)) * dir;
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const awsCount = summary?.byProvider.find((p) => p.provider === "AWS")?.total || 0;
  const huaweiCount = summary?.byProvider.find((p) => p.provider === "HUAWEI CLOUD")?.total || 0;
  const okCount = (summary?.byStatus || []).filter((s) => ["COMPLETED", "AVAILABLE"].includes(s.status.toUpperCase())).reduce((a, s) => a + s.total, 0);
  const okRate = summary?.total ? Math.round((okCount / summary.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total snapshots", value: summary?.total ?? 0, icon: Database, color: "#8b5cf6" },
          { label: "AWS RDS", value: awsCount, icon: Cloud, color: "#f59e0b" },
          { label: "Huawei RDS", value: huaweiCount, icon: HardDrive, color: "#ef4444" },
          { label: "Exitosos", value: `${okRate}%`, icon: CheckCircle2, color: "#10b981" },
        ].map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="rounded-2xl border border-[var(--border)] p-4 bg-[var(--bg-card)]/80 backdrop-blur-xl">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-[10px] tracking-widest uppercase font-semibold text-[var(--text-secondary)]">{m.label}</p>
                  <p className="text-2xl font-bold tracking-tight" style={{ color: m.color }}>{m.value}</p>
                </div>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${m.color}15`, color: m.color }}><Icon size={16} /></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--glass-bg)] backdrop-blur-xl overflow-hidden">
        <div className="p-3 flex flex-col xl:flex-row gap-3">
          <div className="relative w-full xl:max-w-xs group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/40 group-focus-within:text-cyan-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); fetchData(1, pageSize); }}} placeholder="Buscar snapshot, instancia..." className="w-full pl-9 pr-9 py-2 rounded-lg text-sm bg-white/[0.04] border border-white/10 outline-none focus:border-cyan-500/40 placeholder:text-[var(--text-secondary)]/40 transition-all" />
            {search && <button type="button" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5"><X size={14} className="text-[var(--text-secondary)]" /></button>}
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <select value={provider} onChange={(e) => { setProvider(e.target.value); setPage(1); }} className="h-9 rounded-lg border border-[var(--border)] bg-[var(--bg-hover)]/60 text-xs text-[var(--text-primary)]/70 px-2.5 outline-none cursor-pointer min-w-[100px]">
              <option value="">Proveedor</option>
              <option value="AWS">AWS</option>
              <option value="HUAWEI CLOUD">Huawei</option>
            </select>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-9 rounded-lg border border-[var(--border)] bg-[var(--bg-hover)]/60 text-xs text-[var(--text-primary)]/70 px-2.5 outline-none cursor-pointer min-w-[110px]">
              <option value="">Estado</option>
              <option value="COMPLETED">Completado</option>
              <option value="AVAILABLE">Disponible</option>
              <option value="IN_PROGRESS">En progreso</option>
              <option value="FAILED">Fallido</option>
            </select>
            {summary?.byEngine && summary.byEngine.length > 0 && (
              <select value={engine} onChange={(e) => { setEngine(e.target.value); setPage(1); }} className="h-9 rounded-lg border border-[var(--border)] bg-[var(--bg-hover)]/60 text-xs text-[var(--text-primary)]/70 px-2.5 outline-none cursor-pointer min-w-[110px]">
                <option value="">Motor</option>
                {summary.byEngine.map((e) => <option key={e.engine} value={e.engine}>{e.engine} ({e.total})</option>)}
              </select>
            )}
            <button onClick={() => setShowFilters(!showFilters)} className={`px-3 h-9 rounded-lg border text-xs flex items-center gap-1.5 transition-all ${showFilters ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400" : "bg-[var(--bg-card)]/60 border-[var(--border)] text-[var(--text-primary)]/60"}`}>
              <Filter size={14} /> Fechas
              {(from || to) && <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">✓</span>}
            </button>
            {activeFilterCount > 0 && (
              <button onClick={() => { setProvider(""); setStatus(""); setEngine(""); setFrom(""); setTo(""); setPage(1); }} className="h-9 px-2.5 rounded-lg border border-[var(--border)] text-[11px] flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all">
                <X size={12} /> Limpiar
              </button>
            )}
          </div>
        </div>
        {showFilters && (
          <div className="px-4 pb-4 grid grid-cols-2 gap-3 border-t border-white/5 pt-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-widest text-[var(--text-secondary)]">Desde</span>
              <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="control h-9 text-xs mt-1" />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-widest text-[var(--text-secondary)]">Hasta</span>
              <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="control h-9 text-xs mt-1" />
            </label>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]/60 backdrop-blur-xl overflow-hidden">
        {total > pageSize && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
            <span className="text-xs text-[var(--text-primary)]/50">Mostrando {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} de {total}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setPage(page - 1)} disabled={page === 1} className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)]/50 hover:bg-[var(--bg-hover)] disabled:opacity-30 transition-all"><ChevronLeft className="w-4 h-4" /></button>
              <span className="px-3 text-xs">{page} / {totalPages}</span>
              <button type="button" onClick={() => setPage(page + 1)} disabled={page === totalPages} className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)]/50 hover:bg-[var(--bg-hover)] disabled:opacity-30 transition-all"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 900 }}>
            <thead className="bg-[var(--bg-hover)]/60 border-b border-[var(--border)]">
              <tr>
                <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wider text-[var(--text-secondary)] whitespace-nowrap">Nube</th>
                {COLUMNS.map((col) => (
                  <th key={col.key} onClick={() => handleSort(col.key)} className="px-3 py-3 text-left text-[11px] uppercase tracking-wider text-[var(--text-secondary)] whitespace-nowrap cursor-pointer hover:text-cyan-400 select-none transition-colors">
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortField === col.key && (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wider text-[var(--text-secondary)] whitespace-nowrap">Snapshot</th>
                <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wider text-[var(--text-secondary)] whitespace-nowrap">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-6 py-12 text-center text-sm text-[var(--text-secondary)]">Cargando backups RDS...</td></tr>
              ) : sortedRecords.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-12 text-center">
                  <Database size={28} className="mx-auto mb-3 text-[var(--text-secondary)]/40" />
                  <p className="text-sm font-medium">Sin snapshots RDS registrados</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">Ejecuta &quot;Refrescar ahora&quot; para recolectar snapshots de AWS RDS y Huawei RDS.</p>
                </td></tr>
              ) : sortedRecords.map((r) => (
                <tr key={r.id} onClick={() => setSelected(r)} className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)]/40 transition cursor-pointer">
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-medium whitespace-nowrap ${r.provider === "AWS" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                      {r.provider === "AWS" ? <Cloud size={11} /> : <HardDrive size={11} />}
                      {r.provider === "AWS" ? "AWS" : "HW"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-xs font-medium truncate max-w-[120px]">{r.accountName}</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">{r.region}</p>
                  </td>
                  <td className="px-3 py-3 text-xs font-medium truncate max-w-[160px]">{r.dbInstanceName}</td>
                  <td className="px-3 py-3 text-xs text-[var(--text-secondary)]">{r.engine}</td>
                  <td className="px-3 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] border font-medium whitespace-nowrap ${statusStyle(r.status)}`}>{r.status}</span></td>
                  <td className="px-3 py-3 text-xs whitespace-nowrap tabular-nums">{formatBytes(r.sizeBytes)}</td>
                  <td className="px-3 py-3 text-xs whitespace-nowrap">{formatBogota(r.snapshotCreatedAt)}</td>
                  <td className="px-3 py-3 text-xs whitespace-nowrap text-[var(--text-secondary)]">{formatBogota(r.snapshotCompletedAt)}</td>
                  <td className="px-3 py-3">
                    <p className="text-xs font-medium truncate max-w-[200px]">{r.snapshotName}</p>
                  </td>
                  <td className="px-3 py-3 text-xs text-[var(--text-secondary)]">{r.snapshotType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-xs text-[var(--text-secondary)]">{selected.provider} · {selected.accountName} · {selected.region}</p>
                <h2 className="text-lg font-bold break-all">{selected.snapshotName}</h2>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="p-2 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-all"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {[
                ["Instancia", selected.dbInstanceName || "—"],
                ["Motor", selected.engine || "—"],
                ["Tipo snapshot", selected.snapshotType || "—"],
                ["Estado", selected.status],
                ["Tamaño", formatBytes(selected.sizeBytes)],
                ["Creado (Colombia)", formatBogota(selected.snapshotCreatedAt)],
                ["Completado (Colombia)", formatBogota(selected.snapshotCompletedAt)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-[var(--border)] bg-black/20 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">{k}</p>
                  <p className="mt-1 break-all font-medium">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
