import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, badRequest, forbidden, serverError } from "@/lib/api";
import { requireAdmin, audit } from "@/lib/auth";
import { importCsvText, importJsonText } from "@/lib/csv";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

// POST /api/admin/imports/csv — multipart form with `file` + optional `connectorKey`.
// Admin-only. Size-capped. Validates rows, detects duplicates via ingest pipeline,
// reports invalid rows, stores an import summary.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return forbidden();
  try {
    const form = await req.formData().catch(() => null);
    if (!form) return badRequest("Expected multipart/form-data with a `file` field");
    const file = form.get("file");
    if (!(file instanceof File)) return badRequest("`file` field must be a file upload");
    if (file.size > config.maxCsvBytes) return badRequest(`File too large (max ${Math.round(config.maxCsvBytes / 1024)} KB)`);
    const connectorKey = String(form.get("connectorKey") || "manual-import").slice(0, 60);
    const text = await file.text();
    const isJson = file.name.toLowerCase().endsWith(".json") || String(form.get("format")) === "JSON";
    const summary = isJson ? await importJsonText(text, connectorKey) : await importCsvText(text, connectorKey);

    const record = await prisma.dataImport.create({
      data: {
        connectorKey, fileName: file.name.slice(0, 200), format: isJson ? "JSON" : "CSV",
        status: summary.invalid > 0 && summary.imported === 0 ? "FAILED" : "COMPLETED",
        totalRows: summary.totalRows, importedRows: summary.imported, skippedDuplicates: summary.skippedDuplicates,
        invalidRows: summary.invalid, errorsJson: JSON.stringify(summary.errors.slice(0, 100)), uploadedBy: admin.id,
      },
    });
    await audit({ userId: admin.id, action: "data.import", entity: "DataImport", entityId: record.id, detail: { format: record.format, totalRows: summary.totalRows, imported: summary.imported } });
    return ok({ importId: record.id, ...summary });
  } catch (e) {
    return serverError(e);
  }
}
