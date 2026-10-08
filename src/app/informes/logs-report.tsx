"use client";

import { Archive, CheckCircle2, Cloud, FileWarning, HardDrive, History } from "lucide-react";
import type { LogsInformeData } from "@/lib/email/informe-logs";
import { Collapsible, MetricCard, formatBytes } from "./shared";

type Props = {
  data: LogsInformeData;
  activeTab: "aws" | "huawei";
  onTab: (t: "aws" | "huawei") => void;
  detalleAbierto: boolean;
  onToggleDetalle: () => void;
  cuentasAbiertas: Set<string>;
  onToggleCuenta: (id: string) => void;
};

function formatDateLabel(yyyymmdd: string): string {
  if (!/^\d{8}$/.test(yyyymmdd)) return yyyymmdd || "—";
  const d = new Date(`${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}T12:00:00Z`);
  return d.toLocaleDateString("es-CO", { timeZone: "America/Bogota", weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

export default function LogsReport({ data, activeTab, onTab, detalleAbierto, onToggleDetalle, cuentasAbiertas, onToggleCuenta }: Props) {
  const currentReport = activeTab === "aws" ? data.aws : data.huawei;

  return (
    <>
      <div className="page-section" style={{ animationDelay: "0.05s" }}>
        {data.globalSummary.missingServers > 0 ? (
          <div className="mb-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex items-center gap-3">
            <span className="text-2xl font-black text-red-400 tabular-nums">{data.globalSummary.missingServers}</span>
            <p className="text-sm font-semibold text-red-300">servidor(es) SIN BACKUP de logs el día anterior ({data.day.label}) — detalle en rojo abajo</p>
          </div>
        ) : (
          <div className="mb-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-sm font-semibold text-emerald-300">✓ Todos los servidores tienen backup de logs del día anterior ({data.day.label})</p>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <MetricCard label="Registros" value={data.globalSummary.totalEntries} icon={<History size={16} />} color="#8b5cf6" />
          <MetricCard label="Cobertura" value={`${data.globalSummary.coveragePct}%`} icon={<CheckCircle2 size={16} />} color="#10b981" />
          <MetricCard label="Sin backup" value={data.globalSummary.missingServers} icon={<FileWarning size={16} />} color="#ef4444" />
          <MetricCard label="Volumen" value={formatBytes(data.globalSummary.totalBytes)} icon={<Archive size={16} />} color="#06b6d4" />
          <MetricCard label="Completitud" value={`${data.globalSummary.successRate}%`} icon={<CheckCircle2 size={16} />} color="#f59e0b" />
        </div>
      </div>

      <div className="page-section" style={{ animationDelay: "0.1s" }}>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]/60 backdrop-blur-xl overflow-hidden">
          <div className="flex border-b border-[var(--border)]">
            <button
              onClick={() => onTab("aws")}
              className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-all ${activeTab === "aws" ? "text-amber-400 border-b-2 border-amber-400 bg-amber-500/5" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            >
              <Cloud size={16} /> AWS S3
              <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === "aws" ? "bg-amber-500/20 text-amber-300" : "bg-[var(--bg-hover)] text-[var(--text-secondary)]"}`}>{data.aws.totalEntries}</span>
            </button>
            <button
              onClick={() => onTab("huawei")}
              className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-all ${activeTab === "huawei" ? "text-red-400 border-b-2 border-red-400 bg-red-500/5" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            >
              <HardDrive size={16} /> Huawei OBS
              <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === "huawei" ? "bg-red-500/20 text-red-300" : "bg-[var(--bg-hover)] text-[var(--text-secondary)]"}`}>{data.huawei.totalEntries}</span>
            </button>
          </div>

          <div className="p-5 space-y-4">
            {currentReport.totalEntries === 0 ? (
              <div className="text-center py-12">
                <Archive size={28} className="mx-auto mb-3 text-[var(--text-secondary)]/40" />
                <p className="text-sm font-medium">Sin logs registrados para {currentReport.provider}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Ejecuta un refresco de backups desde el módulo de Backups.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Registros", value: currentReport.totalEntries, color: activeTab === "aws" ? "#f59e0b" : "#ef4444" },
                    { label: "Completos", value: currentReport.completedTotal, color: "#10b981" },
                    { label: "Faltantes", value: currentReport.missingTotal, color: "#ef4444" },
                    { label: "Sin backup", value: currentReport.accounts.reduce((a, c) => a + c.serversMissing, 0), color: "#ef4444" },
                  ].map((m) => (
                    <div key={m.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-hover)]/30 p-3">
                      <p className="text-[10px] tracking-widest uppercase font-semibold text-[var(--text-secondary)]">{m.label}</p>
                      <p className="text-xl font-bold mt-1" style={{ color: m.color }}>{m.value}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <p className="text-[10px] tracking-widest uppercase font-semibold text-emerald-400/70">Completitud global</p>
                  <p className="text-3xl font-bold text-emerald-400 mt-1">{currentReport.successRate}%</p>
                  <div className="mt-2 h-2 rounded-full bg-emerald-500/10 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${currentReport.successRate}%` }} />
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
                          {["Cuenta", "Región", "Servidores", "Completos", "Sin backup", "Cobertura", "Última fecha"].map((h) => (
                            <th key={h} className="px-3 py-3 text-left text-[11px] uppercase tracking-wider text-[var(--text-secondary)] whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {currentReport.accounts.map((a) => (
                          <tr key={a.accountId} className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)]/40 transition">
                            <td className="px-3 py-3 text-sm font-medium">{a.accountName}</td>
                            <td className="px-3 py-3 text-xs text-[var(--text-secondary)]">{a.region}</td>
                            <td className="px-3 py-3 text-sm text-center">{a.serversTracked}</td>
                            <td className="px-3 py-3 text-center">
                              <span className="text-sm font-semibold text-emerald-400">{a.serversOk}</span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className={`text-sm font-bold ${a.serversMissing > 0 ? "text-red-400" : "text-[var(--text-secondary)]"}`}>{a.serversMissing}</span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className={`text-sm font-semibold ${a.coveragePct === 100 ? "text-emerald-400" : "text-amber-400"}`}>{a.coveragePct}%</span>
                            </td>
                            <td className="px-3 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">{a.lastDate ? formatDateLabel(a.lastDate) : "—"}</td>
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
                      hint={`${a.serversTracked} servidores · ${a.serversMissing} sin backup · ${a.coveragePct}% cobertura`}
                    >
                      {a.serversMissing > 0 && (
                        <p className="m-3 mb-0 text-xs font-semibold text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                          ⚠ {a.serversMissing} servidor(es) SIN BACKUP de logs en esta cuenta
                        </p>
                      )}
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-[var(--bg-hover)]/60 border-b border-[var(--border)]">
                            <tr>
                              {["Servidor", "Bucket", "Estado", "Tamaño"].map((h) => (
                                <th key={h} className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-[var(--text-secondary)] whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(a.dates[0]?.servers || []).map((s) => {
                              const missing = s.coverage === "MISSING";
                              const failed = s.coverage === "FAILED";
                              return (
                                <tr key={s.serverName} className={`border-b border-[var(--border)]/50 hover:bg-[var(--bg-hover)]/30 transition ${missing ? "bg-red-500/[0.07]" : failed ? "bg-red-500/[0.03]" : ""}`}>
                                  <td className="px-3 py-2.5 text-xs font-medium whitespace-nowrap">
                                    {missing && <span className="mr-2 px-2 py-0.5 rounded-full text-[10px] border font-bold bg-red-500/15 text-red-300 border-red-500/30">SIN BACKUP</span>}
                                    {s.serverName}
                                  </td>
                                  <td className="px-3 py-2.5 text-[11px] text-[var(--text-secondary)] whitespace-nowrap">{s.bucketName || "—"}</td>
                                  <td className="px-3 py-2.5">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] border font-medium whitespace-nowrap ${missing || failed ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}`}>
                                      {missing ? "SIN BACKUP" : s.status}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-xs whitespace-nowrap tabular-nums">{formatBytes(s.sizeBytes)}</td>
                                </tr>
                              );
                            })}
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
