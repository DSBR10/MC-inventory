"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Boxes,
  Activity,
  Cloud,
  Server,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";

import { InventoryItem } from "@/types/inventory";
import ServiceBadge from "@/components/inventory/ServiceBadge";
import BrandLogo from "@/components/layout/BrandLogo";

function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-[var(--bg-dark)] flex items-center justify-center z-50">
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
      <div className="text-center space-y-6 flex flex-col items-center">
        <div className="relative w-20 h-20">
          <div
            className="absolute inset-0 rounded-2xl animate-ping opacity-20"
            style={{ background: "linear-gradient(135deg, #7c3aed, #06b6d4)" }}
          />
          <div
            className="relative flex items-center justify-center w-20 h-20 rounded-2xl"
            style={{ background: "linear-gradient(135deg, #7c3aed, #06b6d4)" }}
          >
            <BrandLogo size={52} />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            Dashboard
          </h1>
          <p className="text-[var(--text-primary)]/40 text-sm">
            Cargando datos del dashboard...
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

type MetricCardProps = {
  label: string;
  value: number;
  icon: React.ReactNode;
  accentColor: string;
};

function MetricCard({ label, value, icon, accentColor }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)] truncate">
            {label}
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mt-1 tabular-nums truncate" title={value.toLocaleString("es-CO")}>
            {value.toLocaleString("es-CO")}
          </p>
        </div>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${accentColor}18`, color: accentColor }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

type SectionTitleProps = {
  children: React.ReactNode;
};

function SectionTitle({ children }: SectionTitleProps) {
  return (
    <div className="flex items-center gap-3 mb-4 pb-2 border-b border-[var(--border)]">
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">
        {children}
      </h2>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [loadError, setLoadError] = useState("");

  const load = async (initial = false) => {
    try {
      if (initial) {
        setLoading(true);
        setLoadError("");
      } else {
        setRefreshing(true);
      }
      const res = await fetch("/api/inventory", { cache: "no-store" });
      if (!res.ok) throw new Error(`Inventario respondió ${res.status}`);
      const json = await res.json();
      setData(Array.isArray(json.data) ? json.data : []);
      setLastUpdate(
        new Date(json.timestamp).toLocaleTimeString("es-CO", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      if (initial) setLoadError("No se pudieron cargar los datos del dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const guarded = (initial = false) => {
      if (!mounted) return;
      if (document.hidden && !initial) return;
      void load(initial);
    };
    void guarded(true);
    const interval = setInterval(() => guarded(false), 60000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalResources = data.length;

  const runningCount = useMemo(
    () =>
      data.filter((item) => {
        const s = (item.status || "").toLowerCase();
        return [
          "running",
          "available",
          "active",
          "ok",
          "in-use",
          "associated",
        ].includes(s);
      }).length,
    [data]
  );

  const stoppedCount = useMemo(
    () =>
      data.filter((item) => {
        const s = (item.status || "").toLowerCase();
        return [
          "stopped",
          "terminated",
          "stopping",
          "shutting-down",
          "deleted",
          "failed",
        ].includes(s);
      }).length,
    [data]
  );

  const uniqueProviders = useMemo(
    () => [...new Set(data.map((i) => i.provider || "N/A"))],
    [data]
  );

  const uniqueServices = useMemo(
    () => [...new Set(data.map((i) => i.service))],
    [data]
  );

  const uniqueAccounts = useMemo(
    () => [...new Set(data.map((i) => i.accountName))],
    [data]
  );

  const serviceDistribution = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((item) => {
      map.set(item.service, (map.get(item.service) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [data]);

  const providerDistribution = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((item) => {
      const provider = item.provider || "N/A";
      map.set(provider, (map.get(provider) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  const statusDistribution = useMemo(() => {
    let running = 0;
    let stopped = 0;
    let other = 0;
    data.forEach((item) => {
      const s = (item.status || "").toLowerCase();
      if (
        [
          "running",
          "available",
          "active",
          "ok",
          "in-use",
          "associated",
        ].includes(s)
      ) {
        running++;
      } else if (
        [
          "stopped",
          "terminated",
          "stopping",
          "shutting-down",
          "deleted",
          "failed",
        ].includes(s)
      ) {
        stopped++;
      } else {
        other++;
      }
    });
    return [
      { name: "Running", value: running },
      { name: "Stopped", value: stopped },
      { name: "Other", value: other },
    ].filter((d) => d.value > 0);
  }, [data]);

  const accountSummary = useMemo(() => {
    const map = new Map<
      string,
      { accountName: string; provider: string; total: number; running: number; stopped: number }
    >();
    data.forEach((item) => {
      const key = `${item.accountName}|${item.provider || "N/A"}`;
      const existing = map.get(key);
      const isRunning = [
        "running",
        "available",
        "active",
        "ok",
        "in-use",
        "associated",
      ].includes((item.status || "").toLowerCase());
      const isStopped = [
        "stopped",
        "terminated",
        "stopping",
        "shutting-down",
        "deleted",
        "failed",
      ].includes((item.status || "").toLowerCase());
      if (existing) {
        existing.total++;
        if (isRunning) existing.running++;
        if (isStopped) existing.stopped++;
      } else {
        map.set(key, {
          accountName: item.accountName,
          provider: item.provider || "N/A",
          total: 1,
          running: isRunning ? 1 : 0,
          stopped: isStopped ? 1 : 0,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [data]);

  const topServicesDetail = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((item) => {
      map.set(item.service, (map.get(item.service) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count, pct: totalResources > 0 ? (count / totalResources) * 100 : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [data, totalResources]);

  const PIE_COLORS: Record<string, string> = {
    Running: "#10b981",
    Stopped: "#ef4444",
    Other: "#6366f1",
  };

  if (loading) return <LoadingScreen />;

  if (loadError) {
    return (
      <div className="min-h-screen space-y-6">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-8 text-center">
          <p className="text-base font-semibold text-red-300">No se pudieron cargar los datos</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{loadError} Revisa tu conexión e inténtalo de nuevo.</p>
          <button
            type="button"
            onClick={() => void load(true)}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-cyan-500 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            <RefreshCw className="h-4 w-4" /> Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] p-5"
        style={{ background: "var(--glass-bg)", backdropFilter: "blur(16px)" }}
      >
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: "linear-gradient(135deg, var(--gradient-start), var(--gradient-end))" }}
        />
        <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl opacity-15"
                style={{ background: "linear-gradient(135deg, var(--gradient-start), var(--gradient-end))" }}
              />
              <div
                className="relative w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-lg"
                style={{ background: "linear-gradient(135deg, var(--gradient-start), var(--gradient-end))" }}
              >
                <Activity size={18} />
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
                Vista general de servicios cloud
                {lastUpdate && (
                  <span className="ml-2 text-[var(--text-primary)]/20">
                    · actualizado <span className="text-[var(--text-primary)]/40 font-medium">{lastUpdate}</span>
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          label="Total Recursos"
          value={totalResources}
          icon={<Boxes size={20} className="text-[var(--text-secondary)]" />}
          accentColor="#6366f1"
        />
        <MetricCard
          label="Activos"
          value={runningCount}
          icon={<CheckCircle2 size={20} className="text-emerald-400" />}
          accentColor="#10b981"
        />
        <MetricCard
          label="Inactivos"
          value={stoppedCount}
          icon={<XCircle size={20} className="text-red-400" />}
          accentColor="#ef4444"
        />
        <MetricCard
          label="Providers"
          value={uniqueProviders.length}
          icon={<Cloud size={20} className="text-cyan-400" />}
          accentColor="#06b6d4"
        />
        <MetricCard
          label="Servicios"
          value={uniqueServices.length}
          icon={<Server size={20} className="text-violet-400" />}
          accentColor="#8b5cf6"
        />
        <MetricCard
          label="Cuentas"
          value={uniqueAccounts.length}
          icon={<Shield size={20} className="text-amber-400" />}
          accentColor="#f59e0b"
        />
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <SectionTitle>Distribución por Servicio</SectionTitle>
        {serviceDistribution.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--text-secondary)]">Sin datos para mostrar.</p>
        ) : (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={serviceDistribution}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <XAxis type="number" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                width={130}
                tickFormatter={(v: string) => (v.length > 18 ? `${v.slice(0, 17)}…` : v)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--text-primary)",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
          <SectionTitle>Recursos por Provider</SectionTitle>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={providerDistribution}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <XAxis type="number" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                  width={120}
                  tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--text-primary)",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="#06b6d4" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
          <SectionTitle>Estado de Recursos</SectionTitle>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {statusDistribution.map((entry) => (
                    <Cell key={entry.name} fill={PIE_COLORS[entry.name] || "#6366f1"} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--text-primary)",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-2">
            {statusDistribution.map((entry) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: PIE_COLORS[entry.name] || "#6366f1" }}
                />
                <span className="text-xs text-[var(--text-secondary)]">
                  {entry.name} ({entry.value})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <SectionTitle>Resumen por Cuenta</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[var(--text-secondary)] font-semibold">
                  Cuenta
                </th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[var(--text-secondary)] font-semibold">
                  Provider
                </th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[var(--text-secondary)] font-semibold">
                  Recursos
                </th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[var(--text-secondary)] font-semibold">
                  Activos
                </th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[var(--text-secondary)] font-semibold">
                  Inactivos
                </th>
              </tr>
            </thead>
            <tbody>
              {accountSummary.map((row) => (
                <tr
                  key={`${row.accountName}-${row.provider}`}
                  className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <td className="py-3 px-4 text-[var(--text-primary)] font-medium">
                    {row.accountName}
                  </td>
                  <td className="py-3 px-4 text-[var(--text-secondary)]">
                    {row.provider}
                  </td>
                  <td className="py-3 px-4 text-right text-[var(--text-primary)] font-semibold tabular-nums">
                    {row.total.toLocaleString("es-CO")}
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-400 tabular-nums">
                    {row.running.toLocaleString("es-CO")}
                  </td>
                  <td className="py-3 px-4 text-right text-red-400 tabular-nums">
                    {row.stopped.toLocaleString("es-CO")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <SectionTitle>Detalle de Servicios</SectionTitle>
        {topServicesDetail.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--text-secondary)]">Sin datos para mostrar.</p>
        ) : (
        <div className="space-y-3">
          {topServicesDetail.map((svc) => (
            <div
              key={svc.name}
              className="flex flex-wrap items-center gap-x-4 gap-y-2"
            >
              <div className="w-36 min-w-0 flex-shrink-0">
                <ServiceBadge service={svc.name} />
              </div>
              <span className="text-sm font-semibold text-[var(--text-primary)] tabular-nums w-12 text-right flex-shrink-0">
                {svc.count}
              </span>
              <div className="flex-1 h-2 rounded-full bg-[var(--bg-hover)] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${svc.pct}%`,
                    backgroundColor: "#6366f1",
                  }}
                />
              </div>
              <span className="text-xs text-[var(--text-secondary)] tabular-nums w-12 text-right flex-shrink-0">
                {svc.pct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
