// Locality-level asking-price statistics computed from ACTUAL collected listings only.
// These are ASKING prices from aggregated sources — not transaction values or government guidance.
// Small samples are honestly reported; the UI hides stats below MIN_SAMPLE.

import { prisma } from "./db";

export const MIN_SAMPLE_STATS = 3; // avoid publishing meaningless averages on tiny samples

export interface LocalityPriceStats {
  locality: string;
  slug: string;
  sampleSize: number;
  medianAskingPrice: number | null;
  averageAskingPrice: number | null;
  medianPricePerSqFt: number | null;
  avgPricePerSqFt: number | null;
  psfSampleSize: number;
  budgetBuckets: Record<string, number>;
  collectedThrough: string; // ISO date of newest observation used
  warnings: string[];
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}
function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

const BUY_BUCKETS: Array<[string, number, number | null]> = [
  ["<10L", 0, 1_000_000], ["10-20L", 1_000_000, 2_000_000], ["20-30L", 2_000_000, 3_000_000],
  ["30-50L", 3_000_000, 5_000_000], ["50-75L", 5_000_000, 7_500_000], ["75L-1Cr", 7_500_000, 10_000_000],
  ["1-2Cr", 10_000_000, 20_000_000], ["2Cr+", 20_000_000, null],
];

export async function getLocalityPriceStats(params: {
  slug: string;
  transactionType?: string;
  propertyType?: string;
}): Promise<LocalityPriceStats | null> {
  const locality = await prisma.locality.findUnique({ where: { slug: params.slug } });
  if (!locality) return null;

  const where: Record<string, unknown> = {
    localityId: locality.id,
    availability: { in: ["ACTIVE", "STALE"] },
  };
  if (params.transactionType) where.transactionType = params.transactionType;
  if (params.propertyType) where.propertyType = params.propertyType;

  const rows = await prisma.property.findMany({
    where,
    select: { price: true, pricePerSqFt: true, lastUpdatedAt: true },
    take: 2000,
  });

  const warnings: string[] = [];
  const prices = rows.map((r) => r.price).filter((x): x is number => x != null && x > 0);
  const psfs = rows.map((r) => r.pricePerSqFt).filter((x): x is number => x != null && x > 0);

  if (rows.length < MIN_SAMPLE_STATS) {
    warnings.push(`Sample size ${rows.length} is too small for meaningful statistics.`);
  }

  const buckets: Record<string, number> = {};
  for (const [label, min, max] of BUY_BUCKETS) {
    buckets[label] = prices.filter((p) => p >= min && (max == null || p < max)).length;
  }

  const newest = rows.reduce<Date | null>((acc, r) => {
    if (!r.lastUpdatedAt) return acc;
    return !acc || r.lastUpdatedAt > acc ? r.lastUpdatedAt : acc;
  }, null);

  return {
    locality: locality.name,
    slug: locality.slug,
    sampleSize: rows.length,
    medianAskingPrice: median(prices),
    averageAskingPrice: avg(prices),
    medianPricePerSqFt: median(psfs),
    avgPricePerSqFt: avg(psfs),
    psfSampleSize: psfs.length,
    budgetBuckets: buckets,
    collectedThrough: (newest ?? new Date()).toISOString(),
    warnings,
  };
}

/** Historical asking-price observations for one property (never invented). */
export async function getPropertyPriceHistory(propertyId: string) {
  const obs = await prisma.propertyObservation.findMany({
    where: { propertyId, price: { not: null } },
    orderBy: { observedAt: "asc" },
    select: { observedAt: true, price: true, changeType: true },
    take: 500,
  });
  const points = obs.map((o) => ({ date: o.observedAt.toISOString(), price: o.price as number, changeType: o.changeType }));
  let initial: number | null = null, previous: number | null = null, current: number | null = null;
  let increases = 0, decreases = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i].price;
    if (initial == null) initial = p;
    if (i > 0 && previous != null) {
      if (p > previous) increases++;
      else if (p < previous) decreases++;
    }
    previous = p; current = p;
  }
  return { points, initial, current, previous: points.length > 1 ? points[points.length - 2]?.price ?? null : null, increases, decreases, hasEnoughData: points.length >= 2 };
}
