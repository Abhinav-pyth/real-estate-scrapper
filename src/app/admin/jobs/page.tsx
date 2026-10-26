import Link from "next/link";
import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import RetryJobButton from "@/components/admin/RetryJobButton";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  SUCCEEDED: "text-brand-700",
  FAILED: "text-red-600",
  RUNNING: "text-amber-600",
  QUEUED: "text-slate-500",
  CANCELLED: "text-slate-400",
};

export default async function AdminJobsPage({ searchParams }: { searchParams: { status?: string; page?: string } }) {
  const take = 30;
  const page = Math.max(1, Number(searchParams.page || 1));
  const where = searchParams.status ? { status: searchParams.status } : {};

  const [jobs, total] = await Promise.all([
    prisma.scrapingJob.findMany({
      where, orderBy: { startedAt: "desc" }, skip: (page - 1) * take, take,
      include: { connector: { select: { name: true, key: true } }, logs: { orderBy: { createdAt: "desc" }, take: 3, select: { level: true, message: true } } },
    }),
    prisma.scrapingJob.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Filter:</span>
        {["", "SUCCEEDED", "FAILED", "RUNNING"].map((s) => (
          <Link key={s} href={s ? `/admin/jobs?status=${s}` : "/admin/jobs"} className={`badge px-2 py-1 ${(!searchParams.status && !s) ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
            {s || "All"}
          </Link>
        ))}
        <span className="ml-auto text-xs text-slate-500">{total} jobs</span>
      </div>

      {jobs.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">No jobs yet. Trigger a sync from the Sources page or run the worker.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">Started</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Kind</th>
                <th className="px-3 py-2">Status</th><th className="px-3 py-2">By</th><th className="px-3 py-2">New</th>
                <th className="px-3 py-2">Updated</th><th className="px-3 py-2">Unchanged</th><th className="px-3 py-2">Unavail.</th>
                <th className="px-3 py-2">Errors</th><th className="px-3 py-2">Duration</th><th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const dur = j.startedAt && j.finishedAt ? Math.round((j.finishedAt.getTime() - j.startedAt.getTime()) / 1000) : null;
                return (
                  <tr key={j.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2 text-xs">{j.startedAt ? timeAgo(j.startedAt.toISOString()) : "—"}</td>
                    <td className="px-3 py-2 text-xs font-medium">{j.connector.name}</td>
                    <td className="px-3 py-2 text-xs">{j.kind}</td>
                    <td className={`px-3 py-2 text-xs font-semibold ${STATUS_COLOR[j.status] ?? ""}`}>{j.status}{j.attempts > 1 ? ` (${j.attempts}×)` : ""}</td>
                    <td className="px-3 py-2 text-xs">{j.triggeredBy.startsWith("ADMIN") ? "admin" : j.triggeredBy.toLowerCase()}</td>
                    <td className="px-3 py-2 text-xs">{j.newCount}</td>
                    <td className="px-3 py-2 text-xs">{j.updatedCount}</td>
                    <td className="px-3 py-2 text-xs">{j.unchangedCount}</td>
                    <td className="px-3 py-2 text-xs">{j.unavailableCount}</td>
                    <td className="px-3 py-2 text-xs">{j.errorCount}</td>
                    <td className="px-3 py-2 text-xs">{dur != null ? `${dur}s` : "running"}</td>
                    <td className="px-3 py-2">{j.status === "FAILED" ? <RetryJobButton jobId={j.id} /> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Error details per job, listed separately so the table stays readable */}
      {jobs.some((j) => j.lastError) && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs">
          <h2 className="mb-1 font-semibold text-red-800">Recent job errors</h2>
          <ul className="list-disc space-y-1 pl-5 text-red-700">
            {jobs.filter((j) => j.lastError).map((j) => (
              <li key={j.id}><strong>{j.connector.name}</strong> ({timeAgo((j.finishedAt ?? j.startedAt ?? new Date()).toISOString())}): {j.lastError}</li>
            ))}
          </ul>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex justify-center gap-2 text-sm">
          {page > 1 && <Link href={`/admin/jobs?page=${page - 1}${searchParams.status ? `&status=${searchParams.status}` : ""}`} className="badge border border-slate-200 bg-white px-3 py-1">← Prev</Link>}
          <span className="badge border border-slate-200 bg-white px-3 py-1">{page} / {pages}</span>
          {page < pages && <Link href={`/admin/jobs?page=${page + 1}${searchParams.status ? `&status=${searchParams.status}` : ""}`} className="badge border border-slate-200 bg-white px-3 py-1">Next →</Link>}
        </nav>
      )}
    </div>
  );
}
