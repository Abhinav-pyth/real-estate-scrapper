import Link from "next/link";
import { prisma } from "@/lib/db";
import ImportForm from "@/components/admin/ImportForm";

export const dynamic = "force-dynamic";

const TEMPLATE_CSV = `canonicalUrl,title,transactionType,propertyType,price,carpetArea,areaUnit,bedrooms,bathrooms,furnishing,projectName,builderName,locality,pinCode,city,lat,lng,description,imageUrl,reraNumber,externalId,rentFrequency,sourcePublishedAt
https://your-agency-site.example/indore/listings/1001,3 BHK apartment in Vijay Nagar,SALE,APARTMENT,8500000,1150,SQFT,3,2,SEMI_FURNISHED,Crystal Enclave,,Vijay Nagar,452011,Indore,,,,,,,1001,,2026-09-14
https://your-agency-site.example/indore/listings/1002,2 BHK flat for rent near Super Corridor,RENT,APARTMENT,18000,950,SQFT,2,2,UNFURNISHED,,,Super Corridor,452010,Indore,,,,,,,1002,MONTHLY,`;

// Optional connector keys that accept imports (IMPORT_ONLY + manual import target).
async function importConnectors() {
  const rows = await prisma.sourceConnector.findMany({
    where: { OR: [{ status: "IMPORT_ONLY" }, { key: "manual-import" }] },
    select: { key: true, name: true },
    orderBy: { name: "asc" },
  });
  if (!rows.some((r) => r.key === "manual-import")) rows.unshift({ key: "manual-import", name: "Manual / agency import" });
  return rows;
}

export default async function AdminImportsPage() {
  const [imports, connectors] = await Promise.all([
    prisma.dataImport.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    importConnectors(),
  ]);

  return (
    <div className="space-y-4">
      <ImportForm connectors={connectors} />

      <p className="text-xs text-slate-600">
        CSV template headers (copy into your own file — replace the example URLs with listings you are authorized to publish):
      </p>
      <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-700">{TEMPLATE_CSV}</pre>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Import history</h2>
        {imports.length === 0 ? <p className="text-xs text-slate-500">No imports yet.</p> : (
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500"><tr><th className="py-1">When</th><th>File</th><th>Format</th><th>Rows</th><th>Imported</th><th>Dup-skipped</th><th>Invalid</th><th>Status</th></tr></thead>
            <tbody>
              {imports.map((im) => {
                let errs: { row: number; message: string }[] = [];
                try { errs = JSON.parse(im.errorsJson); } catch { /* keep empty */ }
                return (
                  <tr key={im.id} className="border-t border-slate-100">
                    <td className="py-1.5">{im.createdAt.toLocaleString("en-IN")}</td>
                    <td>{im.fileName}</td><td>{im.format}</td><td>{im.totalRows}</td><td>{im.importedRows}</td>
                    <td>{im.skippedDuplicates}</td>
                    <td className={im.invalidRows > 0 ? "text-amber-700" : ""}>{im.invalidRows}</td>
                    <td className={im.status === "FAILED" ? "text-red-600" : "text-brand-700"}>{im.status}</td>
                    {errs.length > 0 && (
                      <td colSpan={4} className="text-[10px] text-red-600">
                        {errs.slice(0, 5).map((e) => <div key={`${im.id}-${e.row}`}>row {e.row}: {e.message}</div>)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <p className="text-xs text-slate-500">
        See <Link href="/about/data-policy" className="underline">data policy</Link> — import only data you have rights to use. Invalid rows are reported, never silently dropped.
      </p>
    </div>
  );
}
