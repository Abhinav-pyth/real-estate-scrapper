import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { formatPriceINR } from "@/lib/format";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Saved properties — Indore Property Finder", robots: { index: false } };

export default async function SavedPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [saved, searches] = await Promise.all([
    prisma.savedProperty.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        property: {
          select: {
            id: true, titleNormalized: true, price: true, transactionType: true, availability: true,
            locality: { select: { name: true, slug: true } }, lastUpdatedAt: true,
          },
        },
      },
    }),
    prisma.savedSearch.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">My account</h1>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Saved properties ({saved.length})</h2>
        {saved.length === 0 ? (
          <p className="card p-4 text-sm text-slate-600">Nothing saved yet. Use the ☆ button on any listing. <Link href="/search" className="text-brand-700 underline">Browse properties →</Link></p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {saved.map((s) => (
              <li key={s.id}>
                <Link href={`/properties/${s.property.id}`} className="card block space-y-1 p-3 text-sm hover:shadow-md">
                  <span className="line-clamp-1 font-medium">{s.property.titleNormalized}</span>
                  <span className="block font-bold text-brand-700">
                    {formatPriceINR(s.property.price, { rent: s.property.transactionType.includes("RENT") })}
                    {s.property.availability !== "ACTIVE" && <span className="badge ml-2 bg-amber-50 text-amber-700">possibly stale</span>}
                  </span>
                  <span className="block text-xs text-slate-500">{s.property.locality?.name ?? "Indore"} · saved {new Date(s.createdAt).toLocaleDateString("en-IN")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Saved searches ({searches.length})</h2>
        {searches.length === 0 ? (
          <p className="card p-4 text-sm text-slate-600">Save a search from the results page to track new matching listings and price drops.</p>
        ) : (
          <ul className="space-y-2">
            {searches.map((ss) => {
              let params = "";
              try { params = new URLSearchParams(JSON.parse(ss.paramsJson)).toString(); } catch { params = ""; }
              return (
                <li key={ss.id} className="card flex items-center justify-between p-3 text-sm">
                  <span>{ss.name ?? `Search ${new Date(ss.createdAt).toLocaleDateString("en-IN")}`}</span>
                  <Link className="btn-outline" href={`/search?${params}`}>Run search</Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-xs text-slate-500">Signed in as {user.email}. <LogoutButton /></p>
    </div>
  );
}

