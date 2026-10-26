"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RetryJobButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function retry() {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/admin/jobs/${jobId}/retry`, { method: "POST" }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res || !res.ok) setMsg(body?.error?.message ?? "Retry failed");
    else setMsg(`Re-run ${body?.data?.status ?? "finished"}`);
    setBusy(false);
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button onClick={retry} disabled={busy} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50">
        {busy ? "Retrying…" : "Retry"}
      </button>
      {msg && <span role="status" className="text-[11px] text-slate-600">{msg}</span>}
    </span>
  );
}
