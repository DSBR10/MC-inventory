"use client";

import { BillingItem } from "@/types/billing";

import { getTopResources } from "@/lib/billing/resources";

export default function BillingResources({
  billing,
}: {
  billing: BillingItem[];
}) {
  const topResources = getTopResources(billing, 25);

  return (
    <div
      className="
        rounded-3xl
        border
        border-[var(--border)]
        bg-[var(--bg-card)]/60
        overflow-hidden
      "
    >
      <div className="p-5 border-b border-[var(--border)]">
        <h2 className="text-xl font-semibold">Top Recursos Costosos</h2>

        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Recursos AWS con mayor consumo.
        </p>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead
            className="
              bg-[var(--bg-card)]/60
              sticky
              top-0
            "
          >
            <tr>
              <th className="p-4 text-left">Servicio</th>

              <th className="p-4 text-left">Resource ID</th>

              <th className="p-4 text-left">Cuenta</th>

              <th className="p-4 text-right">Cost</th>
            </tr>
          </thead>

          <tbody>
            {topResources.map((item, idx) => (
              <tr
                key={idx}
                className="
                    border-t
                    border-[var(--border)]
                  "
              >
                <td className="p-4">{item.service}</td>

                <td className="p-4 font-mono text-xs">{item.resourceId}</td>

                <td className="p-4">{item.accountName}</td>

                <td
                  className="
                      p-4
                      text-right
                      font-bold
                      text-cyan-300
                    "
                >
                  ${item.cost.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
