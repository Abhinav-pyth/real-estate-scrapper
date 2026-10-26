import type { Metadata } from "next";
import Link from "next/link";
import MapExplorer from "@/components/MapExplorer";
import { config } from "@/lib/config";

export const metadata: Metadata = {
  title: `Map search — properties in Indore on the map | ${config.appName}`,
  description: "Explore aggregated Indore property listings on an interactive map. Marker clustering, exact vs approximate location indicators, radius search.",
  alternates: { canonical: "/map" },
};

export default function MapPage() {
  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
        <Link href="/" className="hover:underline">Home</Link> › <span aria-current="page">Map search</span>
      </nav>
      <h1 className="text-xl font-bold">Properties in Indore — map view</h1>
      <p className="max-w-3xl text-sm text-slate-600">
        Markers appear only for listings that have coordinates obtained from an authorized geocoding provider or the
        source itself. <span className="text-green-700 font-semibold">Green</span> = exact listing location,{" "}
        <span className="text-amber-600 font-semibold">amber</span> = approximate locality area. Listings without verified
        coordinates are intentionally omitted — we never plot invented positions.
      </p>
      <MapExplorer />
    </div>
  );
}
