"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ImportForm({ connectors }: { connectors: { key: string; name: string }[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [connectorKey, setConnectorKey] = useState("manual-import");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError("Choose a CSV or JSON file first."); return; }
    setBusy(true); setError(null); setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("connectorKey", connectorKey);
      const res = await fetch("/api/admin/imports/csv", { method: "POST", body: fd });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error?.message ?? `Import failed (HTTP ${res.status})`);
      } else {
        const d = body.data;
        setResult(`Imported ${d.imported} · skipped duplicates ${d.skippedDuplicates} · invalid rows ${d.invalid}${d.errors?.length ? ` — first error: row ${d.errors[0].row}: ${d.errors[0].message}` : ""}`);
        setFile(null);
        router.refresh();
      }
    } catch {
      setError("Network error during import.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-600">
          File (CSV or JSON, max ~1&nbsp;MB)
          <input type="file" accept=".csv,.json,text/csv,application/json" required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full max-w-xs rounded border border-slate-300 bg-white p-2 text-sm file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs" />
        </label>
        <label className="text-xs text-slate-600">
          Attribution connector
          <select value={connectorKey} onChange={(e) => setConnectorKey(e.target.value)}
            className="mt-1 block rounded border border-slate-300 bg-white p-2 text-sm">
            {connectors.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
          </select>
        </label>
        <button type="submit" disabled={busy} className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {busy ? "Importing…" : "Import"}
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {result && <p role="status" className="text-xs text-brand-700">{result}</p>}
      <p className="text-[11px] text-slate-500">
        Only import data you have the right to use (your own listings, licensed feeds, authorized partner exports).
        Every row keeps its original source URL. Download the template below for required columns.
      </p>
    </form>
  );
}
