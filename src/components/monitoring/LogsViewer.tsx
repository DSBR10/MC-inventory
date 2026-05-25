"use client";

import { useState } from "react";
import type { LogEntry } from "@/types/monitoring";

interface LogsViewerProps {
  logs: LogEntry[];
  loading?: boolean;
}

export default function LogsViewer({ logs, loading }: LogsViewerProps) {
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const getSeverityColor = (severity: string) => {
    switch (severity.toUpperCase()) {
      case "ERROR":
      case "CRITICAL":
        return "bg-red-100 text-red-800 border-red-300";
      case "WARNING":
      case "WARN":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "INFO":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "DEBUG":
        return "bg-gray-100 text-gray-800 border-gray-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity.toUpperCase()) {
      case "ERROR":
      case "CRITICAL":
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "WARNING":
      case "WARN":
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "INFO":
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const toggleExpand = (logId: string) => {
    setExpandedLog(expandedLog === logId ? null : logId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          No hay logs disponibles
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Intenta ajustar los filtros o el rango de tiempo.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="mb-4 text-sm text-gray-600">
        Mostrando {logs.length} log{logs.length !== 1 ? "s" : ""}
      </div>

      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {logs.map((log) => (
          <div
            key={log.id}
            className={`border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${getSeverityColor(log.severity)}`}
            onClick={() => toggleExpand(log.id)}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {getSeverityIcon(log.severity)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm uppercase">
                      {log.severity}
                    </span>
                    <span className="text-xs px-2 py-1 bg-white bg-opacity-50 rounded">
                      {log.provider}
                    </span>
                    <span className="text-xs px-2 py-1 bg-white bg-opacity-50 rounded">
                      {log.account}
                    </span>
                    {log.logGroup && (
                      <span className="text-xs px-2 py-1 bg-white bg-opacity-50 rounded">
                        {log.logGroup}
                      </span>
                    )}
                  </div>
                  <span className="text-xs whitespace-nowrap">
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>

                <div className="text-sm font-mono break-words">
                  {expandedLog === log.id ? (
                    <pre className="whitespace-pre-wrap">{log.message}</pre>
                  ) : (
                    <div className="truncate">{log.message}</div>
                  )}
                </div>

                {log.metadata &&
                  Object.keys(log.metadata).length > 0 &&
                  expandedLog === log.id && (
                    <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                      <div className="text-xs font-semibold mb-2">
                        Metadata:
                      </div>
                      <pre className="text-xs bg-white bg-opacity-30 p-2 rounded overflow-x-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
              </div>

              <div className="flex-shrink-0">
                <svg
                  className={`w-5 h-5 transition-transform ${expandedLog === log.id ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
