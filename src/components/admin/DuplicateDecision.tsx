"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DuplicateDecision({ id, aTitle, bTitle }: { id: string; aTitle: string; bTitle: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function decide(decision: "MERGE" | "REJECT") {
    if (decision === "MERGE" && !confirm(`Merge these two records?\n\nA (survives): ${aTitle}\nB (sources re-homed to A): ${bTitle}\n\nBoth original source URLs are preserved on the surviving record.`)) return;
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/admin/duplicates/${id}/review`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res || !res.ok) setMsg(body?.error?.message ?? "Review failed");
    else setMsg(decision === "MERGE" ? "Merged — sources preserved." : "Rejected — kept as separate listings.");
    setBusy(false);
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button disabled={busy} onClick={() => decide("MERGE")} className="rounded bg-brand-600 px-2 py-1 text-xs text-white hover:bg-brand-700 disabled:opacity-50">Merge</button>
      <button disabled={busy} onClick={() => decide("REJECT")} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50">Not duplicates</button>
      {msg && <span role="status" className="text-[11px] text-slate-600">{msg}</span>}
    </span>
  );
}
