import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatINR, formatArea } from "@/lib/format";
import DuplicateDecision from "@/components/admin/DuplicateDecision";

export const dynamic = "force-dynamic";

const CLASS_COLOR: Record<string, string> = {
  CONFIRMED: "bg-red-100 text-red-800",
  LIKELY: "bg-amber-100 text-amber-800",
  POSSIBLE: "bg-slate-100 text-slate-700",
};

function Side({ p }: { p: { id: string; titleNormalized: string; price: number | null; carpetArea: number | null; builtUpArea: number | null; areaUnit: string | null; bedrooms: number | null; locality?: { name: string } | null; sources: { canonicalUrl: string; connector: { name: string } }[] } }) {
  return (
    <div className="flex-1 rounded border border-slate-200 bg-slate-50 p-2">
      <Link href={`/properties/${p.id}`} className="text-xs font-medium text-slate-900 hover:underline">{p.titleNormalized}</Link>
      <div className="mt-1 text-[11px] text-slate-600">
        {formatINR(p.price) ?? "Price N/A"} · {p.bedrooms != null ? `${p.bedrooms} BR · ` : ""}{formatArea(p.carpetArea ?? p.builtUpArea, p.areaUnit)} · {p.locality?.name ?? "Locality N/A"}
      </div>
      <ul className="mt-1 space-y-0.5">
        {p.sources.map((s) => (
          <li key={s.canonicalUrl} className="truncate text-[10px]">
            <span className="text-slate-500">{s.connector.name}:</span>{" "}
            <a href={s.canonicalUrl} target="_blank" rel="nofollow noopener noreferrer" className="text-brand-700 underline">{s.canonicalUrl}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function AdminDuplicatesPage() {
  const candidates = await prisma.duplicateCandidate.findMany({
    where: { status: "OPEN" },
    orderBy: { confidence: "desc" },
    take: 50,
    include: {
      propertyA: { include: { locality: true, sources: { include: { connector: true } } } },
      propertyB: { include: { locality: true, sources: { include: { connector: true } } } },
    },
  });

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-xs text-slate-600">
        Uncertain matches are never auto-merged. Compare the evidence below — prices and areas stay separate per source until you decide.
        Signals that fired are shown for each candidate.
      </p>

      {candidates.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">No open duplicate candidates. The detection engine runs after each sync/import.</p>
      ) : (
        candidates.map((c) => {
          let signals: Record<string, unknown> = {};
          try { signals = JSON.parse(c.signalsJson); } catch { /* ignore */ }
          return (
            <article key={c.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <header className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <span className={`badge ${CLASS_COLOR[c.classification] ?? "bg-slate-100"}`}>{c.classification}</span>
                <span className="font-medium text-slate-700">confidence {(c.confidence * 100).toFixed(0)}%</span>
                <span className="text-slate-500">signals: {Object.entries(signals).filter(([, v]) => v === true || (typeof v === "number" && v > 0)).map(([k]) => k).join(", ") || "—"}</span>
                <span className="ml-auto"><DuplicateDecision id={c.id} aTitle={c.propertyA.titleNormalized} bTitle={c.propertyB.titleNormalized} /></span>
              </header>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Side p={c.propertyA} />
                <Side p={c.propertyB} />
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
