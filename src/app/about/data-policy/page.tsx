import type { Metadata } from "next";
export const metadata: Metadata = { title: "Data retention & privacy policy — Indore Property Finder", alternates: { canonical: "/about/data-policy" } };
export default function DataPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 text-sm leading-relaxed text-slate-700">
      <h1 className="text-2xl font-bold">Data retention &amp; privacy</h1>
      <section className="card space-y-2 p-5"><h2 className="font-bold">What we store about listings</h2><p>Normalized fields, the original source URL, timestamps of each re-check, and a raw payload snapshot for auditing. Personal contact details of sellers/agents are not collected or displayed.</p></section>
      <section className="card space-y-2 p-5"><h2 className="font-bold">Retention</h2><p>Active listings remain while the source keeps them available. Listings missing from three consecutive syncs are marked unavailable and archived after 90 days. Raw snapshots are purged after 18 months. Price observations are kept long-term for trend honesty.</p></section>
      <section className="card space-y-2 p-5"><h2 className="font-bold">User accounts</h2><p>We store your email, name (optional), a bcrypt password hash, session records and saved searches. Delete your account any time via the account page request email; deletion is completed within 30 days including sessions and saved data.</p></section>
      <section className="card space-y-2 p-5"><h2 className="font-bold">Cookies &amp; analytics</h2><p>Only a functional session cookie when you sign in. No third-party advertising cookies are set unless you configure an ads provider (see README).</p></section>
      <section className="card space-y-2 p-5"><h2 className="font-bold">Takedowns &amp; corrections</h2><p>Contact legal@your-domain to request removal under applicable law or source agreements. We action verified requests within 7 days and log the change.</p></section>
    </div>
  );
}
