import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { connectorStatusLabel } from "@/lib/labels";
import ConnectorActions from "@/components/admin/ConnectorActions";

export const dynamic = "force-dynamic";

// Sources that can actually fetch data right now (not policy-disabled, not import-only).
const SYNCABLE_STATUSES = new Set(["PERMITTED_API", "PERMITTED_FEED"]);

export default async function AdminSourcesPage() {
  const connectors = await prisma.sourceConnector.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: { _count: { select: { jobs: true } } },
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-600 max-w-3xl">
        Connector status reflects real permission checks (robots.txt / ToS review — see{" "}
        <a href="/about/data-policy" className="text-brand-700 underline">data policy</a>). Sources marked{" "}
        <strong>Disabled by policy</strong> cannot be enabled or synced from this UI; they are deliberately{" "}
        <strong>not scraped</strong>. Use CSV/JSON imports for authorized data you own.
      </p>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Enabled</th>
              <th className="px-3 py-2">Rate limit</th>
              <th className="px-3 py-2">Max/job</th>
              <th className="px-3 py-2">Schedule</th>
              <th className="px-3 py-2">Listings</th>
              <th className="px-3 py-2">Last sync</th>
              <th className="px-3 py-2">Jobs</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {connectors.map((c) => {
              const canSync = c.enabled && SYNCABLE_STATUSES.has(c.status);
              return (
                <tr key={c.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.key}{c.websiteUrl ? ` · ${c.websiteUrl}` : ""}</div>
                    {c.robotsNote && <div className="mt-1 max-w-xs text-[11px] text-slate-500">{c.robotsNote}</div>}
                    {c.lastError && <div className="mt-1 max-w-xs text-[11px] text-red-600">Last error: {c.lastError}</div>}
                  </td>
                  <td className="px-3 py-2"><span className="badge bg-slate-100 text-slate-700">{connectorStatusLabel(c.status)}</span></td>
                  <td className="px-3 py-2">{c.enabled ? <span className="text-brand-700">● on</span> : <span className="text-slate-400">○ off</span>}</td>
                  <td className="px-3 py-2 text-xs">{c.rateLimitPerMin}/min</td>
                  <td className="px-3 py-2 text-xs">{c.maxListingsPerJob}</td>
                  <td className="px-3 py-2 text-xs">{c.scheduleCron ?? "manual"}</td>
                  <td className="px-3 py-2 text-xs">{c.listingsCount}</td>
                  <td className="px-3 py-2 text-xs">{c.lastSyncAt ? timeAgo(c.lastSyncAt.toISOString()) : "never"}</td>
                  <td className="px-3 py-2 text-xs">{c._count.jobs}</td>
                  <td className="px-3 py-2"><ConnectorActions id={c.id} name={c.name} canSync={canSync} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
