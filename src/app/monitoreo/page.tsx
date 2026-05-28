'use client';

import { useState, useEffect } from 'react';
import MetricsGrid from "@/components/monitoring/MetricsGrid";
import MonitoringCharts from "@/components/monitoring/MonitoringCharts";
import LogFilters from '@/components/monitoring/LogFilters';
import LogsViewer from '@/components/monitoring/LogsViewer';
import AlertsPanel from '@/components/monitoring/AlertsPanel';
import AWSMetricsView from './components/AWSMetricsView';
import AWSLogsView from './components/AWSLogsView';
import MonitoringDashboard from './components/MonitoringDashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { LogEntry, LogFilters as LogFiltersType } from '@/types/monitoring';

export default function MonitoringPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string; provider: string }[]>([]);
  const [filters, setFilters] = useState<LogFiltersType>({
    startTime: new Date(Date.now() - 3600000).toISOString(), // Última hora
    endTime: new Date().toISOString(),
    severity: undefined,
    searchText: '',
    provider: undefined,
    account: undefined,
    limit: 100,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      setRefreshing(true);
      const params = new URLSearchParams();

      if (filters.startTime) params.append('startTime', filters.startTime);
      if (filters.endTime) params.append('endTime', filters.endTime);
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.searchText) params.append('searchText', filters.searchText);
      if (filters.provider) params.append('provider', filters.provider);
      if (filters.account) params.append('account', filters.account);
      if (filters.limit) params.append('limit', filters.limit.toString());

      const response = await fetch(`/api/logs?${params.toString()}`);
      if (!response.ok) throw new Error('Error al obtener logs');

      const data = await response.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/inventory');
      if (!response.ok) throw new Error('Error al obtener inventario');

      const data = await response.json();
      const accountsList: { id: string; name: string; provider: string }[] = [];

      // Extraer cuentas de AWS
      if (data.aws) {
        Object.keys(data.aws).forEach((accountName) => {
          accountsList.push({
            id: accountName,
            name: accountName,
            provider: 'AWS',
          });
        });
      }

      // Extraer cuentas de Huawei
      if (data.huawei) {
        Object.keys(data.huawei).forEach((accountName) => {
          accountsList.push({
            id: accountName,
            name: accountName,
            provider: 'Huawei',
          });
        });
      }

      setAccounts(accountsList);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchLogs();
  }, []);

  const handleFilterChange = (newFilters: LogFiltersType) => {
    setFilters(newFilters);
  };

  const handleApplyFilters = () => {
    fetchLogs();
  };

  const handleRefresh = () => {
    fetchLogs();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Monitoreo</h1>
          <p className="text-[var(--text-secondary)] mt-1">
            Métricas, logs y eventos en tiempo real de AWS y Huawei Cloud.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {refreshing ? (
            <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
     Actualizando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Actualizar
            </>
          )}
        </button>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="overview">Vista General</TabsTrigger>
          <TabsTrigger value="aws-metrics">Métricas AWS</TabsTrigger>
          <TabsTrigger value="aws-logs">Logs AWS</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <MonitoringDashboard />
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          <MetricsGrid />
          <MonitoringCharts />
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6">Logs del Sistema</h2>
            <LogFilters
              filters={filters}
              onFilterChange={handleFilterChange}
              onApply={handleApplyFilters}
              accounts={accounts}
            />
            <LogsViewer logs={logs} loading={loading || refreshing} />
          </div>
          <AlertsPanel />
        </TabsContent>

        <TabsContent value="aws-metrics">
          <AWSMetricsView />
        </TabsContent>

        <TabsContent value="aws-logs">
          <AWSLogsView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
