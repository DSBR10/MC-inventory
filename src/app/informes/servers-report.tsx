"use client";

import { Archive, CheckCircle2, Cloud, Database, HardDrive, XCircle } from "lucide-react";
import type { InformeData } from "@/lib/email/informe";
import { Collapsible, MetricCard, formatBogota, formatBytes, statusPillClasses } from "./shared";

type Props = {
  data: InformeData;
  activeTab: "aws" | "huawei";
  onTab: (t: "aws" | "huawei") => void;
  detalleAbierto: boolean;
  onToggleDetalle: () => void;
  cuentasAbiertas: Set<string>;
  onToggleCuenta: (id: string) => void;
};

export default function ServersReport({ data, activeTab, onTab, detalleAbierto, onToggleDetalle, cuentasAbiertas, onToggleCuenta }: Props) {
  const currentReport = activeTab === "aws" ? data.aws : data.huawei;

  return (
    <>
      <div className="page-section" style={{ animationDelay: "0.05s" }}>
        {data.globalSummary.missingServers > 0 ? (
          <div className="mb-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex items-center gap-3">
            <span className="text-2xl font-black text-red-400 tabular-nums">{data.globalSummary.missingServers}</span>
            <p className="text-sm font-semibold text-red-300">servidor(es) SIN BACKUP el día anterior ({data.day.label}) — detalle en rojo abajo</p>
          </div>
        ) : (
          <div className="mb-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-sm font-semibold text-emerald-300">✓ Todos los servidores tienen backup del día anterior ({data.day.label})</p>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <MetricCard label="Total backups" value={data.globalSummary.totalBackups} icon={<Database size={16} />} color="#8b5cf6" />
          <MetricCard label="Cobertura" value={`${data.globalSummary.coveragePct}%`} icon={<CheckCircle2 size={16} />} color="#10b981" />
          <MetricCard label="Sin backup" value={data.globalSummary.missingServers} icon={<XCircle size={16} />} color="#ef4444" />
          <MetricCard label="Almacenado" value={formatBytes(data.globalSummary.totalBytes)} icon={<Archive size={16} />} color="#06b6d4" />
          <MetricCard label="Tasa fallo" value={`${data.globalSummary.failureRate}%`} icon={<XCircle size={16} />} color="#f59e0b" />
        </div>
      </div>

      <div className="page-section" style={{ animationDelay: "0.1s" }}>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]/60 backdrop-blur-xl overflow-hidden">
          <div className="flex border-b border-[var(--border)]">
            <button
              onClick={() => onTab("aws")}
              className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-all ${activeTab === "aws" ? "text-amber-400 border-b-2 border-amber-400 bg-amber-500/5" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            >
              <Cloud size={16} /> AWS Backup
              <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === "aws" ? "bg-amber-500/20 text-amber-300" : "bg-[var(--bg-hover)] text-[var(--text-secondary)]"}`}>{data.aws.totalBackups}</span>
            </button>
            <button
              onClick={() => onTab("huawei")}
              className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-all ${activeTab === "huawei" ? "text-red-400 border-b-2 border-red-400 bg-red-500/5" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            >
              <HardDrive size={16} /> Huawei CBR
              <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === "huawei" ? "bg-red-500/20 text-red-300" : "bg-[var(--bg-hover)] text-[var(--text-secondary)]"}`}>{data.huawei.totalBackups}</span>
            </button>
          </div>

          <div className="p-5 space-y-4">
            {currentReport.totalBackups === 0 ? (
              <div className="text-center py-12">
                <Archive size={28} className="mx-auto mb-3 text-[var(--text-secondary)]/40" />
                <p className="text-sm font-medium">Sin backups registrados para {currentReport.provider}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Ejecuta un refresco de backups desde el módulo de Backups.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Total", value: currentReport.totalBackups, color: activeTab === "aws" ? "#f59e0b" : "#ef4444" },
                    { label: "Exitosos", value: currentReport.successfulTotal, color: "#10b981" },
                    { label: "Fallidos", value: currentReport.failedTotal, color: "#ef4444" },
                    { label: "Sin backup", value: currentReport.accounts.reduce((a, c) => a + c.missingServers, 0), color: "#ef4444" },
                  ].map((m) => (
                    <div key={m.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-hover)]/30 p-3">
                      <p className="text-[10px] tracking-widest uppercase font-semibold text-[var(--text-secondary)]">{m.label}</p>
                      <p className="text-xl font-bold mt-1" style={{ color: m.color }}>{m.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                <Collapsible
                  open={detalleAbierto}
                  onToggle={onToggleDetalle}
                  title="Detalle por cuenta"
                  hint={`${currentReport.accounts.length} cuenta(s) · clic para ${detalleAbierto ? "minimizar" : "expandir"}`}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[var(--bg-hover)]/60 border-b border-[var(--border)]">
                        <tr>
                          {["Cuenta", "Región", "Vaults", "Servidores", "Con backup", "Exitosos", "Fallidos", "Sin backup", "Último backup"].map((h) => (
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
                            <td className="px-3 py-3 text-center">
                              <span className={`text-sm font-bold ${a.missingServers > 0 ? "text-red-400" : "text-[var(--text-secondary)]"}`}>{a.missingServers}</span>
                            </td>
                            <td className="px-3 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">{formatBogota(a.lastBackup)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Collapsible>

                {currentReport.accounts.map((a) => {
                  const abierta = cuentasAbiertas.has(a.accountId);
                  return (
                    <Collapsible
                      key={a.accountId}
                      open={abierta}
                      onToggle={() => onToggleCuenta(a.accountId)}
                      title={<span className="truncate">{a.accountName} <span className="text-xs font-normal text-[var(--text-secondary)]">({a.region})</span></span>}
                      hint={`${a.serversWithBackup}/${a.totalServers} con backup · ${a.failedBackups} fallidos · ${a.missingServers} sin backup`}
                    >
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-[var(--bg-hover)]/60 border-b border-[var(--border)]">
                            <tr>
                              {["Servidor", "Tipo", "Vault", "Estado", "Fecha backup", "Tamaño", "Expira"].map((h) => (
                                <th key={h} className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-[var(--text-secondary)] whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {a.servers.map((s) => (
                              <tr key={s.resourceId} className={`border-b border-[var(--border)]/50 hover:bg-[var(--bg-hover)]/30 transition ${s.coverage === "MISSING" ? "bg-red-500/[0.07]" : s.coverage === "FAILED" ? "bg-red-500/[0.03]" : ""}`}>
                                <td className="px-3 py-2.5">
                                  <p className="text-xs font-medium truncate max-w-[200px]">{s.resourceName}</p>
                                  <p className="text-[10px] text-[var(--text-secondary)] font-mono truncate max-w-[200px]">{s.resourceId}</p>
                                </td>
                                <td className="px-3 py-2.5 text-[10px] text-[var(--text-secondary)] whitespace-nowrap">{s.resourceType}</td>
                                <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)] truncate max-w-[140px]">{s.vaultName || "—"}</td>
                                <td className="px-3 py-2.5">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] border font-medium whitespace-nowrap ${statusPillClasses(s.status)}`}>{s.status}</span>
                                </td>
                                <td className="px-3 py-2.5 text-xs whitespace-nowrap">{formatBogota(s.backupCreatedAt)}</td>
                                <td className="px-3 py-2.5 text-xs whitespace-nowrap tabular-nums">{formatBytes(s.sizeBytes ?? 0)}</td>
                                <td className="px-3 py-2.5 text-xs whitespace-nowrap text-[var(--text-secondary)]">{formatBogota(s.backupExpiresAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Collapsible>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
