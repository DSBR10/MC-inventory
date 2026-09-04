"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Download, Filter, Loader2, Search, ShieldCheck, X } from "lucide-react";

import type { AuditEventSummary, AuditResult } from "@/types/audit";

import { formatAuditDate } from "./AuditEventDetail";

type AuditResponse = {
  page: number;
  limit: number;
  total: number;
  pages: number;
  summary: Record<AuditResult, number>;
  events: AuditEventSummary[];
};

type AuditFilters = {
  from: string;
  to: string;
  actor: string;
  action: string;
  route: string;
  ip: string;
  result: "" | AuditResult;
};

const emptySummary: Record<AuditResult, number> = {
  success: 0,
  failure: 0,
  denied: 0,
  error: 0,
  partial: 0,
};

function openDetailInNewTab(id: string) {
  window.open(`/auditoria/${id}`, "_blank", "noopener");
}

function shorten(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function buildQuery(filters: AuditFilters, page: number) {
  const params = new URLSearchParams({ page: String(page), limit: "50" });
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

export default function AuditDashboard() {
  const [filters, setFilters] = useState<AuditFilters>({ from: "", to: "", actor: "", action: "", route: "", ip: "", result: "" });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditResponse>({ page: 1, limit: 50, total: 0, pages: 0, summary: emptySummary, events: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/audit?${buildQuery(filters, page)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as AuditResponse & { error?: string };
        if (!response.ok) throw new Error(payload.error || "No se pudo consultar la auditoría");
        if (active) {
          setError("");
          setData(payload);
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "No se pudo consultar la auditoría");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filters, page]);

  function updateFilter(key: keyof AuditFilters, value: string) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setPage(1);
    setFilters({ from: "", to: "", actor: "", action: "", route: "", ip: "", result: "" });
  }

  function exportAudit() {
    window.location.assign(`/api/audit/export?${buildQuery(filters, 1)}`);
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const summary = data.summary || emptySummary;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
            <ShieldCheck className="h-3.5 w-3.5" /> Registro persistente append-only
          </div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Auditoría</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Trazabilidad de accesos, operaciones y denegaciones sin guardar secretos.</p>
        </div>
        <button type="button" onClick={exportAudit} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-cyan-400/30 bg-cyan-500/10 px-4 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20">
          <Download className="h-4 w-4" /> Exportar CSV
        </button>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryCard label="Total" value={data.total} tone="cyan" />
        <SummaryCard label="Éxitos" value={summary.success} tone="emerald" />
        <SummaryCard label="Fallos" value={summary.failure + summary.error} tone="rose" />
        <SummaryCard label="Denegados" value={summary.denied} tone="amber" />
        <SummaryCard label="Parciales" value={summary.partial} tone="violet" />
      </section>

      <section className="overflow-visible rounded-lg border border-[var(--border)] bg-[var(--bg-card)]/70">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={() => setFiltersOpen((current) => !current)} className="inline-flex items-center gap-2 self-start rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)]" aria-expanded={filtersOpen}>
            <Filter className="h-4 w-4" /> Filtros {activeFilterCount > 0 && <span className="rounded-full bg-cyan-400 px-1.5 text-xs text-slate-950">{activeFilterCount}</span>}
          </button>
          <span className="text-xs text-[var(--text-secondary)]">{data.total.toLocaleString("es-CO")} eventos</span>
        </div>
        {filtersOpen && (
          <div className="grid grid-cols-1 gap-3 border-b border-[var(--border)] p-4 md:grid-cols-2 xl:grid-cols-4">
            <FilterInput label="Desde" type="datetime-local" value={filters.from} onChange={(value) => updateFilter("from", value)} />
            <FilterInput label="Hasta" type="datetime-local" value={filters.to} onChange={(value) => updateFilter("to", value)} />
            <FilterInput label="Actor" value={filters.actor} onChange={(value) => updateFilter("actor", value)} placeholder="ID, email o nombre" />
            <FilterInput label="Acción" value={filters.action} onChange={(value) => updateFilter("action", value)} placeholder="audit.view" />
            <FilterInput label="Ruta" value={filters.route} onChange={(value) => updateFilter("route", value)} placeholder="/api/" />
            <FilterInput label="IP" value={filters.ip} onChange={(value) => updateFilter("ip", value)} />
            <label className="block text-xs text-[var(--text-secondary)]">Resultado<select value={filters.result} onChange={(event) => updateFilter("result", event.target.value)} className="control mt-1.5"><option value="">Todos</option><option value="success">success</option><option value="failure">failure</option><option value="denied">denied</option><option value="error">error</option><option value="partial">partial</option></select></label>
            <button type="button" onClick={clearFilters} className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-400/20 px-3 text-sm text-red-200 transition hover:bg-red-500/10"><X className="h-4 w-4" /> Limpiar</button>
          </div>
        )}
      </section>

      {error && <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
      <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]/70">
        {loading ? <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-[var(--text-secondary)]"><Loader2 className="h-4 w-4 animate-spin" /> Consultando eventos...</div> : data.events.length === 0 ? <div className="p-10 text-center text-sm text-[var(--text-secondary)]">No hay eventos para los filtros actuales.</div> : <AuditTable events={data.events} onSelect={openDetailInNewTab} />}
        <div className="flex items-center justify-between border-t border-[var(--border)] p-3 text-xs text-[var(--text-secondary)]">
          <span>Página {data.page} de {Math.max(data.pages, 1)}</span>
          <div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded-md border border-[var(--border)] p-2 disabled:opacity-40" aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></button><button type="button" disabled={page >= data.pages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-md border border-[var(--border)] p-2 disabled:opacity-40" aria-label="Página siguiente"><ChevronRight className="h-4 w-4" /></button></div>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "cyan" | "emerald" | "rose" | "amber" | "violet" }) {
  const colors = { cyan: "text-cyan-200", emerald: "text-emerald-200", rose: "text-rose-200", amber: "text-amber-200", violet: "text-violet-200" };
  return <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)]/70 p-4"><p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">{label}</p><p className={`mt-1 text-2xl font-semibold ${colors[tone]}`}>{value.toLocaleString("es-CO")}</p></div>;
}

function FilterInput({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label className="block text-xs text-[var(--text-secondary)]">{label}<span className="relative mt-1.5 block">{type === "datetime-local" ? <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" /> : <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="control pl-9" /></span></label>;
}

function AuditTable({ events, onSelect }: { events: AuditEventSummary[]; onSelect: (id: string) => void }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--text-secondary)]"><tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Acción</th><th className="px-4 py-3">Ruta</th><th className="px-4 py-3">Resultado</th><th className="px-4 py-3">IP</th><th className="px-4 py-3">User-agent</th><th className="px-4 py-3">Duración</th></tr></thead><tbody className="divide-y divide-[var(--border)]">{events.map((event) => <tr key={event.id} onClick={() => onSelect(event.id)} title="Abrir detalle en pestaña nueva" className="cursor-pointer transition hover:bg-[var(--bg-hover)]"><td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--text-secondary)]">{formatAuditDate(event.occurredAt)}</td><td className="max-w-[180px] px-4 py-3"><span className="block truncate font-medium text-[var(--text-primary)]">{event.actor.name}</span><span className="block truncate text-xs text-[var(--text-secondary)]">{event.actor.email}</span></td><td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-cyan-200">{event.action}</td><td className="max-w-[220px] truncate px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">{event.route}</td><td className="px-4 py-3"><ResultBadge result={event.result} /></td><td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">{event.ip}</td><td className="max-w-[170px] truncate px-4 py-3 text-xs text-[var(--text-secondary)]" title={event.userAgent}>{shorten(event.userAgent, 28)}</td><td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--text-secondary)]">{event.durationMs === null ? "-" : `${event.durationMs} ms`}</td></tr>)}</tbody></table></div>;
}

function ResultBadge({ result }: { result: AuditResult }) {
  const style = result === "success" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : result === "denied" ? "border-amber-400/30 bg-amber-500/10 text-amber-200" : result === "partial" ? "border-violet-400/30 bg-violet-500/10 text-violet-200" : "border-rose-400/30 bg-rose-500/10 text-rose-200";
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs ${style}`}>{result}</span>;
}
