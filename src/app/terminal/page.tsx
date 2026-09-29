"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, PlugZap, RotateCcw, TerminalSquare } from "lucide-react";

const EC2Terminal = dynamic(() => import("@/app/components/EC2Terminal"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text-secondary)]">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      Cargando terminal...
    </div>
  ),
});

const INSTANCE_RE = /^i-[0-9a-f]{8,17}$/i;
const ACCOUNT_RE = /^\d{12}$/;

export default function TerminalPage() {
  const [instanceId, setInstanceId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [osType, setOsType] = useState<"linux" | "windows">("linux");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");

  const connect = () => {
    const instance = instanceId.trim();
    const account = accountId.trim();
    if (!INSTANCE_RE.test(instance)) {
      setError("Instance ID inválido. Formato esperado: i-0abc1234def56789.");
      return;
    }
    if (!ACCOUNT_RE.test(account)) {
      setError("Account ID inválido. Debe tener 12 dígitos.");
      return;
    }
    setError("");
    setConnected(true);
  };

  const disconnect = () => {
    setConnected(false);
  };

  const reset = () => {
    setConnected(false);
    setInstanceId("");
    setAccountId("");
    setError("");
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
            <TerminalSquare className="h-3.5 w-3.5" /> Sesión SSM
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Terminal EC2</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Conéctate a una instancia vía AWS Systems Manager.</p>
        </div>
        {connected && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={disconnect}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-4 text-sm text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)]"
            >
              <ArrowLeft className="h-4 w-4" /> Cambiar instancia
            </button>
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-4 text-sm text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              <RotateCcw className="h-4 w-4" /> Limpiar
            </button>
          </div>
        )}
      </section>

      {!connected && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/70 p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_180px_auto]">
            <label className="block text-xs text-[var(--text-secondary)]">
              Instance ID
              <input
                type="text"
                value={instanceId}
                onChange={(e) => setInstanceId(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") connect(); }}
                placeholder="i-0abc1234def56789"
                autoComplete="off"
                spellCheck={false}
                className="control mt-1.5 font-mono"
              />
            </label>
            <label className="block text-xs text-[var(--text-secondary)]">
              Account ID
              <input
                type="text"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") connect(); }}
                placeholder="123456789012"
                inputMode="numeric"
                autoComplete="off"
                className="control mt-1.5 font-mono"
              />
            </label>
            <label className="block text-xs text-[var(--text-secondary)]">
              Sistema operativo
              <select
                value={osType}
                data-audit-field="osType"
                onChange={(event) => setOsType(event.target.value as "linux" | "windows")}
                className="control mt-1.5"
              >
                <option value="linux">Linux</option>
                <option value="windows">Windows</option>
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                data-audit-action="terminal.connect"
                onClick={connect}
                disabled={!instanceId.trim() || !accountId.trim()}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 xl:w-auto"
              >
                <PlugZap className="h-4 w-4" /> Conectar
              </button>
            </div>
          </div>
          {error && (
            <p role="alert" className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </p>
          )}
        </section>
      )}

      {connected && (
        <EC2Terminal instanceId={instanceId.trim()} accountId={accountId.trim()} osType={osType} />
      )}
    </div>
  );
}
