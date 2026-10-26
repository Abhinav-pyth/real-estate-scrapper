import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Indore Property Finder — verified listings aggregator",
  description:
    "Search real, aggregated property listings for Indore (Madhya Pradesh). Every listing links to its original source. We never invent properties or prices.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold text-brand-700">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">IP</span>
              Indore Property Finder
            </Link>
            <nav className="flex items-center gap-4 text-sm text-slate-600">
              <Link href="/search" className="hover:text-brand-700">Search</Link>
              <Link href="/map" className="hover:text-brand-700">Map</Link>
              <Link href="/localities" className="hover:text-brand-700">Localities</Link>
              <Link href="/how-it-works" className="hover:text-brand-700">How it works</Link>
              <Link href="/login" className="btn-outline">Login</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mt-10 border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-slate-500">
            <span>Data aggregated from public/authorized sources for <b>Indore only</b>. Listings link to their original source pages.</span>
            <span><Link href="/how-it-works" className="underline">Collection policy &amp; transparency</Link></span>
          </div>
        </footer>
      </body>
    </html>
  );
}
