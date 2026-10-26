import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { searchProperties } from "@/lib/search";
import { getActiveLocalities } from "@/lib/data";
import { searchParamsSchema, PROPERTY_TYPES, TRANSACTION_TYPES, FURNISHING, CONSTRUCTION_STATUS } from "@/lib/types";
import PropertyCard from "@/components/PropertyCard";
import SearchFilters from "@/components/SearchFilters";
import MapExplorer from "@/components/MapExplorer";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

type SearchProps = { params?: Record<string, string | string[]> };

function buildParams(sp: Record<string, string | string[]> | undefined) {
  const raw: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp ?? {})) if (typeof v === "string") raw[k] = v;
  // UI aliases → API names
  if (raw.tx && !raw.transactionType) raw.transactionType = raw.tx;
  if (raw.type && !raw.propertyType) raw.propertyType = raw.type;
  if (raw.beds && !raw.bedrooms) raw.bedrooms = raw.beds;
  if (raw.baths && !raw.bathrooms) raw.bathrooms = raw.baths;
  if (raw.construction && !raw.constructionStatus) raw.constructionStatus = raw.construction;
  if (raw.minArea && !raw.minCarpetArea) raw.minCarpetArea = raw.minArea;
  const parsed = searchParamsSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function generateMetadata({ params }: SearchProps): Promise<Metadata> {
  const p = buildParams(params as never);
  const loc = p?.locality;
  const title = loc
    ? `Properties in ${loc.replace(/-/g, " ")}, Indore — ${config.appName}`
    : `Property search results in Indore — ${config.appName}`;
  // Indexable only for simple canonical combinations; complex filter combos are noindex.
  const complexity = Object.keys(params ?? {}).length;
  return {
    title,
    description: `Browse aggregated property listings${loc ? ` in ${loc.replace(/-/g, " ")}` : ""}, Indore with budget, BHK and map filters. Original source links included.`,
    robots: complexity > 4 ? { index: false, follow: true } : { index: true, follow: true },
    alternates: { canonical: "/search" },
  };
}

export default async function SearchPage({ params }: SearchProps) {
  const p = buildParams(params as never);
  const localities = await getActiveLocalities();

  if (!p) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Search properties in Indore</h1>
        <Suspense fallback={null}><SearchFilters localities={localities} /></Suspense>
        <div className="card border-dashed p-6 text-sm text-slate-600">
          Some of the provided filters were invalid and have been ignored. Please adjust your search above.
        </div>
      </div>
    );
  }

  const result = await searchProperties(p);
  const totalPages = Math.max(1, Math.ceil(result.total / p.limit));

  const cards = result.items.map((it) => ({
    id: it.id,
    titleNormalized: it.titleNormalized,
    price: it.price,
    pricePerSqFt: it.pricePerSqFt,
    transactionType: it.transactionType,
    propertyType: it.propertyType,
    bedrooms: it.bedrooms,
    carpetArea: it.carpetArea,
    areaUnit: it.areaUnit ?? "SQFT",
    localityName: it.locality?.name ?? null,
    localitySlug: it.locality?.slug ?? null,
    projectName: it.projectName,
    availability: it.availability,
    lastUpdatedAt: it.lastUpdatedAt?.toISOString() ?? null,
    imageUrl: it.images[0]?.url ?? null,
    sourceCount: it.sources.length,
  }));

  const pageLink = (n: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) {
      if (typeof v === "string" && k !== "page") sp.set(k, v);
    }
    sp.set("page", String(n));
    return `/search?${sp.toString()}`;
  };

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
        <Link href="/" className="hover:underline">Home</Link> › <span aria-current="page">Search</span>
        {p.locality ? <> › <Link href={`/localities/${p.locality}`} className="hover:underline">{p.locality.replace(/-/g, " ")}</Link></> : null}
      </nav>

      <Suspense fallback={<div className="card h-40 animate-pulse bg-slate-100" />}>
        <SearchFilters localities={localities} />
      </Suspense>

      {/* Active filter chips */}
      {(p.transactionType || p.propertyType || p.locality || p.bedrooms || p.maxPrice || p.q) && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold text-slate-500">Active:</span>
          {p.q && <span className="badge bg-slate-100">“{p.q}”</span>}
          {p.transactionType && <span className="badge bg-slate-100">{p.transactionType.replace(/_/g, " ")}</span>}
          {p.propertyType && <span className="badge bg-slate-100">{p.propertyType.replace(/_/g, " ")}</span>}
          {p.locality && <span className="badge bg-slate-100">{p.locality.replace(/-/g, " ")}</span>}
          {p.bedrooms != null && <span className="badge bg-slate-100">{p.bedrooms >= 5 ? "5+ BHK" : `${p.bedrooms} BHK`}</span>}
          {p.maxPrice != null && <span className="badge bg-slate-100">≤ ₹{p.maxPrice.toLocaleString("en-IN")}</span>}
          {p.minPrice != null && <span className="badge bg-slate-100">≥ ₹{p.minPrice.toLocaleString("en-IN")}</span>}
          <Link href="/search" className="badge border border-slate-300 text-slate-600 hover:bg-slate-50">✕ Reset</Link>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-label="Property results">
          <p className="mb-2 text-sm text-slate-600">
            <b>{result.total.toLocaleString("en-IN")}</b> propert{result.total === 1 ? "y" : "ies"} in Indore match your filters
            {" · "}sort: {p.sort.replace("_", " ")}
          </p>

          {cards.length === 0 ? (
            <div className="card border-dashed p-8 text-center text-sm text-slate-600">
              <p className="font-semibold">No matching listings found.</p>
              <p className="mt-1">Try widening your budget, removing a filter, or searching a nearby locality. Results only include data actually collected by authorized connectors or imports — we never show placeholder properties.</p>
              <Link href="/search" className="btn-outline mt-4 inline-flex">Clear all filters</Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {cards.map((c) => <PropertyCard key={c.id} p={c} />)}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-4 flex items-center justify-center gap-1 text-sm">
              {p.page > 1 && <Link className="btn-outline" href={pageLink(p.page - 1)}>← Prev</Link>}
              <span className="px-3 py-2 text-slate-600">Page {p.page} / {totalPages}</span>
              {p.page < totalPages && <Link className="btn-outline" href={pageLink(p.page + 1)}>Next →</Link>}
            </nav>
          )}
        </section>

        {/* Map panel — desktop split view; on mobile appears below list */}
        <aside aria-label="Map view" className="hidden lg:block">
          <MapExplorer />
        </aside>
      </div>

      <details className="card p-4 text-sm lg:hidden">
        <summary className="cursor-pointer font-semibold">🗺️ Show map view</summary>
        <div className="mt-3"><MapExplorer /></div>
      </details>

      {/* SEO: category cross-links (only real categories) */}
      <section className="flex flex-wrap gap-2 text-xs">
        {TRANSACTION_TYPES.slice(0, 2).map((tx) =>
          PROPERTY_TYPES.slice(0, 4).map((pt) => (
            <Link
              key={tx + pt}
              href={`/search?transactionType=${tx}&propertyType=${pt}`}
              className="badge border border-slate-200 bg-white py-1 text-slate-600 hover:text-brand-700"
            >
              {pt.replace(/_/g, " ").toLowerCase()} {tx === "SALE" ? "for sale" : "for rent"} in Indore
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
