"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Search,
  RefreshCw,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Cloud,
  HardDrive,
  CalendarDays,
  Filter,
  ShieldAlert,
} from "lucide-react";
import toast from "react-hot-toast";
import { exportTableToXlsx } from "@/lib/exports/xlsx";

type BackupRecord = {
  id: string;
  provider: "AWS" | "HUAWEI CLOUD";
  accountId: string;
  accountName: string;
  region: string;
  vaultId: string;
  vaultName: string;
  backupId: string;
  backupName: string;
  resourceId: string;
  resourceName: string;
  resourceType: string;
  status: string;
  sizeBytes: number | null;
  backupCreatedAt: string | null;
  backupCompletedAt: string | null;
  backupExpiresAt: string | null;
  raw: Record<string, unknown>;
  collectedAt: string;
};

type AccountResult = {
  provider: string;
  accountId: string;
  accountName: string;
  region: string;
  ok: boolean;
  vaults: number;
  records: number;
  error?: string;
  permissionHint?: string;
};

type Summary = {
  total: number;
  byProvider: Array<{ provider: string; total: number }>;
  byStatus: Array<{ status: string; total: number }>;
  byAccount: Array<{ provider: string; accountId: string; accountName: string; total: number; lastBackup: string | null }>;
  totalBytes: number;
};

type LastRefresh = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  trigger: string;
  status: string;
  recordsUpserted: number;
  details: { accounts?: AccountResult[] };
} | null;

function formatBogota(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
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
  if (["IN_PROGRESS", "PROTECTING", "CREATING", "PARTIAL"].includes(s)) return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  if (["FAILED", "ERROR"].includes(s)) return "bg-red-500/10 text-red-400 border-red-500/20";
  if (["EXPIRED", "DELETING"].includes(s)) return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
}

const PAGE_SIZE = 50;

function buildFilterParams(page: number, pageSize: number, f: { provider: string; accountId: string; status: string; resourceType: string; search: string; from: string; to: string }) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (f.provider) params.set("provider", f.provider);
  if (f.accountId) params.set("accountId", f.accountId);
  if (f.status) params.set("status", f.status);
  if (f.resourceType) params.set("resourceType", f.resourceType);
  if (f.search.trim()) params.set("search", f.search.trim());
  if (f.from) params.set("from", new Date(`${f.from}T00:00:00-05:00`).toISOString());
  if (f.to) params.set("to", new Date(`${f.to}T23:59:59-05:00`).toISOString());
  return params;
}

export default function BackupsPage() {
  const [records, setRecords] = useState<BackupRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [lastRefresh, setLastRefresh] = useState<LastRefresh>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("");
  const [accountId, setAccountId] = useState("");
  const [status, setStatus] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<BackupRecord | null>(null);

  const fetchData = useCallback(async (p: number, signal?: AbortSignal) => {
    const params = buildFilterParams(p, PAGE_SIZE, { provider, accountId, status, resourceType, search, from, to });
    const res = await fetch(`/api/backups?${params.toString()}`, { signal });
    if (!res.ok) throw new Error("No se pudieron cargar los backups");
    const json = await res.json();
    setRecords(json.records || []);
    setTotal(json.total || 0);
    setSummary(json.summary || null);
    setLastRefresh(json.lastRefresh || null);
  }, [provider, accountId, status, resourceType, search, from, to]);

  // Carga inicial + cambios de página. Los filtros se aplican con Buscar/Enter (sin doble fetch).
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchData(page, controller.signal).catch((e) => {
      if (e?.name !== "AbortError") toast.error("Error cargando backups");
    }).finally(() => setLoading(false));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const applyFilters = () => {
    if (from && to && from > to) {
      toast.error("El rango de fechas es inválido: 'Desde' es posterior a 'Hasta'");
      return;
    }
    if (page === 1) {
      setLoading(true);
      fetchData(1).catch(() => toast.error("Error cargando backups")).finally(() => setLoading(false));
    } else {
      setPage(1); // el efecto de página recarga con los filtros nuevos
    }
  };
  const clearFilters = () => {
    setSearch(""); setProvider(""); setAccountId(""); setStatus(""); setResourceType(""); setFrom(""); setTo(""); setPage(1);
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch("/api/backups/refresh", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falló el refresco");
      const s = json.summary;
      toast.success(`Refresco ${s.status}: ${s.recordsUpserted} backups (${s.accounts.length} cuentas)`);
      setPage(1);
      await fetchData(1);
    } catch (e: any) {
      toast.error(e?.message || "Error refrescando backups");
    } finally {
      setRefreshing(false);
    }
  };

  const [exporting, setExporting] = useState(false);

  const exportXlsx = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // Exporta TODOS los registros filtrados (paginando la API), no solo la página visible.
      const f = { provider, accountId, status, resourceType, search, from, to };
      const all: BackupRecord[] = [];
      let p = 1;
      let expected = Infinity;
      while (all.length < expected) {
        const params = buildFilterParams(p, 500, f);
        const res = await fetch(`/api/backups?${params.toString()}`);
        if (!res.ok) throw new Error("No se pudo obtener el total a exportar");
        const json = await res.json();
        all.push(...(json.records || []));
        expected = json.total || 0;
        if (!json.records?.length) break;
        p++;
        if (p > 50) break; // tope de seguridad: 25.000 filas
      }
      if (all.length === 0) {
        toast.error("No hay registros para exportar con los filtros actuales");
        return;
      }
      await exportTableToXlsx({
        columns: [
          { key: "provider", header: "Proveedor", width: 16 },
          { key: "accountName", header: "Cuenta", width: 22 },
          { key: "accountId", header: "Cuenta ID", width: 20 },
          { key: "region", header: "Región", width: 16 },
          { key: "vaultName", header: "Vault", width: 26 },
          { key: "backupName", header: "Backup", width: 34 },
          { key: "backupId", header: "Backup ID", width: 40 },
          { key: "resource", header: "Recurso", width: 28 },
          { key: "resourceId", header: "Recurso ID", width: 28 },
          { key: "resourceType", header: "Tipo recurso", width: 20 },
          { key: "status", header: "Estado", width: 14 },
          { key: "sizeBytes", header: "Tamaño (bytes)", width: 16, align: "right", numFmt: "#,##0" },
          { key: "createdBogota", header: "Fecha backup (Bogotá)", width: 20 },
          { key: "expiresBogota", header: "Expira (Bogotá)", width: 20 },
        ],
        rows: all.map((r) => ({
          provider: r.provider,
          accountName: r.accountName,
          accountId: r.accountId,
          region: r.region,
          vaultName: r.vaultName,
          backupName: r.backupName,
          backupId: r.backupId,
          resource: r.resourceName || r.resourceId,
          resourceId: r.resourceId,
          resourceType: r.resourceType,
          status: r.status,
          sizeBytes: r.sizeBytes,
          createdBogota: formatBogota(r.backupCreatedAt),
          expiresBogota: formatBogota(r.backupExpiresAt),
        })),
        filename: `backups-${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheetName: "Backups",
        title: "Bitácora de backups de servidores",
        subtitle: `Generado: ${new Date().toLocaleString("es-CO")} · ${all.length} registros · fechas en hora Colombia`,
        module: "backups",
      });
      toast.success(`Excel generado con ${all.length} registros`);
    } catch {
      toast.error("No se pudo generar el Excel");
    } finally {
      setExporting(false);
    }
  };

  const failedAccounts: AccountResult[] = useMemo(() => {
    const accs = lastRefresh?.details?.accounts || [];
    return accs.filter((a) => !a.ok);
  }, [lastRefresh]);

  const filterOptions = useMemo(() => {
    const accounts = new Map<string, { id: string; name: string; provider: string }>();
    (summary?.byAccount || []).forEach((a) => accounts.set(`${a.provider}|${a.accountId}`, { id: a.accountId, name: a.accountName, provider: a.provider }));
    const statuses = (summary?.byStatus || []).map((s) => s.status);
    const resourceTypes = [...new Set(records.map((r) => r.resourceType).filter(Boolean))];
    return { accounts: [...accounts.values()], statuses, resourceTypes };
  }, [summary, records]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const awsCount = summary?.byProvider.find((p) => p.provider === "AWS")?.total || 0;
  const huaweiCount = summary?.byProvider.find((p) => p.provider === "HUAWEI CLOUD")?.total || 0;
  const okCount = (summary?.byStatus || []).filter((s) => ["COMPLETED", "AVAILABLE"].includes(s.status.toUpperCase())).reduce((a, s) => a + s.total, 0);
  const okRate = summary?.total ? Math.round((okCount / summary.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] p-5" style={{ background: "var(--glass-bg)", backdropFilter: "blur(16px)" }}>
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ background: "linear-gradient(135deg,var(--gradient-start),var(--gradient-end))" }} />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-lg" style={{ background: "linear-gradient(135deg,#0ea5e9,#6366f1)" }}>
              <Archive size={18} />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight">Backups de servidores</h1>
                {refreshing && <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400"><RefreshCw size={12} className="animate-spin" /> Recolectando</span>}
              </div>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Bitácora diaria · AWS Backup + Huawei CBR (vaults) · refresco automático 06:00 hora Colombia
              </p>
              {lastRefresh && (
                <p className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-1.5">
                  <Clock3 size={12} />
                  Último refresco: {formatBogota(lastRefresh.startedAt)} ({lastRefresh.trigger === "scheduled" ? "automático" : "manual"}) ·
                  estado <span className="font-semibold">{lastRefresh.status}</span> · {lastRefresh.recordsUpserted} registros
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportXlsx} disabled={total === 0 || exporting} className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/60 text-sm flex items-center gap-2 hover:bg-[var(--bg-hover)] disabled:opacity-40">
              <Download size={16} /> {exporting ? "Generando..." : "Excel"}
            </button>
            <button onClick={handleRefresh} disabled={refreshing} className="px-4 py-2.5 rounded-xl bg-cyan-600 text-white text-sm flex items-center gap-2 hover:bg-cyan-500 disabled:opacity-50">
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /> Refrescar ahora
            </button>
          </div>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {[
          { label: "Total backups", value: summary?.total ?? 0, sub: "en bitácora", icon: Database, color: "#8b5cf6" },
          { label: "AWS Backup", value: awsCount, sub: "EC2 + EBS", icon: Cloud, color: "#f59e0b" },
          { label: "Huawei CBR", value: huaweiCount, sub: "vaults", icon: HardDrive, color: "#ef4444" },
          { label: "Exitosos", value: `${okRate}%`, sub: `${okCount} completados`, icon: CheckCircle2, color: "#10b981" },
          { label: "Almacenado", value: formatBytes(summary?.totalBytes ?? 0), sub: "tamaño reportado", icon: Archive, color: "#06b6d4" },
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
              <p className="text-xs text-[var(--text-secondary)]">{m.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Alertas por cuenta (permisos) */}
      {failedAccounts.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4 space-y-3">
          <p className="text-sm font-semibold text-amber-300 flex items-center gap-2"><ShieldAlert size={16} /> {failedAccounts.length} cuenta(s) con error en el último refresco</p>
          {failedAccounts.map((a) => (
            <div key={`${a.provider}-${a.accountId}`} className="text-xs leading-relaxed text-[var(--text-secondary)] rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="font-semibold text-white/80">{a.provider} · {a.accountName} ({a.accountId}) · {a.region}</p>
              <p className="mt-1 break-words">{a.error}</p>
              {a.permissionHint && <p className="mt-1.5 text-amber-200/90 flex items-start gap-1.5"><ShieldAlert size={13} className="mt-0.5 shrink-0" /><span>{a.permissionHint}</span></p>}
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--glass-bg)] backdrop-blur-xl overflow-hidden">
        <div className="p-4 flex flex-col xl:flex-row gap-3">
          <div className="relative flex-1 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/40 group-focus-within:text-cyan-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
              placeholder="Buscar backup, servidor, vault, ID de recurso..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/10 outline-none focus:border-cyan-500/40 placeholder:text-[var(--text-secondary)]/40"
            />
            {search && <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda" className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5"><X size={16} className="text-[var(--text-secondary)]" /></button>}
          </div>
          <div className="flex gap-2 flex-wrap">
            <select value={provider} onChange={(e) => setProvider(e.target.value)} aria-label="Filtrar por nube" className="control h-10 min-w-[130px]">
              <option value="">Toda nube</option>
              <option value="AWS">AWS</option>
              <option value="HUAWEI CLOUD">Huawei</option>
            </select>
            <button onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters} className={`px-4 h-10 rounded-xl border text-sm flex items-center gap-2 ${showFilters ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400" : "bg-[var(--bg-card)]/60 border-[var(--border)]"}`}>
              <Filter size={16} /> Filtros
            </button>
            <button onClick={applyFilters} className="px-5 h-10 rounded-xl bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-500">Buscar</button>
          </div>
        </div>
        {showFilters && (
          <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 border-t border-white/5 pt-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-widest text-[var(--text-secondary)]">Cuenta</span>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="control h-10 mt-1">
                <option value="">Todas</option>
                {filterOptions.accounts.map((a) => <option key={`${a.provider}|${a.id}`} value={a.id}>{a.provider === "AWS" ? "AWS" : "Huawei"} · {a.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-widest text-[var(--text-secondary)]">Estado</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="control h-10 mt-1">
                <option value="">Todos</option>
                {filterOptions.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-widest text-[var(--text-secondary)]">Tipo recurso</span>
              <select value={resourceType} onChange={(e) => setResourceType(e.target.value)} className="control h-10 mt-1">
                <option value="">Todos</option>
                {filterOptions.resourceTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-widest text-[var(--text-secondary)]">Desde (Bogotá)</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="control h-10 mt-1" />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-widest text-[var(--text-secondary)]">Hasta (Bogotá)</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="control h-10 mt-1" />
            </label>
          </div>
        )}
        <div className="px-4 py-2.5 flex items-center gap-3 text-xs border-t border-white/5 bg-[var(--bg-hover)]/20">
          <span className="text-[var(--text-secondary)]">Mostrando</span><span className="font-semibold">{records.length}</span>
          <span className="text-[var(--text-secondary)]">de</span><span className="font-semibold">{total}</span>
          <span className="text-[var(--text-secondary)]">backups</span>
          {(search || provider || accountId || status || resourceType || from || to) && (
            <button onClick={clearFilters} className="ml-2 inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200"><X size={12} /> Limpiar filtros</button>
          )}
          <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]"><CalendarDays size={12} /> Fechas en hora Colombia (UTC-5)</span>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]/60 backdrop-blur-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 1100 }}>
            <thead className="bg-[var(--bg-hover)]/60 border-b border-[var(--border)] sticky top-0 z-10 backdrop-blur-xl">
              <tr>
                {["Nube", "Cuenta", "Vault", "Backup / Recurso", "Fecha backup", "Estado", "Tamaño", "Expira"].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-[11px] uppercase tracking-wider text-[var(--text-secondary)] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-sm text-[var(--text-secondary)]">Cargando bitácora de backups...</td></tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <Archive size={28} className="mx-auto mb-3 text-[var(--text-secondary)]/40" />
                    <p className="text-sm font-medium">Sin backups registrados</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">Ejecuta “Refrescar ahora” para recolectar AWS Backup y Huawei CBR, o ajusta los filtros.</p>
                  </td>
                </tr>
              ) : records.map((r) => (
                <tr key={r.id} onClick={() => setSelected(r)} className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)]/40 transition cursor-pointer">
                  <td className="px-3 py-3"><span className="inline-flex px-2 py-1 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)] text-xs whitespace-nowrap">{r.provider === "AWS" ? "AWS" : "Huawei"}</span></td>
                  <td className="px-3 py-3 text-xs"><p className="font-medium truncate max-w-[160px]">{r.accountName}</p><p className="text-[var(--text-secondary)] truncate max-w-[160px]">{r.region}</p></td>
                  <td className="px-3 py-3 text-xs truncate max-w-[180px]">{r.vaultName || "—"}</td>
                  <td className="px-3 py-3">
                    <p className="text-sm font-semibold truncate max-w-[260px]">{r.backupName || "—"}</p>
                    <p className="text-xs text-[var(--text-secondary)] truncate max-w-[260px]">{r.resourceName || r.resourceId} {r.resourceType && <span className="ml-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[10px]">{r.resourceType}</span>}</p>
                  </td>
                  <td className="px-3 py-3 text-xs whitespace-nowrap">{formatBogota(r.backupCreatedAt)}</td>
                  <td className="px-3 py-3"><span className={`px-2 py-1 rounded-full text-[10px] border font-medium whitespace-nowrap ${statusStyle(r.status)}`}>{r.status}</span></td>
                  <td className="px-3 py-3 text-xs whitespace-nowrap">{formatBytes(r.sizeBytes)}</td>
                  <td className="px-3 py-3 text-xs whitespace-nowrap text-[var(--text-secondary)]">{formatBogota(r.backupExpiresAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 flex items-center justify-between gap-3 border-t border-white/5 text-xs text-[var(--text-secondary)]">
          <span>Página {page} de {totalPages} · {total} registros</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} aria-label="Página anterior" onClick={() => setPage((p) => Math.max(1, p - 1))} className="p-2 rounded-lg border border-[var(--border)] disabled:opacity-30 hover:bg-[var(--bg-hover)]"><ChevronLeft size={14} /></button>
            <button type="button" disabled={page >= totalPages} aria-label="Página siguiente" onClick={() => setPage((p) => p + 1)} className="p-2 rounded-lg border border-[var(--border)] disabled:opacity-30 hover:bg-[var(--bg-hover)]"><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>

      {/* Detalle */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-xs text-[var(--text-secondary)]">{selected.provider} · {selected.accountName} · {selected.region}</p>
                <h2 className="text-lg font-bold break-all">{selected.backupName}</h2>
                <p className="text-xs font-mono text-[var(--text-secondary)] break-all mt-1">{selected.backupId}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Cerrar detalle" className="p-2 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)]"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {[
                ["Vault", selected.vaultName || "—"],
                ["Recurso", selected.resourceName || selected.resourceId || "—"],
                ["ID recurso", selected.resourceId || "—"],
                ["Tipo recurso", selected.resourceType || "—"],
                ["Estado", selected.status],
                ["Tamaño", formatBytes(selected.sizeBytes)],
                ["Creado (Bogotá)", formatBogota(selected.backupCreatedAt)],
                ["Completado (Bogotá)", formatBogota(selected.backupCompletedAt)],
                ["Expira (Bogotá)", formatBogota(selected.backupExpiresAt)],
                ["Recolectado", formatBogota(selected.collectedAt)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-[var(--border)] bg-black/20 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">{k}</p>
                  <p className="mt-1 break-all font-medium">{v}</p>
                </div>
              ))}
            </div>
            <details className="mt-4 text-xs">
              <summary className="cursor-pointer text-[var(--text-secondary)] hover:text-white">Ver datos crudos de la nube</summary>
              <pre className="mt-2 rounded-xl border border-[var(--border)] bg-black/30 p-3 overflow-auto max-h-64 text-[11px] leading-relaxed">{JSON.stringify(selected.raw, null, 2)}</pre>
            </details>
          </div>
        </div>
      )}

      {!lastRefresh && !loading && (
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] p-4 flex items-start gap-3 text-sm">
          <AlertTriangle size={18} className="text-cyan-300 mt-0.5" />
          <p className="text-[var(--text-secondary)] text-xs leading-relaxed">
            Aún no hay refrescos registrados. El programador corre a diario a las <strong className="text-white">06:00 hora Colombia</strong> (después de la ventana de backups 22:00–04:00).
            Puedes adelantar la primera carga con <strong className="text-white">“Refrescar ahora”</strong>. Si alguna cuenta falla por permisos, verás aquí el detalle y el permiso requerido.
          </p>
        </div>
      )}
    </div>
  );
}
