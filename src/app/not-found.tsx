import Link from "next/link";
export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-3 py-16 text-center">
      <h1 className="text-2xl font-bold">Page or listing not found</h1>
      <p className="text-sm text-slate-600">The listing may have been removed at the source, taken down on request, or the link is incorrect.</p>
      <Link href="/search" className="btn-primary inline-flex">Browse current listings</Link>
    </div>
  );
}
