"use client";

import { BillingItem } from "@/types/billing";

type Props = {
  billing: BillingItem[];
  search: string;
  setSearch: (value: string) => void;
  provider: string;
  setProvider: (value: string) => void;
  service: string;
  setService: (value: string) => void;
  account: string;
  setAccount: (value: string) => void;
};

export default function BillingFilters({
  billing,
  search, setSearch,
  provider, setProvider,
  service, setService,
  account, setAccount,
}: Props) {

  const providers = Array.from(new Set(billing.map((b) => b.provider))).sort();
  const services  = Array.from(new Set(billing.map((b) => b.service))).sort();
  const accounts  = Array.from(new Set(billing.map((b) => b.accountName))).sort();

  const selectClass = `
    w-full px-4 py-2.5 rounded-xl
    bg-black/40 border border-white/10
    text-sm text-white/80
    outline-none appearance-none cursor-pointer
    hover:border-white/20 focus:border-cyan-500/50
    transition-colors duration-200
  `;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">

      {/* SEARCH */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar servicio, tag, cuenta..."
          className="
            w-full pl-9 pr-4 py-2.5 rounded-xl
            bg-black/40 border border-white/10 text-sm text-white/80
            placeholder:text-white/25 outline-none
            hover:border-white/20 focus:border-cyan-500/50
            transition-colors duration-200
          "
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
          >
            ×
          </button>
        )}
      </div>

      {/* PROVIDER */}
      <div className="relative">
        <select value={provider} onChange={(e) => setProvider(e.target.value)} className={selectClass}>
          <option value="">Todos los Providers</option>
          {providers.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        {provider && (
          <span className="absolute left-3 -top-2 text-[10px] text-cyan-400 bg-[#0d1117] px-1">Provider</span>
        )}
      </div>

      {/* SERVICE */}
      <div className="relative">
        <select value={service} onChange={(e) => setService(e.target.value)} className={selectClass}>
          <option value="">Todos los Servicios</option>
          {services.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        {service && (
          <span className="absolute left-3 -top-2 text-[10px] text-cyan-400 bg-[#0d1117] px-1">Servicio</span>
        )}
      </div>

      {/* ACCOUNT */}
      <div className="relative">
        <select value={account} onChange={(e) => setAccount(e.target.value)} className={selectClass}>
          <option value="">Todas las Cuentas</option>
          {accounts.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        {account && (
          <span className="absolute left-3 -top-2 text-[10px] text-cyan-400 bg-[#0d1117] px-1">Cuenta</span>
        )}
      </div>

    </div>
  );
}
