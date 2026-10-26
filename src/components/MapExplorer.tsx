"use client";
// Leaflet map with clustering + filters + clickable markers.
// Only properties that ACTUALLY have coordinates appear; approximate vs exact is shown.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { INDORE_CENTER } from "@/lib/types";
import { formatPriceINR } from "@/lib/format";

interface Marker {
  id: string; title: string; price: number | null; pricePerSqFt: number | null;
  propertyType: string; transactionType: string; bedrooms: number | null;
  lat: number; lng: number; coordPrecision: string; locality: string | null; localitySlug: string | null;
}

export default function MapExplorer() {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>();
  const clusterRef = useRef<any>();
  const [count, setCount] = useState<number | null>(null);
  const [noGeo, setNoGeo] = useState(false);
  const [filters, setFilters] = useState({ tx: "SALE", maxPrice: "", beds: "" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // dynamic import keeps SSR safe (Leaflet needs window)
      const L = (await import("leaflet")).default;
      await import("leaflet.markercluster");
      // ensure CSS present
      if (!document.querySelector("#leaflet-css")) {
        for (const href of ["https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css", "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"]) {
          const link = document.createElement("link");
          link.rel = "stylesheet"; link.href = href;
          document.head.appendChild(link);
        }
      }
      if (cancelled || !divRef.current) return;
      const map = L.map(divRef.current).setView([INDORE_CENTER.lat, INDORE_CENTER.lng], 12);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; CARTO',
        maxZoom: 19,
      }).addTo(map);
      const cluster = (L as any).markerClusterGroup({ maxClusterRadius: 48 });
      map.addLayer(cluster);
      mapRef.current = map; clusterRef.current = cluster;
      refresh();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    if (!clusterRef.current) return;
    const L = (await import("leaflet")).default;
    const params = new URLSearchParams();
    if (filters.tx) params.set("transactionType", filters.tx);
    if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
    if (filters.beds) params.set("bedrooms", filters.beds);
    const res = await fetch(`/api/map/properties?${params.toString()}`);
    const json = await res.json();
    const markers: Marker[] = json.data?.markers ?? [];
    setCount(markers.length);
    setNoGeo(markers.length === 0);
    const layer = clusterRef.current;
    layer.clearLayers();
    for (const m of markers) {
      const color = m.coordPrecision === "EXACT" ? "#16a34a" : "#d97706";
      const circle = L.circleMarker([m.lat, m.lng], { radius: 7, color, fillColor: color, fillOpacity: 0.75, weight: 2 });
      circle.bindPopup(
        `<div style="min-width:180px">
           <b>${escapeHtml(m.title)}</b><br/>
           <span>${m.price == null ? "Price not available" : formatPriceINR(m.price, { rent: m.transactionType.includes("RENT") })}</span><br/>
           <span style="color:#64748b">${m.bedrooms ? m.bedrooms + " BHK · " : ""}${m.locality ? escapeHtml(m.locality) : ""}</span><br/>
           <span style="font-size:11px;color:${m.coordPrecision === "EXACT" ? "#16a34a" : "#d97706"}">
             ${m.coordPrecision === "EXACT" ? "Exact location" : "Approximate area"}
           </span><br/>
           <a href="/properties/${m.id}" style="color:#1f63c4;font-weight:600">View listing →</a>
         </div>`
      );
      layer.addLayer(circle);
    }
  }

  function escapeHtml(s: string) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-end gap-2 p-3">
        <div>
          <label className="label">Deal type</label>
          <select className="input w-40" value={filters.tx} onChange={(e) => setFilters({ ...filters, tx: e.target.value })}>
            <option value="">All</option><option value="SALE">Sale</option><option value="RENT">Rent</option>
            <option value="COMMERCIAL_SALE">Commercial sale</option><option value="COMMERCIAL_RENT">Commercial rent</option>
          </select>
        </div>
        <div>
          <label className="label">Max price</label>
          <input className="input w-36" inputMode="numeric" placeholder="e.g. 5000000" value={filters.maxPrice}
            onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value.replace(/\D/g, "") })} />
        </div>
        <div>
          <label className="label">BHK</label>
          <select className="input w-24" value={filters.beds} onChange={(e) => setFilters({ ...filters, beds: e.target.value })}>
            <option value="">Any</option>{["1","2","3","4","5"].map((b) => <option key={b} value={b}>{b === "5" ? "5+" : b}</option>)}
          </select>
        </div>
        <button className="btn-primary" onClick={refresh}>Update map</button>
        <span className="ml-auto text-xs text-slate-500">
          {count == null ? "Loading…" : `${count} listed locations shown`} · <span className="text-green-700">●</span> exact · <span className="text-amber-600">●</span> approximate
        </span>
      </div>
      {noGeo && count === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
          No geocoded listings match these filters yet. Listings without verified coordinates are intentionally hidden from the map — we never plot invented locations.{" "}
          <Link className="underline" href="/search">Browse all results instead →</Link>
        </div>
      )}
      <div ref={divRef} className="card z-0 h-[560px] w-full overflow-hidden" />
    </div>
  );
}
