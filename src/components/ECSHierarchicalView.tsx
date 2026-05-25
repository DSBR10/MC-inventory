"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Server, Box, Activity } from "lucide-react";
import type { InventoryItem } from "@/types";

interface ECSHierarchicalViewProps {
  data: InventoryItem[];
  onSelect: (item: InventoryItem) => void;
}

export default function ECSHierarchicalView({
  data,
  onSelect,
}: ECSHierarchicalViewProps) {
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(
    new Set(),
  );
  const [expandedServices, setExpandedServices] = useState<Set<string>>(
    new Set(),
  );

  // Filter only ECS clusters (top level)
  const clusters = data.filter(
    (item) => item.service === "ECS" && item.resourceType === "CLUSTER",
  );

  const toggleCluster = (clusterId: string) => {
    setExpandedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(clusterId)) {
        next.delete(clusterId);
      } else {
        next.add(clusterId);
      }
      return next;
    });
  };

  const toggleService = (serviceId: string) => {
    setExpandedServices((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
  };

  const getStatusColor = (status: string) => {
    const s = status.toUpperCase();
    if (s === "ACTIVE" || s === "RUNNING") return "text-emerald-400";
    if (s === "INACTIVE" || s === "STOPPED") return "text-red-400";
    if (s === "PENDING") return "text-yellow-400";
    return "text-gray-400";
  };

  if (clusters.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-8 text-center">
        <p className="text-[var(--text-primary)]/50">
          No se encontraron clusters de ECS
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
      <div className="divide-y divide-[var(--border)]">
        {clusters.map((cluster) => {
          const isExpanded = expandedClusters.has(cluster.id);
          const services = cluster.children || [];

          return (
            <div key={cluster.id}>
              {/* Cluster Row */}
              <div
                className="flex items-center gap-3 p-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
                onClick={() => toggleCluster(cluster.id)}
              >
                <button className="text-[var(--text-primary)]/50 hover:text-[var(--text-primary)] transition-colors">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <Server className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[var(--text-primary)]">
                      {cluster.name}
                    </h3>
                    <span
                      className={`text-xs font-medium ${getStatusColor(cluster.status)}`}
                    >
                      {cluster.status}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-primary)]/50 truncate">
                    {cluster.id}
                  </p>
                </div>
                <div className="text-sm text-[var(--text-primary)]/50">
                  {services.length} servicio{services.length !== 1 ? "s" : ""}
                </div>
              </div>

              {/* Services */}
              {isExpanded && services.length > 0 && (
                <div className="bg-black/20">
                  {services.map((service: InventoryItem) => {
                    const isServiceExpanded = expandedServices.has(service.id);
                    const tasks = service.children || [];

                    return (
                      <div
                        key={service.id}
                        className="border-t border-[var(--border)]/50"
                      >
                        {/* Service Row */}
                        <div
                          className="flex items-center gap-3 p-4 pl-16 hover:bg-white/[0.02] transition-colors cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleService(service.id);
                          }}
                        >
                          <button className="text-[var(--text-primary)]/50 hover:text-[var(--text-primary)] transition-colors">
                            {isServiceExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                          <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                            <Box className="w-3.5 h-3.5 text-purple-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-[var(--text-primary)]">
                                {service.name}
                              </h4>
                              <span
                                className={`text-xs font-medium ${getStatusColor(service.status)}`}
                              >
                                {service.status}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--text-primary)]/50 truncate">
                              {service.raw?.taskDefinition || service.id}
                            </p>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-[var(--text-primary)]/50">
                            <span>
                              Deseadas: {service.raw?.desiredCount || 0}
                            </span>
                            <span className="text-emerald-400">
                              Corriendo: {service.raw?.runningCount || 0}
                            </span>
                            <span className="text-yellow-400">
                              Pendientes: {service.raw?.pendingCount || 0}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelect(service);
                            }}
                            className="px-3 py-1.5 text-xs rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                          >
                            Ver detalles
                          </button>
                        </div>

                        {/* Tasks */}
                        {isServiceExpanded && tasks.length > 0 && (
                          <div className="bg-black/30">
                            {tasks.map((task: InventoryItem) => (
                              <div
                                key={task.id}
                                className="flex items-center gap-3 p-3 pl-28 hover:bg-white/[0.02] transition-colors border-t border-[var(--border)]/30 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelect(task);
                                }}
                              >
                                <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                  <Activity className="w-3 h-3 text-amber-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-[var(--text-primary)]">
                                      {task.name}
                                    </span>
                                    <span
                                      className={`text-xs font-medium ${getStatusColor(task.status)}`}
                                    >
                                      {task.status}
                                    </span>
                                  </div>
                                  <p className="text-xs text-[var(--text-primary)]/50 truncate">
                                    {task.raw?.taskDefinition || task.id}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-[var(--text-primary)]/50">
                                  <span>CPU: {task.raw?.cpu || "N/A"}</span>
                                  <span>Mem: {task.raw?.memory || "N/A"}</span>
                                  <span>
                                    Contenedores: {task.raw?.containers || 0}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {isServiceExpanded && tasks.length === 0 && (
                          <div className="p-4 pl-28 text-sm text-[var(--text-primary)]/50 bg-black/30 border-t border-[var(--border)]/30">
                            No hay tasks en ejecución
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {isExpanded && services.length === 0 && (
                <div className="p-4 pl-16 text-sm text-[var(--text-primary)]/50 bg-black/20 border-t border-[var(--border)]/50">
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
