import {
  Shield,
  Cloud,
  Server,
  Globe,
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

  const exposed = data.filter((i) => i.publiclyExposed).length;

  const providers = new Set(data.map((i) => i.provider)).size;

  const services = new Set(data.map((i) => i.service)).size;

  const accounts = new Set(data.map((i) => i.accountName)).size;

  const metrics = [
    {
      label: "Total Recursos",
      value: total,
      subtitle: "Filtrados",
      icon: <Boxes size={18} />,
      color: "var(--primary)",
    },

    {
      label: "Providers",
      value: providers,
      subtitle: "Clouds",
      icon: <Cloud size={18} />,
      color: "var(--info)",
    },

    {
      label: "Servicios",
      value: services,
      subtitle: "Únicos",
      icon: <Server size={18} />,
      color: "var(--warning)",
    },

    {
      label: "Running",
      value: running,
      subtitle: "Operativos",
      icon: <Shield size={18} />,
      color: "var(--success)",
    },

    {
      label: "Expuestos",
      value: exposed,
      subtitle: "Públicos",
      icon: <Globe size={18} />,
      color: "var(--error)",
    },

    {
      label: "Cuentas",
      value: accounts,
      subtitle: "Detectadas",
      icon: <AlertTriangle size={18} />,
      color: "var(--secondary)",
    },
  ];

  return (
    <div
      className="
        grid
        grid-cols-2
        xl:grid-cols-6
        gap-3
        mb-5
      "
    >
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="
            relative
            overflow-hidden
            bg-[var(--bg-card)]/60
            backdrop-blur-xl
            border
            border-[var(--border)]
            rounded-2xl
            p-4
            interactive-button
            interactive-glow
          "
        >
          <div
            className="
              absolute
              inset-0
              opacity-10
            "
            style={{
              background: `linear-gradient(135deg, ${metric.color}, transparent)`,
            }}
          />

          <div className="relative z-10">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p
                  className="
                    text-[10px]
                    uppercase
                    tracking-wider
                    text-[var(--text-secondary)]
                    mb-1
                  "
                >
                  {metric.label}
                </p>

                <p
                  className="
                    text-3xl
                    font-bold
                  "
                  style={{
                    color: metric.color,
                  }}
                >
                  {metric.value}
                </p>
              </div>

              <div
                className="
                  w-9
                  h-9
                  rounded-xl
                  flex
                  items-center
                  justify-center
                "
                style={{
                  background: `${metric.color}20`,
                  color: metric.color,
                }}
              >
                {metric.icon}
              </div>
            </div>

            <p className="text-xs text-[var(--text-secondary)]">
              {metric.subtitle}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
