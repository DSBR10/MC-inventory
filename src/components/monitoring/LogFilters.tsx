"use client";

import type { LogFilters } from "@/types/monitoring";

interface LogFiltersProps {
  filters: LogFilters;
  onFilterChange: (filters: LogFilters) => void;
  onApply: () => void;
  accounts?: { id: string; name: string; provider: string }[];
}

export default function LogFiltersComponent({
  filters,
  onFilterChange,
  onApply,
  accounts = [],
}: LogFiltersProps) {
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-card)]/60 p-6">
      <h3 className="text-lg font-semibold mb-4">Filtros de Logs</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Provider Filter */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Proveedor
          </label>
          <select
            value={filters.provider || "all"}
            onChange={(e) =>
              onFilterChange({ ...filters, provider: e.target.value as any })
            }
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos</option>
            <option value="AWS">AWS</option>
            <option value="Huawei">Huawei Cloud</option>
          </select>
        </div>

        {/* Account Filter */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Cuenta
          </label>
          <select
            value={filters.accountId || ""}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                accountId: e.target.value || undefined,
              })
            }
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas las cuentas</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({acc.provider})
              </option>
            ))}
          </select>
        </div>

        {/* Level Filter */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Nivel
          </label>
          <select
            value={filters.level || ""}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                level: (e.target.value as any) || undefined,
              })
            }
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los niveles</option>
            <option value="ERROR">ERROR</option>
            <option value="WARN">WARN</option>
            <option value="INFO">INFO</option>
            <option value="DEBUG">DEBUG</option>
            <option value="TRACE">TRACE</option>
          </select>
        </div>

        {/* Search Term */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Búsqueda
          </label>
          <input
            type="text"
            value={filters.searchTerm || ""}
          onChange={(e) =>
              onFilterChange({
                ...filters,
                searchTerm: e.target.value || undefined,
              })
            }
            placeholder="Buscar en logs..."
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Time Range */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Período
          </label>
          <select
            onChange={(e) => {
              const value = e.target.value;
              let startTime: string | undefined;
              let endTime: string | undefined = new Date().toISOString();

              switch (value) {
                case "5m":
                  startTime = new Date(
                    Date.now() - 5 * 60 * 1000,
                  ).toISOString();
                  break;
                case "15m":
                  startTime = new Date(
                    Date.now() - 15 * 60 * 1000,
                  ).toISOString();
                  break;
                case "1h":
                  startTime = new Date(
                    Date.now() - 60 * 60 * 1000,
                  ).toISOString();
                  break;
                case "6h":
                  startTime = new Date(
                    Date.now() - 6 * 60 * 60 * 1000,
                  ).toISOString();
                  break;
                case "24h":
                  startTime = new Date(
                    Date.now() - 24 * 60 * 60 * 1000,
                  ).toISOString();
                  break;
                default:
                  startTime = undefined;
                  endTime = undefined;
              }

              onFilterChange({ ...filters, startTime, endTime });
            }}
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1h">Última hora</option>
            <option value="6h">Últimas 6 horas</option>
            <option value="24h">Últimas 24 horas</option>
            <option value="15m">Últimos 15 min</option>
            <option value="5m">Últimos 5 min</option>
          </select>
        </div>

        {/* Limit */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Límite
          </label>
          <select
            value={filters.limit || 100}
            onChange={(e) =>
              onFilterChange({ ...filters, limit: parseInt(e.target.value) })
            }
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="50">50 logs</option>
            <option value="100">100 logs</option>
            <option value="200">200 logs</option>
            <option value="500">500 logs</option>
          </select>
        </div>
      </div>

      {/* Apply Button */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={onApply}
          className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Aplicar Filtros
        </button>
      </div>
    </div>
  );
}
