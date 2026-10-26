// Server-side data helpers for pages (Prisma only — never used in client components).
import { prisma } from "./db";
import type { Locality } from "./types";

export async function getCityId(): Promise<string | null> {
  const city = await prisma.city.findUnique({ where: { name: "Indore" }, select: { id: true } });
  return city?.id ?? null;
}

export async function getActiveLocalities(): Promise<Locality[]> {
  const rows = await prisma.locality.findMany({
    where: { isActive: true, city: { name: "Indore" } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { slug: true, name: true, centerLat: true, centerLng: true },
  });
  return rows;
}

export interface PropertyDetail {
  id: string;
  titleNormalized: string;
  titleOriginal: string | null;
  transactionType: string;
  propertyType: string;
  price: number | null;
  currency: string;
  rentFrequency: string | null;
  carpetArea: number | null;
  builtUpArea: number | null;
  superBuiltUpArea: number | null;
  areaUnit: string | null;
  pricePerSqFt: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  furnishing: string | null;
  floorNumber: number | null;
  totalFloors: number | null;
  projectName: string | null;
  builderName: string | null;
  streetOrRoad: string | null;
  pinCode: string | null;
  description: string | null;
  constructionStatus: string | null;
  possessionDate: string | null;
  reraNumber: string | null;
  amenitiesJson: string;
  parkingAvailable: boolean | null;
  liftAvailable: boolean | null;
  gatedCommunity: boolean | null;
  lat: number | null;
  lng: number | null;
  coordPrecision: string | null;
  geoConfidence: number | null;
  availability: string;
  verificationStatus: string;
  completenessScore: number;
  isFeatured: boolean;
  featuredLabel: string | null;
  sourcePublishedAt: Date | null;
  firstDiscoveredAt: Date;
  lastCheckedAt: Date;
  lastUpdatedAt: Date;
  locality: { slug: string; name: string } | null;
  images: { url: string; rightsNote: string | null }[];
  sources: {
    id: string;
    canonicalUrl: string;
    externalId: string | null;
    availability: string;
    lastCheckedAt: Date;
    firstSeenAt: Date;
    rawTitle: string | null;
    connector: { key: string; name: string; websiteUrl: string | null };
  }[];
}

const detailInclude = {
  city: { select: { name: true } },
  locality: { select: { slug: true, name: true } },
  images: { select: { url: true, rightsNote: true }, orderBy: { sortOrder: "asc" as const }, take: 12 },
  sources: {
    select: {
      id: true, canonicalUrl: true, externalId: true, availability: true, lastCheckedAt: true,
      firstSeenAt: true, rawTitle: true,
      connector: { select: { key: true, name: true, websiteUrl: true } },
    },
    orderBy: { firstSeenAt: "asc" as const },
  },
};

export async function getPropertyDetail(id: string): Promise<PropertyDetail | null> {
  try {
    const p = await prisma.property.findUnique({ where: { id }, include: detailInclude });
    if (!p || p.city.name !== "Indore") return null; // scope guard: Indore only
    return p as unknown as PropertyDetail;
  } catch {
    return null;
  }
}

/** Duplicate candidates linked to a property (for the "same listing on other sources" block). */
export async function getPropertyDuplicateGroups(propertyId: string) {
  const cands = await prisma.duplicateCandidate.findMany({
    where: {
      OR: [{ propertyAId: propertyId }, { propertyBId: propertyId }],
      status: { not: "REJECTED" },
    },
    include: {
      propertyA: { select: { id: true, titleNormalized: true, price: true, sources: { select: { canonicalUrl: true, connector: { select: { name: true } } } } } },
      propertyB: { select: { id: true, titleNormalized: true, price: true, sources: { select: { canonicalUrl: true, connector: { select: { name: true } } } } } },
    },
    take: 20,
  });
  return cands.map((c) => ({
    id: c.id,
    classification: c.classification,
    confidence: c.confidence,
    status: c.status,
    other: c.propertyAId === propertyId ? c.propertyB : c.propertyA,
  }));
}

/** Property counts keyed by locality SLUG (resolves slugs → ids first). */
export async function countListingsByLocalitySlug(slugs: string[]) {
  if (!slugs.length) return {};
  const locs = await prisma.locality.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });
  const groups = await prisma.property.groupBy({
    by: ["localityId"],
    where: { localityId: { in: locs.map((l) => l.id) }, availability: { in: ["ACTIVE", "STALE"] } },
    _count: { _all: true },
  });
  const byId = new Map(groups.map((g) => [g.localityId, g._count._all]));
  const out: Record<string, number> = {};
  for (const l of locs) out[l.slug] = byId.get(l.id) ?? 0;
  return out;
}

/** All localities with their active listing counts (for /localities index). */
export async function localitiesWithCounts() {
  const locs = await prisma.locality.findMany({
    where: { isActive: true, city: { name: "Indore" } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { slug: true, name: true, centerLat: true, centerLng: true },
  });
  const counts = await countListingsByLocalitySlug(locs.map((l) => l.slug));
  return locs.map((l) => ({ ...l, count: counts[l.slug] ?? 0 }));
}
