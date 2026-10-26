import type { AreaUnit } from "./types";

/** Convert an area value in the given unit to square feet. Returns null if unit unknown. */
export function toSqft(value: number, unit: AreaUnit | string | null | undefined): number | null {
  switch (unit) {
    case "SQFT": return value;
    case "SQYD": return value * 9;
    case "SQUARE_METER": return value * 10.7639104;
    case "GUNTHA": return value * 1089;
    case "BIGHA": return value * 27225; // MP bigha ≈ 27225 sqft (varies regionally; used only for rough PSF)
    case "HECTARE": return value * 107639.104;
    case "ACRE": return value * 43560;
    default: return null;
  }
}

/**
 * Compute price per square foot ONLY when price and a compatible area exist.
 * Prefers carpet area, then built-up, then super built-up — never mixes incompatible units.
 * Returns null rather than inventing a value.
 */
export function computePricePerSqFt(input: {
  price?: number | null;
  carpetArea?: number | null;
  builtUpArea?: number | null;
  superBuiltUpArea?: number | null;
  areaUnit?: string | null;
}): number | null {
  const { price } = input;
  if (!price || price <= 0) return null;
  const candidates: (number | null | undefined)[] = [input.carpetArea, input.builtUpArea, input.superBuiltUpArea];
  for (const a of candidates) {
    if (a && a > 0) {
      const sqft = toSqft(a, input.areaUnit ?? "SQFT");
      if (sqft && sqft > 0) return Math.round(price / sqft);
    }
  }
  return null;
}

/** Format INR price the Indian way: ₹25 L, ₹75 L, ₹1.2 Cr, ₹8,500/month etc. */
export function formatPriceINR(price?: number | null, opts?: { rent?: boolean }): string {
  if (price == null || !Number.isFinite(price)) return "Price not available";
  if (price >= 1_00_00_000) {
    const cr = price / 1_00_00_000;
    return `₹${trim(cr)} Cr`;
  }
  if (price >= 1_00_000) {
    const l = price / 1_00_000;
    return `₹${trim(l)} L`;
  }
  return `₹${price.toLocaleString("en-IN")}${opts?.rent ? "/month" : ""}`;
}

function trim(n: number): string {
  return n >= 10 ? String(Math.round(n)) : String(Math.round(n * 100) / 100);
}

export function formatPsf(psf?: number | null): string {
  if (psf == null) return "—";
  return `₹${Math.round(psf).toLocaleString("en-IN")}/sqft`;
}

/** Data completeness score 0–100 based on presence of key fields. Honest metric, never guesses values. */
export function completenessScore(fields: Record<string, unknown>): number {
  const weighted: Array<[string, number]> = [
    ["titleNormalized", 8],
    ["canonicalUrl", 8],
    ["transactionType", 6],
    ["propertyType", 6],
    ["price", 15],
    ["localityId", 10],
    ["areaUnit", 5],
    ["carpetArea", 8],
    ["bedrooms", 6],
    ["bathrooms", 4],
    ["projectName", 5],
    ["description", 5],
    ["imageUrls", 8],
    ["lat", 6],
    ["pinCode", 4],
    ["reraNumber", 3],
    ["furnishing", 3],
  ];
  let total = 0;
  let max = 0;
  for (const [k, w] of weighted) {
    max += w;
    const v = fields[k];
    if (v != null && v !== "" && !(Array.isArray(v) && v.length === 0)) total += w;
  }
  return Math.round((total / max) * 100);
}

/** Normalize a listing title for matching: lowercase, strip punctuation/whitespace noise. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Haversine distance in km between two coordinates. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
