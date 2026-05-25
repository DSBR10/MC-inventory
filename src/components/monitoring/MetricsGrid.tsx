'use client';

import { useEffect, useState } from 'react';
import type { MonitoringMetrics } from '@/types/monitoring';

export default function MetricsGrid() {
  const [metrics, setMetrics] = useState<MonitoringMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
    // Refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchMetrics() {
    try {
      const response = await fetch('/api/logs', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics || data);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-3xl border border-[var(--border)] bg-[var(--bg-card)]/60 p-6 animate-pulse"
          >
            <div className="h-4 bg-gray-300 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-gray-300 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  const errorRate = metrics?.totalLogs
    ? ((metrics.errorCount / metrics.totalLogs) * 100).toFixed(1)
    : '0';

  const warnRate = metrics?.totalLogs
    ? ((metrics.warnCount / metrics.totalLogs) * 100).toFixed(1)
    : '0';

  const cards = [
    {
      name: 'Total Logs (1h)',
      value: metrics?.totalLogs.toLocaleString() || '0',
      color: 'text-blue-500',
    },
    {
      name: 'Errors',
      value: metrics?.errorCount.toLocaleString() || '0',
      subtitle: `${errorRate}% de logs`,
      color: 'text-red-500',
    },
    {
      name: 'Warnings',
      value: metrics?.warnCount.toLocaleString() || '0',
      subtitle: `${warnRate}% de logs`,
      color: 'text-yellow-500',
    },
    {
      name: 'Info Logs',
      value: metrics?.infoCount.toLocaleString() || '0',
      color: 'text-green-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.name}
          className="rounded-3xl border border-[var(--border)] bg-[var(--bg-card)]/60 p-6"
        >
          <p className="text-[var(--text-secondary)] text-sm">{card.name}</p>
          <h2 className={`text-3xl font-bold mt-3 ${card.color}`}>{card.value}</h2>
          {card.subtitle && (
            <p className="text-[var(--text-secondary)] text-xs mt-1">{card.subtitle}</p>
          )}
        </div>
      ))}
    </div>
  );
}
