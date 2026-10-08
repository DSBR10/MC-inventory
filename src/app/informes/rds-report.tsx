"use client";

import { Archive, CheckCircle2, Cloud, Database, HardDrive, XCircle } from "lucide-react";
import type { RdsInformeData } from "@/lib/email/informe-rds";
import { Collapsible, MetricCard, formatBogota, formatBytes, statusPillClasses } from "./shared";

type Props = {
  data: RdsInformeData;
  activeTab: "aws" | "huawei";
  onTab: (t: "aws" | "huawei") => void;
  detalleAbierto: boolean;
  onToggleDetalle: () => void;
  cuentasAbiertas: Set<string>;
  onToggleCuenta: (id: string) => void;
};

export default function RdsReport({ data, activeTab, onTab, detalleAbierto, onToggleDetalle, cuentasAbiertas, onToggleCuenta }: Props) {
  const currentReport = activeTab === "aws" ? data.aws : data.huawei;

  return (
    <>
      <div className="page-section" style={{ animationDelay: "0.05s" }}>
        {data.globalSummary.missingDatabases > 0 ? (
          <div className="mb-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex items-center gap-3">
            <span className="text-2xl font-black text-red-400 tabular-nums">{data.globalSummary.missingDatabases}</span>
            <p className="text-sm font-semibold text-red-300">base(s) de datos SIN BACKUP el día anterior ({data.day.label}) — detalle en rojo abajo</p>
          </div>
        ) : (
          <div className="mb-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-sm font-semibold text-emerald-300">✓ Todas las bases de datos tienen snapshot del día anterior ({data.day.label})</p>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <MetricCard label="Total snapshots" value={data.globalSummary.totalSnapshots} icon={<Database size={16} />} color="#8b5cf6" />
          <MetricCard label="Cobertura" value={`${data.globalSummary.coveragePct}%`} icon={<CheckCircle2 size={16} />} color="#10b981" />
          <MetricCard label="Sin backup" value={data.globalSummary.missingDatabases} icon={<XCircle size={16} />} color="#ef4444" />
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
              <Cloud size={16} /> AWS RDS
              <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === "aws" ? "bg-amber-500/20 text-amber-300" : "bg-[var(--bg-hover)] text-[var(--text-secondary)]"}`}>{data.aws.totalSnapshots}</span>
            </button>
            <button
              onClick={() => onTab("huawei")}
              className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-all ${activeTab === "huawei" ? "text-red-400 border-b-2 border-red-400 bg-red-500/5" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            >
              <HardDrive size={16} /> Huawei RDS
              <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === "huawei" ? "bg-red-500/20 text-red-300" : "bg-[var(--bg-hover)] text-[var(--text-secondary)]"}`}>{data.huawei.totalSnapshots}</span>
            </button>
          </div>

          <div className="p-5 space-y-4">
            {currentReport.totalSnapshots === 0 ? (
              <div className="text-center py-12">
                <Archive size={28} className="mx-auto mb-3 text-[var(--text-secondary)]/40" />
                <p className="text-sm font-medium">Sin snapshots registrados para {currentReport.provider}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Ejecuta un refresco de backups desde el módulo de Backups.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Snapshots", value: currentReport.totalSnapshots, color: activeTab === "aws" ? "#f59e0b" : "#ef4444" },
                    { label: "Exitosos", value: currentReport.successfulTotal, color: "#10b981" },
                    { label: "Fallidos", value: currentReport.failedTotal, color: "#ef4444" },
                    { label: "Sin backup", value: currentReport.accounts.reduce((a, c) => a + c.missingInstances, 0), color: "#ef4444" },
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
                          {["Cuenta", "Región", "Motores", "Instancias", "Snapshots", "Exitosos", "Fallidos", "Sin backup", "Último snapshot"].map((h) => (
                            <th key={h} className="px-3 py-3 text-left text-[11px] uppercase tracking-wider text-[var(--text-secondary)] whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {currentReport.accounts.map((a) => (
                          <tr key={a.accountId} className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)]/40 transition">
                            <td className="px-3 py-3 text-sm font-medium">{a.accountName}</td>
                            <td className="px-3 py-3 text-xs text-[var(--text-secondary)]">{a.region}</td>
                            <td className="px-3 py-3 text-xs text-[var(--text-secondary)]">{a.engines.join(", ") || "—"}</td>
                            <td className="px-3 py-3 text-sm text-center">{a.instanceCount}</td>
                            <td className="px-3 py-3 text-sm text-center">{a.totalSnapshots}</td>
                            <td className="px-3 py-3 text-center">
                              <span className="text-sm font-semibold text-emerald-400">{a.successfulSnapshots}</span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className={`text-sm font-semibold ${a.failedSnapshots > 0 ? "text-red-400" : "text-[var(--text-secondary)]"}`}>{a.failedSnapshots}</span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className={`text-sm font-bold ${a.missingInstances > 0 ? "text-red-400" : "text-[var(--text-secondary)]"}`}>{a.missingInstances}</span>
                            </td>
                            <td className="px-3 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">{formatBogota(a.lastSnapshot)}</td>
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
                      hint={`${a.instanceCount} instancias · ${a.failedSnapshots} fallidos · ${a.missingInstances} sin backup`}
                    >
                      <div className="p-4 space-y-4">
                        {a.missingInstances > 0 && (
                          <p className="text-xs font-semibold text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                            ⚠ {a.missingInstances} base(s) de datos SIN BACKUP en esta cuenta
                          </p>
                        )}
                        {a.instances.map((inst) => (
                          <div key={inst.dbInstanceId || inst.dbInstanceName} className={inst.coverage === "MISSING" ? "rounded-xl border border-red-500/30 bg-red-500/[0.06] p-3" : ""}>
                            <p className="text-xs font-semibold mb-2">
                              {inst.coverage === "MISSING" && <span className="mr-2 px-2 py-0.5 rounded-full text-[10px] border font-bold bg-red-500/15 text-red-300 border-red-500/30">SIN BACKUP</span>}
                              {inst.dbInstanceName}
                              <span className="ml-2 font-normal text-[var(--text-secondary)]">{inst.engine} · {inst.coverage === "MISSING" ? "sin snapshots ayer" : `${inst.totalSnapshots} snapshots`}</span>
                            </p>
                            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                              <table className="w-full">
                                <thead className="bg-[var(--bg-hover)]/60 border-b border-[var(--border)]">
                                  <tr>
                                    {["Snapshot", "Tipo", "Estado", "Fecha", "Tamaño"].map((h) => (
                                      <th key={h} className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-[var(--text-secondary)] whitespace-nowrap">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {inst.snapshots.map((s) => (
                                    <tr key={s.snapshotId} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-hover)]/30 transition">
                                      <td className="px-3 py-2">
                                        <p className="text-xs font-medium truncate max-w-[220px]">{s.snapshotName}</p>
                                        <p className="text-[10px] text-[var(--text-secondary)] font-mono truncate max-w-[220px]">{s.snapshotId}</p>
                                      </td>
                                      <td className="px-3 py-2 text-[11px] text-[var(--text-secondary)] whitespace-nowrap">{s.snapshotType || "—"}</td>
                                      <td className="px-3 py-2">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] border font-medium whitespace-nowrap ${statusPillClasses(s.status)}`}>{s.status}</span>
                                      </td>
                                      <td className="px-3 py-2 text-xs whitespace-nowrap">{formatBogota(s.snapshotCreatedAt)}</td>
                                      <td className="px-3 py-2 text-xs whitespace-nowrap tabular-nums">{s.sizeBytes !== null ? formatBytes(s.sizeBytes) : "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {inst.totalSnapshots > inst.snapshots.length && (
                              <p className="text-[11px] text-[var(--text-secondary)] mt-1.5">…y {inst.totalSnapshots - inst.snapshots.length} snapshots anteriores.</p>
                            )}
                          </div>
                        ))}
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
