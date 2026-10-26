"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ConnectorActions({ id, name, canSync }: { id: string; name: string; canSync: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "sync" | "toggle">("");
  const [msg, setMsg] = useState<string | null>(null);

  async function call(url: string, init: RequestInit) {
    setMsg(null);
    const res = await fetch(url, init).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res || !res.ok) {
      setMsg(body?.error?.message ?? `Request failed (${res?.status ?? "network"})`);
    } else {
      const d = body?.data;
      setMsg(typeof d === "object" && d !== null && "newCount" in d
        ? `Job ${d.status}: +${d.newCount} new, ${d.updatedCount} updated, ${d.unchangedCount} unchanged, ${d.errorCount} errors${d.lastError ? ` — ${d.lastError}` : ""}`
        : "Updated");
    }
    setBusy("");
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        disabled={!!busy}
        onClick={() => { setBusy("toggle"); call(`/api/admin/sources/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: true }) }); }}
        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
        title="Enable connector (blocked for policy-disabled sources)"
      >Enable</button>
      <button
        disabled={!!busy}
        onClick={() => { setBusy("toggle"); call(`/api/admin/sources/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: false }) }); }}
        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
      >Disable</button>
      {canSync && (
        <button
          disabled={!!busy}
          onClick={() => { setBusy("sync"); call(`/api/admin/sources/${id}/sync`, { method: "POST" }); }}
          className="rounded bg-brand-600 px-2 py-1 text-xs text-white hover:bg-brand-700 disabled:opacity-50"
        >{busy === "sync" ? "Syncing…" : "Sync now"}</button>
      )}
      {msg && <span role="status" className="text-xs text-slate-600 max-w-[16rem] truncate" title={msg}>{msg}</span>}
      <span className="sr-only">{name}</span>
    </span>
  );
}
