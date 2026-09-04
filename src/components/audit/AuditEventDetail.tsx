import type { AuditEventDetail } from "@/types/audit";

export function formatAuditDate(value: string) {
  return new Date(value).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "medium" });
}

export default function AuditEventDetailView({ event }: { event: AuditEventDetail }) {
  return (
    <section className="rounded-lg border border-cyan-400/20 bg-[var(--bg-card)]/80 p-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-cyan-300">Detalle seguro</p>
        <h2 className="mt-1 font-semibold text-[var(--text-primary)]">{event.action}</h2>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <DetailItem label="Fecha" value={formatAuditDate(event.occurredAt)} />
        <DetailItem label="Usuario" value={`${event.actor.name} · ${event.actor.email}`} />
        <DetailItem label="Ruta" value={`${event.method} ${event.route}`} />
        <DetailItem label="Resultado" value={`${event.result} (${event.statusCode})`} />
        <DetailItem label="IP" value={event.ip} />
        <DetailItem label="User-agent" value={event.userAgent} />
        <DetailItem label="Request ID" value={event.requestId} />
        <DetailItem label="Duración" value={event.durationMs === null ? "-" : `${event.durationMs} ms`} />
      </div>
      <div className="mt-4">
        <p className="mb-2 text-xs uppercase tracking-wide text-[var(--text-secondary)]">Metadata permitida</p>
        <pre className="max-h-80 overflow-auto rounded-md border border-[var(--border)] bg-black/20 p-3 text-xs leading-5 text-[var(--text-secondary)]">
          {JSON.stringify(event.metadata, null, 2)}
        </pre>
      </div>
    </section>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-[var(--border)] bg-black/10 p-3">
      <p className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 break-words text-[var(--text-primary)]">{value}</p>
    </div>
  );
}
