// Duplicate detection engine.
// Signals (weighted): external ID cross-ref, canonical URL equality, normalized title,
// project name, locality, property type, area (±5%), bedrooms, price (±2%), geo proximity.
// Confidence 0..1 → CONFIRMED (≥0.9), LIKELY (≥0.75), POSSIBLE (≥0.55). Below that: unique.
// We NEVER auto-merge on price/address similarity alone; only CONFIRMED pairs are merged
// automatically, and even then both source records are preserved as PropertySource rows.

import { haversineKm, normalizeTitle } from "./format";

export interface DupInput {
  id: string;
  externalId?: string | null;
  connectorKey: string;
  canonicalUrl: string;
  titleNormalized: string;
  projectName?: string | null;
  localityName?: string | null;
  propertyType: string;
  transactionType: string;
  price?: number | null;
  carpetArea?: number | null;
  builtUpArea?: number | null;
  bedrooms?: number | null;
  lat?: number | null;
  lng?: number | null;
  coordPrecision?: string | null;
}

export interface DupSignals {
  sameCanonicalUrl: boolean;
  sameNormalizedTitle: boolean;
  sameProject: boolean;
  sameLocality: boolean;
  samePropertyType: boolean;
  sameTransaction: boolean;
  areaClose: boolean;
  bedroomsEqual: boolean;
  priceClose: boolean;
  geoClose: boolean; // <300m AND exact precision on both sides
}

export interface DupResult {
  confidence: number;
  classification: "CONFIRMED" | "LIKELY" | "POSSIBLE" | "UNIQUE";
  signals: DupSignals;
}

const WEIGHTS = {
  sameCanonicalUrl: 0.45,
  geoClose: 0.18,
  sameNormalizedTitle: 0.15,
  sameProject: 0.12,
  areaClose: 0.1,
  priceClose: 0.08,
  bedroomsEqual: 0.05,
  sameLocality: 0.04,
  samePropertyType: 0.03,
};

export function detectDuplicates(a: DupInput, b: DupInput): DupResult {
  const signals: DupSignals = {
    sameCanonicalUrl: normUrl(a.canonicalUrl) === normUrl(b.canonicalUrl),
    sameNormalizedTitle: a.titleNormalized.length > 10 && a.titleNormalized === b.titleNormalized,
    sameProject: !!(a.projectName && b.projectName && normCi(a.projectName) === normCi(b.projectName)),
    sameLocality: !!(a.localityName && b.localityName && normCi(a.localityName) === normCi(b.localityName)),
    samePropertyType: a.propertyType === b.propertyType,
    sameTransaction: a.transactionType === b.transactionType,
    areaClose: areasClose(a, b),
    bedroomsEqual: a.bedrooms != null && a.bedrooms === b.bedrooms,
    priceClose: pricesClose(a.price, b.price),
    geoClose:
      a.lat != null && a.lng != null && b.lat != null && b.lng != null &&
      a.coordPrecision === "EXACT" && b.coordPrecision === "EXACT" &&
      haversineKm(a.lat, a.lng, b.lat, b.lng) < 0.3,
  };

  // Hard requirement: different sources only (same source+URL is handled by upsert identity)
  if (a.connectorKey === b.connectorKey && signals.sameCanonicalUrl) {
    return { confidence: 1, classification: "CONFIRMED", signals };
  }

  // Transaction/type mismatch ⇒ cannot be duplicate
  if (!signals.sameTransaction || !signals.samePropertyType) {
    return { confidence: 0, classification: "UNIQUE", signals };
  }

  let score = 0;
  for (const [k, w] of Object.entries(WEIGHTS)) {
    if ((signals as Record<string, boolean>)[k]) score += w;
  }
  score = Math.min(1, score);

  const classification =
    score >= 0.9 ? "CONFIRMED" : score >= 0.75 ? "LIKELY" : score >= 0.55 ? "POSSIBLE" : "UNIQUE";
  return { confidence: Number(score.toFixed(3)), classification, signals };
}

function normUrl(u: string): string {
  try {
    const url = new URL(u);
    return (url.host + url.pathname).replace(/\/+$/, "").toLowerCase();
  } catch {
    return u.toLowerCase();
  }
}

function normCi(s: string): string {
  return normalizeTitle(s).replace(/\b(the|a|an|of)\b/g, "").trim();
}

function pricesClose(pa?: number | null, pb?: number | null): boolean {
  if (pa == null || pb == null || pa <= 0 || pb <= 0) return false;
  return Math.abs(pa - pb) / Math.max(pa, pb) <= 0.02; // within 2%
}

function bestArea(x: DupInput): number | null {
  return x.carpetArea ?? x.builtUpArea ?? null;
}

function areasClose(a: DupInput, b: DupInput): boolean {
  const aa = bestArea(a), ab = bestArea(b);
  if (aa == null || ab == null || aa <= 0 || ab <= 0) return false;
  return Math.abs(aa - ab) / Math.max(aa, ab) <= 0.05; // within 5%
}

/** Group helper: given candidate pairs, produce clusters via union-find (CONFIRMED/LIKELY only). */
export function clusterPairs(ids: string[], pairs: Array<[string, string]>): string[][] {
  const parent = new Map<string, string>(ids.map((i) => [i, i]));
  const find = (x: string): string => {
    while (parent.get(x) !== x) x = parent.get(x)!;
    return x;
  };
  for (const [a, b] of pairs) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }
  const groups = new Map<string, string[]>();
  for (const i of ids) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(i);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}
