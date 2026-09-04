"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Filter,
  Play,
  Search,
  Server,
  ShieldCheck,
  SquareTerminal,
  Trash2,
  XCircle,
} from "lucide-react";

import type { InventoryItem } from "@/types/inventory";

type OsType = "linux" | "windows";
type ExecutionStatus = "success" | "failed" | "timedOut" | "cancelled" | "error";

type CommandTarget = {
  instanceId: string;
  accountId: string;
  accountName: string;
  name: string;
  osType: OsType;
};

type CommandResult = {
  instanceId: string;
  accountId: string;
  accountName?: string;
  name?: string;
  status: ExecutionStatus;
  commandId?: string;
  output?: string;
  error?: string;
  durationMs?: number;
};

type HistoryItem = {
  id: string;
  commandPreview: string;
  osType: OsType;
  total: number;
  success: number;
  failed: number;
  timestamp: string;
};

type InventoryResponse = {
  data?: InventoryItem[];
};

const HISTORY_KEY = "mc-command-history";

const templates: Record<OsType, Array<{ label: string; command: string }>> = {
  linux: [
    { label: "Hostname", command: "hostname" },
    { label: "IP local", command: "ip addr show" },
    { label: "Uptime", command: "uptime" },
    { label: "Disco", command: "df -h" },
    { label: "Actualizar paquetes", command: "dnf update -y" },
  ],
  windows: [
    { label: "Hostname", command: "hostname" },
    { label: "IP local", command: "ipconfig /all" },
    { label: "Servicios", command: "Get-Service | Select-Object -First 20" },
    { label: "Disco", command: "Get-PSDrive -PSProvider FileSystem" },
    { label: "Actualizar paquetes", command: "Install-WindowsUpdate -AcceptAll -IgnoreReboot" },
  ],
};

function getOsType(item: InventoryItem): OsType {
  const os = `${item.operatingSystem || ""} ${item.platform || ""}`.toLowerCase();
  return os.includes("windows") ? "windows" : "linux";
}

function isRunnableServer(item: InventoryItem) {
  return item.provider === "AWS" && item.service === "EC2" && item.id && item.ssmManaged;
}

function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item): HistoryItem | null => {
        if (!item || typeof item !== "object") return null;
        const record = item as Record<string, unknown>;
        const command = typeof record.commandPreview === "string"
          ? record.commandPreview
          : typeof record.command === "string"
            ? redactCommandPreview(record.command)
            : "";
        if (!command || (record.osType !== "linux" && record.osType !== "windows")) return null;
        return {
          id: typeof record.id === "string" ? record.id : crypto.randomUUID(),
          commandPreview: redactCommandPreview(command),
          osType: record.osType,
          total: typeof record.total === "number" ? record.total : 0,
          success: typeof record.success === "number" ? record.success : 0,
          failed: typeof record.failed === "number" ? record.failed : 0,
          timestamp: typeof record.timestamp === "string" ? record.timestamp : new Date().toISOString(),
        };
      })
      .filter((item): item is HistoryItem => item !== null);
  } catch {
    return [];
  }
}

function saveHistory(history: HistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 12)));
}

function redactCommandPreview(command: string) {
  const preview = command
    .replace(/\bBearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    .replace(/((?:--?|\/)?(?:password|passwd|pwd|token|secret|api[_-]?key|access[_-]?key|authorization|cookie)\s*[=:]?\s+)[^\s;|]+/gi, "$1[REDACTED]")
    .replace(/((?:PASSWORD|TOKEN|SECRET|API_KEY|ACCESS_KEY)\s*=\s*)[^\s;|]+/gi, "$1[REDACTED]");
  return preview.length > 320 ? `${preview.slice(0, 319)}…` : preview;
}

export default function CommandCenter() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [inventoryError, setInventoryError] = useState("");
  const [osType, setOsType] = useState<OsType>("linux");
  const [query, setQuery] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [accountQuery, setAccountQuery] = useState("");
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const accountPickerRef = useRef<HTMLDivElement | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement | null>(null);
  const [onlyRunning, setOnlyRunning] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [command, setCommand] = useState("hostname");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<CommandResult[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const loadedHistory = loadHistory();
    setHistory(loadedHistory);
    saveHistory(loadedHistory);
  }, []);

  useEffect(() => {
    async function loadInventory() {
      setLoadingInventory(true);
      setInventoryError("");

      try {
        const response = await fetch("/api/inventory");
        const json = (await response.json()) as InventoryResponse;

        if (!response.ok) {
          throw new Error("No se pudo cargar el inventario");
        }

        setInventory(json.data || []);
      } catch (error) {
        setInventoryError(error instanceof Error ? error.message : "Error cargando inventario");
      } finally {
        setLoadingInventory(false);
      }
    }

    loadInventory();
  }, []);

  const runnableServers = useMemo(() => {
    return inventory.filter(isRunnableServer).map((item): CommandTarget => ({
      instanceId: item.id,
      accountId: item.accountId,
      accountName: item.accountName,
      name: item.name || item.id,
      osType: getOsType(item),
    }));
  }, [inventory]);

  const accounts = useMemo(() => {
    return Array.from(new Set(runnableServers.map((server) => server.accountName))).sort();
  }, [runnableServers]);

  const filteredAccounts = useMemo(() => {
    const needle = accountQuery.trim().toLowerCase();
    if (!needle) return accounts;
    return accounts.filter((item) => item.toLowerCase().includes(needle));
  }, [accountQuery, accounts]);

  const selectMatchingAccountsDisabled = !accountQuery.trim() || filteredAccounts.length === 0;

  useEffect(() => {
    if (!accountPickerOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!accountPickerRef.current?.contains(event.target as Node)) setAccountPickerOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountPickerOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountPickerOpen]);

  useEffect(() => {
    if (!filtersOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!filtersRef.current?.contains(event.target as Node)) {
        setFiltersOpen(false);
        setAccountPickerOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFiltersOpen(false);
        setAccountPickerOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [filtersOpen]);

  const filteredServers = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return runnableServers.filter((server) => {
      if (server.osType !== osType) return false;
      if (selectedAccounts.size > 0 && !selectedAccounts.has(server.accountName)) return false;

      if (onlyRunning) {
        const source = inventory.find((item) => item.id === server.instanceId && item.accountId === server.accountId);
        if (source?.status && source.status.toLowerCase() !== "running") return false;
      }

      if (!needle) return true;

      return [
        server.name,
        server.instanceId,
        server.accountId,
        server.accountName,
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [inventory, onlyRunning, osType, query, runnableServers, selectedAccounts]);

  const selectedTargets = useMemo(() => {
    return filteredServers.filter((server) => selected.has(targetKey(server)));
  }, [filteredServers, selected]);

  const stats = useMemo(() => {
    const linux = runnableServers.filter((server) => server.osType === "linux").length;
    const windows = runnableServers.filter((server) => server.osType === "windows").length;

    return {
      total: runnableServers.length,
      linux,
      windows,
      accounts: accounts.length,
    };
  }, [accounts.length, runnableServers]);

  function toggleTarget(server: CommandTarget) {
    setSelected((current) => {
      const next = new Set(current);
      const key = targetKey(server);

      if (next.has(key)) next.delete(key);
      else next.add(key);

      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((current) => {
      const next = new Set(current);
      const allSelected = filteredServers.length > 0 && filteredServers.every((server) => next.has(targetKey(server)));

      for (const server of filteredServers) {
        if (allSelected) next.delete(targetKey(server));
        else next.add(targetKey(server));
      }

      return next;
    });
  }

  async function runCommand() {
    if (running || selectedTargets.length === 0 || !command.trim()) return;

    setRunning(true);
    setResults([]);

    try {
      const response = await fetch("/api/ec2/run-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: command.trim(),
          osType,
          instances: selectedTargets,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        const errorResult: CommandResult = {
          instanceId: "validation",
          accountId: "local",
          status: "error",
          error: payload?.reason || payload?.error || "La ejecución fue rechazada",
        };
        setResults([errorResult]);
        return;
      }

      const nextResults = payload as CommandResult[];
      setResults(nextResults);

      const success = nextResults.filter((item) => item.status === "success").length;
      const nextHistory = [
        {
          id: crypto.randomUUID(),
          commandPreview: redactCommandPreview(command.trim()),
          osType,
          total: nextResults.length,
          success,
          failed: nextResults.length - success,
          timestamp: new Date().toISOString(),
        },
        ...history,
      ];

      setHistory(nextHistory.slice(0, 12));
      saveHistory(nextHistory);
    } catch (error) {
      setResults([
        {
          instanceId: "network",
          accountId: "local",
          status: "error",
          error: error instanceof Error ? error.message : "No se pudo conectar con la API",
        },
      ]);
    } finally {
      setRunning(false);
    }
  }

  function toggleAccount(accountName: string) {
    setSelectedAccounts((current) => {
      const next = new Set(current);

      if (next.has(accountName)) next.delete(accountName);
      else next.add(accountName);

      return next;
    });
    setSelected(new Set());
  }

  function clearAccountFilter() {
    setSelectedAccounts(new Set());
    setAccountQuery("");
    setSelected(new Set());
  }

  function selectMatchingAccounts() {
    if (selectMatchingAccountsDisabled) return;
    setSelectedAccounts(new Set(filteredAccounts));
    setSelected(new Set());
  }

  function clearConsole() {
    setCommand("");
    setResults([]);
    setSelected(new Set());
    setHistory([]);
    saveHistory([]);
  }

  return (
    <div className="max-w-full space-y-4 overflow-hidden">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <ShieldCheck size={14} />
            Validación activa de comandos destructivos
          </div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Ejecución de comandos</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Consola operativa para ejecutar comandos por SSM sobre servidores EC2 administrados.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Targets SSM" value={stats.total} />
          <Metric label="Linux" value={stats.linux} />
          <Metric label="Windows" value={stats.windows} />
          <Metric label="Cuentas" value={stats.accounts} />
        </div>
      </header>

      <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
        <div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-card)]/70">
          <div ref={filtersRef}>
            <div className="border-b border-[var(--border)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-[var(--text-primary)]">Targets</h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {selectedTargets.length} seleccionados de {filteredServers.length} visibles
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (filtersOpen) setAccountPickerOpen(false);
                      setFiltersOpen((current) => !current);
                    }}
                    aria-expanded={filtersOpen}
                    aria-controls="command-filter-options"
                    className="inline-flex items-center gap-2 rounded-md border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-500/20"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    Filtros
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
                  </button>
                  <button
                    type="button"
                    onClick={toggleAllFiltered}
                    disabled={filteredServers.length === 0}
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)] disabled:opacity-50"
                  >
                    {filteredServers.length > 0 && filteredServers.every((server) => selected.has(targetKey(server)))
                      ? "Limpiar"
                      : "Seleccionar"}
                  </button>
                </div>
              </div>
            </div>

            <div id="command-filter-options" hidden={!filtersOpen}>
            <div className="space-y-2.5 border-b border-[var(--border)] p-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setOsType("linux");
                  setCommand("hostname");
                  setSelected(new Set());
                }}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                  osType === "linux"
                    ? "border-cyan-400 bg-cyan-500/10 text-cyan-200"
                    : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                Linux Shell
              </button>
              <button
                type="button"
                onClick={() => {
                  setOsType("windows");
                  setCommand("hostname");
                  setSelected(new Set());
                }}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                  osType === "windows"
                    ? "border-cyan-400 bg-cyan-500/10 text-cyan-200"
                    : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                Windows PowerShell
              </button>
            </div>

            <label className="relative block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre, instancia o cuenta"
                className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-hover)]/40 pl-9 pr-3 text-sm outline-none focus:border-cyan-400"
              />
            </label>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <div ref={accountPickerRef} className="relative">
                <label className="relative block">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-300" />
                  <input
                    value={accountQuery}
                    onChange={(event) => setAccountQuery(event.target.value)}
                    onClick={() => setAccountPickerOpen(true)}
                    role="combobox"
                    aria-haspopup="listbox"
                    aria-expanded={accountPickerOpen}
                    aria-controls="command-account-options"
                    aria-label="Buscar y seleccionar cuentas"
                    placeholder={selectedAccounts.size === 0 ? "Todas las cuentas" : `${selectedAccounts.size} cuentas seleccionadas`}
                    className="h-10 w-full rounded-md border border-cyan-400/20 bg-[#07111d] pl-9 pr-9 text-sm text-cyan-50 outline-none placeholder:text-cyan-100/80 focus:border-cyan-300 focus:bg-[#081827]"
                  />
                  {(selectedAccounts.size > 0 || accountQuery) && (
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={clearAccountFilter}
                      className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-cyan-200 transition hover:bg-cyan-400/10 hover:text-white"
                      aria-label="Limpiar cuenta"
                    >
                      <XCircle size={14} />
                    </button>
                  )}
                </label>

                {accountPickerOpen && (
                  <div className="absolute left-0 right-0 top-11 z-20 overflow-hidden rounded-md border border-cyan-400/20 bg-[#07111d] shadow-2xl shadow-black/40">
                    <div className="flex flex-wrap items-center gap-2 border-b border-cyan-400/10 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAccounts(new Set(accounts));
                          setSelected(new Set());
                        }}
                        className="text-[10px] uppercase tracking-wider text-cyan-100/80 transition hover:text-cyan-50"
                      >
                        Todo
                      </button>
                      <span className="text-cyan-100/30">|</span>
                      <button
                        type="button"
                        onClick={clearAccountFilter}
                        className="text-[10px] uppercase tracking-wider text-cyan-100/80 transition hover:text-red-200"
                      >
                        Ninguno
                      </button>
                      <span className="text-cyan-100/30">|</span>
                      <button
                        type="button"
                        onClick={selectMatchingAccounts}
                        disabled={selectMatchingAccountsDisabled}
                        title={selectMatchingAccountsDisabled ? "Escribe una búsqueda con coincidencias" : undefined}
                        className="text-[10px] uppercase tracking-wider text-cyan-200/80 transition hover:text-cyan-50 disabled:cursor-not-allowed disabled:text-cyan-100/30"
                      >
                        Seleccionar coincidencias
                      </button>
                    </div>

                    <div id="command-account-options" className="max-h-56 overflow-y-auto border-t border-cyan-400/10" role="listbox" aria-label="Cuentas disponibles">
                      {filteredAccounts.length === 0 ? (
                        <div className="px-3 py-3 text-sm text-cyan-100/60">
                          Sin cuentas coincidentes
                        </div>
                      ) : (
                        filteredAccounts.map((item) => {
                          const checked = selectedAccounts.has(item);

                          return (
                            <button
                              key={item}
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => toggleAccount(item)}
                              className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-cyan-500/10 ${
                                checked ? "bg-cyan-500/10 text-cyan-200" : "text-cyan-50"
                              }`}
                            >
                              <span
                                className={`h-4 w-4 shrink-0 rounded border ${
                                  checked ? "border-cyan-300 bg-cyan-400" : "border-cyan-400/30"
                                }`}
                              />
                              <span className="min-w-0 truncate">{item}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {selectedAccounts.size > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Array.from(selectedAccounts).map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleAccount(item)}
                        className="max-w-full truncate rounded-md border border-cyan-400/20 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100 transition hover:bg-cyan-500/20"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <label className="flex h-10 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-hover)]/40 px-3 text-sm text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={onlyRunning}
                  onChange={(event) => setOnlyRunning(event.target.checked)}
                  className="h-4 w-4 accent-cyan-400"
                />
                Solo running
              </label>
            </div>
            </div>
            </div>
          </div>

          <div className="max-h-[360px] overflow-y-auto border-t border-[var(--border)]">
            {loadingInventory && <EmptyState label="Cargando servidores SSM..." />}
            {inventoryError && <EmptyState label={inventoryError} tone="danger" />}
            {!loadingInventory && !inventoryError && filteredServers.length === 0 && (
              <EmptyState label="No hay servidores disponibles para este filtro" />
            )}

            {filteredServers.map((server) => {
              const checked = selected.has(targetKey(server));

              return (
                <button
                  key={targetKey(server)}
                  type="button"
                  onClick={() => toggleTarget(server)}
                  className={`flex w-full items-start gap-2.5 border-b border-[var(--border)] px-3 py-2.5 text-left transition hover:bg-[var(--bg-hover)] ${
                    checked ? "bg-cyan-500/10" : ""
                  }`}
                >
                  <span
                    className={`mt-1 h-4 w-4 rounded border ${
                      checked ? "border-cyan-300 bg-cyan-400" : "border-[var(--border)]"
                    }`}
                  />
                  <Server className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--text-primary)]">
                      {server.name}
                    </span>
                    <span className="mt-1 block truncate text-xs text-[var(--text-secondary)]">
                      {server.accountName} - {server.instanceId}
                    </span>
                  </span>
                  <span className="rounded-md border border-[var(--border)] px-2 py-1 text-[10px] uppercase text-[var(--text-secondary)]">
                    {server.osType}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <section className="min-w-0 rounded-lg border border-[var(--border)] bg-black">
            <div className="flex flex-col gap-3 border-b border-white/10 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <SquareTerminal className="h-5 w-5 text-emerald-300" />
                <div>
                  <h2 className="font-semibold text-white">
                    {osType === "linux" ? "Linux Shell" : "Windows PowerShell"}
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Documento SSM: {osType === "linux" ? "AWS-RunShellScript" : "AWS-RunPowerShellScript"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={clearConsole}
                  disabled={running}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 px-4 text-sm font-semibold text-zinc-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={16} />
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={runCommand}
                  disabled={running || selectedTargets.length === 0 || !command.trim()}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Play size={16} />
                  {running ? "Ejecutando..." : `Ejecutar en ${selectedTargets.length}`}
                </button>
              </div>
            </div>

            <div className="space-y-3 p-3">
              <div className="flex flex-wrap gap-2">
                {templates[osType].map((template) => (
                  <button
                    key={template.label}
                    type="button"
                    onClick={() => setCommand(template.command)}
                    className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 transition hover:bg-white/10"
                  >
                    {template.label}
                  </button>
                ))}
              </div>

              <textarea
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                spellCheck={false}
                className="h-32 min-h-28 w-full resize-none rounded-md border border-white/10 bg-[#050805] p-3 font-mono text-sm leading-5 text-emerald-300 outline-none focus:border-emerald-400"
                placeholder={osType === "linux" ? "hostname" : "Get-ComputerInfo"}
              />

              <div className="flex items-start gap-2 rounded-md border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Comandos destructivos como rm, reboot, shutdown, format, Remove-Item masivo y cambios críticos del sistema son bloqueados antes de llegar a SSM.
                </p>
              </div>
            </div>
          </section>

          <ResultsPanel results={results} running={running} />
        </div>
      </section>

      <HistoryPanel history={history} onUse={(item) => {
        setOsType(item.osType);
         setCommand(item.commandPreview);
      }} />
    </div>
  );
}

function targetKey(server: CommandTarget) {
  return `${server.accountId}:${server.instanceId}`;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)]/70 px-3 py-2">
      <p className="text-[11px] uppercase text-[var(--text-secondary)]">{label}</p>
      <p className="text-lg font-bold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function EmptyState({ label, tone = "muted" }: { label: string; tone?: "muted" | "danger" }) {
  return (
    <div className={`p-6 text-center text-sm ${tone === "danger" ? "text-red-300" : "text-[var(--text-secondary)]"}`}>
      {label}
    </div>
  );
}

function ResultsPanel({ results, running }: { results: CommandResult[]; running: boolean }) {
  if (running) {
    return (
      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)]/70 p-5">
        <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
          <Clock className="h-4 w-4 animate-spin" />
          Esperando resultados de SSM...
        </div>
      </section>
    );
  }

  if (results.length === 0) {
    return (
      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)]/70 p-5">
        <p className="text-sm text-[var(--text-secondary)]">Los resultados aparecerán aquí después de ejecutar.</p>
      </section>
    );
  }

  return (
    <section className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-card)]/70">
      <div className="border-b border-[var(--border)] p-3">
        <h2 className="font-semibold text-[var(--text-primary)]">Resultados</h2>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {results.map((result) => (
          <article key={`${result.accountId}:${result.instanceId}:${result.commandId || result.status}`} className="min-w-0 p-3">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                  {result.name || result.instanceId}
                </p>
                <p className="truncate text-xs text-[var(--text-secondary)]">
                  {result.accountName || result.accountId} - {result.instanceId}
                </p>
              </div>
              <StatusBadge status={result.status} />
            </div>
            <pre className="max-h-[240px] overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words rounded-md border border-black/30 bg-[#050805] p-3 text-xs leading-5 text-zinc-200">
              {result.output || result.error || "(sin salida)"}
            </pre>
          </article>
        ))}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: ExecutionStatus }) {
  const success = status === "success";
  const Icon = success ? CheckCircle2 : XCircle;

  return (
    <span
      className={`inline-flex w-fit items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${
        success
          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
          : "border-red-400/30 bg-red-500/10 text-red-300"
      }`}
    >
      <Icon size={13} />
      {status}
    </span>
  );
}

function HistoryPanel({ history, onUse }: { history: HistoryItem[]; onUse: (item: HistoryItem) => void }) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)]/70">
      <div className="border-b border-[var(--border)] p-4">
        <h2 className="font-semibold text-[var(--text-primary)]">Historial local</h2>
      </div>

      {history.length === 0 ? (
        <EmptyState label="Sin ejecuciones recientes" />
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {history.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onUse(item)}
              className="flex w-full items-center justify-between gap-4 p-4 text-left transition hover:bg-[var(--bg-hover)]"
            >
              <span className="min-w-0">
                 <span className="block truncate font-mono text-sm text-[var(--text-primary)]">{item.commandPreview}</span>
                <span className="mt-1 block text-xs text-[var(--text-secondary)]">
                  {new Date(item.timestamp).toLocaleString()} - {item.osType} - {item.success}/{item.total} OK
                </span>
              </span>
              <Copy className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
