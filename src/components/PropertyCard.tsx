import Link from "next/link";
import { formatPriceINR, formatArea } from "@/lib/format";

export interface CardProperty {
  id: string;
  titleNormalized: string;
  price: number | null;
  pricePerSqFt: number | null;
  transactionType: string;
  propertyType: string;
  bedrooms: number | null;
  carpetArea: number | null;
  areaUnit: string;
  localityName: string | null;
  localitySlug: string | null;
  projectName: string | null;
  availability: string;
  lastUpdatedAt: string | null;
  imageUrl?: string | null;
  sourceCount?: number;
}

const TX_LABEL: Record<string, string> = { SALE: "For Sale", RENT: "For Rent", COMMERCIAL_SALE: "Commercial Sale", COMMERCIAL_RENT: "Commercial Rent" };

// Honest card: missing price renders "Price not available" — never a fabricated number.
export default function PropertyCard({ p }: { p: CardProperty }) {
  return (
    <Link href={`/property/${p.id}`} className="card block overflow-hidden transition hover:shadow-md">
      {p.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.imageUrl} alt="" className="h-40 w-full object-cover" loading="lazy" />
      ) : (
        <div className="grid h-40 w-full place-items-center bg-slate-100 text-xs text-slate-400">No image collected</div>
      )}
      <div className="space-y-1.5 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="badge bg-brand-50 text-brand-700">{TX_LABEL[p.transactionType] ?? p.transactionType}</span>
          {p.availability === "STALE" && <span className="badge bg-amber-50 text-amber-700" title="Not re-verified recently at source">possibly stale</span>}
          {(p.sourceCount ?? 0) > 1 && <span className="badge bg-emerald-50 text-emerald-700">{p.sourceCount} sources</span>}
        </div>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{p.titleNormalized}</h3>
        <p className="text-base font-bold text-brand-700">
          {formatPriceINR(p.price, { rent: p.transactionType.includes("RENT") })}
        </p>
        <p className="text-xs text-slate-500">
          {[p.bedrooms != null ? `${p.bedrooms} BHK` : null, formatArea(p.carpetArea, p.areaUnit, "carpet"), p.propertyType.replace(/_/g, " ").toLowerCase()]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {p.pricePerSqFt != null && <p className="text-xs text-slate-500">≈ ₹{p.pricePerSqFt.toLocaleString("en-IN")}/sqft (computed)</p>}
        {p.localityName && (
          <p className="text-xs text-slate-600">
            📍 {p.localitySlug ? <span className="underline decoration-dotted">{p.localityName}</span> : p.localityName}
            {p.projectName ? ` · ${p.projectName}` : ""}
          </p>
        )}
      </div>
    </Link>
  );
}
