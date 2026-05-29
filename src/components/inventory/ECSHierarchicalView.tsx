"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Server, Box, Activity } from "lucide-react";
import StatusBadge from "./StatusBadge";
import TagsList from "./TagsList";
import { InventoryItem } from "@/types/inventory";

type Props = {
  data: InventoryItem[];
  onSelect: (item: InventoryItem) => void;
};

export default function ECSHierarchicalView({ data, onSelect }: Props) {
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(
    new Set(),
  );
  const [expandedServices, setExpandedServices] = useState<Set<string>>(
    new Set(),
  );

  // Filter only ECS clusters
  const ecsClusters = data.filter(
    (item) => item.service === "ECS" && item.resourceType === "CLUSTER",
  );

  const toggleCluster = (clusterKey: string) => {
    setExpandedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(clusterKey)) {
        next.delete(clusterKey);
      } else {
        next.add(clusterKey);
      }
      return next;
    });
  };

  const toggleService = (serviceKey: string) => {
    setExpandedServices((prev) => {
      const next = new Set(prev);
      if (next.has(serviceKey)) {
        next.delete(serviceKey);
      } else {
        next.add(serviceKey);
      }
      return next;
    });
  };

  if (ecsClusters.length === 0) {
    return (
      <div className="bg-[var(--bg-card)]/60 rounded-2xl border border-[var(--border)] p-8 text-center">
        <p className="text-[var(--text-secondary)]">
          No se encontraron clusters de ECS
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-card)]/60 rounded-2xl border border-[var(--border)] overflow-hidden backdrop-blur-xl">
      <div className="divide-y divide-[var(--border)]">
        {ecsClusters.map((cluster) => {
          const clusterKey = cluster.uniqueKey || cluster.id;
          const isClusterExpanded = expandedClusters.has(clusterKey);
          const services = cluster.children || [];

          return (
            <div key={clusterKey}>
              {/* Cluster Row */}
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-hover)]/50 transition-all group">
                <button
                  onClick={() => toggleCluster(clusterKey)}
                  className="flex-shrink-0 w-6 h-6 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)] flex items-center justify-center hover:bg-purple-500/10 hover:border-purple-500/30 transition-all"
                >
                  {isClusterExpanded ? (
                    <ChevronDown size={14} className="text-purple-400" />
                  ) : (
                    <ChevronRight
                      size={14}
                      className="text-[var(--text-secondary)]"
                    />
                  )}
                </button>

                <div
                  onClick={() => onSelect(cluster)}
                  className="flex-1 cursor-pointer flex items-center gap-3"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center">
                    <Server size={20} className="text-purple-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-[14px] truncate">
                        {cluster.name}
                      </p>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        CLUSTER
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] font-mono truncate mt-0.5">
                      {services.length} servicio
                      {services.length !== 1 ? "s" : ""}
                    </p>
                  </div>

                  <div className="flex-shrink-0 flex items-center gap-3">
                    {cluster.raw?.runningTasksCount !== undefined && (
                      <div className="text-right">
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          Tasks
                        </p>
                        <p className="text-[13px] font-semibold text-emerald-400">
                          {cluster.raw.runningTasksCount}
                        </p>
                      </div>
                    )}
                    <StatusBadge status={cluster.status} />
                  </div>
                </div>
              </div>

              {/* Services */}
              {isClusterExpanded && services.length > 0 && (
                <div className="bg-[var(--bg-hover)]/30 border-t border-[var(--border)]">
                  {services.map((service) => {
                    const serviceKey = service.uniqueKey || service.id;
                    const isServiceExpanded = expandedServices.has(
                      serviceKey,
                    );
                    const tasks = service.children || [];

                    return (
                      <div key={serviceKey}>
                        {/* Service Row */}
                        <div className="flex items-center gap-3 px-4 py-3 pl-16 hover:bg-[var(--bg-hover)]/50 transition-all">
                          <button
                            onClick={() => toggleService(serviceKey)}
                            className="flex-shrink-0 w-6 h-6 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)] flex items-center justify-center hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-all"
                          >
                            {isServiceExpanded ? (
                              <ChevronDown
                                size={14}
                                className="text-cyan-400"
                              />
                            ) : (
                              <ChevronRight
                                size={14}
                                className="text-[var(--text-secondary)]"
                              />
                            )}
                          </button>

                          <div
                            onClick={() => onSelect(service)}
                            className="flex-1 cursor-pointer flex items-center gap-3"
                          >
                            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center">
                              <Box size={18} className="text-cyan-400" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-[13px] truncate">
                                  {service.name}
                                </p>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                  SERVICE
                                </span>
                              </div>
                              <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
                                {tasks.length} task
                                {tasks.length !== 1 ? "s" : ""} en ejecución
                              </p>
                            </div>

                            <div className="flex-shrink-0 flex items-center gap-3">
                              {service.raw?.desiredCount !== undefined && (
                                <div className="text-right">
                                  <p className="text-[11px] text-[var(--text-secondary)]">
                                    Desired
                                  </p>
                                  <p className="text-[13px] font-semibold">
                                    {service.raw.desiredCount}
                                  </p>
                                </div>
                              )}
                              {service.raw?.runningCount !== undefined && (
                                <div className="text-right">
                                  <p className="text-[11px] text-[var(--text-secondary)]">
                                    Running
                                  </p>
                                  <p className="text-[13px] font-semibold text-emerald-400">
                                    {service.raw.runningCount}
                                  </p>
                                </div>
                              )}
                              <StatusBadge status={service.status} />
                            </div>
                          </div>
                        </div>

                        {/* Tasks */}
                        {isServiceExpanded && tasks.length > 0 && (
                          <div className="bg-[var(--bg-hover)]/50 border-t border-[var(--border)]">
                            {tasks.map((task) => (
                              <div
                                key={task.uniqueKey || task.id}
                                onClick={() => onSelect(task)}
                                className="flex items-center gap-3 px-4 py-2.5 pl-28 hover:bg-[var(--bg-hover)]/70 transition-all cursor-pointer"
                              >
                                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
                                  <Activity
                                    size={16}
                                    className="text-emerald-400"
                                  />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-[12px] truncate">
                                      {task.name}
                                    </p>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      TASK
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-[var(--text-secondary)] font-mono truncate mt-0.5">
                                    {task.platform} •{" "}
                                    {task.raw?.containers || 0} container
                                    {task.raw?.containers !== 1 ? "s" : ""}
                                  </p>
                                </div>

                                <div className="flex-shrink-0">
                                  <StatusBadge status={task.status} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {isServiceExpanded && tasks.length === 0 && (
                          <div className="px-4 py-3 pl-28 text-[11px] text-[var(--text-secondary)] italic">
                            No hay tasks en ejecución
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {isClusterExpanded && services.length === 0 && (
                <div className="px-4 py-3 pl-16 text-[11px] text-[var(--text-secondary)] italic bg-[var(--bg-hover)]/30 border-t border-[var(--border)]">
                  No hay servicios en este cluster
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
