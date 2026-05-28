"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  Server,
  Database,
  Box,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";

interface MonitoringSummary {
  totalAccounts: number;
  totalEC2: number;
  runningEC2: number;
  totalRDS: number;
  availableRDS: number;
  totalECSClusters: number;
  totalECSTasks: number;
}

interface CacheInfo {
  source: string;
  timestamp: number;
  cacheAge: number;
  refreshing: boolean;
  backgroundJob: {
    running: boolean;
    refreshing: boolean;
    interval: number;
  };
}

export default function MonitoringDashboard() {
  const [summary, setSummary] = useState<MonitoringSummary | null>(null);
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      const url = forceRefresh
        ? "/api/monitoring/metrics?refresh=true"
        : "/api/monitoring/metrics";

      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch monitoring data");

      const data = await response.json();
      setSummary(data.summary);
      setCacheInfo({
        source: data.source,
        timestamp: data.timestamp,
        cacheAge: data.cacheAge,
        refreshing: data.refreshing,
        backgroundJob: data.backgroundJob,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh cada 10 segundos para actualizar el estado del caché
    const interval = setInterval(() => fetchData(), 10000);
    return () => clearInterval(interval);
  }, []);

  const formatAge = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("es-ES", {
      dateStyle: "short",
      timeStyle: "medium",
    });
  };

  if (loading && !summary) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>Cargando métricas...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex items-center justify-center text-red-500">
            <XCircle className="h-6 w-6 mr-2" />
            <span>Error: {error}</span>
          </div>
          <div className="flex justify-center mt-4">
            <Button onClick={() => fetchData()}>Reintentar</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cache Status */}
      {cacheInfo && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Estado del Sistema</CardTitle>
                <CardDescription>
                  Información de caché y actualización automática
                </CardDescription>
              </div>
              <Button
                onClick={() => fetchData(true)}
                disabled={loading || cacheInfo.refreshing}
                size="sm"
              >
                {cacheInfo.refreshing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Actualizar Ahora
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">
                  Fuente de Datos
                </div>
                <Badge
                  variant={
                    cacheInfo.source === "cache" ? "secondary" : "default"
                  }
                >
                  {cacheInfo.source === "cache" ? "Caché" : "En Vivo"}
                </Badge>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">
                  Edad del Caché
                </div>
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  <span className="font-medium">
                    {formatAge(cacheInfo.cacheAge)}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">
                  Última Actualización
                </div>
                <div className="text-sm font-medium">
                  {formatTimestamp(cacheInfo.timestamp)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">
                  Background Job
                </div>
                <div className="flex items-center">
                  {cacheInfo.backgroundJob.running ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />
                      <span className="text-sm">
                        Activo ({cacheInfo.backgroundJob.interval / 1000}s)
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 mr-1 text-yellow-500" />
                      <span className="text-sm">Inactivo</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cuentas AWS</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalAccounts}</div>
              <p className="text-xs text-muted-foreground">
                Total de cuentas configuradas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Instancias EC2
              </CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalEC2}</div>
              <p className="text-xs text-muted-foreground">
                {summary.runningEC2} en ejecución
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Bases de Datos RDS
              </CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalRDS}</div>
              <p className="text-xs text-muted-foreground">
                {summary.availableRDS} disponibles
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Clusters ECS
              </CardTitle>
              <Box className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary.totalECSClusters}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary.totalECSTasks} tareas activas
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
