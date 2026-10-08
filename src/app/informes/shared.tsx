"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatBogota(iso: string | null): string {
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

export function MetricCard({ label, value, icon, color }: { label: string; value: string | number; icon: ReactNode; color: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] p-4 bg-[var(--bg-card)]/80 backdrop-blur-xl transition-all duration-200 hover:shadow-lg">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-[10px] tracking-widest uppercase font-semibold text-[var(--text-secondary)]">{label}</p>
          <p className="text-2xl font-bold tracking-tight" style={{ color }}>{value}</p>
        </div>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}15`, color }}>{icon}</div>
      </div>
    </div>
  );
}

export function Collapsible({
  open,
  onToggle,
  title,
  hint,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  title: ReactNode;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full px-4 py-3 flex items-center gap-2 hover:bg-[var(--bg-hover)]/40 transition-colors text-left"
      >
        <ChevronDown size={15} className={`shrink-0 text-[var(--text-secondary)] transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
        <span className="text-sm font-semibold text-[var(--text-primary)]">{title}</span>
        {hint && <span className="ml-auto text-xs font-normal text-[var(--text-secondary)]">{hint}</span>}
      </button>
      {open && <div className="border-t border-[var(--border)]">{children}</div>}
    </div>
  );
}

export function statusPillClasses(status: string): string {
  const s = status.toUpperCase();
  if (["COMPLETED", "AVAILABLE"].includes(s)) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (["FAILED", "ERROR", "SIN BACKUP"].includes(s)) return "bg-red-500/10 text-red-400 border-red-500/20";
  return "bg-amber-500/10 text-amber-400 border-amber-500/20";
}
