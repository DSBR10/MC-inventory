"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

import type { AuditEventDetail } from "@/types/audit";

import AuditEventDetailView from "./AuditEventDetail";

export default function AuditDetailPage({ id }: { id: string }) {
  const [event, setEvent] = useState<AuditEventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/audit/${id}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as { event?: AuditEventDetail; error?: string };
        if (!response.ok || !payload.event) throw new Error(payload.error || "Evento no encontrado");
        if (active) setEvent(payload.event);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "No se pudo consultar el detalle");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <div className="space-y-6">
      <Link
        href="/auditoria"
        className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--border)] px-4 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)]"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a auditoría
      </Link>

      {loading && (
        <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-[var(--text-secondary)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Consultando detalle...
        </div>
      )}
      {!loading && error && (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
      )}
      {!loading && !error && event && <AuditEventDetailView event={event} />}
    </div>
  );
}
