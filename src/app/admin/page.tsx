import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatINR, timeAgo } from "@/lib/format";
import { connectorStatusLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

async function stat(fn: () => Promise<number>) { return fn(); }

export default async function AdminOverviewPage() {
  const [total, active, stale, unavailable, pending, dupOpen, avgCompleteness, bySource, byLocality, reductions, recentJobs] =
    await Promise.all([
      stat(() => prisma.property.count()),
      stat(() => prisma.property.count({ where: { availability: "ACTIVE" } })),
      stat(() => prisma.property.count({ where: { availability: "STALE" } })),
      stat(() => prisma.property.count({ where: { availability: { in: ["UNAVAILABLE_AT_SOURCE", "REMOVED_BY_SOURCE"] } } })),
      stat(() => prisma.property.count({ where: { availability: "PENDING_VERIFICATION" } })),
      stat(() => prisma.duplicateCandidate.count({ where: { status: "OPEN" } })),
      stat(async () => {
        const r = await prisma.property.aggregate({ _avg: { completenessScore: true } });
        return Math.round(r._avg.completenessScore ?? 0);
      }),
      prisma.sourceConnector.findMany({ orderBy: { listingsCount: "desc" }, select: { id: true, key: true, name: true, status: true, enabled: true, listingsCount: true, lastSyncAt: true, lastError: true } }),
      prisma.property.groupBy({ by: ["localityId"], _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 10 }),
      prisma.property.findMany({
        where: { observations: { some: {} } },
        orderBy: { lastUpdatedAt: "desc" },
        take: 8,
        select: { id: true, titleNormalized: true, price: true, lastUpdatedAt: true, observations: { orderBy: { observedAt: "desc" }, take: 2, select: { price: true } } },
      }),
      prisma.scrapingJob.findMany({ orderBy: { startedAt: "desc" }, take: 8, include: { connector: { select: { name: true } } } }),
    ]);

  const localityNames = await prisma.locality.findMany({ where: { id: { in: byLocality.map((b) => b.localityId ?? "").filter(Boolean) } }, select: { id: true, name: true } });
  const locName = (id: string | null) => localityNames.find((l) => l.id === id)?.name ?? "Unassigned";

  const reduced = reductions.filter((p) => p.observations.length === 2 && p.observations[0].price != null && p.observations[1].price != null && p.observations[0].price < p.observations[1].price);

  return (
    <div className="space-y-6">
      <section aria-label="Key statistics" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total records", value: total, href: "/admin/properties" },
          { label: "Active listings", value: active, href: "/admin/properties?availability=ACTIVE" },
          { label: "Stale", value: stale, href: "/admin/properties?availability=STALE" },
          { label: "Unavailable / removed", value: unavailable, href: "/admin/properties" },
          { label: "Pending verification", value: pending, href: "/admin/properties?availability=PENDING_VERIFICATION" },
          { label: "Open duplicate candidates", value: dupOpen, href: "/admin/duplicates" },
          { label: "Avg data completeness", value: `${avgCompleteness}%`, href: undefined },
          { label: "Recent price drops", value: reduced.length, href: undefined },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-2xl font-bold text-slate-900">{s.value}</div>
            {s.href ? <Link href={s.href} className="text-xs text-brand-700 hover:underline">{s.label}</Link> : <div className="text-xs text-slate-500">{s.label}</div>}
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Listings by source</h2>
          <table className="w-full text-left text-xs">
            <thead><tr className="text-slate-500"><th className="py-1">Source</th><th>Status</th><th className="text-right">Listings</th><th>Last sync</th></tr></thead>
            <tbody>
              {bySource.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="py-1.5"><Link href={`/admin/sources`} className="font-medium text-slate-800 hover:underline">{s.name}</Link></td>
                  <td>{connectorStatusLabel(s.status)}{s.enabled ? "" : " · off"}</td>
                  <td className="text-right">{s.listingsCount}</td>
                  <td>{s.lastSyncAt ? timeAgo(s.lastSyncAt.toISOString()) : "never"}{s.lastError ? <span className="ml-1 text-red-600" title={s.lastError}>⚠</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Top localities</h2>
          {byLocality.length === 0 ? <p className="text-xs text-slate-500">No property records yet.</p> : (
            <ul className="space-y-1 text-xs">
              {byLocality.map((b) => (
                <li key={b.localityId ?? "none"} className="flex justify-between border-b border-slate-100 py-1">
                  <span>{locName(b.localityId)}</span><span className="font-medium">{b._count.id}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Recent price reductions (from stored observations)</h2>
        {reduced.length === 0 ? <p className="text-xs text-slate-500">No price reductions recorded yet — these appear only after re-checks capture actual changes.</p> : (
          <ul className="space-y-1 text-xs">
            {reduced.map((p) => (
              <li key={p.id} className="flex justify-between border-b border-slate-100 py-1">
                <Link href={`/properties/${p.id}`} className="truncate text-slate-800 hover:underline">{p.titleNormalized}</Link>
                <span className="whitespace-nowrap text-brand-700">{formatINR(p.observations[1].price!)} → {formatINR(p.observations[0].price!)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Recent ingestion jobs</h2>
        {recentJobs.length === 0 ? <p className="text-xs text-slate-500">No jobs have run yet.</p> : (
          <table className="w-full text-left text-xs">
            <thead><tr className="text-slate-500"><th className="py-1">Source</th><th>Kind</th><th>Status</th><th>New</th><th>Updated</th><th>Errors</th><th>Started</th></tr></thead>
            <tbody>
              {recentJobs.map((j) => (
                <tr key={j.id} className="border-t border-slate-100">
                  <td className="py-1.5">{j.connector.name}</td><td>{j.kind}</td>
                  <td className={j.status === "FAILED" ? "text-red-600" : j.status === "SUCCEEDED" ? "text-brand-700" : "text-slate-600"}>{j.status}</td>
                  <td>{j.newCount}</td><td>{j.updatedCount}</td><td>{j.errorCount}</td>
                  <td>{j.startedAt ? timeAgo(j.startedAt.toISOString()) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-xs"><Link href="/admin/jobs" className="text-brand-700 hover:underline">View all jobs →</Link></p>
      </section>
    </div>
  );
}
