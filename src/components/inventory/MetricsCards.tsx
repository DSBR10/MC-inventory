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
    ["running", "available", "active", "ok"].includes((i.status || "").toLowerCase()),
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
    },
    {
      label: "Providers",
      value: providers,
      subtitle: "Clouds activos",
      icon: Cloud,
      color: "var(--info)",
    },
    {
      label: "Servicios",
      value: services,
      subtitle: "Tipos únicos",
      icon: Server,
      color: "var(--warning)",
    },
    {
      label: "Running",
      value: running,
      subtitle: "Operativos",
      icon: Shield,
      color: "var(--success)",
    },
    {
      label: "Servidores",
      value: servers,
      subtitle: "EC2 + Huawei ECS",
      icon: Cpu,
      color: "var(--info)",
    },
    {
      label: "Cuentas",
      value: accounts,
      subtitle: "Bajo gestión",
      icon: AlertTriangle,
      color: "var(--secondary)",
    },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div
            key={metric.label}
            className="relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3.5 transition-colors duration-200 hover:border-[color-mix(in_srgb,var(--primary)_20%,var(--border))]"
          >
            <div
              className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full opacity-70"
              style={{ background: metric.color }}
            />

            <div className="pl-3">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-0.5 font-medium">
                    {metric.label}
                  </p>
                  <p
                    className="text-2xl font-bold tracking-tight"
                    style={{ color: metric.color }}
                  >
                    {metric.value}
                  </p>
                </div>

                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: `${metric.color}12`,
                    color: metric.color,
                  }}
                >
                  <Icon size={15} />
                </div>
              </div>

              <p className="text-[11px] text-[var(--text-secondary)]">
                {metric.subtitle}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
