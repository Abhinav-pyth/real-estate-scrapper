import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";

export const metadata: Metadata = {
  title: "How we collect property data — transparency & policy | Indore Property Finder",
  description: "Our data collection policy: robots.txt and ToS compliance, authorized feeds only, CSV/JSON imports, duplicate handling, coordinate rules and takedown process.",
  alternates: { canonical: "/how-it-works" },
};

export default async function HowItWorksPage() {
  const connectors = await prisma.sourceConnector.findMany({ orderBy: { name: "asc" } });
  const statusLabel: Record<string, string> = {
    NOT_CONFIGURED: "Not configured",
    PERMITTED_API: "Permitted API (needs credentials)",
    PERMITTED_FEED: "Permitted feed (needs URL)",
    IMPORT_ONLY: "Import-only (CSV/JSON by licensed providers)",
    DISABLED_BY_POLICY: "Disabled — automated collection not permitted",
  };
  const statusColor: Record<string, string> = {
    NOT_CONFIGURED: "bg-slate-100 text-slate-600",
    PERMITTED_API: "bg-blue-50 text-blue-700",
    PERMITTED_FEED: "bg-blue-50 text-blue-700",
    IMPORT_ONLY: "bg-emerald-50 text-emerald-700",
    DISABLED_BY_POLICY: "bg-red-50 text-red-700",
  };

  return (
    <div className="prose-sm mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">How Indore Property Finder collects data</h1>

      <section className="card space-y-2 p-5 text-sm leading-relaxed text-slate-700">
        <h2 className="text-lg font-bold text-slate-900">Our rules</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>We check each source&apos;s robots.txt, terms of service and technical access controls before collecting anything.</li>
          <li>We <b>never</b> bypass CAPTCHAs, logins, paywalls or anti-bot systems.</li>
          <li>Where automated collection is not permitted, the connector stays disabled and is marked honestly below.</li>
          <li>We prefer official APIs, licensed feeds, partner integrations and explicitly authorized scraping.</li>
          <li>Administrators can import datasets from providers who hold the rights (CSV/JSON), with full validation.</li>
          <li>We never fabricate listings, prices, URLs or coordinates. Missing data is shown as “not available”.</li>
          <li>Personal contact details are not collected or republished.</li>
          <li>Listings that a source asks us to remove are taken down promptly (see takedown section).</li>
        </ul>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-bold">Source connectors — live status</h2>
        <p className="text-sm text-slate-600">Statuses come directly from the database and reflect actual configuration — nothing is pretended to work.</p>
        <table className="w-full text-left text-xs">
          <thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-2">Source</th><th>Status</th><th className="hidden sm:table-cell">Notes</th></tr></thead>
          <tbody>
            {connectors.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 align-top">
                <td className="py-2 font-medium">{c.name}{c.websiteUrl ? <> <a className="text-slate-400" href={c.websiteUrl} rel="nofollow noopener noreferrer" target="_blank">↗</a></> : null}</td>
                <td className="py-2"><span className={`badge ${statusColor[c.status] ?? "bg-slate-100"}`}>{statusLabel[c.status] ?? c.status}</span>{c.enabled ? <span className="badge ml-1 bg-emerald-600 text-white">active</span> : null}</td>
                <td className="hidden py-2 text-slate-500 sm:table-cell">{c.robotsNote}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card space-y-2 p-5 text-sm leading-relaxed text-slate-700">
        <h2 className="text-lg font-bold">Coordinates &amp; map honesty</h2>
        <p>Latitude/longitude values come only from source-provided data or an authorized geocoding provider (e.g. Nominatim/Google). Each point stores its precision: <b>exact</b> (green marker) or <b>approximate locality area</b> (amber marker). Approximate points are never presented as exact property locations, and listings without verified coordinates are omitted from the map entirely.</p>
      </section>

      <section className="card space-y-2 p-5 text-sm leading-relaxed text-slate-700">
        <h2 className="text-lg font-bold">Duplicates &amp; price statistics</h2>
        <p>The same home may appear on several portals. Our engine flags likely duplicates using listing IDs, URLs, titles, geometry and price signals, but uncertain matches are never silently merged — every source record keeps its own price, area and original URL.</p>
        <p>Locality price figures are <b>asking prices from collected listings</b>, not registered transaction values or government guidance prices. Small samples are withheld rather than published as misleading averages.</p>
      </section>

      <section className="card space-y-2 p-5 text-sm leading-relaxed text-slate-700">
        <h2 className="text-lg font-bold">Takedown requests</h2>
        <p>Are you a portal, builder, agent or homeowner and want a listing removed or corrected? Email <a className="underline" href={`mailto:legal@${new URL(config.appUrl).hostname}`}>legal@{new URL(config.appUrl).hostname}</a> with the listing URL(s). We verify and remove within 7 days; removals are recorded in our audit trail.</p>
      </section>

      <p className="text-xs text-slate-500">
        Scope: this release covers <b>Indore, Madhya Pradesh, India only</b>. Listings from other cities are rejected at ingestion even if similarly named. See also <Link href="/about/data-policy" className="underline">data retention policy</Link>.
      </p>
    </div>
  );
}
