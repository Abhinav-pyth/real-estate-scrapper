import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getActiveLocalities } from "@/lib/data";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Property localities in Indore — price guides & listings | ${config.appName}`,
  description: "Browse Indore localities with aggregated property listings and asking-price statistics computed only from real collected data.",
  alternates: { canonical: "/localities" },
};

export default async function LocalitiesPage() {
  const locs = await getActiveLocalities();
  const counts = await prisma.property.groupBy({
    by: ["localityId"],
    where: { availability: { in: ["ACTIVE", "STALE"] } },
    _count: { _all: true },
  });
  const countById = new Map(counts.map((c) => [c.localityId, c._count._all]));
  const idMap = await prisma.locality.findMany({ where: { slug: { in: locs.map((l) => l.slug) } }, select: { id: true, slug: true } });
  const slugToId = new Map(idMap.map((l) => [l.slug, l.id]));

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
        <Link href="/" className="hover:underline">Home</Link> › <span aria-current="page">Localities</span>
      </nav>
      <h1 className="text-xl font-bold">Indore localities</h1>
      <p className="max-w-3xl text-sm text-slate-600">
        Locality pages are generated for all configured Indore neighborhoods. Listing counts reflect currently
        collected data; pages with too few records show limited or no statistics rather than misleading averages.
      </p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {locs.map((l) => {
          const n = countById.get(slugToId.get(l.slug) ?? "") ?? 0;
          return (
            <li key={l.slug}>
              <Link href={`/localities/${l.slug}`} className="card flex items-center justify-between p-3 text-sm hover:border-brand-300">
                <span className="font-medium">{l.name}</span>
                <span className="badge bg-slate-100 text-slate-600">{n} listing{n === 1 ? "" : "s"}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
