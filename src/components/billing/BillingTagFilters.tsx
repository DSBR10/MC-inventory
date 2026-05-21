"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { BillingItem } from "@/types/billing";

type TagFilter = {
  key: string;
  value: string;
};

type Props = {
  billing: BillingItem[];
  selectedTags: TagFilter[];
  onTagsChange: (tags: TagFilter[]) => void;
};

export default function BillingTagFilters({ billing, selectedTags, onTagsChange }: Props) {
  const [open, setOpen] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [pendingValues, setPendingValues] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setPendingKey(null);
        setPendingValues([]);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const allTagKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const item of billing) {
      for (const k of Object.keys(item.tags || {})) {
        keys.add(k);
      }
    }
    return Array.from(keys).sort();
  }, [billing]);

  const valuesForKey = useMemo(() => {
    if (!pendingKey) return [];
    const vals = new Set<string>();
    for (const item of billing) {
      const v = (item.tags || {})[pendingKey];
      if (v) vals.add(v);
    }
    return Array.from(vals).sort();
  }, [billing, pendingKey]);

  const usedKeys = useMemo(
    () => new Set(selectedTags.map((t) => t.key)),
    [selectedTags]
  );

  function selectKey(key: string) {
    setPendingKey(key);
    setPendingValues([]);
  }

  function toggleValue(val: string) {
    setPendingValues((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  }

  function applyFilter() {
    if (!pendingKey || pendingValues.length === 0) return;
    const newFilters = pendingValues.map((v) => ({ key: pendingKey, value: v }));
    const existing = selectedTags.filter((t) => t.key !== pendingKey);
    onTagsChange([...existing, ...newFilters]);
    setPendingKey(null);
    setPendingValues([]);
    setOpen(false);
  }

  function removeTag(tag: TagFilter) {
    onTagsChange(selectedTags.filter((t) => !(t.key === tag.key && t.value === tag.value)));
  }

  function removeKey(key: string) {
    onTagsChange(selectedTags.filter((t) => t.key !== key));
  }

  function clearAll() {
    onTagsChange([]);
    setPendingKey(null);
    setPendingValues([]);
    setOpen(false);
  }

  const groupedActive = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const t of selectedTags) {
      if (!map[t.key]) map[t.key] = [];
      map[t.key].push(t.value);
    }
    return map;
  }, [selectedTags]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-wrap items-center gap-3">

      {/* Chips activos agrupados por key */}
      {Object.entries(groupedActive).map(([key, values]) => (
        <div
          key={key}
          className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl px-3 py-1.5"
        >
          <span className="text-xs text-cyan-400 font-semibold uppercase tracking-wide">{key}</span>
          <span className="text-white/40 text-xs">:</span>
          <div className="flex gap-1 flex-wrap">
            {values.map((v) => (
              <span
                key={v}
                className="flex items-center gap-1 bg-cyan-500/20 text-cyan-300 text-xs px-2 py-0.5 rounded-lg"
              >
                {v}
                <button
                  onClick={() => removeTag({ key, value: v })}
                  className="text-cyan-400 hover:text-white transition-colors ml-0.5"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <button
            onClick={() => removeKey(key)}
            className="text-white/30 hover:text-red-400 transition-colors text-xs ml-1"
            title={`Limpiar filtro ${key}`}
          >
            ✕
          </button>
        </div>
      ))}

      {/* Botón Add filter */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/20 bg-black/30 text-sm text-white/70 hover:text-white hover:border-cyan-500/50 transition-all duration-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Filtrar por Tag
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-2 z-50 bg-[#0d1117] border border-white/15 rounded-2xl shadow-2xl flex overflow-hidden min-w-[520px]">

            {/* Columna izquierda: keys */}
            <div className="w-48 border-r border-white/10 flex flex-col">
              <div className="px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-widest border-b border-white/10">
                Tag Key
              </div>
              <div className="overflow-y-auto max-h-64">
                {allTagKeys.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-white/30">Sin tags disponibles</p>
                ) : (
                  allTagKeys.map((key) => (
                    <button
                      key={key}
                      onClick={() => selectKey(key)}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                        pendingKey === key
                          ? "bg-cyan-500/15 text-cyan-400"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      } ${usedKeys.has(key) ? "opacity-50" : ""}`}
                    >
                      <span>{key}</span>
                      {usedKeys.has(key) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Columna derecha: values */}
            <div className="flex-1 flex flex-col">
              <div className="px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-widest border-b border-white/10">
                {pendingKey ? `Valores de "${pendingKey}"` : "Selecciona una key"}
              </div>

              <div className="overflow-y-auto max-h-64 flex-1">
                {!pendingKey ? (
                  <div className="flex items-center justify-center h-24 text-white/20 text-sm">
                    ← Elige una clave de tag
                  </div>
                ) : valuesForKey.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-white/30">Sin valores disponibles</p>
                ) : (
                  valuesForKey.map((val) => {
                    const checked = pendingValues.includes(val);
                    return (
                      <label
                        key={val}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-white/5 ${
                          checked ? "text-white" : "text-white/60"
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                            checked ? "bg-cyan-500 border-cyan-500" : "border-white/20 bg-transparent"
                          }`}
                        >
                          {checked && (
                            <svg className="w-2.5 h-2.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => toggleValue(val)}
                        />
                        <span className="text-sm">{val}</span>
                      </label>
                    );
                  })
                )}
              </div>

              {pendingKey && (
                <div className="border-t border-white/10 px-4 py-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-white/30">
                    {pendingValues.length} seleccionado{pendingValues.length !== 1 ? "s" : ""}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setOpen(false); setPendingKey(null); setPendingValues([]); }}
                      className="px-3 py-1.5 text-xs text-white/40 hover:text-white transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={applyFilter}
                      disabled={pendingValues.length === 0}
                      className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-cyan-500 text-black disabled:opacity-30 disabled:cursor-not-allowed hover:bg-cyan-400 transition-colors"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {selectedTags.length > 0 && (
        <button
          onClick={clearAll}
          className="text-xs text-red-400 hover:text-red-300 transition-colors underline underline-offset-2 ml-1"
        >
          Limpiar tags
        </button>
      )}
    </div>
  );
}
