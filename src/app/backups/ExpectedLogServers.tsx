"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Plus, Server, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";

type ExpectedServer = {
  id: string;
  provider: string;
  accountId: string;
  accountName: string;
  serverName: string;
  bucketName: string;
  active: boolean;
};

export default function ExpectedLogServers() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ExpectedServer[]>([]);
  const [provider, setProvider] = useState("AWS");
  const [accountId, setAccountId] = useState("");
  const [serverName, setServerName] = useState("");
  const [bucketName, setBucketName] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/log-expected-servers", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (open) fetchItems();
  }, [open, fetchItems]);

  const handleAdd = async () => {
    if (!accountId.trim() || !serverName.trim()) {
      toast.error("Cuenta y servidor son requeridos");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/log-expected-servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, accountId: accountId.trim(), serverName: serverName.trim(), bucketName: bucketName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo agregar");
      toast.success("Servidor agregado al roster");
      setAccountId("");
      setServerName("");
      setBucketName("");
      fetchItems();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo agregar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`¿Quitar ${name} del roster esperado?`)) return;
    try {
      const res = await fetch(`/api/log-expected-servers?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo eliminar");
      toast.success("Servidor eliminado del roster");
      fetchItems();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo eliminar");
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]/60 backdrop-blur-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-[var(--bg-hover)]/40 transition-colors"
      >
        <ChevronDown size={15} className={`text-[var(--text-secondary)] transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
        <Server size={15} className="text-cyan-300" />
        <span className="text-sm font-semibold">Servidores esperados</span>
        <span className="text-xs text-[var(--text-secondary)]">manual + detectados · si falta su carpeta se marca en rojo</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-[var(--border)] pt-3">
          {items.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)] rounded-xl border border-dashed border-[var(--border)] p-3 text-center">
              Sin servidores manuales. El roster aprende automáticamente de los backups históricos.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {items.map((item) => (
                <span key={item.id} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-hover)]/40 px-2.5 py-1.5 text-xs">
                  <span className="font-medium">{item.serverName}</span>
                  <span className="text-[var(--text-secondary)]">{item.provider === "AWS" ? "AWS" : "Huawei"} · {item.accountName}</span>
                  <button type="button" onClick={() => handleDelete(item.id, item.serverName)} aria-label={`Quitar ${item.serverName}`} className="p-0.5 text-[var(--text-secondary)] hover:text-red-400 transition-colors">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <select value={provider} onChange={(e) => setProvider(e.target.value)} aria-label="Proveedor" className="h-9 rounded-lg border border-[var(--border)] bg-[var(--bg-hover)]/60 text-xs px-2.5 outline-none cursor-pointer">
              <option value="AWS">AWS</option>
              <option value="HUAWEI CLOUD">Huawei</option>
            </select>
            <input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="ID de cuenta / proyecto" aria-label="ID de cuenta" className="h-9 flex-1 px-3 rounded-lg text-xs outline-none border border-[var(--border)] bg-[var(--bg-hover)]/50 placeholder:text-[var(--text-secondary)]/40 focus:border-cyan-500/40" />
            <input value={serverName} onChange={(e) => setServerName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }} placeholder="switch-1, jboss-1..." aria-label="Nombre del servidor" className="h-9 flex-1 px-3 rounded-lg text-xs outline-none border border-[var(--border)] bg-[var(--bg-hover)]/50 placeholder:text-[var(--text-secondary)]/40 focus:border-cyan-500/40" />
            <input value={bucketName} onChange={(e) => setBucketName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }} placeholder="Bucket (opcional)" aria-label="Bucket" className="h-9 flex-1 px-3 rounded-lg text-xs outline-none border border-[var(--border)] bg-[var(--bg-hover)]/50 placeholder:text-[var(--text-secondary)]/40 focus:border-cyan-500/40" />
            <button type="button" onClick={handleAdd} disabled={saving || !accountId.trim() || !serverName.trim()} className="h-9 px-4 rounded-lg bg-cyan-600 text-white text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-cyan-500 disabled:opacity-50 transition-all">
              <Plus size={14} /> Agregar
            </button>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1.5">
            <Trash2 size={11} /> Solo manuales se listan aquí; los detectados históricamente se comparan automáticamente.
          </p>
        </div>
      )}
    </div>
  );
}
