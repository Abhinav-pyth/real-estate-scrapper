import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { SearchParams } from "./types";
import { haversineKm } from "./format";

// Builds DB-level where clauses for validated search params.
// SQLite-compatible: no raw SQL, no Postgres-specific operators.
export function buildWhere(p: SearchParams, cityId: string): Prisma.PropertyWhereInput {
  const where: Prisma.PropertyWhereInput = {
    cityId,
    availability: p.availability,
  };

  if (p.transactionType) where.transactionType = p.transactionType;
  if (p.propertyType) where.propertyType = p.propertyType;
  if (p.minPrice != null || p.maxPrice != null) {
    where.price = {};
    if (p.minPrice != null) (where.price as Prisma.IntNullableFilter).gte = p.minPrice;
    if (p.maxPrice != null) (where.price as Prisma.IntNullableFilter).lte = p.maxPrice;
  }
  if (p.minCarpetArea != null || p.maxCarpetArea != null) {
    where.carpetArea = {};
    if (p.minCarpetArea != null) (where.carpetArea as Prisma.FloatNullableFilter).gte = p.minCarpetArea;
    if (p.maxCarpetArea != null) (where.carpetArea as Prisma.FloatNullableFilter).lte = p.maxCarpetArea;
  }
  if (p.bedrooms != null) {
    where.bedrooms = p.bedrooms >= 5 ? { gte: 5 } : p.bedrooms; // "5+" bucket
  }
  if (p.bathrooms != null) where.bathrooms = { gte: p.bathrooms };
  if (p.furnishing) where.furnishing = p.furnishing;
  if (p.constructionStatus) where.constructionStatus = p.constructionStatus;
  if (p.gatedCommunity != null) where.gatedCommunity = p.gatedCommunity;
  if (p.parking != null) where.parkingAvailable = p.parking;
  if (p.lift != null) where.liftAvailable = p.lift;
  if (p.hasCoordinates) {
    where.lat = { not: null };
    where.lng = { not: null };
  }
  if (p.verified) where.verificationStatus = "VERIFIED";
  if (p.incomplete) where.completenessScore = { lt: 55 };

  if (p.locality) where.locality = { slug: p.locality };

  if (p.source) where.sources = { some: { connector: { key: p.source } } };

  if (p.hasImages) where.images = { some: {} };

  if (p.priceReduced) {
    where.observations = { some: { changeType: "PRICE_DECREASE" } };
  }

  // Bounding box: bbox = lat1,lng1,lat2,lng2 (any corners)
  if (p.bbox) {
    const [a, b, c, d] = p.bbox.split(",").map(Number);
    const minLat = Math.min(a, c), maxLat = Math.max(a, c);
    const minLng = Math.min(b, d), maxLng = Math.max(b, d);
    where.lat = { not: null, gte: minLat, lte: maxLat };
    where.lng = { not: null, gte: minLng, lte: maxLng };
  }

  // Free-text q: locality name/slug, project, road, PIN, title keywords
  if (p.q) {
    const q = p.q.trim();
    const like: Prisma.PropertyWhereInput = {
      OR: [
        { titleNormalized: { contains: q.toLowerCase() } },
        { projectName: { contains: q } },
        { builderName: { contains: q } },
        { streetOrRoad: { contains: q } },
        { pinCode: { startsWith: q } },
        { locality: { name: { contains: q } } },
        { locality: { slug: { contains: q.toLowerCase().replace(/\s+/g, "-") } } },
      ],
    };
    where.AND = [...(((where.AND as Prisma.PropertyWhereInput[]) || [])), like];
  }

  return where;
}

// SQLite does not support Prisma's `nulls: "last"` ordering modifier.
function order(p: SearchParams): Prisma.PropertyOrderByWithRelationInput[] {
  const base = orderBy(p);
  return base.map((o) => {
    const v = (o as Record<string, { sort?: string } | string>);
    for (const k of Object.keys(v)) {
      const val = v[k];
      if (typeof val === "object" && val && "sort" in val) {
        // plain direction only — null handling differs by DB; prices are rarely null after normalization
        return { [k]: (val as { sort: string }).sort } as Prisma.PropertyOrderByWithRelationInput;
      }
    }
    return o;
  });
}

function orderBy(p: SearchParams): Prisma.PropertyOrderByWithRelationInput[] {
  switch (p.sort) {
    case "price_asc": return [{ price: { sort: "asc", nulls: "last" } as never }, { firstDiscoveredAt: "desc" }];
    case "price_desc": return [{ price: { sort: "desc", nulls: "last" } as never }];
    case "updated": return [{ lastUpdatedAt: "desc" }];
    case "area_desc": return [{ carpetArea: { sort: "desc", nulls: "last" } as never }];
    case "psf_asc": return [{ pricePerSqFt: { sort: "asc", nulls: "last" } as never }];
    case "distance": return [{ lastCheckedAt: "desc" }]; // refined post-query in memory
    default: return [{ firstDiscoveredAt: "desc" }];
  }
}

export async function searchProperties(p: SearchParams) {
  const city = await prisma.city.findUnique({ where: { name: "Indore" } });
  if (!city) return { items: [], total: 0 };
  const where = buildWhere(p, city.id);

  // Radius search: fetch candidates by coarse bbox around point, then filter precisely.
  if (p.nearLat != null && p.nearLng != null && p.radiusKm != null) {
    const dLat = p.radiusKm / 111;
    const dLng = p.radiusKm / (111 * Math.cos((p.nearLat * Math.PI) / 180));
    where.lat = { not: null, gte: p.nearLat - dLat, lte: p.nearLat + dLat };
    where.lng = { not: null, gte: p.nearLng - dLng, lte: p.nearLng + dLng };
  }

  const include = {
    locality: { select: { slug: true, name: true } },
    images: { select: { url: true }, take: 1, orderBy: { sortOrder: "asc" as const } },
    sources: { select: { id: true, canonicalUrl: true, connectorId: true, connector: { select: { key: true, name: true } } }, take: 6 },
  } satisfies Prisma.PropertyInclude;

  let items: Prisma.PropertyGetPayload<{ include: typeof include }>[];
  let total: number;

  if (p.sort === "distance" && p.nearLat != null && p.nearLng != null) {
    // distance sort needs full candidate set within radius — cap at 500 to stay honest & fast
    const all = await prisma.property.findMany({ where, include, take: 500 });
    const scored = all.map((it) => ({
      it,
      km: it.lat != null && it.lng != null ? haversineKm(p.nearLat!, p.nearLng!, it.lat, it.lng) : Infinity,
    }));
    scored.sort((x, y) => x.km - y.km);
    total = scored.length;
    items = scored.slice((p.page - 1) * p.limit, p.page * p.limit).map((s) => s.it);
  } else {
    const [count, rows] = await Promise.all([
      prisma.property.count({ where }),
      prisma.property.findMany({
        where,
        include,
        orderBy: order(p),
        skip: (p.page - 1) * p.limit,
        take: p.limit,
      }),
    ]);
    total = count;
    items = rows;
  }

  return { items, total, cityId: city.id };
}
