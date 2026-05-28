"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Server, Database, Activity, AlertCircle } from "lucide-react";
import AWSAccountSelector from "@/components/monitoring/AWSAccountSelector";

interface MetricsSummary {
  ec2Count: number;
  rdsCount: number;
  ecsCount: number;
  alerts: number;
}

export default function AWSDashboard() {
  const [selectedAccount, setSelectedAccount] = useState("");
  const [summary, setSummary] = useState<MetricsSummary>({
    ec2Count: 0,
    rdsCount: 0,
    ecsCount: 0,
    alerts: 0,
  });
  const [loading, setLoading] = useState(false);

  const fetchDashboardData = async () => {
    if (!selectedAccount) return;

    setLoading(true);
    try {
      // Aquí puedes agregar llamadas a APIs para obtener resúmenes
      // Por ahora, mostramos datos estáticos como ejemplo
      setSummary({
        ec2Count: 12,
        rdsCount: 5,
        ecsCount: 8,
        alerts: 2,
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAccount) {
      fetchDashboardData();
    }
  }, [selectedAccount]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dashboard de Monitoreo AWS</CardTitle>
          <CardDescription>
            Vista general de tus recursos en AWS
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full max-w-md">
            <label className="text-sm font-medium mb-2 block">
              Selecciona una cuenta
            </label>
            <AWSAccountSelector
              value={selectedAccount}
              onChange={setSelectedAccount}
            />
          </div>
        </CardContent>
      </Card>

      {selectedAccount && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Instancias EC2
              </CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.ec2Count}</div>
              <p className="text-xs text-muted-foreground">
                Servidores activos
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
              <div className="text-2xl font-bold">{summary.rdsCount}</div>
              <p className="text-xs text-muted-foreground">Instancias de BD</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Servicios ECS
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.ecsCount}</div>
              <p className="text-xs text-muted-foreground">
                Contenedores activos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Alertas Activas
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {summary.alerts}
              </div>
              <p className="text-xs text-muted-foreground">
                Requieren atención
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedAccount && (
        <Card>
          <CardHeader>
            <CardTitle>Métricas Recientes</CardTitle>
            <CardDescription>Actividad en las últimas 24 horas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">CPU Utilization (promedio)</span>
                </div>
                <span className="text-sm font-medium">45%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-green-500" />
                  <span className="text-sm">DB Connections (activas)</span>
                </div>
                <span className="text-sm font-medium">127</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-purple-500" />
                  <span className="text-sm">ECS Tasks (running)</span>
                </div>
                <span className="text-sm font-medium">23</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
