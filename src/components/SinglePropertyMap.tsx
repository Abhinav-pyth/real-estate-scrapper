"use client";
import { useEffect, useRef } from "react";

// Small single-marker map for the property detail page (Leaflet, no key needed).
export default function SinglePropertyMap({ lat, lng, precision }: { lat: number; lng: number; precision: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (!document.querySelector("#leaflet-single-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-single-css"; link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      if (cancelled || !ref.current) return;
      const map = L.map(ref.current, { zoomControl: true, scrollWheelZoom: false }).setView([lat, lng], precision === "EXACT" ? 16 : 13);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; CARTO',
        maxZoom: 19,
      }).addTo(map);
      const color = precision === "EXACT" ? "#16a34a" : "#d97706";
      L.circleMarker([lat, lng], { radius: 10, color, fillColor: color, fillOpacity: 0.8, weight: 2 })
        .addTo(map)
        .bindPopup(precision === "EXACT" ? "Listing location (source-provided)" : "Approximate locality area — not the exact address");
    })();
    return () => { cancelled = true; };
  }, [lat, lng, precision]);
  return <div ref={ref} className="z-0 h-64 w-full overflow-hidden rounded-lg border border-slate-200" />;
}
