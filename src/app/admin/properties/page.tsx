import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatINR, timeAgo } from "@/lib/format";
import { availabilityLabel } from "@/lib/labels";
import PropertyAdminRow from "@/components/admin/PropertyAdminRow";

export const dynamic = "force-dynamic";

export default async function AdminPropertiesPage({ searchParams }: { searchParams: { q?: string; availability?: string; page?: string } }) {
  const take = 25;
  const page = Math.max(1, Number(searchParams.page || 1));
  const where: Record<string, unknown> = {};
  if (searchParams.availability) where.availability = searchParams.availability;
  if (searchParams.q) where.titleNormalized = { contains: searchParams.q };

  const [props, total] = await Promise.all([
    prisma.property.findMany({ where, orderBy: { lastUpdatedAt: "desc" }, skip: (page - 1) * take, take, include: { locality: { select: { name: true } } } }),
    prisma.property.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / take));
  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: searchParams.q, availability: searchParams.availability, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/admin/properties${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <div className="space-y-4">
      <form method="get" action="/admin/properties" className="flex flex-wrap items-center gap-2 text-sm">
        <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Search title…" className="w-full max-w-xs rounded border border-slate-300 bg-white px-3 py-1.5 text-sm" />
        <select name="availability" defaultValue={searchParams.availability ?? ""} className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm">
          <option value="">Any status</option>
          {["ACTIVE", "STALE", "PENDING_VERIFICATION", "UNAVAILABLE_AT_SOURCE", "REMOVED_BY_SOURCE"].map((s) => <option key={s} value={s}>{availabilityLabel(s)}</option>)}
        </select>
        <button type="submit" className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white">Filter</button>
        <span className="ml-auto text-xs text-slate-500">{total} records</span>
      </form>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">Title · locality · completeness — click Edit to correct normalized fields or change status</div>
        {props.length === 0 ? <p className="p-6 text-sm text-slate-600">No records match.</p> : props.map((p) => (
          <PropertyAdminRow key={p.id} p={{ id: p.id, titleNormalized: p.titleNormalized, availability: p.availability, verificationStatus: p.verificationStatus, localityName: p.locality?.name ?? null, price: p.price, completenessScore: p.completenessScore }} />
        ))}
      </div>

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex justify-center gap-2 text-sm">
          {page > 1 && <Link href={qs({ page: String(page - 1) })} className="badge border border-slate-200 bg-white px-3 py-1">← Prev</Link>}
          <span className="badge border border-slate-200 bg-white px-3 py-1">{page} / {pages}</span>
          {page < pages && <Link href={qs({ page: String(page + 1) })} className="badge border border-slate-200 bg-white px-3 py-1">Next →</Link>}
        </nav>
      )}
    </div>
  );
}
