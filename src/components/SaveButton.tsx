"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

// Save-to-favorites button. Works without login for browsing; saving requires a session.
export default function SaveButton({ propertyId }: { propertyId: string }) {
  const [state, setState] = useState<"unknown" | "anon" | "saved" | "unsaved">("unknown");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/saved-properties")
      .then(async (r) => {
        if (r.status === 401) { if (!cancelled) setState("anon"); return; }
        const j = await r.json();
        const ids: string[] = (j.data ?? []).map((s: { property: { id: string } }) => s.property.id);
        if (!cancelled) setState(ids.includes(propertyId) ? "saved" : "unsaved");
      })
      .catch(() => !cancelled && setState("anon"));
    return () => { cancelled = true; };
  }, [propertyId]);

  async function toggle() {
    setBusy(true);
    try {
      const r = await fetch("/api/saved-properties", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyId }),
      });
      if (r.status === 401) { setState("anon"); return; }
      const j = await r.json();
      setState(j.data?.saved ? "saved" : "unsaved");
    } finally {
      setBusy(false);
    }
  }

  if (state === "anon") {
    return (
      <div className="card p-4 text-sm">
        <p className="text-slate-600">Sign in to save this property and track price changes.</p>
        <Link href="/login" className="btn-outline mt-2 w-full justify-center">Login to save</Link>
      </div>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={busy || state === "unknown"}
      className={`btn w-full justify-center ${state === "saved" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}
      aria-pressed={state === "saved"}
    >
      {state === "unknown" ? "…" : state === "saved" ? "★ Saved — click to remove" : "☆ Save property"}
    </button>
  );
}
