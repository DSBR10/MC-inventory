"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FileBarChart,
  Send,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Cloud,
  HardDrive,
  Archive,
  Database,
  Clock3,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import toast from "react-hot-toast";
import ScrollToTop from "@/components/ui/ScrollToTop";

type ServerBackupDetail = {
  resourceName: string;
  resourceId: string;
  resourceType: string;
  vaultName: string;
  backupName: string;
  status: string;
  sizeBytes: number | null;
  backupCreatedAt: string | null;
  backupCompletedAt: string | null;
  backupExpiresAt: string | null;
};

type AccountDetail = {
  accountId: string;
  accountName: string;
  region: string;
  vaultCount: number;
  totalBackups: number;
  successfulBackups: number;
  failedBackups: number;
  inProgressBackups: number;
  expiredBackups: number;
  serversWithBackup: number;
  totalServers: number;
  lastBackup: string | null;
  servers: ServerBackupDetail[];
};

type ProviderReport = {
  provider: string;
  totalBackups: number;
  totalBytes: number;
  accounts: AccountDetail[];
  successfulTotal: number;
  failedTotal: number;
  inProgressTotal: number;
  expiredTotal: number;
  successRate: number;
  failureRate: number;
};

type InformeData = {
  generatedAt: string;
  dateLabel: string;
  aws: ProviderReport;
  huawei: ProviderReport;
  globalSummary: {
    totalBackups: number;
    totalBytes: number;
    successRate: number;
    failureRate: number;
  };
  sendGridConfigured: boolean;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatBogota(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function InformesPage() {
  const [data, setData] = useState<InformeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"aws" | "huawei">("aws");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/informes");
      if (!res.ok) throw new Error("Error cargando informe");
      const json = await res.json();
      setData(json);
    } catch {
      toast.error("Error cargando datos del informe");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSendEmail = async (provider: "all" | "AWS" | "HUAWEI CLOUD") => {
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/informes/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Error ${res.status}: no se pudo enviar el correo`);
      }
      toast.success(`Correo enviado exitosamente a ${json.recipients?.join(", ") || "destinatarios"}`, { duration: 6000 });
    } catch (e: any) {
      toast.error(e?.message || "Error enviando informe por correo", { duration: 8000 });
    } finally {
      setSending(false);
    }
  };

  const handleViewInNewTab = () => {
    window.open("/api/informes/pdf", "_blank");
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <p className="text-sm text-[var(--text-secondary)]">Generando informe...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-[var(--text-secondary)]">No se pudieron cargar los datos del informe.</p>
      </div>
    );
  }

  const currentReport = activeTab === "aws" ? data.aws : data.huawei;

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .page-section { animation: fadeUp 0.4s ease both; }
      `}</style>

      <div className="page-section">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] p-5" style={{ background: "var(--glass-bg)", backdropFilter: "blur(16px)" }}>
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ background: "linear-gradient(135deg,var(--gradient-start),var(--gradient-end))" }} />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-lg" style={{ background: "linear-gradient(135deg,#8b5cf6,#06b6d4)" }}>
                <FileBarChart size={18} />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Informes de backups</h1>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  {data.dateLabel} · Envío diario automático a las {process.env.NEXT_PUBLIC_INFORMES_HOUR || "07:00"} hora Colombia
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-1.5">
                  <Clock3 size={12} />
                  Generado: {formatBogota(data.generatedAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={handleRefresh} className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/60 text-sm flex items-center gap-2 hover:bg-[var(--bg-hover)] transition-all">
                <RefreshCw size={16} /> Actualizar
              </button>
              <button onClick={handleViewInNewTab} className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/60 text-sm flex items-center gap-2 hover:bg-[var(--bg-hover)] transition-all">
                <ExternalLink size={16} /> Ver informe
              </button>
              {data.sendGridConfigured ? (
                <button onClick={() => handleSendEmail("all")} disabled={sending} className="px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm flex items-center gap-2 hover:bg-violet-500 disabled:opacity-50 transition-all">
                  <Send size={16} className={sending ? "animate-pulse" : ""} /> {sending ? "Enviando..." : "Enviar correo"}
                </button>
              ) : (
                <div className="px-4 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-xs text-amber-400 flex items-center gap-2">
                  <AlertTriangle size={14} /> SendGrid no configurado
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="page-section" style={{ animationDelay: "0.05s" }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total backups", value: data.globalSummary.totalBackups, icon: Database, color: "#8b5cf6" },
            { label: "Almacenado", value: formatBytes(data.globalSummary.totalBytes), icon: Archive, color: "#06b6d4" },
            { label: "Tasa éxito", value: `${data.globalSummary.successRate}%`, icon: CheckCircle2, color: "#10b981" },
            { label: "Tasa fallo", value: `${data.globalSummary.failureRate}%`, icon: XCircle, color: "#ef4444" },
          ].map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="rounded-2xl border border-[var(--border)] p-4 bg-[var(--bg-card)]/80 backdrop-blur-xl transition-all duration-200 hover:shadow-lg">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-[10px] tracking-widest uppercase font-semibold text-[var(--text-secondary)]">{m.label}</p>
                    <p className="text-2xl font-bold tracking-tight" style={{ color: m.color }}>{m.value}</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${m.color}15`, color: m.color }}><Icon size={16} /></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="page-section" style={{ animationDelay: "0.1s" }}>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]/60 backdrop-blur-xl overflow-hidden">
          <div className="flex border-b border-[var(--border)]">
            <button
              onClick={() => setActiveTab("aws")}
              className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-all ${activeTab === "aws" ? "text-amber-400 border-b-2 border-amber-400 bg-amber-500/5" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            >
              <Cloud size={16} /> AWS Backup
              <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === "aws" ? "bg-amber-500/20 text-amber-300" : "bg-[var(--bg-hover)] text-[var(--text-secondary)]"}`}>{data.aws.totalBackups}</span>
            </button>
            <button
              onClick={() => setActiveTab("huawei")}
              className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-all ${activeTab === "huawei" ? "text-red-400 border-b-2 border-red-400 bg-red-500/5" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            >
              <HardDrive size={16} /> Huawei CBR
              <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === "huawei" ? "bg-red-500/20 text-red-300" : "bg-[var(--bg-hover)] text-[var(--text-secondary)]"}`}>{data.huawei.totalBackups}</span>
            </button>
          </div>

          <div className="p-5">
            {currentReport.totalBackups === 0 ? (
              <div className="text-center py-12">
                <Archive size={28} className="mx-auto mb-3 text-[var(--text-secondary)]/40" />
                <p className="text-sm font-medium">Sin backups registrados para {currentReport.provider}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Ejecuta un refresco de backups desde el módulo de Backups.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                  {[
                    { label: "Total", value: currentReport.totalBackups, color: activeTab === "aws" ? "#f59e0b" : "#ef4444" },
                    { label: "Exitosos", value: currentReport.successfulTotal, color: "#10b981" },
                    { label: "Fallidos", value: currentReport.failedTotal, color: "#ef4444" },
                    { label: "En progreso", value: currentReport.inProgressTotal, color: "#f59e0b" },
                    { label: "Expirados", value: currentReport.expiredTotal, color: "#71717a" },
                  ].map((m) => (
                    <div key={m.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-hover)]/30 p-3">
                      <p className="text-[10px] tracking-widest uppercase font-semibold text-[var(--text-secondary)]">{m.label}</p>
                      <p className="text-xl font-bold mt-1" style={{ color: m.color }}>{m.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <p className="text-[10px] tracking-widest uppercase font-semibold text-emerald-400/70">Tasa de éxito</p>
                    <p className="text-3xl font-bold text-emerald-400 mt-1">{currentReport.successRate}%</p>
                    <div className="mt-2 h-2 rounded-full bg-emerald-500/10 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${currentReport.successRate}%` }} />
                    </div>
                  </div>
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                    <p className="text-[10px] tracking-widest uppercase font-semibold text-red-400/70">Tasa de fallo</p>
                    <p className="text-3xl font-bold text-red-400 mt-1">{currentReport.failureRate}%</p>
                    <div className="mt-2 h-2 rounded-full bg-red-500/10 overflow-hidden">
                      <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${currentReport.failureRate}%` }} />
                    </div>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                  <ChevronRight size={14} className="text-[var(--text-secondary)]" />
                  Detalle por cuenta
                </h3>

                <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                  <table className="w-full">
                    <thead className="bg-[var(--bg-hover)]/60 border-b border-[var(--border)]">
                      <tr>
                        {["Cuenta", "Región", "Vaults", "Servidores", "Con backup", "Exitosos", "Fallidos", "Último backup"].map((h) => (
                          <th key={h} className="px-3 py-3 text-left text-[11px] uppercase tracking-wider text-[var(--text-secondary)] whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {currentReport.accounts.map((a) => (
                        <tr key={a.accountId} className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)]/40 transition">
                          <td className="px-3 py-3 text-sm font-medium">{a.accountName}</td>
                          <td className="px-3 py-3 text-xs text-[var(--text-secondary)]">{a.region}</td>
                          <td className="px-3 py-3 text-sm text-center">{a.vaultCount}</td>
                          <td className="px-3 py-3 text-sm text-center">{a.totalServers}</td>
                          <td className="px-3 py-3 text-sm text-center">
                            <span className={`font-semibold ${a.serversWithBackup === a.totalServers ? "text-emerald-400" : "text-amber-400"}`}>
                              {a.serversWithBackup}
                            </span>
                            <span className="text-[var(--text-secondary)] text-xs ml-1">/ {a.totalServers}</span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="text-sm font-semibold text-emerald-400">{a.successfulBackups}</span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`text-sm font-semibold ${a.failedBackups > 0 ? "text-red-400" : "text-[var(--text-secondary)]"}`}>{a.failedBackups}</span>
                          </td>
                          <td className="px-3 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">{formatBogota(a.lastBackup)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {currentReport.accounts.map((a) => (
                  <div key={a.accountId} className="mb-6">
                    <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                      <ChevronRight size={14} className="text-[var(--text-secondary)]" />
                      {a.accountName}
                      <span className="text-xs font-normal text-[var(--text-secondary)]">({a.region})</span>
                      <span className="ml-auto text-xs text-[var(--text-secondary)]">
                        {a.serversWithBackup}/{a.totalServers} servidores con backup · {a.successfulBackups} ok · <span className={a.failedBackups > 0 ? "text-red-400 font-semibold" : ""}>{a.failedBackups} fallidos</span>
                      </span>
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                      <table className="w-full">
                        <thead className="bg-[var(--bg-hover)]/60 border-b border-[var(--border)]">
                          <tr>
                            {["Servidor", "Tipo", "Vault", "Estado", "Fecha backup", "Tamaño", "Expira"].map((h) => (
                              <th key={h} className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-[var(--text-secondary)] whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {a.servers.map((s) => {
                            const isOk = ["COMPLETED", "AVAILABLE"].includes(s.status.toUpperCase());
                            const isFailed = ["FAILED", "ERROR"].includes(s.status.toUpperCase());
                            return (
                              <tr key={s.resourceId} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-hover)]/30 transition">
                                <td className="px-3 py-2.5">
                                  <p className="text-xs font-medium truncate max-w-[200px]">{s.resourceName}</p>
                                  <p className="text-[10px] text-[var(--text-secondary)] font-mono truncate max-w-[200px]">{s.resourceId}</p>
                                </td>
                                <td className="px-3 py-2.5 text-[10px] text-[var(--text-secondary)] whitespace-nowrap">{s.resourceType}</td>
                                <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)] truncate max-w-[140px]">{s.vaultName || "—"}</td>
                                <td className="px-3 py-2.5">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] border font-medium whitespace-nowrap ${isOk ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : isFailed ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>{s.status}</span>
                                </td>
                                <td className="px-3 py-2.5 text-xs whitespace-nowrap">{formatBogota(s.backupCreatedAt)}</td>
                                <td className="px-3 py-2.5 text-xs whitespace-nowrap tabular-nums">{formatBytes(s.sizeBytes ?? 0)}</td>
                                <td className="px-3 py-2.5 text-xs whitespace-nowrap text-[var(--text-secondary)]">{formatBogota(s.backupExpiresAt)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                {data.sendGridConfigured && (
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => handleSendEmail(activeTab === "aws" ? "AWS" : "HUAWEI CLOUD")}
                      disabled={sending}
                      className="px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm flex items-center gap-2 hover:bg-violet-500 disabled:opacity-50 transition-all"
                    >
                      <Send size={16} className={sending ? "animate-pulse" : ""} /> {sending ? "Enviando..." : `Enviar informe ${currentReport.provider} por correo`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <ScrollToTop />
    </div>
  );
}
