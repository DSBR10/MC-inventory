"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  FileSearch,
  Filter,
  Layers3,
  ListFilter,
  Loader2,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CloudTrailEvent, CloudWatchLog, LogGroup, MetricData } from "@/types/monitoring-aws";

type AwsAccount = {
  id: string;
  name: string;
  region: string;
};

type AccountMetrics = {
  accountId: string;
  accountName: string;
  region: string;
  ec2: {
    instances: Array<{
      instanceId: string;
      instanceType: string;
      state: string;
      cpuUtilization: number;
      networkIn: number;
      networkOut: number;
    }>;
    summary: {
      total: number;
      running: number;
      stopped: number;
      avgCpu: number;
    };
  };
  rds: {
    instances: Array<{
      dbInstanceIdentifier: string;
      engine: string;
      status: string;
      cpuUtilization: number;
      databaseConnections: number;
      freeableMemory: number;
      freeStorageSpace: number;
    }>;
    summary: {
      total: number;
      available: number;
      avgCpu: number;
      totalConnections: number;
    };
  };
  ecs: {
    clusters: Array<{
      clusterName: string;
      status: string;
      cpuUtilization: number;
      memoryUtilization: number;
      runningTasksCount: number;
      servicesCount: number;
    }>;
    summary: {
      totalClusters: number;
      totalTasks: number;
      totalServices: number;
      avgCpu: number;
      avgMemory: number;
    };
  };
  lastUpdated: number;
};

type GlobalSummary = {
  totalAccounts: number;
  totalEC2: number;
  runningEC2: number;
  totalRDS: number;
  availableRDS: number;
  totalECSClusters: number;
  totalECSTasks: number;
};

type MonitoringResponse = {
  success: boolean;
  source: "cache" | "fresh";
  timestamp: number;
  cacheAge: number;
  refreshing: boolean;
  summary?: GlobalSummary;
  account?: AccountMetrics;
  accounts?: Record<string, AccountMetrics>;
};

type LogGroupOption = LogGroup & {
  accountId: string;
  accountName: string;
  key: string;
};

type LogsState = {
  groups: LogGroupOption[];
  logs: CloudWatchLog[];
  groupKey: string;
  filterPattern: string;
  startTime: string;
  endTime: string;
  limit: number;
  loadingGroups: boolean;
  loadingLogs: boolean;
  error: string | null;
};

type TrailEvent = CloudTrailEvent & {
  accountName?: string;
  accountId?: string;
};

type TrailState = {
  events: TrailEvent[];
  query: string;
  startTime: string;
  endTime: string;
  maxResults: number;
  loading: boolean;
  error: string | null;
};

type MetricExplorerState = {
  serviceType: "ec2" | "rds" | "ecs";
  resourceKey: string;
  clusterKey: string;
  serviceKey: string;
  period: number;
  metrics: MetricData[];
  loading: boolean;
  error: string | null;
};

type ResourceKind = "ec2" | "rds" | "ecs";

type ResourceOption = {
  key: string;
  kind: ResourceKind;
  accountId: string;
  accountName: string;
  id: string;
  name: string;
  label: string;
  clusterName?: string;
  serviceName?: string;
  status: string;
  secondary: string;
  metrics: string[];
};

type InventoryItem = {
  provider?: string;
  accountId?: string;
  accountName?: string;
  service?: string;
  resourceType?: string;
  name?: string;
  id?: string;
  host?: string;
  status?: string;
  raw?: Record<string, unknown>;
  children?: InventoryItem[];
};

const REGIONS = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "eu-west-1",
  "eu-central-1",
  "ap-southeast-1",
  "ap-northeast-1",
];

const initialStart = () => new Date(Date.now() - 3600000).toISOString().slice(0, 16);
const initialEnd = () => new Date().toISOString().slice(0, 16);

export default function MonitoringPage() {
  const [accounts, setAccounts] = useState<AwsAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState("us-east-1");
  const [accountMetricsMap, setAccountMetricsMap] = useState<Record<string, AccountMetrics>>({});
  const [cacheInfo, setCacheInfo] = useState<Pick<MonitoringResponse, "source" | "timestamp" | "cacheAge" | "refreshing"> | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [modalResource, setModalResource] = useState<ResourceOption | null>(null);
  const [modalMetrics, setModalMetrics] = useState<MetricData[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [logsState, setLogsState] = useState<LogsState>({
    groups: [],
    logs: [],
    groupKey: "",
    filterPattern: "",
    startTime: initialStart(),
    endTime: initialEnd(),
    limit: 100,
    loadingGroups: false,
    loadingLogs: false,
    error: null,
  });

  const [trailState, setTrailState] = useState<TrailState>({
    events: [],
    query: "",
    startTime: initialStart(),
    endTime: initialEnd(),
    maxResults: 50,
    loading: false,
    error: null,
  });

  const [metricExplorer, setMetricExplorer] = useState<MetricExplorerState>({
    serviceType: "ec2",
    resourceKey: "",
    clusterKey: "",
    serviceKey: "",
    period: 300,
    metrics: [],
    loading: false,
    error: null,
  });

  const activeAccountIds = useMemo(() => {
    return selectedAccountIds;
  }, [selectedAccountIds]);

  const activeAccounts = useMemo(
    () => accounts.filter((account) => activeAccountIds.includes(account.id)),
    [accounts, activeAccountIds],
  );

  const activeMetrics = useMemo(
    () => activeAccountIds.map((accountId) => accountMetricsMap[accountId]).filter(Boolean),
    [accountMetricsMap, activeAccountIds],
  );

  const computedSummary = useMemo(() => computeSummary(activeMetrics), [activeMetrics]);
  const resourceOptions = useMemo(
    () => buildResourceOptions(activeMetrics, inventoryItems),
    [activeMetrics, inventoryItems],
  );

  const fetchAccounts = useCallback(async () => {
    const response = await fetch("/api/monitoring/aws/accounts");
    if (!response.ok) throw new Error("No se pudieron cargar las cuentas AWS");
    const data = await response.json();
    const nextAccounts = (data.accounts || []) as AwsAccount[];
    setAccounts(nextAccounts);
    setSelectedAccountIds((current) => {
      if (current.length === 0) return nextAccounts.map((account) => account.id);
      return current.filter((id) => nextAccounts.some((account) => account.id === id));
    });
    if (nextAccounts[0]) setSelectedRegion(nextAccounts[0].region || "us-east-1");
  }, []);

  const fetchInventory = useCallback(async () => {
    try {
      const response = await fetch("/api/inventory");
      const data = await response.json();
      setInventoryItems((data.data || data.inventory || []) as InventoryItem[]);
    } catch {
      setInventoryItems([]);
    }
  }, []);

  const fetchOverview = useCallback(async (forceRefresh = false) => {
    setOverviewLoading(true);
    setOverviewError(null);

    try {
      const params = new URLSearchParams();
      if (forceRefresh) params.set("refresh", "true");

      const response = await fetch(`/api/monitoring/metrics?${params.toString()}`);
      if (!response.ok) throw new Error("No se pudo cargar el resumen de monitoreo");

      const data = (await response.json()) as MonitoringResponse;
      const nextMap = data.accounts || (data.account ? { [data.account.accountId]: data.account } : {});
      setAccountMetricsMap(nextMap);
      setCacheInfo({
        source: data.source,
        timestamp: data.timestamp,
        cacheAge: data.cacheAge,
        refreshing: data.refreshing,
      });
    } catch (error) {
      setOverviewError(error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const fetchLogGroups = useCallback(async () => {
    if (activeAccounts.length === 0) return;
    setLogsState((prev) => ({ ...prev, loadingGroups: true, error: null }));

    try {
      const results = await Promise.allSettled(
        activeAccounts.map(async (account) => {
          const params = new URLSearchParams({ accountId: account.id, region: selectedRegion });
          const response = await fetch(`/api/monitoring/aws/cloudwatch-logs?${params.toString()}`);
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || `No se pudieron cargar log groups de ${account.name}`);
          return ((data.logGroups || []) as LogGroup[]).map((group) => ({
            ...group,
            accountId: account.id,
            accountName: account.name,
            key: `${account.id}::${group.logGroupName}`,
          }));
        }),
      );

      const groups = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
      setLogsState((prev) => ({
        ...prev,
        groups,
        groupKey: groups.some((group) => group.key === prev.groupKey) ? prev.groupKey : "",
      }));
    } catch (error) {
      setLogsState((prev) => ({ ...prev, error: error instanceof Error ? error.message : "Error desconocido" }));
    } finally {
      setLogsState((prev) => ({ ...prev, loadingGroups: false }));
    }
  }, [activeAccounts, selectedRegion]);

  const fetchLogs = useCallback(async () => {
    const group = logsState.groups.find((item) => item.key === logsState.groupKey);
    if (!group) return;
    setLogsState((prev) => ({ ...prev, loadingLogs: true, error: null }));

    try {
      const params = new URLSearchParams({
        accountId: group.accountId,
        region: selectedRegion,
        logGroupName: group.logGroupName,
        limit: String(logsState.limit),
      });
      if (logsState.startTime) params.set("startTime", new Date(logsState.startTime).toISOString());
      if (logsState.endTime) params.set("endTime", new Date(logsState.endTime).toISOString());
      if (logsState.filterPattern) params.set("filterPattern", logsState.filterPattern);

      const response = await fetch(`/api/monitoring/aws/cloudwatch-logs?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar los logs");

      setLogsState((prev) => ({ ...prev, logs: data.logs || [] }));
    } catch (error) {
      setLogsState((prev) => ({ ...prev, error: error instanceof Error ? error.message : "Error desconocido" }));
    } finally {
      setLogsState((prev) => ({ ...prev, loadingLogs: false }));
    }
  }, [logsState.endTime, logsState.filterPattern, logsState.groupKey, logsState.groups, logsState.limit, logsState.startTime, selectedRegion]);

  const fetchCloudTrail = useCallback(async () => {
    if (activeAccounts.length === 0) return;
    setTrailState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const results = await Promise.allSettled(
        activeAccounts.map(async (account) => {
          const params = new URLSearchParams({
            accountId: account.id,
            region: selectedRegion,
            maxResults: String(trailState.maxResults),
          });
          if (trailState.startTime) params.set("startTime", new Date(trailState.startTime).toISOString());
          if (trailState.endTime) params.set("endTime", new Date(trailState.endTime).toISOString());

          const response = await fetch(`/api/monitoring/aws/cloudtrail?${params.toString()}`);
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || `No se pudieron cargar eventos de ${account.name}`);
          return ((data.events || []) as CloudTrailEvent[]).map((event) => ({
            ...event,
            accountId: account.id,
            accountName: account.name,
          }));
        }),
      );

      const events = results
        .flatMap((result) => result.status === "fulfilled" ? result.value : [])
        .sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime());

      setTrailState((prev) => ({ ...prev, events }));
    } catch (error) {
      setTrailState((prev) => ({ ...prev, error: error instanceof Error ? error.message : "Error desconocido" }));
    } finally {
      setTrailState((prev) => ({ ...prev, loading: false }));
    }
  }, [activeAccounts, selectedRegion, trailState.endTime, trailState.maxResults, trailState.startTime]);

  const requestMetrics = useCallback(
    async (resource: ResourceOption, period: number) => {
      const params = new URLSearchParams({
        accountId: resource.accountId,
        region: selectedRegion,
        serviceType: resource.kind,
        resourceId: resource.kind === "ecs" ? resource.clusterName || resource.id : resource.id,
        period: String(period),
      });
      if (resource.kind === "ecs" && resource.serviceName) params.set("serviceName", resource.serviceName);

      const response = await fetch(`/api/monitoring/aws/metrics?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar metricas");
      return (data.metrics || []) as MetricData[];
    },
    [selectedRegion],
  );

  const fetchResourceMetrics = useCallback(async () => {
    const resource = resolveExplorerResource(metricExplorer, resourceOptions);
    if (!resource) {
      setMetricExplorer((prev) => ({
        ...prev,
        metrics: [],
        error: null,
      }));
      return;
    }

    setMetricExplorer((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const metrics = await requestMetrics(resource, metricExplorer.period);
      setMetricExplorer((prev) => ({ ...prev, metrics }));
    } catch (error) {
      setMetricExplorer((prev) => ({ ...prev, error: error instanceof Error ? error.message : "Error desconocido" }));
    } finally {
      setMetricExplorer((prev) => ({ ...prev, loading: false }));
    }
  }, [metricExplorer, requestMetrics, resourceOptions]);

  const openResourceModal = useCallback(
    async (resource: ResourceOption) => {
      setModalResource(resource);
      setModalMetrics([]);
      setModalLoading(true);
      setModalError(null);

      try {
        const metrics = await requestMetrics(resource, 300);
        setModalMetrics(metrics);
      } catch (error) {
        setModalError(error instanceof Error ? error.message : "Error desconocido");
      } finally {
        setModalLoading(false);
      }
    },
    [requestMetrics],
  );

  useEffect(() => {
    fetchAccounts().catch((error) => {
      setOverviewError(error instanceof Error ? error.message : "No se pudieron cargar las cuentas");
    });
    fetchInventory();
  }, [fetchAccounts, fetchInventory]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    fetchLogGroups();
  }, [fetchLogGroups]);

  const accountSubtitle = activeAccounts.length === 0
    ? "Sin cuentas seleccionadas"
    : activeAccounts.length === accounts.length
    ? `Todas las cuentas AWS (${accounts.length})`
    : `${activeAccounts.length} cuenta${activeAccounts.length === 1 ? "" : "s"} seleccionada${activeAccounts.length === 1 ? "" : "s"}`;

  const displaySummary = activeAccountIds.length > 0 ? computedSummary : computeSummary([]);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10">
              <Activity className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Monitoreo AWS</h1>
              <p className="text-sm text-[var(--text-secondary)]">{accountSubtitle}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(280px,420px)_180px_auto]">
          <Field label="Cuenta">
            <AccountPicker
              accounts={accounts}
              selectedIds={selectedAccountIds}
              onChange={setSelectedAccountIds}
            />
          </Field>

          <Field label="Region">
            <select value={selectedRegion} onChange={(event) => setSelectedRegion(event.target.value)} className="control">
              {REGIONS.map((region) => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </Field>

          <button
            onClick={() => {
              fetchOverview(true);
              fetchInventory();
            }}
            disabled={overviewLoading}
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/15 px-4 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {overviewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Actualizar
          </button>
        </div>
      </section>

      {overviewError && <StatusMessage tone="error" message={overviewError} />}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Server} label="EC2" value={displaySummary?.totalEC2 ?? 0} detail={`${displaySummary?.runningEC2 ?? 0} running`} />
        <MetricCard icon={Database} label="RDS" value={displaySummary?.totalRDS ?? 0} detail={`${displaySummary?.availableRDS ?? 0} disponibles`} />
        <MetricCard icon={Layers3} label="ECS" value={displaySummary?.totalECSClusters ?? 0} detail={`${displaySummary?.totalECSTasks ?? 0} tasks`} />
        <MetricCard icon={Clock3} label="Cache" value={cacheInfo ? formatAge(cacheInfo.cacheAge) : "N/A"} detail={cacheInfo ? `${cacheInfo.source} - ${formatDate(cacheInfo.timestamp)}` : "Sin datos"} />
      </section>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)]/70 p-2 lg:grid-cols-4">
          <TabsTrigger className="tab-trigger" value="overview"><BarChart3 className="h-4 w-4" />Resumen</TabsTrigger>
          <TabsTrigger className="tab-trigger" value="metrics"><Activity className="h-4 w-4" />Metricas</TabsTrigger>
          <TabsTrigger className="tab-trigger" value="logs"><FileSearch className="h-4 w-4" />Logs</TabsTrigger>
          <TabsTrigger className="tab-trigger" value="trail"><ShieldCheck className="h-4 w-4" />CloudTrail</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5">
          <OverviewPanel
            loading={overviewLoading}
            resources={resourceOptions}
            onOpenResource={openResourceModal}
          />
        </TabsContent>

        <TabsContent value="metrics" className="mt-5">
          <MetricExplorer
            state={metricExplorer}
            setState={setMetricExplorer}
            resources={resourceOptions}
            onSearch={fetchResourceMetrics}
            onOpenResource={openResourceModal}
          />
        </TabsContent>

        <TabsContent value="logs" className="mt-5">
          <LogsPanel
            state={logsState}
            setState={setLogsState}
            onLoadGroups={fetchLogGroups}
            onSearch={fetchLogs}
          />
        </TabsContent>

        <TabsContent value="trail" className="mt-5">
          <CloudTrailPanel
            state={trailState}
            setState={setTrailState}
            onSearch={fetchCloudTrail}
          />
        </TabsContent>
      </Tabs>

      {modalResource && (
        <ResourceMetricsModal
          resource={modalResource}
          metrics={modalMetrics}
          loading={modalLoading}
          error={modalError}
          onClose={() => setModalResource(null)}
        />
      )}
    </div>
  );
}

function AccountPicker({
  accounts,
  selectedIds,
  onChange,
}: {
  accounts: AwsAccount[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const allSelected = accounts.length > 0 && selectedIds.length === accounts.length;
  const label = selectedIds.length === 0
    ? "Ninguna cuenta seleccionada"
    : allSelected
    ? `Todas las cuentas (${accounts.length})`
    : `${selectedIds.length} seleccionada${selectedIds.length === 1 ? "" : "s"}`;

  const toggle = (id: string) => {
    const next = selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id];
    onChange(next);
  };

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={pickerRef} className="relative">
      <button type="button" onClick={() => setOpen((current) => !current)} className="control flex items-center justify-between text-left">
        <span className="truncate">{label}</span>
        <ListFilter className="h-4 w-4 text-[var(--text-secondary)]" />
      </button>
      {open && (
        <div className="absolute z-30 mt-2 max-h-80 w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl">
          <button
            type="button"
            onClick={() => onChange(allSelected ? [] : accounts.map((account) => account.id))}
            className="flex w-full items-center gap-2 border-b border-[var(--border)] px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-white/5"
          >
            <input readOnly type="checkbox" checked={allSelected} className="h-4 w-4 accent-cyan-400" />
            Todas las cuentas
          </button>
          <div className="max-h-64 overflow-y-auto">
            {accounts.map((account) => {
              const checked = selectedIds.includes(account.id);
              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => toggle(account.id)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-white/5"
                >
                  <input readOnly type="checkbox" checked={checked} className="mt-0.5 h-4 w-4 accent-cyan-400" />
                  <span className="min-w-0">
                    <span className="block truncate text-[var(--text-primary)]">{account.name}</span>
                    <span className="block truncate text-xs text-[var(--text-secondary)]">{account.id} - {account.region}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewPanel({
  resources,
  loading,
  onOpenResource,
}: {
  resources: ResourceOption[];
  loading: boolean;
  onOpenResource: (resource: ResourceOption) => void;
}) {
  if (loading && resources.length === 0) return <LoadingPanel label="Cargando resumen de monitoreo..." />;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <ResourceTable title="EC2" icon={Server} rows={resources.filter((resource) => resource.kind === "ec2")} onOpen={onOpenResource} />
      <ResourceTable title="RDS" icon={Database} rows={resources.filter((resource) => resource.kind === "rds")} onOpen={onOpenResource} />
      <ResourceTable title="ECS" icon={Layers3} rows={resources.filter((resource) => resource.kind === "ecs")} onOpen={onOpenResource} />
    </div>
  );
}

function MetricExplorer({
  state,
  setState,
  resources,
  onSearch,
  onOpenResource,
}: {
  state: MetricExplorerState;
  setState: Dispatch<SetStateAction<MetricExplorerState>>;
  resources: ResourceOption[];
  onSearch: () => void;
  onOpenResource: (resource: ResourceOption) => void;
}) {
  const ec2Options = resources.filter((resource) => resource.kind === "ec2");
  const rdsOptions = resources.filter((resource) => resource.kind === "rds");
  const ecsClusters = resources.filter((resource) => resource.kind === "ecs" && !resource.serviceName);
  const ecsServices = resources.filter((resource) => resource.kind === "ecs" && resource.serviceName && (!state.clusterKey || resource.clusterName === resources.find((item) => item.key === state.clusterKey)?.clusterName));
  const selectedOptions = state.serviceType === "ec2" ? ec2Options : state.serviceType === "rds" ? rdsOptions : ecsServices;
  const selectedResource = resolveExplorerResource(state, resources);
  const summaryResources = state.serviceType === "ecs"
    ? resources.filter((resource) => resource.kind === "ecs")
    : resources.filter((resource) => resource.kind === state.serviceType);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Explorador de metricas CloudWatch</h2>
          <p className="panel-subtitle">Selecciona el recurso desde listas filtrables por cuenta y servicio.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        <Field label="Servicio">
          <select
            value={state.serviceType}
            onChange={(event) => setState((prev) => ({
              ...prev,
              serviceType: event.target.value as MetricExplorerState["serviceType"],
              resourceKey: "",
              clusterKey: "",
              serviceKey: "",
              metrics: [],
            }))}
            className="control"
          >
            <option value="ec2">EC2</option>
            <option value="rds">RDS</option>
            <option value="ecs">ECS</option>
          </select>
        </Field>

        {state.serviceType === "ecs" ? (
          <>
            <SearchableResourceSelect
              label="Cluster ECS"
              value={state.clusterKey}
              options={ecsClusters}
              placeholder="Buscar cluster"
              onChange={(key) => setState((prev) => ({ ...prev, clusterKey: key, serviceKey: "", resourceKey: "", metrics: [] }))}
            />
            <SearchableResourceSelect
              label="Servicio ECS"
              value={state.serviceKey}
              options={ecsServices}
              placeholder="Buscar servicio"
              onChange={(key) => setState((prev) => ({ ...prev, serviceKey: key, resourceKey: key, metrics: [] }))}
            />
          </>
        ) : (
          <div className="lg:col-span-2">
            <SearchableResourceSelect
              label={state.serviceType === "rds" ? "Instancia RDS" : "Instancia EC2"}
              value={state.resourceKey}
              options={selectedOptions}
              placeholder="Escribe para buscar"
              onChange={(key) => setState((prev) => ({ ...prev, resourceKey: key, metrics: [] }))}
            />
          </div>
        )}

        <Field label="Periodo">
          <select value={state.period} onChange={(event) => setState((prev) => ({ ...prev, period: Number(event.target.value) }))} className="control">
            <option value={60}>1 minuto</option>
            <option value={300}>5 minutos</option>
            <option value={900}>15 minutos</option>
          </select>
        </Field>
        <button
          onClick={onSearch}
          disabled={state.loading}
          className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Consultar
        </button>
      </div>

      {state.error && <StatusMessage tone="error" message={state.error} />}

      {!selectedResource && (
        <ResourceSummaryGrid
          title={`Metricas disponibles para ${state.serviceType.toUpperCase()}`}
          resources={summaryResources}
          onOpenResource={onOpenResource}
        />
      )}

      <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-2">
        {state.metrics.map((metric) => <MetricSeries key={`${metric.namespace}-${metric.metricName}`} metric={metric} />)}
      </div>

      {!state.loading && state.metrics.length === 0 && selectedResource && (
        <EmptyState icon={Activity} title="Sin metricas cargadas" description="Presiona Consultar para cargar las series CloudWatch del recurso seleccionado." />
      )}
    </section>
  );
}

function SearchableResourceSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: ResourceOption[];
  placeholder: string;
  onChange: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.key === value);
  const filteredOptions = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!selectRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <Field label={label}>
      <div ref={selectRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="control flex items-center justify-between text-left"
        >
          <span className="truncate">{selected?.label || `Todos / ${options.length} opciones`}</span>
          <Search className="h-4 w-4 text-[var(--text-secondary)]" />
        </button>
        {open && (
          <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl">
            <div className="border-b border-[var(--border)] p-2">
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="control h-9"
                placeholder={placeholder}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                onChange("");
                setQuery("");
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-white/5"
            >
              <span>Ver resumen de todos</span>
              <span className="text-xs text-[var(--text-secondary)]">{options.length}</span>
            </button>
            <div className="max-h-72 overflow-y-auto border-t border-[var(--border)]">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-[var(--text-secondary)]">Sin resultados</div>
              ) : filteredOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    onChange(option.key);
                    setQuery("");
                    setOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left hover:bg-white/5"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="block min-w-0 truncate text-sm text-[var(--text-primary)]">{option.label}</span>
                    <StatusPill value={option.status} />
                  </span>
                  <span className="mt-1 block truncate text-xs text-[var(--text-secondary)]">{option.secondary}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Field>
  );
}

function ResourceSummaryGrid({
  title,
  resources,
  onOpenResource,
}: {
  title: string;
  resources: ResourceOption[];
  onOpenResource: (resource: ResourceOption) => void;
}) {
  const [query, setQuery] = useState("");
  const filteredResources = resources.filter((resource) => {
    const text = [
      resource.name,
      resource.label,
      resource.id,
      resource.accountName,
      resource.clusterName,
      resource.serviceName,
      resource.secondary,
    ].filter(Boolean).join(" ").toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });

  return (
    <div className="mt-5 rounded-lg border border-[var(--border)] bg-black/10 p-4">
      <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
          <p className="text-xs text-[var(--text-secondary)]">Selecciona un recurso del desplegable para abrir sus graficas CloudWatch.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-input)] sm:w-80">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center border-r border-[var(--border)] text-[var(--text-secondary)]">
              <Search className="h-4 w-4" />
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]"
              placeholder="Buscar por nombre, cuenta o servicio"
            />
          </div>
          <span className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-secondary)]">
            {filteredResources.length}/{resources.length}
          </span>
        </div>
      </div>
      {resources.length === 0 ? (
        <EmptyState icon={Activity} title="Sin recursos" description="Selecciona una o varias cuentas con recursos disponibles." compact />
      ) : filteredResources.length === 0 ? (
        <EmptyState icon={Search} title="Sin resultados" description="Ajusta el texto de busqueda para encontrar el recurso." compact />
      ) : (
        <div className="grid max-h-[360px] grid-cols-1 gap-2 overflow-y-auto md:grid-cols-2 xl:grid-cols-3">
          {filteredResources.slice(0, 60).map((resource) => (
            <button
              key={resource.key}
              type="button"
              onClick={() => onOpenResource(resource)}
              className="rounded-lg border border-[var(--border)] bg-white/[0.03] p-3 text-left transition hover:border-cyan-400/40 hover:bg-cyan-500/5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">{resource.name}</p>
                  <p className="truncate text-xs text-[var(--text-secondary)]">{resource.accountName} - {resource.secondary}</p>
                </div>
                <StatusPill value={resource.status} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {resource.metrics.slice(0, 3).map((metric) => (
                  <span key={metric} className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-[var(--text-secondary)]">{metric}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LogsPanel({
  state,
  setState,
  onLoadGroups,
  onSearch,
}: {
  state: LogsState;
  setState: Dispatch<SetStateAction<LogsState>>;
  onLoadGroups: () => void;
  onSearch: () => void;
}) {
  const [selectedLog, setSelectedLog] = useState<CloudWatchLog | null>(null);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">CloudWatch Logs</h2>
          <p className="panel-subtitle">Vista con scroll interno, lectura por detalle y exportacion.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButtons logs={state.logs} />
          <button onClick={onLoadGroups} disabled={state.loadingGroups} className="secondary-button">
            {state.loadingGroups ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Grupos
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(280px,1.4fr)_repeat(4,minmax(140px,1fr))_auto]">
        <Field label="Log group">
          <select value={state.groupKey} onChange={(event) => setState((prev) => ({ ...prev, groupKey: event.target.value }))} className="control">
            <option value="">Selecciona un log group</option>
            {state.groups.map((group) => (
              <option key={group.key} value={group.key}>{group.accountName} / {group.logGroupName}</option>
            ))}
          </select>
        </Field>
        <Field label="Inicio">
          <input type="datetime-local" value={state.startTime} onChange={(event) => setState((prev) => ({ ...prev, startTime: event.target.value }))} className="control" />
        </Field>
        <Field label="Fin">
          <input type="datetime-local" value={state.endTime} onChange={(event) => setState((prev) => ({ ...prev, endTime: event.target.value }))} className="control" />
        </Field>
        <Field label="Patron">
          <input value={state.filterPattern} onChange={(event) => setState((prev) => ({ ...prev, filterPattern: event.target.value }))} className="control" placeholder="ERROR, timeout..." />
        </Field>
        <Field label="Limite">
          <select value={state.limit} onChange={(event) => setState((prev) => ({ ...prev, limit: Number(event.target.value) }))} className="control">
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
            <option value={500}>500</option>
          </select>
        </Field>
        <button onClick={onSearch} disabled={state.loadingLogs || !state.groupKey} className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60">
          {state.loadingLogs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
          Filtrar
        </button>
      </div>

      {state.error && <StatusMessage tone="error" message={state.error} />}

      <div className="mt-5 overflow-hidden rounded-lg border border-[var(--border)]">
        {state.loadingLogs ? (
          <LoadingPanel label="Consultando logs..." />
        ) : state.logs.length === 0 ? (
          <EmptyState icon={FileSearch} title="Sin logs" description="Selecciona un log group y aplica filtros." />
        ) : (
          <div className="max-h-[68vh] min-h-[420px] overflow-y-auto divide-y divide-[var(--border)]">
            <div className="sticky top-0 z-10 grid grid-cols-[170px_220px_1fr_88px] gap-2 border-b border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)]">
              <span>Hora</span>
              <span>Stream</span>
              <span>Mensaje</span>
              <span>Detalle</span>
            </div>
            {state.logs.map((log, index) => <LogRow key={`${log.timestamp}-${index}`} log={log} onOpen={() => setSelectedLog(log)} />)}
          </div>
        )}
      </div>

      {selectedLog && <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </section>
  );
}

function ExportButtons({ logs }: { logs: CloudWatchLog[] }) {
  const disabled = logs.length === 0;

  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={() => exportLogs(logs, "txt")} disabled={disabled} className="secondary-button"><Download className="h-4 w-4" />TXT</button>
      <button onClick={() => exportLogs(logs, "json")} disabled={disabled} className="secondary-button"><Download className="h-4 w-4" />JSON</button>
      <button onClick={() => exportLogs(logs, "xlsx")} disabled={disabled} className="secondary-button"><Download className="h-4 w-4" />XLSX</button>
    </div>
  );
}

function CloudTrailPanel({
  state,
  setState,
  onSearch,
}: {
  state: TrailState;
  setState: Dispatch<SetStateAction<TrailState>>;
  onSearch: () => void;
}) {
  const [selectedEvent, setSelectedEvent] = useState<TrailEvent | null>(null);
  const filteredEvents = useMemo(() => {
    const query = state.query.trim().toLowerCase();
    if (!query) return state.events;
    return state.events.filter((event) => {
      const resources = (event.resources || []).map((resource) => `${resource.resourceType || ""} ${resource.resourceName || ""}`).join(" ");
      return [
        event.eventName,
        event.eventSource,
        event.username,
        event.accountName,
        event.accountId,
        resources,
      ].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [state.events, state.query]);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">CloudTrail</h2>
          <p className="panel-subtitle">Busca primero por fecha y luego filtra por usuario, evento, cuenta o servicio.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(220px,1.4fr)_repeat(3,minmax(140px,1fr))_auto]">
        <Field label="Buscar">
          <input value={state.query} onChange={(event) => setState((prev) => ({ ...prev, query: event.target.value }))} className="control" placeholder="usuario, evento, servicio, cuenta..." />
        </Field>
        <Field label="Inicio">
          <input type="datetime-local" value={state.startTime} onChange={(event) => setState((prev) => ({ ...prev, startTime: event.target.value }))} className="control" />
        </Field>
        <Field label="Fin">
          <input type="datetime-local" value={state.endTime} onChange={(event) => setState((prev) => ({ ...prev, endTime: event.target.value }))} className="control" />
        </Field>
        <Field label="Limite por cuenta">
          <select value={state.maxResults} onChange={(event) => setState((prev) => ({ ...prev, maxResults: Number(event.target.value) }))} className="control">
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </Field>
        <button onClick={onSearch} disabled={state.loading} className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60">
          {state.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListFilter className="h-4 w-4" />}
          Buscar
        </button>
      </div>

      {state.error && <StatusMessage tone="error" message={state.error} />}

      <div className="mt-5 overflow-hidden rounded-lg border border-[var(--border)]">
        {state.loading ? (
          <LoadingPanel label="Consultando CloudTrail..." />
        ) : filteredEvents.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Sin eventos" description="Ajusta la fecha o la busqueda libre para revisar actividad." />
        ) : (
          <div className="max-h-[68vh] min-h-[420px] overflow-y-auto divide-y divide-[var(--border)]">
            <div className="sticky top-0 z-10 grid grid-cols-[170px_1fr_200px_180px_92px] gap-2 border-b border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)]">
              <span>Hora</span>
              <span>Evento</span>
              <span>Usuario</span>
              <span>Cuenta</span>
              <span>Detalle</span>
            </div>
            {filteredEvents.map((event, index) => (
              <TrailRow
                key={`${event.eventTime}-${event.eventName}-${index}`}
                event={event}
                onOpen={() => setSelectedEvent(event)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedEvent && <CloudTrailDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </section>
  );
}

function ResourceTable({
  title,
  icon: Icon,
  rows,
  onOpen,
}: {
  title: string;
  icon: LucideIcon;
  rows: ResourceOption[];
  onOpen: (resource: ResourceOption) => void;
}) {
  return (
    <section className="panel min-h-[360px]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-cyan-300" />
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
        </div>
        <span className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-secondary)]">{rows.length}</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Icon} title={`Sin ${title}`} description="No hay recursos reportados en cache." compact />
      ) : (
        <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
          {rows.map((row) => (
            <button key={row.key} onClick={() => onOpen(row)} className="w-full rounded-lg border border-[var(--border)] bg-black/10 p-3 text-left transition hover:border-cyan-400/40 hover:bg-cyan-500/5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">{row.name}</p>
                  <p className="truncate text-xs text-[var(--text-secondary)]">{row.accountName} - {row.secondary}</p>
                </div>
                <StatusPill value={row.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {row.metrics.map((metric) => <span key={metric} className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-[var(--text-secondary)]">{metric}</span>)}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function ResourceMetricsModal({
  resource,
  metrics,
  loading,
  error,
  onClose,
}: {
  resource: ResourceOption;
  metrics: MetricData[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const cpuMetric = metrics.find((metric) => metric.metricName === "CPUUtilization");
  const memoryMetric = metrics.find((metric) => ["MemoryUtilization", "FreeableMemory"].includes(metric.metricName));
  const additionalMetrics = metrics.filter((metric) => !["CPUUtilization", "MemoryUtilization", "FreeableMemory"].includes(metric.metricName));
  const memoryTitle = resource.kind === "rds" ? "RAM libre" : "RAM";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <section className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-[var(--text-primary)]">{resource.name}</h2>
            <p className="text-sm text-[var(--text-secondary)]">{resource.accountName} - {resource.kind.toUpperCase()}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill value={resource.status} />
            <button onClick={onClose} className="secondary-button" aria-label="Cerrar"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="max-h-[76vh] overflow-y-auto p-4">
          {loading ? <LoadingPanel label="Cargando metricas del recurso..." /> : error ? <StatusMessage tone="error" message={error} /> : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <ChartPanel title="CPU" metric={cpuMetric} unit="%" />
                <ChartPanel
                  title={memoryTitle}
                  metric={memoryMetric}
                  unit={resource.kind === "rds" ? "bytes" : "%"}
                  emptyMessage={resource.kind === "ec2" ? "EC2 no publica RAM nativa en CloudWatch; requiere CloudWatch Agent." : "No hay datos de memoria para este recurso."}
                />
              </div>
              {additionalMetrics.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Metricas adicionales</h3>
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {additionalMetrics.map((metric) => (
                      <ChartPanel
                        key={`${metric.namespace}-${metric.metricName}`}
                        title={metric.metricName}
                        metric={metric}
                        unit={metric.unit || "None"}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ChartPanel({ title, metric, unit, emptyMessage }: { title: string; metric?: MetricData; unit: string; emptyMessage?: string }) {
  const data = (metric?.statistics || []).map((point) => ({
    time: formatTime(point.timestamp),
    avg: point.average || 0,
    max: point.maximum || 0,
    min: point.minimum || 0,
  }));

  return (
    <div className="rounded-lg border border-[var(--border)] bg-black/10 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        <span className="rounded-md bg-white/5 px-2 py-1 text-xs text-[var(--text-secondary)]">{metric?.metricName || unit}</span>
      </div>
      {data.length === 0 ? (
        <EmptyState icon={Activity} title="Sin datos" description={emptyMessage || "CloudWatch no devolvio puntos para esta metrica."} compact />
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
              <XAxis dataKey="time" stroke="rgb(148,163,184)" fontSize={11} />
              <YAxis stroke="rgb(148,163,184)" fontSize={11} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(148,163,184,0.25)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="avg" name="Avg" stroke="#22d3ee" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="max" name="Max" stroke="#a7f3d0" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="min" name="Min" stroke="#fbbf24" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function MetricSeries({ metric }: { metric: MetricData }) {
  const latest = metric.statistics.at(-1);
  return (
    <div className="rounded-lg border border-[var(--border)] bg-black/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{metric.metricName}</h3>
          <p className="text-xs text-[var(--text-secondary)]">{metric.namespace}</p>
        </div>
        <span className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-secondary)]">{metric.unit || "None"}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniStat label="Promedio" value={latest?.average?.toFixed(2) || "N/A"} />
        <MiniStat label="Maximo" value={latest?.maximum?.toFixed(2) || "N/A"} />
        <MiniStat label="Minimo" value={latest?.minimum?.toFixed(2) || "N/A"} />
      </div>
      <div className="mt-4">
        <ChartPanel title="Serie" metric={metric} unit={metric.unit || "None"} />
      </div>
    </div>
  );
}

function LogRow({ log, onOpen }: { log: CloudWatchLog; onOpen: () => void }) {
  return (
    <div className="grid grid-cols-[170px_220px_1fr_88px] gap-2 p-3">
      <div className="text-xs text-[var(--text-secondary)]">{formatDate(log.timestamp)}</div>
      <div className="truncate text-xs text-cyan-200">{log.logStreamName || "stream"}</div>
      <pre className="max-h-28 overflow-hidden whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-[var(--text-primary)]/90">{log.message}</pre>
      <button onClick={onOpen} className="secondary-button justify-center px-2">Abrir</button>
    </div>
  );
}

function LogDetailModal({ log, onClose }: { log: CloudWatchLog; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <section className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Detalle del log</h2>
            <p className="text-xs text-[var(--text-secondary)]">{formatDate(log.timestamp)} - {log.logStreamName || "stream"}</p>
          </div>
          <button onClick={onClose} className="secondary-button" aria-label="Cerrar"><X className="h-4 w-4" /></button>
        </div>
        <pre className="max-h-[72vh] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-[var(--text-primary)]">{log.message}</pre>
      </section>
    </div>
  );
}

function TrailRow({ event, onOpen }: { event: TrailEvent; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="grid w-full grid-cols-[170px_1fr_200px_180px_92px] gap-2 p-3 text-left transition hover:bg-cyan-500/5">
      <div className="text-xs text-[var(--text-secondary)]">{formatDate(event.eventTime)}</div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{event.eventName || "Evento"}</p>
        <p className="text-xs text-[var(--text-secondary)]">{event.eventSource || "AWS"}</p>
        {event.resources && event.resources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {event.resources.slice(0, 4).map((resource, index) => (
              <span key={`${resource.resourceName}-${index}`} className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-[var(--text-secondary)]">
                {resource.resourceType || "resource"}: {resource.resourceName || "N/A"}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="truncate text-xs text-cyan-200">{event.username || "unknown"}</div>
      <div className="truncate text-xs text-[var(--text-secondary)]">{event.accountName || event.accountId || "AWS"}</div>
      <span className="secondary-button justify-center px-2">Ver</span>
    </button>
  );
}

function CloudTrailDetailModal({ event, onClose }: { event: TrailEvent; onClose: () => void }) {
  const parsedEvent = parseCloudTrailEvent(event.cloudTrailEvent);
  const detailRows = [
    ["Evento", event.eventName || "N/A"],
    ["Fuente", event.eventSource || parsedEvent?.eventSource || "N/A"],
    ["Usuario", event.username || parsedEvent?.userIdentity?.arn || "N/A"],
    ["Cuenta", event.accountName || event.accountId || "N/A"],
    ["Fecha", formatDate(event.eventTime)],
    ["Event ID", event.eventId || parsedEvent?.eventID || "N/A"],
    ["Access Key", event.accessKeyId || parsedEvent?.userIdentity?.accessKeyId || "N/A"],
    ["IP origen", parsedEvent?.sourceIPAddress || "N/A"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <section className="max-h-[88vh] w-full max-w-6xl overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-[var(--text-primary)]">{event.eventName || "Detalle CloudTrail"}</h2>
            <p className="text-sm text-[var(--text-secondary)]">{event.eventSource || "AWS"} - {event.accountName || event.accountId || "Cuenta AWS"}</p>
          </div>
          <button onClick={onClose} className="secondary-button" aria-label="Cerrar"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid max-h-[76vh] grid-cols-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[360px_1fr]">
          <div className="rounded-lg border border-[var(--border)] bg-black/10 p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Resumen</h3>
            <div className="space-y-3">
              {detailRows.map(([label, value]) => (
                <div key={label}>
                  <p className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">{label}</p>
                  <p className="mt-1 break-words text-sm text-[var(--text-primary)]">{String(value)}</p>
                </div>
              ))}
            </div>
            {event.resources && event.resources.length > 0 && (
              <div className="mt-5">
                <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Recursos</h3>
                <div className="flex flex-wrap gap-2">
                  {event.resources.map((resource, index) => (
                    <span key={`${resource.resourceName}-${index}`} className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-[var(--text-secondary)]">
                      {resource.resourceType || "resource"}: {resource.resourceName || "N/A"}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-black/10">
            <div className="border-b border-[var(--border)] px-4 py-3">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Evento completo</h3>
            </div>
            <pre className="max-h-[64vh] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-[var(--text-primary)]">
              {JSON.stringify(parsedEvent || event, null, 2)}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">{label}</span>
      {children}
    </label>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)]/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10"><Icon className="h-5 w-5 text-cyan-300" /></div>
      </div>
      <p className="mt-2 truncate text-xs text-[var(--text-secondary)]">{detail}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/5 p-3">
      <p className="text-[11px] text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const isGood = ["running", "available", "active", "ok"].includes(normalized);
  const isBad = ["stopped", "failed", "error", "terminated"].includes(normalized);

  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${isGood ? "bg-emerald-500/10 text-emerald-300" : isBad ? "bg-red-500/10 text-red-300" : "bg-amber-500/10 text-amber-300"}`}>
      {isGood ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {value || "unknown"}
    </span>
  );
}

function StatusMessage({ tone, message }: { tone: "error" | "info"; message: string }) {
  return (
    <div className={`rounded-lg border p-4 text-sm ${tone === "error" ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-cyan-500/30 bg-cyan-500/10 text-cyan-100"}`}>
      {message}
    </div>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-[var(--text-secondary)]">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, compact }: { icon: LucideIcon; title: string; description: string; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "py-8" : "min-h-56 py-10"}`}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white/5"><Icon className="h-5 w-5 text-[var(--text-secondary)]" /></div>
      <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}

function computeSummary(metrics: AccountMetrics[]): GlobalSummary {
  return metrics.reduce<GlobalSummary>((acc, account) => ({
    totalAccounts: acc.totalAccounts + 1,
    totalEC2: acc.totalEC2 + account.ec2.summary.total,
    runningEC2: acc.runningEC2 + account.ec2.summary.running,
    totalRDS: acc.totalRDS + account.rds.summary.total,
    availableRDS: acc.availableRDS + account.rds.summary.available,
    totalECSClusters: acc.totalECSClusters + account.ecs.summary.totalClusters,
    totalECSTasks: acc.totalECSTasks + account.ecs.summary.totalTasks,
  }), {
    totalAccounts: 0,
    totalEC2: 0,
    runningEC2: 0,
    totalRDS: 0,
    availableRDS: 0,
    totalECSClusters: 0,
    totalECSTasks: 0,
  });
}

function buildResourceOptions(metrics: AccountMetrics[], inventory: InventoryItem[]): ResourceOption[] {
  const flatInventory = flattenInventory(inventory);
  const ecsInventory = flatInventory.filter((item) => item.provider === "AWS" && item.service === "ECS");
  const ec2InventoryById = new Map(
    flatInventory
      .filter((item) => item.provider === "AWS" && item.service === "EC2" && item.id)
      .map((item) => [`${item.accountId || ""}::${item.id || ""}`, item]),
  );
  const options: ResourceOption[] = [];

  for (const account of metrics) {
    for (const instance of account.ec2.instances) {
      const inventoryInstance = ec2InventoryById.get(`${account.accountId}::${instance.instanceId}`);
      const instanceName = inventoryInstance?.name && inventoryInstance.name !== "N/A"
        ? inventoryInstance.name
        : instance.instanceId;
      options.push({
        key: `ec2::${account.accountId}::${instance.instanceId}`,
        kind: "ec2",
        accountId: account.accountId,
        accountName: account.accountName,
        id: instance.instanceId,
        name: instanceName,
        label: `${account.accountName} / ${instanceName} (${instance.instanceId})`,
        status: instance.state,
        secondary: `${instance.instanceType} - ${instance.instanceId}`,
        metrics: [`CPU ${formatPercent(instance.cpuUtilization)}`, `In ${formatBytes(instance.networkIn)}`, `Out ${formatBytes(instance.networkOut)}`],
      });
    }

    for (const instance of account.rds.instances) {
      options.push({
        key: `rds::${account.accountId}::${instance.dbInstanceIdentifier}`,
        kind: "rds",
        accountId: account.accountId,
        accountName: account.accountName,
        id: instance.dbInstanceIdentifier,
        name: instance.dbInstanceIdentifier,
        label: `${account.accountName} / ${instance.dbInstanceIdentifier} (${instance.engine})`,
        status: instance.status,
        secondary: instance.engine,
        metrics: [`CPU ${formatPercent(instance.cpuUtilization)}`, `${instance.databaseConnections} conexiones`, `${formatBytes(instance.freeStorageSpace)} libres`],
      });
    }

    for (const cluster of account.ecs.clusters) {
      const clusterName = cluster.clusterName;
      options.push({
        key: `ecs-cluster::${account.accountId}::${clusterName}`,
        kind: "ecs",
        accountId: account.accountId,
        accountName: account.accountName,
        id: clusterName,
        name: clusterName,
        label: `${account.accountName} / ${clusterName}`,
        clusterName,
        status: cluster.status,
        secondary: `${cluster.servicesCount} servicios`,
        metrics: [`CPU ${formatPercent(cluster.cpuUtilization)}`, `Mem ${formatPercent(cluster.memoryUtilization)}`, `${cluster.runningTasksCount} tasks`],
      });

      for (const service of ecsInventory.filter((item) => item.accountId === account.accountId && item.resourceType === "SERVICE" && getString(item.raw?.clusterName) === clusterName)) {
        const serviceName = service.name || service.id || "service";
        options.push({
          key: `ecs-service::${account.accountId}::${clusterName}::${serviceName}`,
          kind: "ecs",
          accountId: account.accountId,
          accountName: account.accountName,
          id: serviceName,
          name: `${clusterName} / ${serviceName}`,
          label: `${account.accountName} / ${clusterName} / ${serviceName}`,
          clusterName,
          serviceName,
          status: service.status || "UNKNOWN",
          secondary: "Servicio ECS",
          metrics: [`Cluster ${clusterName}`, service.host ? `Host ${service.host}` : "Servicio"],
        });
      }
    }
  }

  return options;
}

function resolveExplorerResource(state: MetricExplorerState, resources: ResourceOption[]) {
  if (state.serviceType === "ecs") return resources.find((resource) => resource.key === state.serviceKey && resource.serviceName);
  return resources.find((resource) => resource.key === state.resourceKey && resource.kind === state.serviceType);
}

function flattenInventory(items: InventoryItem[]): InventoryItem[] {
  return items.flatMap((item) => [item, ...flattenInventory(item.children || [])]);
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function parseCloudTrailEvent(value?: string) {
  if (!value) return null;
  try {
    return JSON.parse(value) as any;
  } catch {
    return { raw: value };
  }
}

async function exportLogs(logs: CloudWatchLog[], format: "txt" | "json" | "xlsx") {
  const filename = `cloudwatch-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.${format}`;
  if (format === "txt") {
    downloadBlob(logs.map((log) => `[${new Date(log.timestamp).toISOString()}] ${log.logStreamName || ""}\n${log.message}`).join("\n\n"), filename, "text/plain;charset=utf-8");
    return;
  }
  if (format === "json") {
    downloadBlob(JSON.stringify(logs, null, 2), filename, "application/json;charset=utf-8");
    return;
  }

  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.json_to_sheet(logs.map((log) => ({
    timestamp: new Date(log.timestamp).toISOString(),
    stream: log.logStreamName || "",
    message: log.message,
  })));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Logs");
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  downloadBlob(buffer, filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
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

function formatAge(ms: number) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatDate(value: string | number | Date) {
  return new Date(value).toLocaleString("es-CO", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatTime(value: string | number | Date) {
  return new Date(value).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "N/A";
  return `${value.toFixed(1)}%`;
}

function formatBytes(value: number) {
  if (!Number.isFinite(value)) return "N/A";
  if (value < 1024) return `${value.toFixed(0)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let next = value / 1024;
  let unit = 0;
  while (next >= 1024 && unit < units.length - 1) {
    next /= 1024;
    unit++;
  }
  return `${next.toFixed(1)} ${units[unit]}`;
}
