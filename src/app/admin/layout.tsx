import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin dashboard — Indore Property Finder", robots: { index: false } };

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/sources", label: "Sources" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/imports", label: "Imports" },
  { href: "/admin/duplicates", label: "Duplicates" },
  { href: "/admin/properties", label: "Properties" },
  { href: "/admin/audit", label: "Audit log" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  if (!user) redirect("/login?next=/admin"); // admins only; honest redirect to login

  // Determine active nav item from the request path (server-side).
  const pathname = headers().get("x-pathname") ?? headers().get("next-url") ?? "/admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-slate-900">⚙️ Admin</h1>
        <span className="text-xs text-slate-500">{user.email} · <LogoutButton /></span>
      </div>
      <nav aria-label="Admin sections" className="flex flex-wrap gap-1 border-b border-slate-200 pb-2 text-sm">
        {NAV.map((n) => {
          const active = n.href === "/admin" ? /^\/admin(\/?)$/.test(pathname) : pathname.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} className={`badge px-3 py-1.5 ${active ? "bg-brand-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"}`}>
              {n.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
