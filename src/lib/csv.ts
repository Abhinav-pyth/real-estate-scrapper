// CSV/JSON import: validation, duplicate detection (via ingest pipeline), row error report.
// CSV parsing is dependency-free and quote-aware; input size is capped upstream.

import { csvRowSchema, normalizedListingSchema, type NormalizedListing } from "./types";
import { normalizeTitle } from "./format";
import { saveListing } from "./ingest";

export interface ImportSummary {
  totalRows: number;
  imported: number;
  updated: number;
  unchanged: number;
  priceChanged: number;
  skippedDuplicates: number;
  invalid: number;
  errors: Array<{ row: number; message: string }>;
}

/** Minimal RFC-4180-ish CSV parser (handles quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQuotes = false;
  // strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

export function csvToObjects(text: string): { headers: string[]; objects: Record<string, string>[] } {
  const rows = parseCsv(text);
  if (!rows.length) return { headers: [], objects: [] };
  const headers = rows[0].map((h) => h.trim());
  const objects = rows.slice(1).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => (o[h] = (r[i] ?? "").trim()));
    return o;
  });
  return { headers, objects };
}

const REQUIRED_HEADERS = ["canonicalUrl", "title", "transactionType", "propertyType", "city"];

export function validateCsvHeaders(headers: string[]): string[] {
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  return missing;
}

export function rowToListing(obj: Record<string, string>, connectorKey: string): NormalizedListing {
  const parsed = csvRowSchema.parse(obj);
  const listing: NormalizedListing = {
    connectorKey,
    externalId: parsed.externalId ?? null,
    canonicalUrl: parsed.canonicalUrl,
    titleOriginal: parsed.title,
    titleNormalized: normalizeTitle(parsed.title),
    transactionType: parsed.transactionType,
    propertyType: parsed.propertyType,
    price: parsed.price ?? null,
    currency: "INR",
    rentFrequency: parsed.rentFrequency ?? null,
    carpetArea: parsed.carpetArea ?? null,
    builtUpArea: parsed.builtUpArea ?? null,
    superBuiltUpArea: null,
    areaUnit: parsed.areaUnit ?? "SQFT",
    bedrooms: parsed.bedrooms ?? null,
    bathrooms: parsed.bathrooms ?? null,
    furnishing: parsed.furnishing ?? null,
    floorNumber: null,
    totalFloors: null,
    projectName: parsed.projectName ?? null,
    builderName: parsed.builderName ?? null,
    streetOrRoad: null,
    pinCode: parsed.pinCode ?? null,
    localitySlug: parsed.locality ? slugify(parsed.locality) : null,
    city: "Indore",
    state: "Madhya Pradesh",
    lat: parsed.lat ?? null,
    lng: parsed.lng ?? null,
    coordPrecision: parsed.lat != null && parsed.lng != null ? "EXACT" : "NONE",
    geoConfidence: null,
    description: parsed.description ?? null,
    imageUrls: parsed.imageUrl ? [parsed.imageUrl] : [],
    constructionStatus: null,
    possessionDate: null,
    reraNumber: parsed.reraNumber ?? null,
    amenities: [],
    parkingAvailable: null,
    liftAvailable: null,
    gatedCommunity: null,
    sourcePublishedAt: parsed.sourcePublishedAt ? new Date(parsed.sourcePublishedAt) : null,
  };
  return listing;
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
}

export async function importCsvText(text: string, connectorKey: string): Promise<ImportSummary> {
  const summary: ImportSummary = { totalRows: 0, imported: 0, updated: 0, unchanged: 0, priceChanged: 0, skippedDuplicates: 0, invalid: 0, errors: [] };
  const { headers, objects } = csvToObjects(text);
  const missing = validateCsvHeaders(headers);
  if (missing.length) {
    summary.errors.push({ row: 0, message: `Missing required columns: ${missing.join(", ")}` });
    return summary;
  }
  summary.totalRows = objects.length;

  const seenUrls = new Set<string>();
  for (let i = 0; i < objects.length; i++) {
    const rowNum = i + 2; // 1-based incl header
    const obj = objects[i];
    const p = csvRowSchema.safeParse(obj);
    if (!p.success) {
      summary.invalid++;
      summary.errors.push({ row: rowNum, message: p.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") });
      continue;
    }
    const urlKey = obj.canonicalUrl.replace(/\/+$/, "");
    if (seenUrls.has(urlKey)) {
      summary.skippedDuplicates++;
      continue;
    }
    seenUrls.add(urlKey);
    try {
      const listing = rowToListing(obj, connectorKey);
      const v = normalizedListingSchema.safeParse(listing);
      if (!v.success) {
        summary.invalid++;
        summary.errors.push({ row: rowNum, message: v.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") });
        continue;
      }
      const out = await saveListing(listing);
      if (out.status === "NEW") summary.imported++;
      else if (out.status === "UPDATED") summary.updated++;
      else if (out.status === "PRICE_CHANGED") summary.priceChanged++;
      else summary.unchanged++;
    } catch (e) {
      summary.invalid++;
      summary.errors.push({ row: rowNum, message: (e as Error).message });
    }
  }
  return summary;
}

export async function importJsonText(text: string, connectorKey: string): Promise<ImportSummary> {
  const summary: ImportSummary = { totalRows: 0, imported: 0, updated: 0, unchanged: 0, priceChanged: 0, skippedDuplicates: 0, invalid: 0, errors: [] };
  let data: unknown;
  try { data = JSON.parse(text); } catch (e) {
    summary.errors.push({ row: 0, message: "Invalid JSON: " + (e as Error).message });
    return summary;
  }
  const items = Array.isArray(data) ? data : (data as { listings?: unknown[] })?.listings;
  if (!Array.isArray(items)) {
    summary.errors.push({ row: 0, message: 'Expected a JSON array or { "listings": [...] }' });
    return summary;
  }
  summary.totalRows = items.length;
  const seen = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    try {
      const raw = items[i] as Record<string, unknown>;
      const obj: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw)) if (v != null) obj[k] = String(v);
      const listing = rowToListing({ ...obj, locality: raw.locality ? String(raw.locality) : undefined } as Record<string, string>, connectorKey);
      const key = listing.canonicalUrl.replace(/\/+$/, "");
      if (seen.has(key)) { summary.skippedDuplicates++; continue; }
      seen.add(key);
      const v = normalizedListingSchema.safeParse(listing);
      if (!v.success) { summary.invalid++; summary.errors.push({ row: i + 1, message: v.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") }); continue; }
      const out = await saveListing(listing);
      if (out.status === "NEW") summary.imported++;
      else if (out.status === "UPDATED") summary.updated++;
      else if (out.status === "PRICE_CHANGED") summary.priceChanged++;
      else summary.unchanged++;
    } catch (e) {
      summary.invalid++;
      summary.errors.push({ row: i + 1, message: (e as Error).message });
    }
  }
  return summary;
}
