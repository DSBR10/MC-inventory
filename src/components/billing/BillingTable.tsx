"use client";

import { useMemo, useState } from "react";

import { BillingItem } from "@/types/billing";

import { exportBillingToExcel, exportBillingToPDF } from "@/lib/billing/export";

type Props = {
  billing: BillingItem[];

  loading: boolean;
};

const PAGE_SIZE = 15;

export default function BillingTable({ billing, loading }: Props) {
  const [page, setPage] = useState(1);

  const [sortField, setSortField] = useState<keyof BillingItem>("cost");

  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const sortedBilling = useMemo(() => {
    return [...billing].sort((a, b) => {
      const aValue = a[sortField];

      const bValue = b[sortField];

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      return sortDirection === "asc"
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
  }, [billing, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedBilling.length / PAGE_SIZE);

  const paginated = sortedBilling.slice(
    (page - 1) * PAGE_SIZE,

    page * PAGE_SIZE,
  );

  function handleSort(field: keyof BillingItem) {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");

      return;
    }

    setSortField(field);

    setSortDirection("desc");
  }

  if (loading) {
    return (
      <div className="text-[var(--text-secondary)]">Loading billing...</div>
    );
  }

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
      {/* HEADER */}

      <div
        className="
          p-5
          border-b
          border-[var(--border)]
          flex
          flex-wrap
          gap-3
          justify-between
          items-center
        "
      >
        <h2 className="text-2xl font-bold">Billing Enterprise</h2>

        <div className="flex gap-3">
          <button
            onClick={() => exportBillingToExcel(billing)}
            className="
              px-4
              py-2
              rounded-xl
              bg-cyan-500
              text-black
              font-semibold
            "
          >
            Export XLSX
          </button>

          <button
            onClick={() => exportBillingToPDF(billing)}
            className="
              px-4
              py-2
              rounded-xl
              bg-purple-500
              text-[var(--text-primary)]
              font-semibold
            "
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* TABLE */}

      <div
        className="
          overflow-auto
          max-h-[700px]
        "
      >
        <table className="w-full text-sm">
          <thead
            className="
              sticky
              top-0
              bg-black
              z-20
            "
          >
            <tr>
              <TH label="Provider" onClick={() => handleSort("provider")} />

              <TH label="Cuenta" onClick={() => handleSort("accountName")} />

              <TH label="Servicio" onClick={() => handleSort("service")} />

              <TH label="Mes" onClick={() => handleSort("month")} />

              <TH label="Costo" onClick={() => handleSort("cost")} />
            </tr>
          </thead>

          <tbody>
            {paginated.map((item, idx) => (
              <tr
                key={idx}
                className="
                  border-t
                  border-[var(--border)]
                  hover:bg-[var(--bg-card)]/60
                "
              >
                <td className="p-4">{item.provider}</td>

                <td className="p-4">{item.accountName}</td>

                <td className="p-4">{item.service}</td>

                <td className="p-4">{item.month}</td>

                <td
                  className="
                    p-4
                    font-bold
                    text-cyan-400
                  "
                >
                  ${item.cost.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}

      <div
        className="
          p-4
          border-t
          border-[var(--border)]
          flex
          justify-between
          items-center
        "
      >
        <p className="text-sm text-[var(--text-secondary)]">
          Página {page}
          de {totalPages}
        </p>

        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="
              px-4
              py-2
              rounded-xl
              border
              border-[var(--border)]
            "
          >
            Prev
          </button>

          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="
              px-4
              py-2
              rounded-xl
              border
              border-[var(--border)]
            "
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function TH({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <th
      onClick={onClick}
      className="
        text-left
        p-4
        cursor-pointer
        hover:text-cyan-400
        transition-all
      "
    >
      {label}
    </th>
  );
}
