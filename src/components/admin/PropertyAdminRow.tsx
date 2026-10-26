"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Prop = {
  id: string; titleNormalized: string; availability: string; verificationStatus: string;
  localityName: string | null; price: number | null; completenessScore: number;
};

export default function PropertyAdminRow({ p }: { p: Prop }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [avail, setAvail] = useState(p.availability);
  const [verif, setVerif] = useState(p.verificationStatus);

  async function patch(data: Record<string, unknown>) {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/admin/properties/${p.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(data) }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res || !res.ok) setMsg(body?.error?.message ?? `Failed (${res?.status ?? "network"})`);
    else setMsg("Saved");
    setBusy(false); router.refresh();
  }

  return (
    <div className="border-t border-slate-100 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-slate-900">{p.titleNormalized}</span>
        <span className="text-slate-500">{p.localityName ?? "—"} · {p.completenessScore}% complete</span>
        <button onClick={() => setOpen((o) => !o)} className="ml-auto rounded border border-slate-300 bg-white px-2 py-0.5 hover:bg-slate-50">{open ? "Hide" : "Edit"}</button>
      </div>
      {open && (
        <div className="mt-2 grid gap-2 rounded border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2">
          <label className="block">Availability
            <select value={avail} onChange={(e) => setAvail(e.target.value)} className="mt-0.5 w-full rounded border border-slate-300 bg-white p-1">
              {["ACTIVE", "STALE", "UNAVAILABLE_AT_SOURCE", "REMOVED_BY_SOURCE", "PENDING_VERIFICATION"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="block">Verification (only change after a real check)
            <select value={verif} onChange={(e) => setVerif(e.target.value)} className="mt-0.5 w-full rounded border border-slate-300 bg-white p-1">
              {["UNVERIFIED", "METADATA_CHECKED", "VERIFIED"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
            <button disabled={busy} onClick={() => patch({ availability: avail, verificationStatus: verif })} className="rounded bg-brand-600 px-3 py-1 text-white hover:bg-brand-700 disabled:opacity-50">Save</button>
            <button disabled={busy} onClick={() => { if (confirm("Mark this record as removed by source? It stays in the database for audit but leaves public search.")) patch({ availability: "REMOVED_BY_SOURCE" }); }} className="rounded border border-red-300 bg-white px-3 py-1 text-red-700 hover:bg-red-50 disabled:opacity-50">Takedown</button>
            {msg && <span role="status" className="text-slate-600">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
