import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { searchProperties } from "@/lib/search";
import { getLocalityPriceStats, MIN_SAMPLE_STATS } from "@/lib/priceStats";
import { formatPriceINR, formatPsf } from "@/lib/format";
import PropertyCard from "@/components/PropertyCard";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

async function load(slug: string) {
  const locality = await prisma.locality.findFirst({ where: { slug, city: { name: "Indore" }, isActive: true } });
  if (!locality) return null;
  const [sale, rent, statsSale, statsRent] = await Promise.all([
    searchProperties({ city: "Indore", locality: slug, transactionType: "SALE", availability: "ACTIVE", sort: "newest", page: 1, limit: 24 } as never),
    searchProperties({ city: "Indore", locality: slug, transactionType: "RENT", availability: "ACTIVE", sort: "newest", page: 1, limit: 24 } as never),
    getLocalityPriceStats({ slug, transactionType: "SALE" }),
    getLocalityPriceStats({ slug, transactionType: "RENT" }),
  ]);
  return { locality, sale, rent, statsSale, statsRent };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load(params.slug);
  if (!data) return { title: "Locality not found" };
  const name = data.locality.name;
  return {
    title: `Properties in ${name}, Indore — prices & listings | ${config.appName}`,
    description: `Aggregated ${name}, Indore property listings for sale and rent with asking-price statistics computed from collected data. Original source links included.`,
    alternates: { canonical: `/localities/${params.slug}` },
  };
}

function StatsBlock({ title, stats }: { title: string; stats: Awaited<ReturnType<typeof getLocalityPriceStats>> }) {
  if (!stats) return null;
  if (stats.sampleSize < MIN_SAMPLE_STATS) {
    return (
      <div className="card p-4 text-sm">
        <h3 className="font-bold">{title}</h3>
        <p className="mt-1 text-slate-500">
          Only {stats.sampleSize} listing{stats.sampleSize === 1 ? "" : "s"} collected so far — too small a sample to publish averages honestly.
          Check back as coverage grows.
        </p>
      </div>
    );
  }
  return (
    <div className="card space-y-2 p-4 text-sm">
      <h3 className="font-bold">{title}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
        <div><dt className="text-xs text-slate-500">Median asking price</dt><dd className="font-semibold">{formatPriceINR(stats.medianAskingPrice)}</dd></div>
        <div><dt className="text-xs text-slate-500">Average asking price</dt><dd className="font-semibold">{formatPriceINR(stats.averageAskingPrice)}</dd></div>
        <div><dt className="text-xs text-slate-500">Median ₹/sqft</dt><dd className="font-semibold">{stats.medianPricePerSqFt != null ? formatPsf(stats.medianPricePerSqFt) : "Not enough compatible area data"}</dd></div>
        <div><dt className="text-xs text-slate-500">Sample size</dt><dd className="font-semibold">{stats.sampleSize} listings</dd></div>
      </dl>
      <div className="flex flex-wrap gap-1 pt-1">
        {Object.entries(stats.budgetBuckets).map(([label, n]) => (
          <span key={label} className="badge bg-slate-100 text-slate-600">{label}: {n}</span>
        ))}
      </div>
      <p className="text-[11px] text-slate-400">
        Asking prices from aggregated listings (collected through {new Date(stats.collectedThrough).toLocaleDateString("en-IN")}) — not registered transaction values or guidance prices.
        {stats.warnings.map((w) => ` ${w}`)}
      </p>
    </div>
  );
}

const cardsOf = (r: Awaited<ReturnType<typeof searchProperties>>) =>
  r.items.map((it) => ({
    id: it.id, titleNormalized: it.titleNormalized, price: it.price, pricePerSqFt: it.pricePerSqFt,
    transactionType: it.transactionType, propertyType: it.propertyType, bedrooms: it.bedrooms,
    carpetArea: it.carpetArea, areaUnit: it.areaUnit ?? "SQFT",
    localityName: it.locality?.name ?? null, localitySlug: it.locality?.slug ?? null,
    projectName: it.projectName, availability: it.availability,
    lastUpdatedAt: it.lastUpdatedAt?.toISOString() ?? null, imageUrl: it.images[0]?.url ?? null,
    sourceCount: it.sources.length,
  }));

export default async function LocalityPage({ params }: Props) {
  const data = await load(params.slug);
  if (!data) notFound();
  const { locality, sale, rent } = data;
  const name = locality.name;

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
        <Link href="/" className="hover:underline">Home</Link> ›{" "}
        <Link href="/localities" className="hover:underline">Localities</Link> ›{" "}
        <span aria-current="page">{name}</span>
      </nav>

      <header>
        <h1 className="text-2xl font-bold">Properties in {name}, Indore</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          {sale.total + rent.total > 0 ? (
            <>Currently aggregating <b>{sale.total}</b> sale and <b>{rent.total}</b> rental listings in {name}. Each record links to its original source.</>
          ) : (
            <>No listings collected for {name} yet. Data appears here after an authorized connector sync or import covers this locality — we never display placeholder properties.</>
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link className="btn-outline" href={`/search?locality=${locality.slug}&transactionType=SALE`}>Buy in {name}</Link>
          <Link className="btn-outline" href={`/search?locality=${locality.slug}&transactionType=RENT`}>Rent in {name}</Link>
          <Link className="btn-outline" href={`/search?locality=${locality.slug}&propertyType=APARTMENT`}>Flats</Link>
          <Link className="btn-outline" href={`/search?locality=${locality.slug}&propertyType=RESIDENTIAL_PLOT`}>Plots</Link>
          <Link className="btn-outline" href={`/map?locality=${locality.slug}`}>View on map</Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <StatsBlock title={`${name} — buy (asking)`} stats={data.statsSale} />
        <StatsBlock title={`${name} — rent (asking)`} stats={data.statsRent} />
      </section>

      {sale.items.length > 0 && (
        <section aria-labelledby="sale-h">
          <h2 id="sale-h" className="mb-2 text-lg font-bold">For sale in {name}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cardsOf(sale).slice(0, 9).map((c) => <PropertyCard key={c.id} p={c} />)}
          </div>
          {sale.total > 9 && <Link className="btn-outline mt-3" href={`/search?locality=${locality.slug}&transactionType=SALE`}>See all {sale.total} sale listings →</Link>}
        </section>
      )}

      {rent.items.length > 0 && (
        <section aria-labelledby="rent-h">
          <h2 id="rent-h" className="mb-2 text-lg font-bold">For rent in {name}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cardsOf(rent).slice(0, 9).map((c) => <PropertyCard key={c.id} p={c} />)}
          </div>
          {rent.total > 9 && <Link className="btn-outline mt-3" href={`/search?locality=${locality.slug}&transactionType=RENT`}>See all {rent.total} rental listings →</Link>}
        </section>
      )}

      {/* Nearby localities — internal linking */}
      <section aria-labelledby="nearby">
        <h2 id="nearby" className="mb-2 text-lg font-bold">Nearby localities</h2>
        <div className="flex flex-wrap gap-2 text-xs">
          {(await prisma.locality.findMany({
            where: { isActive: true, city: { name: "Indore" }, slug: { not: locality.slug }, centerLat: { not: null } },
            select: { slug: true, name: true, centerLat: true, centerLng: true },
          }))
            .filter((l) => l.centerLat != null && l.centerLng != null && locality.centerLat != null && locality.centerLng != null)
            .map((l) => ({ ...l, d: Math.hypot((l.centerLat as number) - locality.centerLat!, (l.centerLng as number) - locality.centerLng!) }))
            .sort((a, b) => a.d - b.d)
            .slice(0, 8)
            .map((l) => (
              <Link key={l.slug} href={`/localities/${l.slug}`} className="badge border border-slate-200 bg-white py-1 text-slate-700 hover:text-brand-700">
                {l.name}
              </Link>
            ))}
        </div>
      </section>
    </div>
  );
}
