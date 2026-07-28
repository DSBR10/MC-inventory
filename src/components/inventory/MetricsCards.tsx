import {
  Shield,
  Cloud,
  Server,
  Cpu,
  Boxes,
  AlertTriangle,
} from "lucide-react";

import { InventoryItem } from "@/types/inventory";

type Props = {
  data: InventoryItem[];
};

export default function MetricsCards({ data }: Props) {
  const total = data.length;

  const running = data.filter((i) =>
    ["running", "available", "active", "ok"].includes(i.status.toLowerCase()),
  ).length;

  const servers = data.filter((i) =>
    (i.provider === "AWS" && i.service === "EC2") ||
    (i.provider === "HUAWEI CLOUD" && i.service === "ECS")
  ).length;

  const providers = new Set(data.map((i) => i.provider)).size;

  const services = new Set(data.map((i) => i.service)).size;

  const accounts = new Set(data.map((i) => i.accountName)).size;

  const metrics = [
    {
      label: "Total Recursos",
      value: total,
      subtitle: "Filtrados",
      icon: Boxes,
      color: "var(--primary)",
      gradient: "linear-gradient(135deg, var(--primary), var(--accent))",
    },
    {
      label: "Providers",
      value: providers,
      subtitle: "Clouds activos",
      icon: Cloud,
      color: "var(--info)",
      gradient: "linear-gradient(135deg, var(--info), #06b6d4)",
    },
    {
      label: "Servicios",
      value: services,
      subtitle: "Tipos únicos",
      icon: Server,
      color: "var(--warning)",
      gradient: "linear-gradient(135deg, var(--warning), #f97316)",
    },
    {
      label: "Running",
      value: running,
      subtitle: "Operativos",
      icon: Shield,
      color: "var(--success)",
      gradient: "linear-gradient(135deg, var(--success), #34d399)",
    },
    {
      label: "Servidores",
      value: servers,
      subtitle: "EC2 + Huawei ECS",
      icon: Cpu,
      color: "var(--info)",
      gradient: "linear-gradient(135deg, var(--info), #06b6d4)",
    },
    {
      label: "Cuentas",
      value: accounts,
      subtitle: "Bajo gestión",
      icon: AlertTriangle,
      color: "var(--secondary)",
      gradient: "linear-gradient(135deg, var(--secondary), #a78bfa)",
    },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div
            key={metric.label}
            className="group relative overflow-hidden rounded-2xl border border-[var(--border)] p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
            style={{
              background: "var(--bg-card)",
              boxShadow: "0 2px 20px var(--shadow-color)",
            }}
          >
            {/* Top accent bar */}
            <div
              className="absolute top-0 left-3 right-3 h-0.5 rounded-full opacity-60 transition-all duration-300 group-hover:opacity-100 group-hover:h-1"
              style={{ background: metric.gradient }}
            />

            {/* Hover glow */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{
                background: `radial-gradient(600px circle at 50% 0%, ${metric.color}15, transparent 70%)`,
              }}
            />

            <div className="relative z-10">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1 font-semibold">
                    {metric.label}
                  </p>
                  <p
                    className="text-3xl font-bold tracking-tight transition-all duration-300 group-hover:scale-105 origin-left"
                    style={{ color: metric.color }}
                  >
                    {metric.value}
                  </p>
                </div>

                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg"
                  style={{
                    background: `${metric.color}18`,
                    color: metric.color,
                  }}
                >
                  <Icon size={17} />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div
                  className="w-1.5 h-1.5 rounded-full transition-all duration-300 group-hover:scale-125"
                  style={{ background: metric.color }}
                />
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {metric.subtitle}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
