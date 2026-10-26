import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  "source.update": "Updated connector settings",
  "source.sync": "Triggered sync",
  "job.retry": "Retried job",
  "data.import": "Imported data file",
  "duplicate.merge": "Merged duplicate candidates",
  "duplicate.reject": "Rejected duplicate candidate",
  "property.edit": "Edited property record",
  "property.takedown": "Took down property",
};

export default async function AdminAuditPage({ searchParams }: { searchParams: { page?: string } }) {
  const take = 50;
  const page = Math.max(1, Number(searchParams.page || 1));
  const [logs, total, users] = await Promise.all([
    prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take, include: { user: { select: { email: true } } } }),
    prisma.adminAuditLog.count(),
    // no-op kept simple
    Promise.resolve(null),
  ]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-600">{total} recorded administrative actions. All connector changes, syncs, imports, merges, edits and takedowns appear here.</p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Admin</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Entity</th><th className="px-3 py-2">Detail</th></tr></thead>
          <tbody>
            {logs.length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-slate-500">No audit entries yet.</td></tr> : logs.map((l) => (
              <tr key={l.id} className="border-t border-slate-100 align-top">
                <td className="px-3 py-1.5 whitespace-nowrap">{l.createdAt.toLocaleString("en-IN")}</td>
                <td className="px-3 py-1.5">{l.user?.email ?? "system"}</td>
                <td className="px-3 py-1.5 font-medium text-slate-800">{ACTION_LABEL[l.action] ?? l.action}</td>
                <td className="px-3 py-1.5">{l.entity ?? "—"}{l.entityId ? ` · ${l.entityId.slice(0, 10)}…` : ""}</td>
                <td className="max-w-md truncate px-3 py-1.5 text-slate-500" title={l.detailJson}>{l.detailJson !== "{}" ? l.detailJson : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > take && (
        <nav aria-label="Pagination" className="flex justify-center gap-2 text-sm">
          {page > 1 && <a href={`/admin/audit?page=${page - 1}`} className="badge border border-slate-200 bg-white px-3 py-1">← Prev</a>}
          <span className="badge border border-slate-200 bg-white px-3 py-1">{page} / {Math.ceil(total / take)}</span>
          {page * take < total && <a href={`/admin/audit?page=${page + 1}`} className="badge border border-slate-200 bg-white px-3 py-1">Next →</a>}
        </nav>
      )}
    </div>
  );
}
