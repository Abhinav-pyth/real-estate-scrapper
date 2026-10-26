import Link from "next/link";
import { prisma } from "@/lib/db";
import { searchProperties } from "@/lib/search";
import { getActiveLocalities } from "@/lib/data";
import { toSearchUrl } from "@/lib/api";
import { config } from "@/lib/config";
import type { Metadata } from "next";

export const dynamic = "force-dynamic"; // counts must reflect real DB state, never stale SSG

export const metadata: Metadata = {
  title: `Property Finder for Indore, Madhya Pradesh — ${config.appName}`,
  description:
    "Search aggregated real-estate listings for Indore (MP) across multiple authorized sources. Compare prices, view on a map, filter by budget and locality. Every listing links to its original source.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Find properties in Indore — buy & rent",
    description: "Multi-source property aggregator for Indore, Madhya Pradesh. Real listings, original source links, no invented data.",
    url: config.appUrl,
    type: "website",
    locale: "en_IN",
  },
};

const CATEGORY_LINKS: Array<{ label: string; params: Record<string, string> }> = [
  { label: "Properties for sale in Indore", params: { transactionType: "SALE" } },
  { label: "Flats for sale in Indore", params: { transactionType: "SALE", propertyType: "APARTMENT" } },
  { label: "Houses for sale in Indore", params: { transactionType: "SALE", propertyType: "INDEPENDENT_HOUSE" } },
  { label: "Residential plots in Indore", params: { transactionType: "SALE", propertyType: "RESIDENTIAL_PLOT" } },
  { label: "Villas in Indore", params: { transactionType: "SALE", propertyType: "VILLA" } },
  { label: "Properties for rent in Indore", params: { transactionType: "RENT" } },
  { label: "Flats for rent in Indore", params: { transactionType: "RENT", propertyType: "APARTMENT" } },
  { label: "Commercial properties in Indore", params: { transactionType: "COMMERCIAL_SALE" } },
];

export default async function HomePage() {
  const [saleCount, rentCount, totalCount, localities, latest] = await Promise.all([
    prisma.property.count({ where: { city: { name: "Indore" }, availability: "ACTIVE", transactionType: "SALE" } }),
    prisma.property.count({ where: { city: { name: "Indore" }, availability: "ACTIVE", transactionType: "RENT" } }),
    prisma.property.count({ where: { city: { name: "Indore" }, availability: "ACTIVE" } }),
    getActiveLocalities(),
    searchProperties({
      city: "Indore", sort: "newest", page: 1, limit: 8, availability: "ACTIVE",
    } as never),
  ]);

  const hasData = totalCount > 0;

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="card relative overflow-hidden bg-gradient-to-br from-white to-brand-50 p-8 text-center sm:p-12">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Find your property in <span className="text-brand-700">Indore</span>
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
          Aggregated listings from multiple authorized sources for Indore, Madhya Pradesh — compare asking
          prices side by side, explore on a map, and always reach the original listing with one click.
          {hasData ? ` Currently ${totalCount.toLocaleString("en-IN")} active listings indexed.` : ""}
        </p>
        <form action="/search" method="get" className="mx-auto mt-6 flex max-w-xl gap-2">
          <input
            name="q"
            className="input"
            placeholder="Search properties in Indore — e.g. Vijay Nagar, Super Corridor, 452011…"
            aria-label="Search properties in Indore"
          />
          <button className="btn-primary shrink-0">Search</button>
        </form>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs text-slate-500">
          <span><b>{saleCount.toLocaleString("en-IN")}</b> sale listings</span>
          <span><b>{rentCount.toLocaleString("en-IN")}</b> rental listings</span>
          <Link href="/how-it-works" className="underline">How we collect data</Link>
        </div>
      </section>

      {/* Category landing links */}
      <section aria-labelledby="categories">
        <h2 id="categories" className="mb-3 text-lg font-bold">Popular searches</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CATEGORY_LINKS.map((c) => (
            <Link key={c.label} href={toSearchUrl(c.params)} className="card px-3 py-2.5 text-sm font-medium hover:border-brand-300 hover:text-brand-700">
              {c.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Localities */}
      <section aria-labelledby="localities-h">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="localities-h" className="text-lg font-bold">Properties by locality</h2>
          <Link href="/localities" className="text-sm text-brand-700 underline">All localities →</Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {localities.slice(0, 24).map((l) => (
            <Link key={l.slug} href={`/localities/${l.slug}`} className="badge border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-brand-400 hover:text-brand-700">
              {l.name}
            </Link>
          ))}
        </div>
      </section>

      {/* Latest listings or honest empty state */}
      <section aria-labelledby="latest-h">
        <h2 id="latest-h" className="mb-3 text-lg font-bold">Newest listings</h2>
        {hasData ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {latest.items.map((p) => (
              <Link key={p.id} href={`/properties/${p.id}`} className="card block space-y-1 p-3 hover:shadow-md">
                <h3 className="line-clamp-1 text-sm font-semibold">{p.titleNormalized}</h3>
                <p className="text-sm font-bold text-brand-700">
                  {p.price == null ? "Price not available" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(p.price)}
                </p>
                <p className="text-xs text-slate-500">
                  {[p.bedrooms != null ? `${p.bedrooms} BHK` : null, p.locality?.name ?? "Indore"].filter(Boolean).join(" · ")}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card border-dashed p-6 text-sm text-slate-600">
            <p className="font-semibold">No live listings collected yet.</p>
            <p className="mt-1">
              This application never invents properties. Listings appear here only after an authorized data
              connector sync or an admin CSV/JSON import completes successfully.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs">
              <li>Configure an authorized feed connector (see <Link href="/how-it-works" className="underline">collection policy</Link>).</li>
              <li>Or import a licensed dataset via the admin dashboard (CSV template provided).</li>
            </ul>
          </div>
        )}
      </section>

      {/* Trust / transparency strip */}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><h3 className="text-sm font-bold">Original source always linked</h3><p className="mt-1 text-xs text-slate-600">Every aggregated record keeps its source URL. Verify details on the publisher&apos;s own page.</p></div>
        <div className="card p-4"><h3 className="text-sm font-bold">No fabricated data</h3><p className="mt-1 text-xs text-slate-600">Missing prices show as “not available”. Coordinates come only from authorized geocoding — never guessed.</p></div>
        <div className="card p-4"><h3 className="text-sm font-bold">Asking-price statistics</h3><p className="mt-1 text-xs text-slate-600">Locality stats are computed from collected asking prices, with sample sizes disclosed — not transaction values.</p></div>
      </section>
    </div>
  );
}
