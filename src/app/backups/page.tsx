"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
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
  Settings2,
  GripVertical,
  Lock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronUp,
  XCircle,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import { exportTableToXlsx } from "@/lib/exports/xlsx";
import ScrollToTop from "@/components/ui/ScrollToTop";
import RdsBackupsTab from "./RdsBackupsTab";
import LogBackupsTab from "./LogBackupsTab";

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

type ColumnDef = {
  key: string;
  label: string;
  fixed: boolean;
};

type ColPrefs = {
  order: string[];
  hidden: string[];
};

type SortConfig = {
  key: string;
  direction: "asc" | "desc";
};

const FIXED_KEYS = new Set(["provider", "accountName"]);

const ALL_BUILTIN_COLUMNS: ColumnDef[] = [
  { key: "provider", label: "Nube", fixed: true },
  { key: "accountName", label: "Cuenta", fixed: true },
  { key: "vaultName", label: "Vault", fixed: false },
  { key: "backupName", label: "Backup / Recurso", fixed: false },
  { key: "backupCreatedAt", label: "Fecha backup", fixed: false },
  { key: "status", label: "Estado", fixed: false },
  { key: "sizeBytes", label: "Tamaño", fixed: false },
  { key: "backupExpiresAt", label: "Expira", fixed: false },
];

const COL_PREFS_KEY = "backups-col-prefs";

function loadColPrefs(): ColPrefs | null {
  try {
    const raw = localStorage.getItem(COL_PREFS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveColPrefs(prefs: ColPrefs) {
  try {
    localStorage.setItem(COL_PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

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

function PaginationControls({ currentPage, totalPages, totalItems, pageSize, startIndex, endIndex, onPageChange, onPageSizeChange }: { currentPage: number; totalPages: number; totalItems: number; pageSize: number; startIndex: number; endIndex: number; onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void; }) {
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 5) { for (let i = 1; i <= totalPages; i++) pages.push(i); return pages; }
    pages.push(1);
    if (currentPage > 3) pages.push("ellipsis");
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
      <div className="flex items-center gap-3">
        <span className="text-xs text-[var(--text-primary)]/50">Mostrando {startIndex + 1} - {endIndex} de {totalItems} backups</span>
        <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))} className="rounded-lg border border-[var(--border)] bg-[var(--bg-hover)] text-xs text-[var(--text-primary)]/70 px-2 py-1 outline-none cursor-pointer">
          {[10, 25, 50, 100].map((s) => (<option key={s} value={s}>{s} por página</option>))}
        </select>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)]/50 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"><ChevronLeft className="w-4 h-4" /></button>
        {getPageNumbers().map((p, i) => p === "ellipsis" ? <span key={`e-${i}`} className="px-2 text-xs text-[var(--text-primary)]/30">…</span> : (
          <button key={p} type="button" onClick={() => onPageChange(p)} className={`min-w-[32px] h-8 rounded-lg text-xs font-medium transition-all ${p === currentPage ? "bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30" : "border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)]/50 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"}`}>{p}</button>
        ))}
        <button type="button" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)]/50 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"><ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

function SortableColumnItem({ col, isHidden, onToggle, showDivider }: { col: { key: string; label: string; fixed: boolean }; isHidden: boolean; onToggle: (key: string) => void; showDivider?: boolean; }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.key, disabled: col.fixed });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <>
      {showDivider && <div className="my-1 mx-2 border-t border-[var(--border)]/50" />}
      <div ref={setNodeRef} style={style} className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs ${isHidden ? "opacity-40" : ""} ${isDragging ? "bg-[var(--bg-hover)] shadow-lg border border-cyan-400/20" : "hover:bg-[var(--bg-hover)]/50"} transition-all`}>
        {col.fixed ? (
          <Lock className="w-3.5 h-3.5 text-[var(--text-primary)]/20 flex-shrink-0" />
        ) : (
          <button type="button" className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-primary)]/25 hover:text-[var(--text-primary)]/50 transition-all flex-shrink-0 touch-none" {...attributes} {...listeners}>
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        )}
        {col.fixed ? (
          <span className="flex-1 truncate text-[var(--text-primary)]/50 font-medium">{col.label}</span>
        ) : (
          <label className="flex items-center gap-2 flex-1 cursor-pointer select-none">
            <input type="checkbox" checked={!isHidden} onChange={() => onToggle(col.key)} className="w-3.5 h-3.5 rounded border-[var(--border)] bg-transparent accent-cyan-500 cursor-pointer" />
            <span className={`truncate ${isHidden ? "text-[var(--text-primary)]/40" : "text-[var(--text-primary)]/80"}`}>{col.label}</span>
          </label>
        )}
      </div>
    </>
  );
}

export default function BackupsPage() {
  const [activeTab, setActiveTab] = useState<"servers" | "rds" | "logs">("servers");
  const [records, setRecords] = useState<BackupRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
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
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: "backupCreatedAt", direction: "desc" });

  const [prefsOpen, setPrefsOpen] = useState(false);
  const prefsBtnRef = useRef<HTMLButtonElement>(null);
  const prefsPanelRef = useRef<HTMLDivElement>(null);

  const [colPrefs, setColPrefs] = useState<ColPrefs>(() => {
    const saved = loadColPrefs();
    if (saved) return saved;
    return { order: ALL_BUILTIN_COLUMNS.map((c) => c.key), hidden: [] };
  });

  const updateColPrefs = useCallback((updater: (prev: ColPrefs) => ColPrefs) => {
    setColPrefs((prev) => {
      const next = updater(prev);
      saveColPrefs(next);
      return next;
    });
  }, []);

  useEffect(() => {
    setColPrefs((prev) => {
      const existingKeys = new Set(prev.order);
      let changed = false;
      const newOrder = [...prev.order];
      for (const col of ALL_BUILTIN_COLUMNS) {
        if (!existingKeys.has(col.key)) {
          newOrder.push(col.key);
          changed = true;
        }
      }
      if (!changed) return prev;
      const result = { ...prev, order: newOrder };
      saveColPrefs(result);
      return result;
    });
  }, []);

  const hiddenSet = useMemo(() => new Set(colPrefs.hidden), [colPrefs.hidden]);

  const visibleColumns = useMemo(() => {
    const builtinMap = new Map(ALL_BUILTIN_COLUMNS.map((c) => [c.key, c]));
    return colPrefs.order
      .filter((key) => !hiddenSet.has(key))
      .map((key) => {
        const builtin = builtinMap.get(key);
        return builtin ? { key, label: builtin.label, fixed: builtin.fixed } : null;
      })
      .filter(Boolean) as { key: string; label: string; fixed: boolean }[];
  }, [colPrefs.order, hiddenSet]);

  const allColumnsForPrefs = useMemo(() => {
    const builtinMap = new Map(ALL_BUILTIN_COLUMNS.map((c) => [c.key, c]));
    return colPrefs.order.map((key) => {
      const builtin = builtinMap.get(key);
      return builtin ? { key, label: builtin.label, fixed: builtin.fixed } : null;
    }).filter(Boolean) as { key: string; label: string; fixed: boolean }[];
  }, [colPrefs.order]);

  const handleToggleCol = useCallback((key: string) => {
    updateColPrefs((prev) => {
      if (FIXED_KEYS.has(key)) return prev;
      const hidden = prev.hidden.includes(key) ? prev.hidden.filter((k) => k !== key) : [...prev.hidden, key];
      return { ...prev, hidden };
    });
  }, [updateColPrefs]);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    updateColPrefs((prev) => {
      const oldIdx = prev.order.indexOf(active.id as string);
      const newIdx = prev.order.indexOf(over.id as string);
      if (oldIdx === -1 || newIdx === -1) return prev;
      const newOrder = arrayMove(prev.order, oldIdx, newIdx);
      const fixedKeys = newOrder.filter((k) => FIXED_KEYS.has(k));
      const nonFixedKeys = newOrder.filter((k) => !FIXED_KEYS.has(k));
      return { ...prev, order: [...fixedKeys, ...nonFixedKeys] };
    });
  }, [updateColPrefs]);

  useEffect(() => {
    if (!prefsOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (prefsBtnRef.current && prefsBtnRef.current.contains(e.target as Node)) return;
      if (prefsPanelRef.current && !prefsPanelRef.current.contains(e.target as Node)) setPrefsOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPrefsOpen(false); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("keydown", handleKey); };
  }, [prefsOpen]);

  const fetchData = useCallback(async (p: number, ps: number, signal?: AbortSignal) => {
    const params = buildFilterParams(p, ps, { provider, accountId, status, resourceType, search, from, to });
    const res = await fetch(`/api/backups?${params.toString()}`, { signal });
    if (!res.ok) throw new Error("No se pudieron cargar los backups");
    const json = await res.json();
    setRecords(json.records || []);
    setTotal(json.total || 0);
    setSummary(json.summary || null);
    setLastRefresh(json.lastRefresh || null);
  }, [provider, accountId, status, resourceType, search, from, to]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchData(page, pageSize, controller.signal).catch((e) => {
      if (e?.name !== "AbortError") toast.error("Error cargando backups");
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [page, pageSize, fetchData]);

  const applyFilters = () => {
    if (from && to && from > to) {
      toast.error("El rango de fechas es inválido: 'Desde' es posterior a 'Hasta'");
      return;
    }
    if (page === 1) {
      setLoading(true);
      fetchData(1, pageSize).catch(() => toast.error("Error cargando backups")).finally(() => setLoading(false));
    } else {
      setPage(1);
    }
  };

  const clearFilters = () => {
    setSearch(""); setProvider(""); setAccountId(""); setStatus(""); setResourceType(""); setFrom(""); setTo(""); setPage(1);
  };

  const handleProviderChange = (value: string) => {
    setProvider(value);
    setAccountId("");
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
      await fetchData(1, pageSize);
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
        if (p > 50) break;
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
          { key: "createdBogota", header: "Fecha backup (Colombia)", width: 20 },
          { key: "expiresBogota", header: "Expira (Colombia)", width: 20 },
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

  const filteredAccounts = useMemo(() => {
    if (!provider) return filterOptions.accounts;
    return filterOptions.accounts.filter((a) => a.provider === provider);
  }, [provider, filterOptions.accounts]);

  const filteredResourceTypes = useMemo(() => {
    if (!provider) return filterOptions.resourceTypes;
    return [...new Set(records.filter((r) => r.provider === provider).map((r) => r.resourceType).filter(Boolean))];
  }, [provider, records, filterOptions.resourceTypes]);

  const sortedRecords = useMemo(() => {
    if (!sortConfig) return records;
    const { key, direction } = sortConfig;
    return [...records].sort((a, b) => {
      let valA: string, valB: string;
      switch (key) {
        case "provider": valA = a.provider; valB = b.provider; break;
        case "accountName": valA = a.accountName; valB = b.accountName; break;
        case "vaultName": valA = a.vaultName || ""; valB = b.vaultName || ""; break;
        case "backupName": valA = a.backupName || ""; valB = b.backupName || ""; break;
        case "backupCreatedAt": valA = a.backupCreatedAt || ""; valB = b.backupCreatedAt || ""; break;
        case "status": valA = a.status; valB = b.status; break;
        case "sizeBytes": valA = String(a.sizeBytes ?? -1); valB = String(b.sizeBytes ?? -1); break;
        case "backupExpiresAt": valA = a.backupExpiresAt || ""; valB = b.backupExpiresAt || ""; break;
        default: valA = ""; valB = "";
      }
      const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: "base" });
      return direction === "asc" ? cmp : -cmp;
    });
  }, [records, sortConfig]);

  const handleSort = useCallback((key: string) => {
    setSortConfig((prev) => { if (prev && prev.key === key) return prev.direction === "asc" ? { key, direction: "desc" } : null; return { key, direction: "asc" }; });
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safeCurrentPage = Math.min(page, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);

  const awsCount = summary?.byProvider.find((p) => p.provider === "AWS")?.total || 0;
  const huaweiCount = summary?.byProvider.find((p) => p.provider === "HUAWEI CLOUD")?.total || 0;
  const okCount = (summary?.byStatus || []).filter((s) => ["COMPLETED", "AVAILABLE"].includes(s.status.toUpperCase())).reduce((a, s) => a + s.total, 0);
  const failedCount = (summary?.byStatus || []).filter((s) => ["FAILED", "ERROR"].includes(s.status.toUpperCase())).reduce((a, s) => a + s.total, 0);
  const okRate = summary?.total ? Math.round((okCount / summary.total) * 100) : 0;
  const failedRate = summary?.total ? Math.round((failedCount / summary.total) * 100) : 0;

  const activeFilterCount = (provider ? 1 : 0) + (accountId ? 1 : 0) + (status ? 1 : 0) + (resourceType ? 1 : 0) + (from ? 1 : 0) + (to ? 1 : 0);

  const getCellValue = (r: BackupRecord, key: string) => {
    switch (key) {
      case "provider":
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium whitespace-nowrap ${r.provider === "AWS" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
            {r.provider === "AWS" ? <Cloud size={12} /> : <HardDrive size={12} />}
            {r.provider === "AWS" ? "AWS" : "Huawei"}
          </span>
        );
      case "accountName":
        return (
          <div className="text-xs">
            <p className="font-medium truncate max-w-[160px]">{r.accountName}</p>
            <p className="text-[var(--text-secondary)] truncate max-w-[160px]">{r.region}</p>
          </div>
        );
      case "vaultName":
        return <span className="text-xs truncate max-w-[180px] block">{r.vaultName || "—"}</span>;
      case "backupName":
        return (
          <div>
            <p className="text-sm font-semibold truncate max-w-[260px]">{r.backupName || "—"}</p>
            <p className="text-xs text-[var(--text-secondary)] truncate max-w-[260px]">{r.resourceName || r.resourceId} {r.resourceType && <span className="ml-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[10px]">{r.resourceType}</span>}</p>
          </div>
        );
      case "backupCreatedAt":
        return <span className="text-xs whitespace-nowrap">{formatBogota(r.backupCreatedAt)}</span>;
      case "status":
        return <span className={`px-2.5 py-1 rounded-full text-[10px] border font-medium whitespace-nowrap ${statusStyle(r.status)}`}>{r.status}</span>;
      case "sizeBytes":
        return <span className="text-xs whitespace-nowrap tabular-nums">{formatBytes(r.sizeBytes)}</span>;
      case "backupExpiresAt":
        return <span className="text-xs whitespace-nowrap text-[var(--text-secondary)]">{formatBogota(r.backupExpiresAt)}</span>;
      default:
        return null;
    }
  };

  const handlePageSizeChange = useCallback((size: number) => { setPageSize(size); setPage(1); }, []);
  const handlePageChange = useCallback((p: number) => { setPage(p); }, []);

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .page-section { animation: fadeUp 0.4s ease both; }
      `}</style>

      <div className="page-section">
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
                   Bitácora diaria · AWS Backup + Huawei CBR · refresco automático 10:00 hora Colombia
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
              <button onClick={exportXlsx} disabled={total === 0 || exporting} className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/60 text-sm flex items-center gap-2 hover:bg-[var(--bg-hover)] disabled:opacity-40 transition-all">
                <Download size={16} /> {exporting ? "Generando..." : "Excel"}
              </button>
              <button onClick={handleRefresh} disabled={refreshing} className="px-4 py-2.5 rounded-xl bg-cyan-600 text-white text-sm flex items-center gap-2 hover:bg-cyan-500 disabled:opacity-50 transition-all">
                <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /> Refrescar ahora
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="page-section" style={{ animationDelay: "0.02s" }}>
        <div className="flex gap-1 p-1 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/60 backdrop-blur-xl w-fit">
          {([
            { key: "servers" as const, label: "Servidores", icon: Archive },
            { key: "rds" as const, label: "Base de datos", icon: Database },
            { key: "logs" as const, label: "Logs transaccionales", icon: FileText },
          ] as const).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? "bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]/50 border border-transparent"}`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "rds" && <RdsBackupsTab />}
      {activeTab === "logs" && <LogBackupsTab />}

      {activeTab === "servers" && (
      <>
      <div className="page-section" style={{ animationDelay: "0.05s" }}>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {[
            { label: "Total backups", value: summary?.total ?? 0, sub: "en bitácora", icon: Database, color: "#8b5cf6" },
            { label: "AWS Backup", value: awsCount, sub: "EC2 + EBS", icon: Cloud, color: "#f59e0b" },
            { label: "Huawei CBR", value: huaweiCount, sub: "vaults", icon: HardDrive, color: "#ef4444" },
            { label: "Exitosos", value: `${okRate}%`, sub: `${okCount} completados · ${failedRate}% fallidos`, icon: CheckCircle2, color: "#10b981" },
            { label: "Almacenado", value: formatBytes(summary?.totalBytes ?? 0), sub: "tamaño reportado", icon: Archive, color: "#06b6d4" },
          ].map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="rounded-2xl border border-[var(--border)] p-4 bg-[var(--bg-card)]/80 backdrop-blur-xl transition-all duration-200 hover:border-[var(--border)]/80 hover:shadow-lg">
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
      </div>

      {failedAccounts.length > 0 && (
        <div className="page-section rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4 space-y-3" style={{ animationDelay: "0.1s" }}>
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

      <div className="page-section" style={{ animationDelay: "0.1s" }}>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--glass-bg)] backdrop-blur-xl overflow-hidden">
          <div className="p-4 flex flex-col xl:flex-row gap-3">
            <div className="relative flex-1 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/40 group-focus-within:text-cyan-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
                placeholder="Buscar backup, servidor, vault, ID de recurso..."
                className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/10 outline-none focus:border-cyan-500/40 placeholder:text-[var(--text-secondary)]/40 transition-all"
              />
              {search && <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda" className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5"><X size={16} className="text-[var(--text-secondary)]" /></button>}
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <select value={provider} onChange={(e) => handleProviderChange(e.target.value)} aria-label="Filtrar por nube" className="control h-10 min-w-[130px]">
                <option value="">Toda nube</option>
                <option value="AWS">AWS</option>
                <option value="HUAWEI CLOUD">Huawei Cloud</option>
              </select>
              <button onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters} className={`px-4 h-10 rounded-xl border text-sm flex items-center gap-2 transition-all ${showFilters ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400" : "bg-[var(--bg-card)]/60 border-[var(--border)]"}`}>
                <Filter size={16} /> Filtros
                {activeFilterCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">{activeFilterCount}</span>}
              </button>
              <button onClick={applyFilters} className="px-5 h-10 rounded-xl bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-500 transition-all">Buscar</button>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="px-3 h-10 rounded-xl border border-[var(--border)] text-xs flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all">
                  <X size={14} /> Limpiar
                </button>
              )}
            </div>
          </div>
          {showFilters && (
            <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 border-t border-white/5 pt-3">
              <label className="block">
                <span className="text-[11px] uppercase tracking-widest text-[var(--text-secondary)]">Cuenta{provider ? ` (${provider === "AWS" ? "AWS" : "Huawei Cloud"})` : ""}</span>
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="control h-10 mt-1">
                  <option value="">Todas</option>
                  {filteredAccounts.map((a) => <option key={`${a.provider}|${a.id}`} value={a.id}>{a.provider === "AWS" ? "AWS" : "Huawei"} · {a.name}</option>)}
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
                <span className="text-[11px] uppercase tracking-widest text-[var(--text-secondary)]">Tipo recurso{provider ? ` (${provider === "AWS" ? "AWS" : "Huawei Cloud"})` : ""}</span>
                <select value={resourceType} onChange={(e) => setResourceType(e.target.value)} className="control h-10 mt-1">
                  <option value="">Todos</option>
                  {filteredResourceTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-widest text-[var(--text-secondary)]">Desde</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="control h-10 mt-1" />
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-widest text-[var(--text-secondary)]">Hasta</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="control h-10 mt-1" />
              </label>
            </div>
          )}
          <div className="px-4 py-2.5 flex items-center gap-3 text-xs border-t border-white/5 bg-[var(--bg-hover)]/20">
            <span className="text-[var(--text-secondary)]">Mostrando</span><span className="font-semibold">{records.length}</span>
            <span className="text-[var(--text-secondary)]">de</span><span className="font-semibold">{total}</span>
            <span className="text-[var(--text-secondary)]">backups</span>
            <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]"><CalendarDays size={12} /> Fechas en hora Colombia (UTC-5)</span>
          </div>
        </div>
      </div>

      <div className="page-section" style={{ animationDelay: "0.15s" }}>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]/60 backdrop-blur-xl overflow-hidden">
          <div className="p-4 flex items-center gap-3 flex-wrap border-b border-[var(--border)]/50">
            <div className="flex-1" />
            <div className="relative">
              <button type="button" ref={prefsBtnRef} onClick={() => setPrefsOpen((p) => !p)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)]/60 text-xs font-medium text-[var(--text-primary)]/50 hover:text-[var(--text-primary)]/80 hover:border-cyan-400/30 hover:bg-[var(--bg-hover)] transition-all" title="Preferencias de columnas">
                <Settings2 className="w-4 h-4" />
              </button>
              {prefsOpen && (
                <div ref={prefsPanelRef} className="absolute top-full right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] max-h-[480px] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[0_18px_50px_rgba(0,0,0,0.42)] z-50">
                  <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Preferencias</p>
                      <p className="text-[11px] text-[var(--text-primary)]/40 mt-0.5">Arrastra para reordenar · marca para mostrar</p>
                    </div>
                    <button type="button" onClick={() => setPrefsOpen(false)} className="p-1 rounded text-[var(--text-primary)]/30 hover:text-[var(--text-primary)]/70 hover:bg-[var(--bg-hover)] transition-all"><X className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="p-2">
                    <DndContext sensors={dndSensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
                      <SortableContext items={allColumnsForPrefs.map((c) => c.key)} strategy={verticalListSortingStrategy}>
                        {allColumnsForPrefs.map((col, idx) => {
                          const prevCol = idx > 0 ? allColumnsForPrefs[idx - 1] : null;
                          const showDivider = !!(prevCol && prevCol.fixed && !col.fixed);
                          return (
                            <SortableColumnItem key={col.key} col={col} isHidden={hiddenSet.has(col.key)} onToggle={handleToggleCol} showDivider={showDivider} />
                          );
                        })}
                      </SortableContext>
                    </DndContext>
                  </div>
                  <div className="px-4 py-2.5 border-t border-[var(--border)] flex items-center justify-between">
                    <span className="text-[10px] text-[var(--text-primary)]/30">{hiddenSet.size} oculta{hiddenSet.size !== 1 ? "s" : ""} · {allColumnsForPrefs.length - hiddenSet.size} visible{((allColumnsForPrefs.length - hiddenSet.size) !== 1) ? "s" : ""}</span>
                    <button type="button" onClick={() => updateColPrefs(() => ({ order: ALL_BUILTIN_COLUMNS.map((c) => c.key), hidden: [] }))} className="text-[10px] text-cyan-400/70 hover:text-cyan-300 transition-colors">Restaurar</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {total > pageSize && <PaginationControls currentPage={safeCurrentPage} totalPages={totalPages} totalItems={total} pageSize={pageSize} startIndex={startIndex} endIndex={endIndex} onPageChange={handlePageChange} onPageSizeChange={handlePageSizeChange} />}

          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 900 }}>
              <thead className="bg-[var(--bg-hover)]/60 border-b border-[var(--border)] sticky top-0 z-10 backdrop-blur-xl">
                <tr>
                  {visibleColumns.map((col) => {
                    const isSorted = sortConfig?.key === col.key;
                    return (
                      <th key={col.key} className="px-3 py-3 text-left text-[11px] uppercase tracking-wider text-[var(--text-secondary)] whitespace-nowrap group/th">
                        <button type="button" onClick={() => handleSort(col.key)} className="flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]/80">
                          {col.label}
                          {isSorted ? (sortConfig!.direction === "asc" ? <ArrowUp className="w-3 h-3 text-cyan-400" /> : <ArrowDown className="w-3 h-3 text-cyan-400" />) : <ArrowUpDown className="w-3 h-3 opacity-0 group-hover/th:opacity-40 transition-opacity" />}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={visibleColumns.length} className="px-6 py-12 text-center text-sm text-[var(--text-secondary)]">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex gap-1.5">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                      <span>Cargando bitácora de backups...</span>
                    </div>
                  </td></tr>
                ) : sortedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length} className="px-6 py-12 text-center">
                      <Archive size={28} className="mx-auto mb-3 text-[var(--text-secondary)]/40" />
                      <p className="text-sm font-medium">Sin backups registrados</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">Ejecuta "Refrescar ahora" para recolectar AWS Backup y Huawei CBR, o ajusta los filtros.</p>
                    </td>
                  </tr>
                ) : sortedRecords.map((r) => (
                  <tr key={r.id} onClick={() => setSelected(r)} className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)]/40 transition cursor-pointer group/row">
                    {visibleColumns.map((col) => (
                      <td key={col.key} className="px-3 py-3">{getCellValue(r, col.key)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > pageSize && <PaginationControls currentPage={safeCurrentPage} totalPages={totalPages} totalItems={total} pageSize={pageSize} startIndex={startIndex} endIndex={endIndex} onPageChange={handlePageChange} onPageSizeChange={handlePageSizeChange} />}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-xs text-[var(--text-secondary)]">{selected.provider} · {selected.accountName} · {selected.region}</p>
                <h2 className="text-lg font-bold break-all">{selected.backupName}</h2>
                <p className="text-xs font-mono text-[var(--text-secondary)] break-all mt-1">{selected.backupId}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Cerrar detalle" className="p-2 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-all"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {[
                ["Vault", selected.vaultName || "—"],
                ["Recurso", selected.resourceName || selected.resourceId || "—"],
                ["ID recurso", selected.resourceId || "—"],
                ["Tipo recurso", selected.resourceType || "—"],
                ["Estado", selected.status],
                ["Tamaño", formatBytes(selected.sizeBytes)],
                ["Creado (Colombia)", formatBogota(selected.backupCreatedAt)],
                ["Completado (Colombia)", formatBogota(selected.backupCompletedAt)],
                ["Expira (Colombia)", formatBogota(selected.backupExpiresAt)],
                ["Recolectado", formatBogota(selected.collectedAt)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-[var(--border)] bg-black/20 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">{k}</p>
                  <p className="mt-1 break-all font-medium">{v}</p>
                </div>
              ))}
            </div>
            <details className="mt-4 text-xs">
              <summary className="cursor-pointer text-[var(--text-secondary)] hover:text-white transition-colors">Ver datos crudos de la nube</summary>
              <pre className="mt-2 rounded-xl border border-[var(--border)] bg-black/30 p-3 overflow-auto max-h-64 text-[11px] leading-relaxed">{JSON.stringify(selected.raw, null, 2)}</pre>
            </details>
          </div>
        </div>
      )}

      {!lastRefresh && !loading && (
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] p-4 flex items-start gap-3 text-sm">
          <AlertTriangle size={18} className="text-cyan-300 mt-0.5" />
          <p className="text-[var(--text-secondary)] text-xs leading-relaxed">
            Aún no hay refrescos registrados. El programador corre a diario a las <strong className="text-white">10:00 hora Colombia</strong>.
            Puedes adelantar la primera carga con <strong className="text-white">"Refrescar ahora"</strong>. Si alguna cuenta falla por permisos, verás aquí el detalle y el permiso requerido.
          </p>
        </div>
      )}

      </>
      )}

      <ScrollToTop />
    </div>
  );
}
