"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/auth/roles";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  FileBarChart,
  History,
  Inbox,
  Plus,
  RefreshCw,
  ScrollText,
  Send,
  Server,
  Settings2,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import ScrollToTop from "@/components/ui/ScrollToTop";
import type { InformeData } from "@/lib/email/informe";
import type { RdsInformeData } from "@/lib/email/informe-rds";
import type { LogsInformeData } from "@/lib/email/informe-logs";
import { formatBogota } from "./shared";
import ServersReport from "./servers-report";
import RdsReport from "./rds-report";
import LogsReport from "./logs-report";

type ReportType = "servers" | "rds" | "logs";
type ProviderTab = "aws" | "huawei";

type Recipient = {
  id: string;
  email: string;
  name: string | null;
  active: boolean;
};

type RecentSend = {
  sentAt: string;
  status: string;
  details: {
    reportType?: string;
    recipients?: string[];
    messageId?: string;
    totalBackups?: number;
    successRate?: number;
    error?: string;
  };
};

type AllReports = {
  servers: InformeData;
  rds: RdsInformeData;
  logs: LogsInformeData;
  sendGridConfigured: boolean;
};

const REPORT_META: Record<ReportType, { label: string; short: string }> = {
  servers: { label: "Servidores", short: "servidores" },
  rds: { label: "Bases de datos", short: "bases de datos" },
  logs: { label: "Logs transaccionales", short: "logs" },
};

export default function InformesPage() {
  const { data: session } = useSession();
  const canManageRecipients = !!session?.user?.role && hasPermission(session.user.role, "inventory:modify");

  const [data, setData] = useState<AllReports | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [reportType, setReportType] = useState<ReportType>("servers");
  const [activeTab, setActiveTab] = useState<ProviderTab>("aws");

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientsSource, setRecipientsSource] = useState<"db" | "env" | "none">("none");
  const [senderEmail, setSenderEmail] = useState("");
  const [recentSends, setRecentSends] = useState<RecentSend[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [savingRecipient, setSavingRecipient] = useState(false);

  // Colapsables: el resumen "Detalle por cuenta" inicia abierto; cada cuenta inicia minimizada.
  const [detalleAbierto, setDetalleAbierto] = useState(true);
  const [cuentasAbiertas, setCuentasAbiertas] = useState<Set<string>>(new Set());

  // Centro de configuración de correo
  const [configOpen, setConfigOpen] = useState(false);
  const [configTab, setConfigTab] = useState<"estado" | "correos" | "enviar">("estado");
  const [sendReportType, setSendReportType] = useState<ReportType>("servers");
  const [sendProvider, setSendProvider] = useState<"all" | "AWS" | "HUAWEI CLOUD">("all");
  const [adHoc, setAdHoc] = useState("");

  const toggleCuenta = (accountId: string) => {
    setCuentasAbiertas((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  };

  const switchReportType = (t: ReportType) => {
    setReportType(t);
    setActiveTab("aws");
    setDetalleAbierto(true);
    setCuentasAbiertas(new Set());
  };

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

  const fetchRecipients = useCallback(async () => {
    try {
      const res = await fetch("/api/informes/recipients");
      if (!res.ok) return;
      const json = await res.json();
      setRecipients(json.recipients || []);
      setRecipientsSource(json.source || "none");
      setSenderEmail(json.senderEmail || "");
      setRecentSends(json.recentSends || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchRecipients();
  }, [fetchRecipients]);

  const handleSendEmail = async (type: ReportType, provider: "all" | "AWS" | "HUAWEI CLOUD", adHocList?: string[]) => {
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/informes/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportType: type, provider, recipients: adHocList && adHocList.length > 0 ? adHocList : undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Error ${res.status}: no se pudo enviar el correo`);
      }
      toast.success(`Correo enviado exitosamente a ${json.recipients?.join(", ") || "destinatarios"}`, { duration: 6000 });
      fetchRecipients();
    } catch (e: any) {
      toast.error(e?.message || "Error enviando informe por correo", { duration: 8000 });
    } finally {
      setSending(false);
    }
  };

  const handleSendFromConfig = () => {
    const list = adHoc.split(/[,;\n]/).map((s) => s.trim().toLowerCase()).filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s));
    const unique = [...new Set(list)];
    if (adHoc.trim() && unique.length === 0) {
      toast.error("Ningún correo adicional es válido");
      return;
    }
    handleSendEmail(sendReportType, sendProvider, unique);
  };

  const openQuickSend = (type: ReportType) => {
    setSendReportType(type);
    setSendProvider("all");
    setConfigTab("enviar");
    setConfigOpen(true);
  };

  const handleAddRecipient = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      toast.error("Escribe un correo válido");
      return;
    }
    setSavingRecipient(true);
    try {
      const res = await fetch("/api/informes/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: newName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo agregar");
      toast.success(`Destinatario agregado: ${json.recipient.email}`);
      setNewEmail("");
      setNewName("");
      fetchRecipients();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo agregar el destinatario");
    } finally {
      setSavingRecipient(false);
    }
  };

  const handleToggleRecipient = async (id: string, active: boolean) => {
    try {
      const res = await fetch("/api/informes/recipients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active }),
      });
      if (!res.ok) throw new Error("No se pudo actualizar");
      fetchRecipients();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo actualizar el destinatario");
    }
  };

  const handleRemoveRecipient = async (id: string, email: string) => {
    if (!window.confirm(`¿Eliminar a ${email} de los destinatarios?`)) return;
    try {
      const res = await fetch(`/api/informes/recipients?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo eliminar");
      toast.success("Destinatario eliminado");
      fetchRecipients();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo eliminar el destinatario");
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchData();
  };

  const handleViewInNewTab = () => {
    window.open(`/api/informes/pdf?reportType=${reportType}&provider=${activeTab === "aws" ? "AWS" : "HUAWEI CLOUD"}`, "_blank");
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
          <p className="text-sm text-[var(--text-secondary)]">Generando informes...</p>
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

  const activeProviderLabel = activeTab === "aws" ? "AWS" : "HUAWEI CLOUD";

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
                  Datos del día anterior: <span className="font-semibold text-[var(--text-primary)]">{data.servers.dateLabel}</span> · Envío diario automático a las {process.env.NEXT_PUBLIC_INFORMES_HOUR || "07:00"} hora Colombia
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-1.5">
                  <Clock3 size={12} />
                  Generado: {formatBogota(data.servers.generatedAt)}
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
              <button onClick={() => { setConfigTab("estado"); setConfigOpen(true); }} className="px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm flex items-center gap-2 hover:bg-violet-500 transition-all">
                <Settings2 size={16} /> Configuración
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="page-section" style={{ animationDelay: "0.03s" }}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            { id: "servers", label: "Servidores", desc: `${data.servers.globalSummary.totalBackups} backups · ${data.servers.globalSummary.successRate}% éxito`, icon: <Server size={17} />, active: reportType === "servers", accent: "#8b5cf6" },
            { id: "rds", label: "Bases de datos", desc: `${data.rds.globalSummary.totalSnapshots} snapshots · ${data.rds.globalSummary.successRate}% éxito`, icon: <Database size={17} />, active: reportType === "rds", accent: "#06b6d4" },
            { id: "logs", label: "Logs transaccionales", desc: `${data.logs.globalSummary.totalEntries} registros · ${data.logs.globalSummary.successRate}% completitud`, icon: <History size={17} />, active: reportType === "logs", accent: "#f59e0b" },
          ] as const).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => switchReportType(t.id)}
              aria-pressed={t.active}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all ${t.active ? "border-transparent shadow-lg" : "border-[var(--border)] bg-[var(--bg-card)]/60 hover:border-white/20"}`}
              style={t.active ? { background: `linear-gradient(135deg, ${t.accent}26, transparent)` , borderColor: `${t.accent}55` } : undefined}
            >
              <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${t.accent}18`, color: t.accent }}>
                {t.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{t.label}</span>
                <span className="block text-xs text-[var(--text-secondary)] truncate">{t.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {reportType === "servers" && (
        <ServersReport
          data={data.servers}
          activeTab={activeTab}
          onTab={setActiveTab}
          detalleAbierto={detalleAbierto}
          onToggleDetalle={() => setDetalleAbierto((v) => !v)}
          cuentasAbiertas={cuentasAbiertas}
          onToggleCuenta={toggleCuenta}
        />
      )}
      {reportType === "rds" && (
        <RdsReport
          data={data.rds}
          activeTab={activeTab}
          onTab={setActiveTab}
          detalleAbierto={detalleAbierto}
          onToggleDetalle={() => setDetalleAbierto((v) => !v)}
          cuentasAbiertas={cuentasAbiertas}
          onToggleCuenta={toggleCuenta}
        />
      )}
      {reportType === "logs" && (
        <LogsReport
          data={data.logs}
          activeTab={activeTab}
          onTab={setActiveTab}
          detalleAbierto={detalleAbierto}
          onToggleDetalle={() => setDetalleAbierto((v) => !v)}
          cuentasAbiertas={cuentasAbiertas}
          onToggleCuenta={toggleCuenta}
        />
      )}

      <div className="page-section flex justify-end">
        <button
          type="button"
          onClick={() => openQuickSend(reportType)}
          className="px-4 py-2.5 rounded-xl border border-violet-500/30 bg-violet-500/10 text-sm flex items-center gap-2 hover:bg-violet-500/20 text-violet-200 transition-all"
        >
          <Send size={16} /> Enviar informe de {REPORT_META[reportType].short} por correo
        </button>
      </div>

      {configOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setConfigOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Configuración de correo"
            className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl overflow-hidden max-h-[88vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-violet-600 text-white">
                  <Settings2 size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">Configuración de correo</h2>
                  <p className="text-xs text-[var(--text-secondary)]">Estado, destinatarios y envío de informes</p>
                </div>
              </div>
              <button type="button" onClick={() => setConfigOpen(false)} aria-label="Cerrar configuración" className="p-2 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-all">
                <X size={16} />
              </button>
            </div>

            <div className="flex gap-1 px-5 pt-3">
              {([
                { id: "estado", label: "Estado" },
                { id: "correos", label: "Correos" },
                { id: "enviar", label: "Enviar" },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setConfigTab(t.id)}
                  className={`px-4 py-2 rounded-t-xl text-sm font-medium transition-all ${configTab === t.id ? "bg-[var(--bg-hover)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="px-5 py-4 overflow-y-auto">
              {configTab === "estado" && (
                <div className="space-y-3">
                  <div className={`flex items-center gap-3 rounded-xl border p-4 ${data.sendGridConfigured ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"}`}>
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${data.sendGridConfigured ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"}`} />
                    <div>
                      <p className="text-sm font-semibold">{data.sendGridConfigured ? "SendGrid operativo" : "SendGrid sin configurar"}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {data.sendGridConfigured
                          ? "API key y remitente listos. El envío automático corre a diario a las 07:00."
                          : "Falta SENDGRID_API_KEY o SENDGRID_SENDER_EMAIL en el entorno."}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl border border-[var(--border)] bg-black/20 p-3">
                      <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">Remitente (fijo)</p>
                      <p className="mt-1 font-medium break-all">{senderEmail || "—"}</p>
                    </div>
                    <div className="rounded-xl border border-[var(--border)] bg-black/20 p-3">
                      <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">Envío automático</p>
                      <p className="mt-1 font-medium">{process.env.NEXT_PUBLIC_INFORMES_HOUR || "07:00"} hora Colombia · 3 informes</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-black/20 p-3">
                    <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] mb-2">Últimos envíos</p>
                    {recentSends.length === 0 ? (
                      <p className="text-xs text-[var(--text-secondary)] flex items-center gap-2"><Inbox size={13} /> Aún no hay envíos registrados.</p>
                    ) : (
                      <div className="space-y-2">
                        {recentSends.map((s, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            {s.status === "success"
                              ? <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                              : <XCircle size={14} className="text-red-400 mt-0.5 shrink-0" />}
                            <div className="min-w-0">
                              <p className="font-medium">{formatBogota(s.sentAt)} · {s.status}{s.details?.reportType ? ` · ${s.details.reportType}` : ""}</p>
                              {s.details?.recipients && <p className="text-[var(--text-secondary)] truncate">Para: {s.details.recipients.join(", ")}</p>}
                              {s.details?.error && <p className="text-red-400 break-words">{s.details.error}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {configTab === "correos" && (
                <div>
                  <p className="text-xs text-[var(--text-secondary)] mb-3">
                    {recipientsSource === "db" ? (
                      <>Lista gestionada aquí <span className="text-emerald-400 font-medium">({recipients.filter((r) => r.active).length} activos)</span>. Tiene prioridad sobre la variable de entorno.</>
                    ) : recipientsSource === "env" ? (
                      <>Usando variable de entorno. <span className="text-amber-400 font-medium">Agrega un correo para tomar control desde aquí.</span></>
                    ) : (
                      <span className="text-red-400 font-medium">Sin destinatarios: agrega al menos uno.</span>
                    )}
                  </p>
                  {recipients.length === 0 ? (
                    <p className="text-xs text-[var(--text-secondary)] rounded-xl border border-dashed border-[var(--border)] p-4 text-center mb-3">
                      No hay destinatarios guardados.
                    </p>
                  ) : (
                    <div className="space-y-2 mb-3 max-h-56 overflow-y-auto pr-1">
                      {recipients.map((r) => (
                        <div key={r.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${r.active ? "border-[var(--border)] bg-[var(--bg-hover)]/30" : "border-[var(--border)] opacity-50"}`}>
                          <button
                            type="button"
                            disabled={!canManageRecipients}
                            onClick={() => handleToggleRecipient(r.id, !r.active)}
                            title={r.active ? "Desactivar" : "Activar"}
                            aria-label={r.active ? `Desactivar ${r.email}` : `Activar ${r.email}`}
                            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${r.active ? "bg-emerald-500" : "bg-[var(--bg-hover)] border border-[var(--border)]"} ${canManageRecipients ? "cursor-pointer" : "cursor-default"}`}
                          >
                            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${r.active ? "left-[18px]" : "left-0.5"}`} />
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{r.email}</p>
                            {r.name && <p className="text-xs text-[var(--text-secondary)] truncate">{r.name}</p>}
                          </div>
                          {!r.active && <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Inactivo</span>}
                          {canManageRecipients && (
                            <button
                              type="button"
                              onClick={() => handleRemoveRecipient(r.id, r.email)}
                              title={`Eliminar ${r.email}`}
                              aria-label={`Eliminar ${r.email}`}
                              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {canManageRecipients ? (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleAddRecipient(); }}
                        placeholder="correo@ejemplo.com"
                        aria-label="Nuevo correo destinatario"
                        className="flex-1 px-3.5 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/10 outline-none focus:border-cyan-500/40 placeholder:text-[var(--text-secondary)]/40"
                      />
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleAddRecipient(); }}
                        placeholder="Nombre (opcional)"
                        aria-label="Nombre del destinatario"
                        className="sm:w-40 px-3.5 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/10 outline-none focus:border-cyan-500/40 placeholder:text-[var(--text-secondary)]/40"
                      />
                      <button
                        type="button"
                        onClick={handleAddRecipient}
                        disabled={savingRecipient || !newEmail.trim()}
                        className="px-4 py-2.5 rounded-xl bg-cyan-600 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-cyan-500 disabled:opacity-50 transition-all"
                      >
                        <Plus size={16} /> {savingRecipient ? "..." : "Agregar"}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-secondary)]">Solo un administrador puede gestionar los destinatarios.</p>
                  )}
                </div>
              )}

              {configTab === "enviar" && (
                <div className="space-y-4">
                  {!data.sendGridConfigured && (
                    <p className="text-xs rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-amber-300 flex items-start gap-2">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      SendGrid no está configurado (falta API key o remitente). El envío fallará hasta configurarlo.
                    </p>
                  )}
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-[var(--text-secondary)] mb-2">Informe</p>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { id: "servers", label: "Servidores" },
                        { id: "rds", label: "Bases de datos" },
                        { id: "logs", label: "Logs" },
                      ] as const).map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => setSendReportType(o.id)}
                          className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${sendReportType === o.id ? "bg-violet-600 text-white border-violet-600" : "border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"}`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-[var(--text-secondary)] mb-2">Alcance del informe</p>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { id: "all", label: "Completo" },
                        { id: "AWS", label: "Solo AWS" },
                        { id: "HUAWEI CLOUD", label: "Solo Huawei" },
                      ] as const).map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => setSendProvider(o.id)}
                          className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${sendProvider === o.id ? "bg-violet-600 text-white border-violet-600" : "border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"}`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-[var(--text-secondary)] mb-2">Correos adicionales (opcional)</p>
                    <textarea
                      value={adHoc}
                      onChange={(e) => setAdHoc(e.target.value)}
                      placeholder="otros@ejemplo.com, jefe@ejemplo.com (separados por coma)"
                      aria-label="Correos adicionales para este envío"
                      rows={2}
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/10 outline-none focus:border-cyan-500/40 placeholder:text-[var(--text-secondary)]/40 resize-none"
                    />
                    <p className="text-[11px] text-[var(--text-secondary)] mt-1.5">Si lo dejas vacío, se envía a la lista de destinatarios configurada.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendFromConfig}
                    disabled={sending}
                    className="w-full py-3 rounded-xl bg-violet-600 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-violet-500 disabled:opacity-50 transition-all"
                  >
                    <Send size={16} className={sending ? "animate-pulse" : ""} />
                    {sending ? "Enviando..." : `Enviar informe de ${REPORT_META[sendReportType].short}`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ScrollToTop />
    </div>
  );
}
