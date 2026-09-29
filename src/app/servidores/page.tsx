"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  Server,
  Download,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Pencil,
  X,
  Search,
  RefreshCw,
  Columns3,
  CheckSquare,
  Square,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Filter,
  Settings2,
  GripVertical,
  Lock,
} from "lucide-react";
import Image from "next/image";

import { InventoryItem } from "@/types/inventory";
import StatusBadge from "@/components/inventory/StatusBadge";
import BrandLogo from "@/components/layout/BrandLogo";
import {
  exportInventoryToExcel,
  exportInventoryToPDF,
} from "@/lib/inventory/exportCsv";
import toast from "react-hot-toast";

type ServerColumn = {
  id: string;
  name: string;
  position: number;
  created_at: string;
};

type ServerColumnValue = {
  id: string;
  column_id: string;
  server_id: string;
  value: string;
  created_at: string;
  updated_at: string;
};

type SortConfig = {
  key: string;
  direction: "asc" | "desc";
};

type ColumnDef = {
  key: string;
  label: string;
  fixed: boolean;
};

const FIXED_KEYS = new Set(["provider", "accountName", "name"]);

const ALL_BUILTIN_COLUMNS: ColumnDef[] = [
  { key: "provider", label: "Provider", fixed: true },
  { key: "accountName", label: "Cuenta", fixed: true },
  { key: "name", label: "Nombre", fixed: true },
  { key: "instanceType", label: "Instance Type", fixed: false },
  { key: "status", label: "Estado", fixed: false },
  { key: "privateIp", label: "IP Privada", fixed: false },
  { key: "publicIp", label: "IP Pública", fixed: false },
  { key: "os", label: "OS", fixed: false },
  { key: "availabilityZone", label: "AZ", fixed: false },
  { key: "launchTime", label: "Launch Time", fixed: false },
];

const DEFAULT_VISIBLE = new Set(ALL_BUILTIN_COLUMNS.map((c) => c.key));

function getFieldValue(item: InventoryItem, key: string): string {
  switch (key) {
    case "provider": return item.provider || "";
    case "accountName": return item.accountName || "";
    case "name": return item.name || "";
    case "instanceType": return item.instanceType || "";
    case "status": return item.status || "";
    case "privateIp": return item.privateIp || "";
    case "publicIp": return item.publicIp || "";
    case "os": return item.operatingSystem || item.platform || "";
    case "availabilityZone": return item.availabilityZone || "";
    case "launchTime": return item.launchTime || "";
    default: return "";
  }
}

const COL_PREFS_KEY = "servidores-col-prefs";

type ColPrefs = {
  order: string[];
  hidden: string[];
};

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

function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-[#080c14] flex items-center justify-center z-50">
      <style jsx global>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .shimmer {
          background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
      `}</style>
      <div className="text-center space-y-6 flex flex-col items-center">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-2xl animate-ping opacity-20" style={{ background: "linear-gradient(135deg, #7c3aed, #06b6d4)" }} />
          <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl" style={{ background: "linear-gradient(135deg, #7c3aed, #06b6d4)" }}>
            <BrandLogo size={52} />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Inventario de Servidores</h1>
          <p className="text-[var(--text-primary)]/40 text-sm">Cargando servidores...</p>
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

function EditableCell({ columnId, serverId, initialValue, onSave }: { columnId: string; serverId: string; initialValue: string; onSave: (columnId: string, serverId: string, value: string) => void; }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setValue(initialValue); }, [initialValue]);
  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [editing]);

  const save = useCallback(() => {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed !== initialValue.trim()) onSave(columnId, serverId, trimmed);
  }, [columnId, serverId, value, initialValue, onSave]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") { setValue(initialValue); setEditing(false); }
  }, [save, initialValue]);

  if (editing) {
    return <input ref={inputRef} type="text" value={value} onChange={(e) => setValue(e.target.value)} onBlur={save} onKeyDown={handleKeyDown} className="w-full px-1 py-0.5 text-xs bg-[var(--bg-card)] border border-cyan-500/40 rounded text-[var(--text-primary)] outline-none" />;
  }

  return (
    <div className="group/cell relative flex items-center gap-1 min-h-[24px] cursor-pointer" onClick={() => setEditing(true)}>
      <span className="text-xs text-[var(--text-primary)]/70 truncate">{initialValue || <span className="text-[var(--text-primary)]/20">—</span>}</span>
      <Pencil className="w-3 h-3 text-[var(--text-primary)]/0 group-hover/cell:text-[var(--text-primary)]/30 transition-colors flex-shrink-0" />
    </div>
  );
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
        <span className="text-xs text-[var(--text-primary)]/50">Mostrando {startIndex + 1} - {endIndex} de {totalItems} servidores</span>
        <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))} className="rounded-lg border border-[var(--border)] bg-[var(--bg-hover)] text-xs text-[var(--text-primary)]/70 px-2 py-1 outline-none cursor-pointer">
          {[10, 50, 100, 500].map((s) => (<option key={s} value={s}>{s} por página</option>))}
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

export default function ServidoresPage() {
  const [allData, setAllData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [customColumns, setCustomColumns] = useState<ServerColumn[]>([]);
  const [columnValues, setColumnValues] = useState<ServerColumnValue[]>([]);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [addingColumn, setAddingColumn] = useState(false);
  const [deletingColumnId, setDeletingColumnId] = useState<string | null>(null);
  const [renamingColumnId, setRenamingColumnId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMenuPos, setExportMenuPos] = useState<{ top: number; right: number } | null>(null);
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const exportContainerRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const renameSavingRef = useRef<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkColumnId, setBulkColumnId] = useState("");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const tableScrollRef = useRef<HTMLDivElement>(null);

  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [filterProvider, setFilterProvider] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterAccount, setFilterAccount] = useState<string>("all");

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

  useEffect(() => {
    setColPrefs((prev) => {
      const existingKeys = new Set(prev.order);
      let changed = false;
      const newOrder = [...prev.order];
      for (const col of customColumns) {
        const ck = `custom:${col.id}`;
        if (!existingKeys.has(ck)) {
          newOrder.push(ck);
          changed = true;
        }
      }
      const removed = newOrder.filter((k) => {
        if (!k.startsWith("custom:")) return true;
        const id = k.slice(7);
        return customColumns.some((c) => c.id === id);
      });
      if (!changed && removed.length === newOrder.length) return prev;
      const result = { ...prev, order: removed };
      saveColPrefs(result);
      return result;
    });
  }, [customColumns]);

  const hiddenSet = useMemo(() => new Set(colPrefs.hidden), [colPrefs.hidden]);

  const visibleColumns = useMemo(() => {
    const builtinMap = new Map(ALL_BUILTIN_COLUMNS.map((c) => [c.key, c]));
    return colPrefs.order
      .filter((key) => !hiddenSet.has(key))
      .map((key) => {
        if (key.startsWith("custom:")) {
          const id = key.slice(7);
          const col = customColumns.find((c) => c.id === id);
          return col ? { key, label: col.name, fixed: false, isCustom: true, colId: id } : null;
        }
        const builtin = builtinMap.get(key);
        return builtin ? { key, label: builtin.label, fixed: builtin.fixed, isCustom: false } : null;
      })
      .filter(Boolean) as { key: string; label: string; fixed: boolean; isCustom: boolean; colId?: string }[];
  }, [colPrefs.order, hiddenSet, customColumns]);

  const allColumnsForPrefs = useMemo(() => {
    const builtinMap = new Map(ALL_BUILTIN_COLUMNS.map((c) => [c.key, c]));
    return colPrefs.order.map((key) => {
      if (key.startsWith("custom:")) {
        const id = key.slice(7);
        const col = customColumns.find((c) => c.id === id);
        return col ? { key, label: col.name, fixed: false } : null;
      }
      const builtin = builtinMap.get(key);
      return builtin ? { key, label: builtin.label, fixed: builtin.fixed } : null;
    }).filter(Boolean) as { key: string; label: string; fixed: boolean }[];
  }, [colPrefs.order, customColumns]);

  const serverData = useMemo(
    () => allData.filter((item) => (item.provider === "AWS" && item.service === "EC2") || (item.provider === "HUAWEI CLOUD" && item.service === "ECS")),
    [allData]
  );

  const uniqueProviders = useMemo(() => [...new Set(serverData.map((item) => item.provider || "AWS"))].sort(), [serverData]);
  const uniqueStatuses = useMemo(() => [...new Set(serverData.map((item) => item.status || "unknown"))].sort(), [serverData]);
  const uniqueAccounts = useMemo(() => [...new Set(serverData.map((item) => item.accountName || "N/A"))].sort(), [serverData]);

  const filteredData = useMemo(() => {
    let data = serverData;
    if (filterProvider !== "all") data = data.filter((item) => (item.provider || "AWS") === filterProvider);
    if (filterStatus !== "all") data = data.filter((item) => (item.status || "unknown") === filterStatus);
    if (filterAccount !== "all") data = data.filter((item) => (item.accountName || "N/A") === filterAccount);
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter((item) => item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q) || (item.privateIp || "").toLowerCase().includes(q) || (item.publicIp || "").toLowerCase().includes(q) || (item.accountName || "").toLowerCase().includes(q) || (item.instanceType || "").toLowerCase().includes(q) || (item.operatingSystem || item.platform || "").toLowerCase().includes(q));
    }
    return data;
  }, [serverData, search, filterProvider, filterStatus, filterAccount]);

  const getValueMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of columnValues) map.set(`${v.column_id}::${v.server_id}`, v.value);
    return map;
  }, [columnValues]);

  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;
    const { key, direction } = sortConfig;
    return [...filteredData].sort((a, b) => {
      let valA: string, valB: string;
      if (key.startsWith("custom:")) {
        const colId = key.slice(7);
        valA = getValueMap.get(`${colId}::${a.id}`) || "";
        valB = getValueMap.get(`${colId}::${b.id}`) || "";
      } else {
        valA = getFieldValue(a, key);
        valB = getFieldValue(b, key);
      }
      const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: "base" });
      return direction === "asc" ? cmp : -cmp;
    });
  }, [filteredData, sortConfig, getValueMap]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, sortedData.length);
  const paginatedData = useMemo(() => sortedData.slice(startIndex, endIndex), [sortedData, startIndex, endIndex]);

  const loadData = useCallback(async (initial = false) => {
    try {
      if (initial) setLoading(true); else setRefreshing(true);
      const invRes = await fetch("/api/inventory", { cache: "no-store" });
      const invJson = await invRes.json();
      setAllData(invJson.data || []);
      try {
        const [colsRes, valsRes] = await Promise.all([fetch("/api/server-columns", { cache: "no-store" }), fetch("/api/server-columns/values", { cache: "no-store" })]);
        const colsJson = await colsRes.json();
        const valsJson = await valsRes.json();
        setCustomColumns(colsJson.columns || []);
        setColumnValues(valsJson.values || []);
      } catch { setCustomColumns([]); setColumnValues([]); }
    } catch { toast.error("Error cargando inventario"); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  // Polling pausado con pestaña oculta y durante ediciones/bulk (no pisa el trabajo en curso).
  useEffect(() => {
    loadData(true);
    const interval = setInterval(() => {
      if (document.hidden) return;
      if (manageModalOpen || confirmModalOpen || selectedIds.size > 0) return;
      loadData(false);
    }, 30000);
    return () => clearInterval(interval);
  }, [loadData, manageModalOpen, confirmModalOpen, selectedIds.size]);

  const handleSaveValue = useCallback(async (columnId: string, serverId: string, value: string) => {
    try {
      if (!value) {
        await fetch("/api/server-columns/values", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ columnId, serverId }) });
        setColumnValues((prev) => prev.filter((v) => !(v.column_id === columnId && v.server_id === serverId)));
      } else {
        const res = await fetch("/api/server-columns/values", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ columnId, serverId, value }) });
        const json = await res.json();
        if (json.value) setColumnValues((prev) => { const idx = prev.findIndex((v) => v.column_id === columnId && v.server_id === serverId); if (idx >= 0) { const next = [...prev]; next[idx] = json.value; return next; } return [...prev, json.value]; });
      }
    } catch { toast.error("Error guardando valor"); }
  }, []);

  const handleBulkApply = useCallback(async () => {
    if (!bulkColumnId || !bulkValue.trim()) return;
    setBulkSaving(true);
    let successCount = 0;
    for (const serverId of selectedIds) {
      try {
        const res = await fetch("/api/server-columns/values", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ columnId: bulkColumnId, serverId, value: bulkValue.trim() }) });
        const json = await res.json();
        if (json.value) { setColumnValues((prev) => { const idx = prev.findIndex((v) => v.column_id === bulkColumnId && v.server_id === serverId); if (idx >= 0) { const next = [...prev]; next[idx] = json.value; return next; } return [...prev, json.value]; }); successCount++; }
      } catch {}
    }
    setBulkSaving(false); setConfirmModalOpen(false); setSelectedIds(new Set()); setBulkValue(""); setBulkColumnId("");
    if (successCount > 0) toast.success(`Valor aplicado a ${successCount} servidor(es)`); else toast.error("Error aplicando cambios");
  }, [bulkColumnId, bulkValue, selectedIds]);

  const handleAddColumn = useCallback(async () => {
    if (!newColumnName.trim()) return;
    setAddingColumn(true);
    try {
      const res = await fetch("/api/server-columns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newColumnName.trim() }) });
      const json = await res.json();
      if (json.column) { setCustomColumns((prev) => [...prev, json.column]); setNewColumnName(""); toast.success("Columna creada"); } else toast.error(json.error || "Error creando columna");
    } catch { toast.error("Error creando columna"); } finally { setAddingColumn(false); }
  }, [newColumnName]);

  const handleDeleteColumn = useCallback(async (id: string) => {
    try {
      await fetch("/api/server-columns", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      setCustomColumns((prev) => prev.filter((c) => c.id !== id));
      setColumnValues((prev) => prev.filter((v) => v.column_id !== id));
      setDeletingColumnId(null); toast.success("Columna eliminada");
    } catch { toast.error("Error eliminando columna"); }
  }, []);

  const handleRenameColumn = useCallback(async (id: string) => {
    // Enter + blur disparan doble guardado; el ref lo hace idempotente.
    if (renameSavingRef.current === id) return;
    if (!renameValue.trim()) { setRenamingColumnId(null); return; }
    renameSavingRef.current = id;
    try {
      const res = await fetch("/api/server-columns", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name: renameValue.trim() }) });
      const json = await res.json();
      if (json.column) { setCustomColumns((prev) => prev.map((c) => (c.id === id ? json.column : c))); toast.success("Columna renombrada"); } else toast.error(json.error || "Error renombrando columna");
    } catch { toast.error("Error renombrando columna"); } finally { renameSavingRef.current = null; setRenamingColumnId(null); }
  }, [renameValue]);

  const handleReorderColumns = useCallback(async (reordered: ServerColumn[]) => {
    setCustomColumns(reordered);
    try {
      const res = await fetch("/api/server-columns/reorder", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ columns: reordered.map((col, idx) => ({ id: col.id, position: idx + 1 })) }) });
      const json = await res.json();
      if (json.columns) setCustomColumns(json.columns);
    } catch { toast.error("Error reordenando columnas"); }
  }, []);

  useEffect(() => { if (renamingColumnId && renameInputRef.current) { renameInputRef.current.focus(); renameInputRef.current.select(); } }, [renamingColumnId]);

  useEffect(() => {
    if (!exportOpen) return;
    const updatePos = () => { const btn = exportBtnRef.current; if (!btn) return; const rect = btn.getBoundingClientRect(); const menuH = 174; const gap = 8; const top = rect.bottom + gap + menuH <= window.innerHeight ? rect.bottom + gap : Math.max(gap, rect.top - gap - menuH); setExportMenuPos({ top, right: Math.max(gap, window.innerWidth - rect.right) }); };
    const handleClick = (e: MouseEvent) => { if (exportContainerRef.current && !exportContainerRef.current.contains(e.target as Node) && exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportOpen(false); };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setExportOpen(false); };
    updatePos(); document.addEventListener("mousedown", handleClick); document.addEventListener("keydown", handleKey); window.addEventListener("resize", updatePos); window.addEventListener("scroll", updatePos, true);
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("keydown", handleKey); window.removeEventListener("resize", updatePos); window.removeEventListener("scroll", updatePos, true); };
  }, [exportOpen]);

  useEffect(() => { if (!manageModalOpen) return; const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setManageModalOpen(false); }; document.addEventListener("keydown", handleKey); return () => document.removeEventListener("keydown", handleKey); }, [manageModalOpen]);
  useEffect(() => { if (!confirmModalOpen) return; const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setConfirmModalOpen(false); }; document.addEventListener("keydown", handleKey); return () => document.removeEventListener("keydown", handleKey); }, [confirmModalOpen]);

  useEffect(() => {
    if (!prefsOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (prefsBtnRef.current && prefsBtnRef.current.contains(e.target as Node)) return;
      if (prefsPanelRef.current && !prefsPanelRef.current.contains(e.target as Node)) setPrefsOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPrefsOpen(false); };
    document.addEventListener("mousedown", handleClick); document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("keydown", handleKey); };
  }, [prefsOpen]);

  const handleSearchChange = useCallback((value: string) => { setSearch(value); setCurrentPage(1); }, []);
  const handlePageSizeChange = useCallback((size: number) => { setPageSize(size); setCurrentPage(1); }, []);
  const handlePageChange = useCallback((page: number) => { setCurrentPage(page); }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => { if (paginatedData.every((item) => prev.has(item.id))) { const next = new Set(prev); for (const item of paginatedData) next.delete(item.id); return next; } const next = new Set(prev); for (const item of paginatedData) next.add(item.id); return next; });
  }, [paginatedData]);

  const toggleSelectOne = useCallback((id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);

  const allPageSelected = paginatedData.length > 0 && paginatedData.every((item) => selectedIds.has(item.id));

  const formatLaunchTime = (t?: string) => { if (!t) return "—"; try { return new Date(t).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return t; } };

  const handleSort = useCallback((key: string) => {
    setSortConfig((prev) => { if (prev && prev.key === key) return prev.direction === "asc" ? { key, direction: "desc" } : null; return { key, direction: "asc" }; });
  }, []);

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

  const handleExportExcel = useCallback(() => {
    const customColData = customColumns.map((col) => ({ id: col.id, name: col.name }));
    void exportInventoryToExcel(sortedData, "servers-report.xlsx", customColData, getValueMap);
    setExportOpen(false);
  }, [sortedData, customColumns, getValueMap]);

  const handleExportPDF = useCallback(() => {
    const customColData = customColumns.map((col) => ({ id: col.id, name: col.name }));
    void exportInventoryToPDF(sortedData, "servers-report.pdf", customColData, getValueMap);
    setExportOpen(false);
  }, [sortedData, customColumns, getValueMap]);

  const activeFilterCount = (filterProvider !== "all" ? 1 : 0) + (filterStatus !== "all" ? 1 : 0) + (filterAccount !== "all" ? 1 : 0);

  const renderCellValue = (item: InventoryItem, col: { key: string; isCustom: boolean; colId?: string }) => {
    if (col.isCustom && col.colId) {
      const val = getValueMap.get(`${col.colId}::${item.id}`) || "";
      return <EditableCell columnId={col.colId} serverId={item.id} initialValue={val} onSave={handleSaveValue} />;
    }
    switch (col.key) {
      case "provider":
        return item.provider === "AWS" ? (
          <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium"><Image src="/logos/aws.svg" alt="AWS" width={16} height={16} />AWS</span>
        ) : (
          <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium"><Image src="/logos/huawei-buena.svg" alt="Huawei" width={16} height={16} />Huawei</span>
        );
      case "accountName": return <span className="text-xs text-[var(--text-primary)]/70 whitespace-nowrap">{item.accountName}</span>;
      case "name": return <span className="text-xs text-[var(--text-primary)] font-medium max-w-[200px] truncate block" title={item.name}>{item.name}</span>;
      case "instanceType": return <span className="text-xs text-[var(--text-primary)]/70 whitespace-nowrap font-mono">{item.instanceType || "—"}</span>;
      case "status": return <StatusBadge status={item.status} />;
      case "privateIp": return <span className="text-xs text-[var(--text-primary)]/70 whitespace-nowrap font-mono">{item.privateIp || "—"}</span>;
      case "publicIp": return <span className="text-xs text-[var(--text-primary)]/70 whitespace-nowrap font-mono">{item.publicIp || "—"}</span>;
      case "os": return <span className="text-xs text-[var(--text-primary)]/70 whitespace-nowrap">{item.operatingSystem || item.platform || "—"}</span>;
      case "availabilityZone": return <span className="text-xs text-[var(--text-primary)]/70 whitespace-nowrap">{item.availabilityZone || "—"}</span>;
      case "launchTime": return <span className="text-xs text-[var(--text-primary)]/70 whitespace-nowrap">{formatLaunchTime(item.launchTime)}</span>;
      default: return null;
    }
  };

  const getCellClassName = (col: { key: string; isCustom: boolean }) => {
    if (col.isCustom) return "px-4 py-3 bg-[var(--bg-hover)]/20 min-w-[120px]";
    if (col.key === "provider" || col.key === "status") return "px-4 py-3 whitespace-nowrap";
    return "px-4 py-3 whitespace-nowrap";
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      <style jsx global>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .page-section { animation: fadeUp 0.4s ease both; }
      `}</style>

      <div className="min-h-screen space-y-6">
        <div className="page-section">
          <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] p-5" style={{ background: "var(--glass-bg)", backdropFilter: "blur(16px)" }}>
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: "linear-gradient(135deg, var(--gradient-start), var(--gradient-end))" }} />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ background: "linear-gradient(135deg, var(--gradient-secondary-start), var(--gradient-secondary-end))" }} />
            <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl opacity-15" style={{ background: "linear-gradient(135deg, var(--gradient-start), var(--gradient-end))" }} />
                  <div className="relative w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-lg" style={{ background: "linear-gradient(135deg, var(--gradient-start), var(--gradient-end))" }}><Server size={18} /></div>
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Inventario de Servidores</h1>
                    {refreshing && <span className="flex items-center gap-1.5 text-[11px] text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded-full border border-cyan-400/20"><RefreshCw className="w-3 h-3 animate-spin" />Actualizando</span>}
                  </div>
                  <p className="text-sm text-[var(--text-primary)]/40 mt-0.5">EC2 (AWS) + ECS (Huawei Cloud) · <span className="text-[var(--text-primary)] font-semibold">{sortedData.length}</span> servidores</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setManageModalOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--border)] bg-[var(--bg-card)]/60 text-[var(--text-primary)]/70 transition-all duration-200 hover:border-cyan-400/30 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
                  <Columns3 className="w-4 h-4" />Manage Columns
                </button>
                <div className="relative" ref={exportContainerRef}>
                  <button type="button" ref={exportBtnRef} onClick={() => setExportOpen((p) => !p)} disabled={sortedData.length === 0} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/60 px-4 py-2.5 text-sm font-medium text-[var(--text-primary)]/70 transition-all duration-200 hover:border-cyan-400/30 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40">
                    <Download className="h-4 w-4" />Exportar<ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${exportOpen ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="page-section" style={{ animationDelay: "0.05s" }}>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
            <div className="p-4 flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px] group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-primary)]/20 pointer-events-none transition-colors group-focus-within:text-cyan-400/60" />
                <input type="text" placeholder="Buscar servidores..." value={search} onChange={(e) => handleSearchChange(e.target.value)} aria-label="Buscar servidores" className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none transition-all duration-200 bg-[var(--bg-hover)]/40 border border-[var(--border)] focus:border-cyan-500/40" />
                {search && <button type="button" onClick={() => handleSearchChange("")} aria-label="Limpiar búsqueda" className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-primary)]/30 hover:text-[var(--text-primary)]/70 transition-colors"><X className="w-4 h-4" /></button>}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-4 h-4 text-[var(--text-primary)]/30" aria-hidden />
                <select value={filterProvider} aria-label="Filtrar por proveedor" onChange={(e) => { setFilterProvider(e.target.value); setCurrentPage(1); }} className="rounded-lg border border-[var(--border)] bg-[var(--bg-hover)] text-xs text-[var(--text-primary)]/70 px-2 py-2 outline-none cursor-pointer min-w-[130px]">
                  <option value="all">Proveedor</option>
                  {uniqueProviders.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={filterStatus} aria-label="Filtrar por estado" onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }} className="rounded-lg border border-[var(--border)] bg-[var(--bg-hover)] text-xs text-[var(--text-primary)]/70 px-2 py-2 outline-none cursor-pointer min-w-[130px]">
                  <option value="all">Estado</option>
                  {uniqueStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filterAccount} aria-label="Filtrar por cuenta" onChange={(e) => { setFilterAccount(e.target.value); setCurrentPage(1); }} className="rounded-lg border border-[var(--border)] bg-[var(--bg-hover)] text-xs text-[var(--text-primary)]/70 px-2 py-2 outline-none cursor-pointer min-w-[140px]">
                  <option value="all">Cuenta</option>
                  {uniqueAccounts.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                {activeFilterCount > 0 && <button type="button" onClick={() => { setFilterProvider("all"); setFilterStatus("all"); setFilterAccount("all"); setCurrentPage(1); }} aria-label="Limpiar filtros" className="px-2 py-2 rounded-lg text-xs text-[var(--text-primary)]/40 hover:text-[var(--text-primary)]/70 hover:bg-[var(--bg-hover)] transition-all"><X className="w-3.5 h-3.5" /></button>}
              </div>

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
                      <button type="button" onClick={() => updateColPrefs(() => ({ order: [...ALL_BUILTIN_COLUMNS.map((c) => c.key), ...customColumns.map((c) => c.id)], hidden: [] }))} className="text-[10px] text-cyan-400/70 hover:text-cyan-300 transition-colors">Restaurar</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-[var(--text-primary)]/40">
                <span className="text-[var(--text-primary)] font-semibold tabular-nums">{sortedData.length}</span>de {serverData.length} servidores
              </div>
              {selectedIds.size > 0 && <span className="text-xs font-medium text-[var(--primary)] bg-[var(--primary)]/10 px-2.5 py-1 rounded-lg border border-[var(--primary)]/20">{selectedIds.size} seleccionado{selectedIds.size !== 1 ? "s" : ""}</span>}
            </div>

            {selectedIds.size > 0 && (
              <div className="mx-4 mb-3 rounded-lg border border-[var(--primary)]/20 bg-[var(--primary)]/5 p-3 flex items-center gap-3 flex-wrap">
                <AlertCircle className="w-4 h-4 text-[var(--primary)] flex-shrink-0" />
                <select value={bulkColumnId} onChange={(e) => setBulkColumnId(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--bg-hover)] text-xs text-[var(--text-primary)]/70 px-2 py-1.5 outline-none cursor-pointer min-w-[140px]">
                  <option value="">Seleccionar columna...</option>
                  {customColumns.map((col) => <option key={col.id} value={col.id}>{col.name}</option>)}
                </select>
                <input type="text" placeholder="Valor a aplicar..." value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-primary)] placeholder:text-[var(--text-primary)]/25 outline-none border border-[var(--border)] bg-[var(--bg-hover)]/50 focus:border-cyan-500/40 transition-all min-w-[160px]" />
                <button type="button" onClick={() => { if (!bulkColumnId || !bulkValue.trim()) { toast.error("Seleccione columna y valor"); return; } setConfirmModalOpen(true); }} disabled={bulkSaving || !bulkColumnId || !bulkValue.trim()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--primary)]/15 border border-[var(--primary)]/30 text-[var(--primary)] hover:bg-[var(--primary)]/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  {bulkSaving && <RefreshCw className="w-3 h-3 animate-spin" />}Aplicar
                </button>
                <button type="button" onClick={() => { setSelectedIds(new Set()); setBulkValue(""); setBulkColumnId(""); }} className="px-2 py-1.5 rounded-lg text-xs text-[var(--text-primary)]/40 hover:text-[var(--text-primary)]/70 hover:bg-[var(--bg-hover)] transition-all"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            {sortedData.length > pageSize && <PaginationControls currentPage={safeCurrentPage} totalPages={totalPages} totalItems={sortedData.length} pageSize={pageSize} startIndex={startIndex} endIndex={endIndex} onPageChange={handlePageChange} onPageSizeChange={handlePageSizeChange} />}

            <div ref={tableScrollRef} className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: "1100px" }}>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[var(--bg-card)] border-b border-[var(--border)]">
                    <th className="px-4 py-3 text-left w-[40px]">
                      <button type="button" onClick={toggleSelectAll} aria-label={allPageSelected ? "Deseleccionar página" : "Seleccionar página"} aria-pressed={allPageSelected} className="flex items-center justify-center rounded hover:opacity-80">
                        {allPageSelected ? <CheckSquare className="w-4 h-4 text-[var(--primary)]" /> : <Square className="w-4 h-4 text-[var(--text-primary)]/30" />}
                      </button>
                    </th>
                    {visibleColumns.map((col) => {
                      const isSorted = sortConfig?.key === col.key;
                      return (
                        <th key={col.key} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap group/th ${col.isCustom ? "text-cyan-400/70" : "text-[var(--text-primary)]/50"}`}>
                          <button type="button" onClick={() => handleSort(col.key)} className={`flex items-center gap-1 transition-colors ${col.isCustom ? "hover:text-cyan-300" : "hover:text-[var(--text-primary)]/80"}`}>
                            {col.label}
                            {isSorted ? (sortConfig!.direction === "asc" ? <ArrowUp className={`w-3 h-3 ${col.isCustom ? "text-cyan-300" : "text-cyan-400"}`} /> : <ArrowDown className={`w-3 h-3 ${col.isCustom ? "text-cyan-300" : "text-cyan-400"}`} />) : <ArrowUpDown className="w-3 h-3 opacity-0 group-hover/th:opacity-40 transition-opacity" />}
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/50">
                  {sortedData.length === 0 ? (
                    <tr><td colSpan={1 + visibleColumns.length} className="px-4 py-12 text-center text-[var(--text-primary)]/30">No se encontraron servidores</td></tr>
                  ) : (
                    paginatedData.map((item) => (
                      <tr key={item.id} className={`hover:bg-[var(--bg-hover)]/50 transition-colors ${selectedIds.has(item.id) ? "bg-[var(--primary)]/5" : ""}`}>
                        <td className="px-4 py-3 w-[40px]">
                          <button type="button" onClick={() => toggleSelectOne(item.id)} aria-label={selectedIds.has(item.id) ? `Deseleccionar ${item.id}` : `Seleccionar ${item.id}`} aria-pressed={selectedIds.has(item.id)} className="flex items-center justify-center rounded hover:opacity-80">
                            {selectedIds.has(item.id) ? <CheckSquare className="w-4 h-4 text-[var(--primary)]" /> : <Square className="w-4 h-4 text-[var(--text-primary)]/30" />}
                          </button>
                        </td>
                        {visibleColumns.map((col) => (
                          <td key={col.key} className={getCellClassName(col)}>{renderCellValue(item, col)}</td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {sortedData.length > pageSize && <PaginationControls currentPage={safeCurrentPage} totalPages={totalPages} totalItems={sortedData.length} pageSize={pageSize} startIndex={startIndex} endIndex={endIndex} onPageChange={handlePageChange} onPageSizeChange={handlePageSizeChange} />}
          </div>
        </div>
      </div>

      {confirmModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget && !bulkSaving) setConfirmModalOpen(false); }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md mx-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[0_18px_50px_rgba(0,0,0,0.42)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center"><AlertCircle className="w-4 h-4 text-[var(--primary)]" /></div><h2 className="text-sm font-semibold text-[var(--text-primary)]">Confirmar cambios</h2></div>
              <button type="button" onClick={() => setConfirmModalOpen(false)} disabled={bulkSaving} className="p-1.5 rounded-lg text-[var(--text-primary)]/40 hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all disabled:opacity-40"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4"><p className="text-sm text-[var(--text-primary)]/70">Se aplicará el valor <span className="font-semibold text-[var(--text-primary)]">&apos;{bulkValue.trim()}&apos;</span> en la columna <span className="font-semibold text-[var(--text-primary)]">&apos;{customColumns.find((c) => c.id === bulkColumnId)?.name || ""}&apos;</span> para <span className="font-semibold text-[var(--text-primary)]">{selectedIds.size}</span> servidor(es). ¿Confirma que desea aplicar los cambios?</p></div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border)]">
              <button type="button" onClick={() => setConfirmModalOpen(false)} disabled={bulkSaving} className="px-4 py-2 rounded-lg text-xs font-medium border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)]/70 hover:bg-[var(--bg-hover)] transition-all disabled:opacity-40">Cancelar</button>
              <button type="button" onClick={handleBulkApply} disabled={bulkSaving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[var(--primary)]/15 border border-[var(--primary)]/30 text-[var(--primary)] hover:bg-[var(--primary)]/25 transition-all disabled:opacity-40">{bulkSaving && <RefreshCw className="w-3 h-3 animate-spin" />}Confirmar</button>
            </div>
          </div>
        </div>, document.body
      )}

      {manageModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) setManageModalOpen(false); }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md mx-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[0_18px_50px_rgba(0,0,0,0.42)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center"><Columns3 className="w-4 h-4 text-cyan-400" /></div><div><h2 className="text-sm font-semibold text-[var(--text-primary)]">Custom Columns</h2><p className="text-xs text-[var(--text-primary)]/40">{customColumns.length} columna{customColumns.length !== 1 ? "s" : ""}</p></div></div>
              <button type="button" onClick={() => setManageModalOpen(false)} className="p-1.5 rounded-lg text-[var(--text-primary)]/40 hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-3 max-h-[300px] overflow-y-auto divide-y divide-[var(--border)]/50">
              {customColumns.length === 0 && <p className="py-6 text-center text-xs text-[var(--text-primary)]/30">No hay columnas personalizadas</p>}
              {customColumns.map((col) => (
                <div key={col.id} className="flex items-center gap-2 py-2.5">
                  {renamingColumnId === col.id ? (
                    <div className="flex items-center gap-1 flex-1"><input ref={renameInputRef} type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleRenameColumn(col.id); if (e.key === "Escape") setRenamingColumnId(null); }} onBlur={() => handleRenameColumn(col.id)} className="flex-1 px-2 py-1 text-xs bg-[var(--bg-card)] border border-cyan-500/40 rounded text-[var(--text-primary)] outline-none" /></div>
                  ) : <span className="flex-1 text-sm text-[var(--text-primary)] truncate">{col.name}</span>}
                  {renamingColumnId !== col.id && <button type="button" onClick={() => { setRenamingColumnId(col.id); setRenameValue(col.name); }} className="p-1 rounded text-[var(--text-primary)]/30 hover:text-cyan-400 hover:bg-cyan-400/10 transition-all"><Pencil className="w-3.5 h-3.5" /></button>}
                  {deletingColumnId === col.id ? (
                    <div className="flex items-center gap-1"><button type="button" onClick={() => handleDeleteColumn(col.id)} className="px-2 py-1 text-[10px] font-medium rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all">Confirm</button><button type="button" onClick={() => setDeletingColumnId(null)} className="px-2 py-1 text-[10px] font-medium rounded bg-[var(--bg-hover)] text-[var(--text-primary)]/50 hover:text-[var(--text-primary)] transition-all">Cancel</button></div>
                  ) : <button type="button" onClick={() => setDeletingColumnId(col.id)} className="p-1 rounded text-[var(--text-primary)]/30 hover:text-red-400 hover:bg-red-400/10 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-[var(--border)]">
              <div className="flex items-center gap-2">
                <input type="text" placeholder="Nombre de nueva columna..." value={newColumnName} onChange={(e) => setNewColumnName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAddColumn(); }} className="flex-1 px-3 py-2 rounded-lg text-xs text-[var(--text-primary)] placeholder:text-[var(--text-primary)]/25 outline-none border border-[var(--border)] bg-[var(--bg-hover)]/50 focus:border-cyan-500/40 transition-all" />
                <button type="button" onClick={handleAddColumn} disabled={!newColumnName.trim() || addingColumn} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"><Plus className="w-3.5 h-3.5" />Add</button>
              </div>
            </div>
          </div>
        </div>, document.body
      )}

      {exportOpen && exportMenuPos && createPortal(
        <div ref={exportMenuRef} role="menu" className="fixed z-[9999] w-60 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[0_18px_50px_rgba(0,0,0,0.42)]" style={{ top: exportMenuPos.top, right: exportMenuPos.right }}>
          <div className="border-b border-[var(--border)] px-4 py-3"><p className="text-sm font-medium text-[var(--text-primary)]">Exportar servidores</p><p className="mt-0.5 text-xs text-[var(--text-secondary)]">{sortedData.length.toLocaleString("es-CO")} servidores</p></div>
          <div className="p-1.5">
            <button type="button" role="menuitem" onClick={handleExportExcel} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-emerald-400/10">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300"><FileSpreadsheet className="h-4 w-4" /></span>
              <span><span className="block text-sm font-medium text-[var(--text-primary)]">Excel</span><span className="block text-[11px] text-[var(--text-secondary)]">Formato .xlsx</span></span>
            </button>
            <button type="button" role="menuitem" onClick={handleExportPDF} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-rose-400/10">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-400/10 text-rose-300"><FileText className="h-4 w-4" /></span>
              <span><span className="block text-sm font-medium text-[var(--text-primary)]">PDF</span><span className="block text-[11px] text-[var(--text-secondary)]">Formato .pdf</span></span>
            </button>
          </div>
        </div>, document.body
      )}
    </>
  );
}
