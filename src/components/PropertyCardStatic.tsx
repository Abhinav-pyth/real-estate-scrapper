import Link from "next/link";
import { formatPriceINR } from "@/lib/format";
import type { CardProperty } from "./PropertyCard";

// Server-rendered card for landing pages (no client JS needed).
export default function PropertyCardStatic({ p }: { p: CardProperty }) {
  const tx = p.transactionType.includes("RENT") ? "for rent" : "for sale";
  return (
    <Link href={`/properties/${p.id}`} className="card block overflow-hidden transition hover:shadow-md">
      {p.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.imageUrl} alt="" className="h-36 w-full object-cover" loading="lazy" />
      ) : (
        <div className="grid h-36 w-full place-items-center bg-slate-100 text-xs text-slate-400">No image collected</div>
      )}
      <div className="space-y-1 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold">{p.titleNormalized}</h3>
        <p className="text-base font-bold text-brand-700">{formatPriceINR(p.price, { rent: p.transactionType.includes("RENT") })}</p>
        <p className="text-xs text-slate-500">
          {[p.bedrooms != null ? `${p.bedrooms} BHK` : null, p.localityName ? `${p.localityName}, Indore` : "Indore", tx]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </Link>
  );
}
