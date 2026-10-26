"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, string> = {
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
    };
    if (mode === "register") body.name = String(fd.get("name") ?? "");
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error?.message ?? "Something went wrong. Please try again.");
        return;
      }
      router.push("/saved");
      router.refresh();
    } catch {
      setError("Network error — please retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <h1 className="text-xl font-bold">{mode === "login" ? "Log in" : "Create your account"}</h1>
      <p className="text-xs text-slate-500">
        Accounts are optional — you can search without logging in. We use your email only for sign-in and saved searches; no marketing without consent.
      </p>
      <form onSubmit={onSubmit} className="card space-y-3 p-4">
        {mode === "register" && (
          <div><label className="label" htmlFor="name">Name (optional)</label><input id="name" name="name" className="input" autoComplete="name" /></div>
        )}
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="input" autoComplete="email" /></div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required minLength={mode === "register" ? 10 : 8} className="input" autoComplete={mode === "login" ? "current-password" : "new-password"} />
          {mode === "register" && <p className="mt-1 text-[11px] text-slate-400">At least 10 characters.</p>}
        </div>
        {error && <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="btn-primary w-full justify-center">{busy ? "…" : mode === "login" ? "Log in" : "Sign up"}</button>
      </form>
      <p className="text-center text-sm text-slate-600">
        {mode === "login" ? (
          <>No account? <Link href="/register" className="text-brand-700 underline">Sign up</Link></>
        ) : (
          <>Already registered? <Link href="/login" className="text-brand-700 underline">Log in</Link></>
        )}
      </p>
    </div>
  );
}
