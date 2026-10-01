"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FileText,
  Search,
  X,
  Cloud,
  HardDrive,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import toast from "react-hot-toast";

type LogBackupRecord = {
  id: string;
  provider: "AWS" | "HUAWEI CLOUD";
  accountId: string;
  accountName: string;
  region: string;
  bucketName: string;
  backupDate: string;
  serverName: string;
  folderExists: boolean;
  sizeBytes: number;
  status: string;
  raw: Record<string, unknown>;
  collectedAt: string;
};

type LogSummary = {
  total: number;
  byProvider: Array<{ provider: string; total: number }>;
  byStatus: Array<{ status: string; total: number }>;
  byAccount: Array<{ provider: string; accountId: string; accountName: string; total: number }>;
  byDate: Array<{ backupDate: string; total: number }>;
  totalBytes: number;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDateDisplay(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function statusStyle(status: string): string {
  const s = status.toUpperCase();
  if (s === "COMPLETED") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (s === "EMPTY") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  if (s === "NO_BACKUP") return "bg-red-500/10 text-red-400 border-red-500/20";
  return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
}

function statusIcon(status: string) {
  const s = status.toUpperCase();
  if (s === "COMPLETED") return <CheckCircle2 size={12} className="text-emerald-400" />;
  if (s === "EMPTY") return <AlertTriangle size={12} className="text-amber-400" />;
  if (s === "NO_BACKUP") return <XCircle size={12} className="text-red-400" />;
  return null;
}

export default function LogBackupsTab() {
  const [records, setRecords] = useState<LogBackupRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [summary, setSummary] = useState<LogSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("");
  const [status, setStatus] = useState("");
  const [backupDate, setBackupDate] = useState("");

  const fetchData = useCallback(async (p: number, ps: number) => {
    const params = new URLSearchParams({ page: String(p), pageSize: String(ps) });
    if (provider) params.set("provider", provider);
    if (status) params.set("status", status);
    if (backupDate) params.set("backupDate", backupDate);
    if (search.trim()) params.set("search", search.trim());
    const res = await fetch(`/api/backups/logs?${params.toString()}`);
    if (!res.ok) throw new Error("No se pudieron cargar los backups de logs");
    const json = await res.json();
    setRecords(json.records || []);
    setTotal(json.total || 0);
    setSummary(json.summary || null);
  }, [provider, status, backupDate, search]);

  useEffect(() => {
    setLoading(true);
    fetchData(page, pageSize).catch(() => toast.error("Error cargando backups de logs")).finally(() => setLoading(false));
  }, [page, pageSize, fetchData]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const completedCount = (summary?.byStatus || []).filter((s) => s.status === "COMPLETED").reduce((a, s) => a + s.total, 0);
  const emptyCount = (summary?.byStatus || []).filter((s) => s.status === "EMPTY").reduce((a, s) => a + s.total, 0);
  const noBackupCount = (summary?.byStatus || []).filter((s) => s.status === "NO_BACKUP").reduce((a, s) => a + s.total, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total registros", value: summary?.total ?? 0, icon: FileText, color: "#8b5cf6" },
          { label: "Con backup", value: completedCount, icon: CheckCircle2, color: "#10b981" },
          { label: "Vacíos (0B)", value: emptyCount, icon: AlertTriangle, color: "#f59e0b" },
          { label: "Sin carpeta", value: noBackupCount, icon: XCircle, color: "#ef4444" },
          { label: "Almacenado", value: formatBytes(summary?.totalBytes ?? 0), icon: HardDrive, color: "#06b6d4" },
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

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--glass-bg)] backdrop-blur-xl overflow-hidden">
        <div className="p-4 flex flex-col xl:flex-row gap-3">
          <div className="relative flex-1 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/40" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); fetchData(1, pageSize); }}} placeholder="Buscar servidor, bucket, cuenta..." className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/10 outline-none focus:border-cyan-500/40 placeholder:text-[var(--text-secondary)]/40 transition-all" />
            {search && <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5"><X size={16} className="text-[var(--text-secondary)]" /></button>}
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <select value={provider} onChange={(e) => { setProvider(e.target.value); setPage(1); }} className="control h-10 min-w-[130px]">
              <option value="">Toda nube</option>
              <option value="AWS">AWS (Siga)</option>
              <option value="HUAWEI CLOUD">Huawei Cloud</option>
            </select>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="control h-10 min-w-[130px]">
              <option value="">Todo estado</option>
              <option value="COMPLETED">Con backup</option>
              <option value="EMPTY">Vacío (0B)</option>
              <option value="NO_BACKUP">Sin carpeta</option>
            </select>
            {summary?.byDate && summary.byDate.length > 0 && (
              <select value={backupDate} onChange={(e) => { setBackupDate(e.target.value); setPage(1); }} className="control h-10 min-w-[140px]">
                <option value="">Toda fecha</option>
                {summary.byDate.map((d) => <option key={d.backupDate} value={d.backupDate}>{formatDateDisplay(d.backupDate)} ({d.total})</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

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
          <table className="w-full" style={{ minWidth: 800 }}>
            <thead className="bg-[var(--bg-hover)]/60 border-b border-[var(--border)]">
              <tr>
                {["Nube", "Cuenta", "Bucket", "Fecha", "Servidor", "Estado", "Tamaño"].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-[11px] uppercase tracking-wider text-[var(--text-secondary)] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-[var(--text-secondary)]">Cargando backups de logs...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center">
                  <FileText size={28} className="mx-auto mb-3 text-[var(--text-secondary)]/40" />
                  <p className="text-sm font-medium">Sin backups de logs registrados</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">Ejecuta "Refrescar ahora" para validar los buckets de logs S3 y OBS.</p>
                </td></tr>
              ) : records.map((r) => (
                <tr key={r.id} className={`border-b border-[var(--border)] transition ${r.status !== "COMPLETED" ? "hover:bg-red-500/5" : "hover:bg-[var(--bg-hover)]/40"}`}>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium whitespace-nowrap ${r.provider === "AWS" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                      {r.provider === "AWS" ? <Cloud size={12} /> : <HardDrive size={12} />}
                      {r.provider === "AWS" ? "AWS" : "Huawei"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-xs font-medium truncate max-w-[120px]">{r.accountName}</p>
                  </td>
                  <td className="px-3 py-3 text-xs text-[var(--text-secondary)] truncate max-w-[160px]">{r.bucketName}</td>
                  <td className="px-3 py-3 text-xs whitespace-nowrap font-mono">{formatDateDisplay(r.backupDate)}</td>
                  <td className="px-3 py-3 text-xs font-medium truncate max-w-[240px]">{r.serverName}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] border font-medium whitespace-nowrap ${statusStyle(r.status)}`}>
                      {statusIcon(r.status)}
                      {r.status === "COMPLETED" ? "OK" : r.status === "EMPTY" ? "Vacío (0B)" : r.status === "NO_BACKUP" ? "Sin backup" : r.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs whitespace-nowrap tabular-nums">{formatBytes(r.sizeBytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
