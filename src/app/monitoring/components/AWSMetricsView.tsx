"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { MetricData } from "@/types/monitoring-aws";
import { Loader2, Server, Database, Activity } from "lucide-react";

interface AWSAccount {
  name: string;
  id: string;
  region: string;
}

export default function AWSMetricsView() {
  const [serviceType, setServiceType] = useState<"ec2" | "rds" | "ecs">("ec2");
  const [resourceId, setResourceId] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [accounts, setAccounts] = useState<AWSAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load AWS accounts on mount
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await fetch("/api/monitoring/aws/accounts");
        const data = await response.json();
        if (data.success) {
          setAccounts(data.accounts);
          if (data.accounts.length > 0) {
            setSelectedAccount(data.accounts[0].name);
            setRegion(data.accounts[0].region);
          }
        }
      } catch (err) {
        console.error("Error loading AWS accounts:", err);
      }
    };
    fetchAccounts();
  }, []);

  const fetchMetrics = async () => {
    if (!resourceId) {
      setError("Por favor ingresa el ID del recurso");
      return;
    }

    if (!selectedAccount) {
      setError("Por favor selecciona una cuenta de AWS");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let url = `/api/monitoring/aws/metrics?serviceType=${serviceType}&resourceId=${resourceId}&region=${region}&account=${selectedAccount}`;

      if (serviceType === "ecs" && serviceName) {
        url += `&serviceName=${serviceName}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al obtener métricas");
      }

      setMetrics(data.metrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const formatChartData = (metric: MetricData) => {
    return metric.statistics.map((stat) => ({
      time: new Date(stat.timestamp).toLocaleTimeString(),
      average: stat.average?.toFixed(2),
      maximum: stat.maximum?.toFixed(2),
      minimum: stat.minimum?.toFixed(2),
    }));
  };

  const getServiceIcon = () => {
    switch (serviceType) {
      case "ec2":
        return <Server className="h-5 w-5" />;
      case "rds":
        return <Database className="h-5 w-5" />;
      case "ecs":
        return <Activity className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getServiceIcon()}
            Métricas de AWS
          </CardTitle>
          <CardDescription>
            Monitorea métricas de EC2, RDS y ECS en tiempo real
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Cuenta AWS
              </label>
              <Select
                value={selectedAccount}
                onValueChange={setSelectedAccount}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.name}>
                      {account.name} ({account.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Tipo de Servicio
              </label>
              <Select
                value={serviceType}
                onValueChange={(value: any) => setServiceType(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ec2">EC2 Instances</SelectItem>
                  <SelectItem value="rds">RDS Databases</SelectItem>
                  <SelectItem value="ecs">ECS Services</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                {serviceType === "ec2" && "Instance ID"}
                {serviceType === "rds" && "DB Instance Identifier"}
                {serviceType === "ecs" && "Cluster Name"}
              </label>
              <Input
                placeholder={
                  serviceType === "ec2"
                    ? "i-1234567890abcdef0"
                    : serviceType === "rds"
                      ? "my-database"
                      : "my-cluster"
                }
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
              />
            </div>

            {serviceType === "ecs" && (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Service Name
                </label>
                <Input
                  placeholder="my-service"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">Región</label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="us-east-1">
                    US East (N. Virginia)
                  </SelectItem>
                  <SelectItem value="us-east-2">US East (Ohio)</SelectItem>
                  <SelectItem value="us-west-1">
                    US West (N. California)
                  </SelectItem>
                  <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                  <SelectItem value="eu-west-1">EU (Ireland)</SelectItem>
                  <SelectItem value="eu-central-1">EU (Frankfurt)</SelectItem>
                  <SelectItem value="ap-southeast-1">
                    Asia Pacific (Singapore)
                  </SelectItem>
                  <SelectItem value="ap-northeast-1">
                    Asia Pacific (Tokyo)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={fetchMetrics}
            disabled={loading}
            className="w-full md:w-auto"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Obtener Métricas
          </Button>

          {error && (
            <div className="mt-4 p-4 bg-red-5der-red-200 rounded-md text-red-800">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {metrics.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          {metrics.map((metric, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle>{metric.metricName}</CardTitle>
                <CardDescription>
                  {metric.namespace} - {metric.unit}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {metric.statistics.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={formatChartData(metric)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="average"
                        stroke="#8884d8"
                        name="Promedio"
                      />
                      <Line
                        type="monotone"
                        dataKey="maximum"
                        stroke="#ff7300"
                        name="Máximo"
                      />
                      <Line
                        type="monotone"
                        dataKey="minimum"
                        stroke="#00C49F"
                        name="Mínimo"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    No hay datos disponibles
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
