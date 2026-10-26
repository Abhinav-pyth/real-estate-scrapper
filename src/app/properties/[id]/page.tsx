import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPropertyDetail, getPropertyDuplicateGroups } from "@/lib/data";
import { formatPriceINR, formatPsf, formatArea } from "@/lib/format";
import { INDORE_CENTER } from "@/lib/types";
import SaveButton from "@/components/SaveButton";
import SinglePropertyMap from "@/components/SinglePropertyMap";
import PriceHistory from "@/components/PriceHistory";

export const dynamic = "force-dynamic";

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getPropertyDetail(params.id);
  if (!p) return { title: "Property not found" };
  const priceTxt = p.price != null ? formatPriceINR(p.price, { rent: p.transactionType.includes("RENT") }) : "Price not available";
  const loc = p.locality?.name ?? "Indore";
  return {
    title: `${p.titleNormalized} — ${priceTxt}, ${loc}, Indore`,
    description: `${p.propertyType.replace(/_/g, " ")} ${p.transactionType.includes("SALE") ? "for sale" : "for rent"} in ${loc}, Indore. Aggregated listing with original source links.`,
    alternates: { canonical: `/properties/${p.id}` },
    openGraph: { title: `${p.titleNormalized} — ${priceTxt}`, description: `${loc}, Indore — see sources & details`, type: "website" },
  };
}

const TX_LABEL: Record<string, string> = { SALE: "For Sale", RENT: "For Rent", COMMERCIAL_SALE: "Commercial — Sale", COMMERCIAL_RENT: "Commercial — Rent" };

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-1.5 text-sm">
      <dt className="text-slate-500">{k}</dt><dd className="text-right font-medium">{v ?? <span className="text-slate-400">Not available</span>}</dd>
    </div>
  );
}

export default async function PropertyPage({ params }: Props) {
  const p = await getPropertyDetail(params.id);
  if (!p) notFound();
  const dups = await getPropertyDuplicateGroups(p.id);
  const amenities: string[] = (() => { try { return JSON.parse(p.amenitiesJson); } catch { return []; } })();
  const isRent = p.transactionType.includes("RENT");
  const stale = p.availability !== "ACTIVE";

  return (
    <article className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
        <Link href="/" className="hover:underline">Home</Link> ›{" "}
        <Link href="/search" className="hover:underline">Search</Link> ›{" "}
        {p.locality ? <><Link href={`/localities/${p.locality.slug}`} className="hover:underline">{p.locality.name}</Link> › </> : null}
        <span aria-current="page" className="line-clamp-1">{p.titleNormalized}</span>
      </nav>

      {p.isFeatured && (
        <p className="badge bg-amber-50 text-amber-800">Sponsored placement{p.featuredLabel ? ` — ${p.featuredLabel}` : ""}</p>
      )}

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge bg-brand-50 text-brand-700">{TX_LABEL[p.transactionType] ?? p.transactionType}</span>
          <span className="badge bg-slate-100 text-slate-600">{p.propertyType.replace(/_/g, " ")}</span>
          {stale && <span className="badge bg-amber-50 text-amber-700">Status: {p.availability.replace(/_/g, " ").toLowerCase()} — may no longer be available</span>}
          {p.verificationStatus === "VERIFIED" && <span className="badge bg-emerald-50 text-emerald-700">Verified</span>}
        </div>
        <h1 className="text-2xl font-bold leading-tight">{p.titleNormalized}</h1>
        <p className="text-sm text-slate-500">
          📍 {[p.locality?.name, p.streetOrRoad, p.pinCode && `PIN ${p.pinCode}`, "Indore, Madhya Pradesh"].filter(Boolean).join(" · ")}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="space-y-6">
          {/* Images */}
          {p.images.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {p.images.map((img, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={img.url} alt="" loading="lazy" className="h-36 w-full rounded-lg object-cover" />
              ))}
            </div>
          ) : (
            <div className="grid h-44 place-items-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-400">
              No photographs collected for this listing
            </div>
          )}
          <p className="text-xs text-slate-400">Photographs remain the property of their original publishers and are referenced, not re-hosted.</p>

          {/* Key facts */}
          <div className="card p-4">
            <h2 className="mb-2 text-base font-bold">Listing summary</h2>
            <dl>
              <Row k="Asking price" v={<b className="text-brand-700">{formatPriceINR(p.price, { rent: isRent })}</b>} />
              <Row k="Price per sqft" v={p.pricePerSqFt != null ? `${formatPsf(p.pricePerSqFt)} (computed)` : null} />
              <Row k="Carpet area" v={formatArea(p.carpetArea, p.areaUnit)} />
              <Row k="Built-up area" v={formatArea(p.builtUpArea, p.areaUnit, "built-up")} />
              <Row k="Super built-up" v={formatArea(p.superBuiltUpArea, p.areaUnit, "super built-up")} />
              <Row k="Bedrooms / Bathrooms" v={`${p.bedrooms ?? "—"} / ${p.bathrooms ?? "—"}`} />
              <Row k="Furnishing" v={p.furnishing?.replace(/_/g, " ").toLowerCase() ?? null} />
              <Row k="Floor" v={p.floorNumber != null ? `${p.floorNumber}${p.totalFloors ? ` of ${p.totalFloors}` : ""}` : null} />
              <Row k="Construction status" v={p.constructionStatus?.replace(/_/g, " ").toLowerCase() ?? null} />
              <Row k="Possession" v={p.possessionDate} />
              <Row k="Project / Builder" v={[p.projectName, p.builderName].filter(Boolean).join(" · ") || null} />
              <Row k="RERA" v={p.reraNumber ?? "Not provided by source"} />
              <Row k="Parking / Lift / Gated" v={[p.parkingAvailable == null ? null : (p.parkingAvailable ? "Parking" : "No parking"), p.liftAvailable == null ? null : (p.liftAvailable ? "Lift" : null), p.gatedCommunity == null ? null : (p.gatedCommunity ? "Gated" : null)].filter(Boolean).join(" · ") || "Not specified"} />
              <Row k="First discovered" v={new Date(p.firstDiscoveredAt).toLocaleDateString("en-IN")} />
              <Row k="Last checked at source" v={new Date(p.lastCheckedAt).toLocaleString("en-IN")} />
            </dl>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-slate-500"><span>Data completeness</span><span>{p.completenessScore}/100</span></div>
              <div className="mt-1 h-1.5 rounded bg-slate-100"><div className="h-1.5 rounded bg-brand-600" style={{ width: `${p.completenessScore}%` }} /></div>
            </div>
          </div>

          {amenities.length > 0 && (
            <div className="card p-4">
              <h2 className="mb-2 text-base font-bold">Amenities (as stated by source)</h2>
              <ul className="flex flex-wrap gap-1.5">{amenities.map((a) => <li key={a} className="badge bg-slate-100 text-slate-700">{a}</li>)}</ul>
            </div>
          )}

          {p.description && (
            <div className="card p-4">
              <h2 className="mb-1 text-base font-bold">Description excerpt</h2>
              <p className="whitespace-pre-line text-sm text-slate-600">{p.description}</p>
              <p className="mt-2 text-xs text-slate-400">Short excerpt only — read the full description on the original listing below.</p>
            </div>
          )}

          <PriceHistory propertyId={p.id} />
        </section>

        <aside className="space-y-4">
          {/* Sources — never merged silently */}
          <div className="card p-4">
            <h2 className="mb-2 text-base font-bold">Sources ({p.sources.length})</h2>
            <ul className="space-y-3">
              {p.sources.map((s) => (
                <li key={s.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <b>{s.connector.name}</b>
                    <span className={`badge ${s.availability === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{s.availability.replace(/_/g, " ").toLowerCase()}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs italic text-slate-500" title={s.rawTitle ?? undefined}>“{s.rawTitle ?? s.canonicalUrl}”</p>
                  <p className="mt-1 text-xs text-slate-500">Checked {new Date(s.lastCheckedAt).toLocaleDateString("en-IN")}{s.externalId ? ` · ID ${s.externalId}` : ""}</p>
                  <a className="btn-primary mt-2 w-full justify-center" href={s.canonicalUrl} target="_blank" rel="nofollow noopener noreferrer external">
                    View Original Listing ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <SaveButton propertyId={p.id} />

          {/* Map */}
          {(p.lat != null && p.lng != null) ? (
            <div className="card p-4">
              <h2 className="mb-1 text-base font-bold">Location</h2>
              <p className="mb-2 text-xs text-slate-500">
                {p.coordPrecision === "EXACT"
                  ? "Exact coordinates provided by source or authorized geocoding."
                  : "Approximate locality center — the exact address is not published. Do not treat this pin as the property location."}
              </p>
              <SinglePropertyMap lat={p.lat} lng={p.lng} precision={p.coordPrecision ?? "LOCALITY_APPROXIMATE"} />
            </div>
          ) : (
            <div className="card p-4 text-sm text-slate-500">
              <h2 className="mb-1 text-base font-bold text-slate-900">Location</h2>
              No verified coordinates for this listing. We do not display guessed positions.
            </div>
          )}

          {/* Duplicate candidates */}
          {dups.length > 0 && (
            <div className="card p-4">
              <h2 className="mb-2 text-base font-bold">Similar listings detected</h2>
              <p className="mb-2 text-xs text-slate-500">Automatically flagged as possibly the same property on other records. Not merged automatically — review each.</p>
              <ul className="space-y-2">
                {dups.map((d) => (
                  <li key={d.id} className="rounded-lg border border-slate-200 p-2 text-xs">
                    <span className={`badge ${d.classification === "CONFIRMED" ? "bg-emerald-50 text-emerald-700" : d.classification === "LIKELY" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                      {d.classification.toLowerCase()} · {Math.round(d.confidence * 100)}%
                    </span>
                    {" "}<Link className="font-medium underline" href={`/properties/${d.other.id}`}>{d.other.titleNormalized}</Link>
                    <span className="text-slate-500"> — {formatPriceINR(d.other.price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card bg-slate-50 p-4 text-xs text-slate-500">
            <b>Disclaimer:</b> Information comes from third-party sources and may be outdated or inaccurate. Prices are asking prices, not transaction values. Verify all details — including availability, pricing and legal status — directly with the source before making decisions.
          </div>
        </aside>
      </div>
    </article>
  );
}
