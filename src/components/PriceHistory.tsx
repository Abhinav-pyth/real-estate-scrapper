import { getPropertyPriceHistory } from "@/lib/priceStats";
import { formatPriceINR } from "@/lib/format";

// Server component: price history chart built ONLY from stored observations.
// If fewer than 2 dated price observations exist, we honestly say so — no invented trend lines.
export default async function PriceHistory({ propertyId }: { propertyId: string }) {
  const h = await getPropertyPriceHistory(propertyId);

  if (!h.hasEnoughData) {
    return (
      <div className="card p-4 text-sm text-slate-500">
        <h2 className="mb-1 text-base font-bold text-slate-900">Price history</h2>
        Not enough dated re-checks yet to show a trend. History appears once the source has been checked
        multiple times with recorded prices. We never draw estimated past or future prices.
      </div>
    );
  }

  const prices = h.points.map((p) => p.price);
  const min = Math.min(...prices), max = Math.max(...prices);
  const W = 320, H = 90;
  const pts = h.points
    .map((p, i) => {
      const x = h.points.length === 1 ? W / 2 : (i / (h.points.length - 1)) * W;
      const y = max === min ? H / 2 : H - ((p.price - min) / (max - min)) * (H - 10) - 5;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const netChange = (h.current ?? 0) - (h.initial ?? 0);

  return (
    <div className="card space-y-3 p-4">
      <h2 className="text-base font-bold">Price history ({h.points.length} recorded observations)</h2>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" role="img" aria-label="Asking price over time">
        <polyline points={pts} fill="none" stroke="#1f63c4" strokeWidth="2" />
        {h.points.map((p, i) => {
          const x = h.points.length === 1 ? W / 2 : (i / (h.points.length - 1)) * W;
          const y = max === min ? H / 2 : H - ((p.price - min) / (max - min)) * (H - 10) - 5;
          return <circle key={i} cx={x} cy={y} r="3" fill={p.changeType === "PRICE_DECREASE" ? "#16a34a" : p.changeType === "PRICE_INCREASE" ? "#dc2626" : "#1f63c4"} />;
        })}
      </svg>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <div><dt className="text-slate-500">First seen</dt><dd className="font-semibold">{formatPriceINR(h.initial)}</dd></div>
        <div><dt className="text-slate-500">Previous</dt><dd className="font-semibold">{h.previous != null ? formatPriceINR(h.previous) : "—"}</dd></div>
        <div><dt className="text-slate-500">Current ask</dt><dd className="font-semibold">{formatPriceINR(h.current)}</dd></div>
        <div><dt className="text-slate-500">Net change</dt><dd className={`font-semibold ${netChange < 0 ? "text-emerald-700" : netChange > 0 ? "text-red-600" : ""}`}>{netChange === 0 ? "no change" : `${netChange > 0 ? "+" : ""}${formatPriceINR(Math.abs(netChange)).replace("₹", "₹")}${netChange < 0 ? " ↓" : " ↑"}`}</dd></div>
      </dl>
      <p className="text-[11px] text-slate-400">Based on asking prices recorded during source re-checks only. Increases: {h.increases}, reductions: {h.decreases}.</p>
    </div>
  );
}
