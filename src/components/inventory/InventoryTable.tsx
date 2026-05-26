"use client";

import { ArrowUp, ArrowDown, ChevronRight, ChevronDown } from "lucide-react";

import { useState } from "react";

import { InventoryItem } from "@/types/inventory";

import StatusBadge from "./StatusBadge";
import ServiceBadge from "./ServiceBadge";
import TagsList from "./TagsList";

type Props = {
  data: InventoryItem[];

  onSelect: (item: InventoryItem) => void;

  onSort: (field: any) => void;

  sortField: string;

  sortDirection: string;
};

export default function InventoryTable({
  data,
  onSelect,
  onSort,
  sortField,
  sortDirection,
}: Props) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Build flat rows with indentation for children
  const rows: { item: InventoryItem; depth: number }[] = [];

  for (const item of data) {
    rows.push({ item, depth: 0 });
    if (
      item.children &&
      item.children.length > 0 &&
      expandedKeys.has(item.uniqueKey || "")
    ) {
      for (const child of item.children) {
        rows.push({ item: child, depth: 1 });
      }
    }
  }

  return (
    <div
      className="
        bg-[var(--bg-card)]/60
        rounded-2xl
        border
        border-[var(--border)]
        overflow-hidden
        backdrop-blur-xl
      "
    >
      <div className="overflow-x-auto">
        <table
          className="w-full table-fixed"
          style={{
            minWidth: "1200px",
          }}
        >
          <colgroup>
            <col style={{ width: "9%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "18%" }} />
          </colgroup>

          <thead
            className="
              bg-[var(--bg-hover)]/70
              border-b
              border-[var(--border)]
            "
          >
            <tr>
              <Header
                title="Provider"
                field="provider"
                onSort={onSort}
                sortField={sortField}
                sortDirection={sortDirection}
              />

              <Header
                title="Cuenta"
                field="account"
                onSort={onSort}
                sortField={sortField}
                sortDirection={sortDirection}
              />

              <Header
                title="Servicio"
                field="service"
                onSort={onSort}
                sortField={sortField}
                sortDirection={sortDirection}
              />

              <Header
                title="Nombre"
                field="name"
                onSort={onSort}
                sortField={sortField}
                sortDirection={sortDirection}
              />

              <Header
                title="Network"
                field="host"
                onSort={onSort}
                sortField={sortField}
                sortDirection={sortDirection}
              />

              <Header
                title="Estado"
                field="status"
                onSort={onSort}
                sortField={sortField}
                sortDirection={sortDirection}
              />

              <th
                className="
                  px-4
                  py-3
                  text-left
                  text-[11px]
                  uppercase
                  tracking-wider
                  text-[var(--text-secondary)]
                "
              >
                Tags
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map(({ item, depth }) => {
              const hasChildren = (item.children?.length || 0) > 0;
              const isExpanded = expandedKeys.has(item.uniqueKey || "");
              const key = item.uniqueKey || `${item.id}-${depth}`;

              return (
                <tr
                  key={key}
                  onClick={() => {
                    if (hasChildren) {
                      toggleExpand(item.uniqueKey || "");
                    }
                    onSelect(item);
                  }}
                  className={`
                    border-b
                    border-[var(--border)]
                    hover:bg-[var(--bg-hover)]/50
                    hover:shadow-[0_0_0_1px_rgba(255,255,255,0.03)]
                    transition-all
                    cursor-pointer
                    ${depth > 0 ? "bg-[var(--bg-hover)]/20" : ""}
                  `}
                >
                  <td className="px-4 py-3 text-[13px]">
                    <div
                      className="
                        inline-flex
                        items-center
                        px-2.5
                        py-1
                        rounded-lg
                        bg-[var(--bg-hover)]
                        border
                        border-[var(--border)]
                      "
                    >
                      {item.provider}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-[13px] truncate">
                    {item.accountName}
                  </td>

                  <td className="px-4 py-3">
                    <ServiceBadge service={item.service} />
                  </td>

                  <td className="px-4 py-3">
                    <div className="min-w-0 flex items-center gap-2">
                      {depth === 0 && hasChildren ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(item.uniqueKey || "");
                          }}
                          className="
                            flex-shrink-0
                            p-0.5
                            rounded
                            hover:bg-[var(--bg-hover)]
                            transition-all
                          "
                        >
                          {isExpanded ? (
                            <ChevronDown
                              size={14}
                              className="text-[var(--primary)]"
                            />
                          ) : (
                            <ChevronRight
                              size={14}
                              className="text-[var(--text-secondary)]"
                            />
                          )}
                        </button>
                      ) : depth > 0 ? (
                        <span className="flex-shrink-0 w-5 flex items-center justify-center">
                          <span className="text-[var(--text-secondary)] text-[10px]">
                            └
                          </span>
                        </span>
                      ) : (
                        <span className="flex-shrink-0 w-5" />
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate text-[13px]">
                          {item.name}
                        </p>

                        <p
                          className="
                            text-[11px]
                            text-[var(--text-secondary)]
                            font-mono
                            truncate
                            mt-1
                          "
                        >
                          {item.id}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <p className="text-[13px] truncate">{item.host}</p>

                      {item.privateIp && (
                        <p className="text-[11px] text-cyan-400 truncate">
                          PRI: {item.privateIp}
                        </p>
                      )}

                      {item.publicIp && (
                        <p className="text-[11px] text-orange-400 truncate">
                          PUB: {item.publicIp}
                        </p>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <StatusBadge status={item.status} />
                  </td>

                  <td className="px-4 py-3">
                    <TagsList tags={item.tags} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Header({ title, field, onSort, sortField, sortDirection }: any) {
  const active = sortField === field;

  return (
    <th
      onClick={() => onSort(field)}
      className="
        px-4
        py-3
        text-left
        text-[11px]
        uppercase
        tracking-wider
        text-[var(--text-secondary)]
        cursor-pointer
        select-none
        hover:text-[var(--text-primary)]
        transition-all
      "
    >
      <div className="flex items-center gap-2">
        <span>{title}</span>

        {active ? (
          sortDirection === "asc" ? (
            <ArrowUp size={12} />
          ) : (
            <ArrowDown size={12} />
          )
        ) : (
          <ArrowUp size={12} className="opacity-30" />
        )}
      </div>
    </th>
  );
}