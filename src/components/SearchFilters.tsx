"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import type { Locality } from "@/lib/types";

const PROPERTY_TYPES = ["APARTMENT", "PLOT", "VILLA", "COMMERCIAL_SHOP", "OFFICE_SPACE"];
const TX_TYPES = ["SALE", "RENT", "COMMERCIAL_SALE", "COMMERCIAL_RENT"];
const BEDS = ["1", "2", "3", "4", "5+"];
const BUDGETS: Array<[string, number | null]> = [["₹10L", 1000000], ["₹20L", 2000000], ["₹30L", 3000000], ["₹50L", 5000000], ["₹75L", 7500000], ["₹1Cr", 10000000], ["₹2Cr", 20000000]];

export default function SearchFilters({ localities }: { localities: Locality[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [sugg, setSugg] = useState<Array<{ type: string; label: string; value: string }>>([]);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (q.trim().length < 2) { setSugg([]); return; }
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggestions?q=${encodeURIComponent(q.trim())}`);
        const json = await res.json();
        setSugg(json.data ?? []);
      } catch { /* suggestions are best-effort */ }
    }, 250);
    return () => clearTimeout(debounce.current);
  }, [q]);

  function apply(patch: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") params.delete(k); else params.set(k, v);
    }
    params.delete("page");
    router.push(`/search?${params.toString()}`);
  }

  const cur = (k: string) => sp.get(k) ?? "";

  return (
    <div className="card space-y-3 p-4">
      <div className="relative">
        <input
          className="input"
          placeholder="Search locality, project or road in Indore…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && apply({ q: q.trim() || null })}
        />
        {sugg.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
            {sugg.map((s, i) => (
              <li key={i}>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                  onClick={() => {
                    setSugg([]);
                    if (s.type === "locality") apply({ locality: s.value, q: null });
                    else apply({ q: s.value });
                  }}
                >
                  <span className="badge bg-slate-100 text-slate-600">{s.type}</span> {s.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select className="input" value={cur("tx")} onChange={(e) => apply({ tx: e.target.value || null })}>
          <option value="">Any deal type</option>
          {TX_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </select>
        <select className="input" value={cur("type")} onChange={(e) => apply({ type: e.target.value || null })}>
          <option value="">Any property type</option>
          {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </select>
        <select className="input" value={cur("locality")} onChange={(e) => apply({ locality: e.target.value || null })}>
          <option value="">All localities</option>
          {localities.map((l) => <option key={l.slug} value={l.slug}>{l.name}</option>)}
        </select>
        <select className="input" value={cur("beds")} onChange={(e) => apply({ beds: e.target.value || null })}>
          <option value="">Any BHK</option>
          {BEDS.map((b) => <option key={b} value={b}>{b === "5+" ? "5+ BHK" : `${b} BHK`}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-semibold text-slate-500">Budget:</span>
        {BUDGETS.map(([label, val]) => (
          <button key={label}
            className={`badge border ${cur("maxPrice") === String(val) ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            onClick={() => apply({ maxPrice: cur("maxPrice") === String(val) ? null : String(val) })}>
            ≤ {label}
          </button>
        ))}
        <button className="badge border border-slate-200 text-slate-500 hover:bg-slate-50" onClick={() => apply({ maxPrice: null, minPrice: null, beds: null, type: null, tx: null, locality: null, q: null, sort: null })}>
          ✕ Clear all
        </button>
      </div>
    </div>
  );
}
