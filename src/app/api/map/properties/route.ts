import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, badRequest, serverError, rateLimited, clientKey, tooManyRequests } from "@/lib/api";
import { haversineKm } from "@/lib/format";

export const dynamic = "force-dynamic";

const mapSchema = z.object({
  bbox: z.string().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/).optional(),
  nearLat: z.coerce.number().min(-90).max(90).optional(),
  nearLng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(50).optional(),
  transactionType: z.enum(["SALE", "RENT", "COMMERCIAL_SALE", "COMMERCIAL_RENT"]).optional(),
  propertyType: z.string().max(40).optional(),
  maxPrice: z.coerce.number().int().positive().optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  bedrooms: z.coerce.number().int().min(1).max(10).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(300),
});

// GET /api/map/properties — lightweight marker payload for the interactive map.
// Returns ONLY properties that actually have coordinates; approximate vs exact is flagged.
export async function GET(req: NextRequest) {
  if (rateLimited(clientKey(req))) return tooManyRequests();
  try {
    const parsed = mapSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    if (!parsed.success) return badRequest("Invalid map parameters", parsed.error.issues);
    const p = parsed.data;

    const where: Record<string, unknown> = {
      city: { name: "Indore" },
      availability: { in: ["ACTIVE", "STALE"] },
      lat: { not: null },
      lng: { not: null },
    };
    if (p.transactionType) where.transactionType = p.transactionType;
    if (p.propertyType) where.propertyType = p.propertyType;
    if (p.minPrice != null || p.maxPrice != null) {
      const f: Record<string, number> = {};
      if (p.minPrice != null) f.gte = p.minPrice;
      if (p.maxPrice != null) f.lte = p.maxPrice;
      where.price = f;
    }
    if (p.bedrooms != null) where.bedrooms = p.bedrooms >= 5 ? { gte: 5 } : p.bedrooms;

    if (p.bbox) {
      const [a, b, c, d] = p.bbox.split(",").map(Number);
      where.lat = { not: null, gte: Math.min(a, c), lte: Math.max(a, c) };
      where.lng = { not: null, gte: Math.min(b, d), lte: Math.max(b, d) };
    } else if (p.nearLat != null && p.nearLng != null && p.radiusKm != null) {
      const dLat = p.radiusKm / 111;
      const dLng = p.radiusKm / (111 * Math.cos((p.nearLat * Math.PI) / 180));
      where.lat = { not: null, gte: p.nearLat - dLat, lte: p.nearLat + dLat };
      where.lng = { not: null, gte: p.nearLng - dLng, lte: p.nearLng + dLng };
    }

    const rows = await prisma.property.findMany({
      where,
      select: {
        id: true, titleNormalized: true, price: true, pricePerSqFt: true, propertyType: true,
        transactionType: true, bedrooms: true, lat: true, lng: true, coordPrecision: true,
        locality: { select: { name: true, slug: true } },
      },
      take: p.limit,
    });

    let markers = rows.map((r) => ({
      id: r.id, title: r.titleNormalized, price: r.price, pricePerSqFt: r.pricePerSqFt,
      propertyType: r.propertyType, transactionType: r.transactionType, bedrooms: r.bedrooms,
      lat: r.lat, lng: r.lng, coordPrecision: r.coordPrecision,
      locality: r.locality?.name ?? null, localitySlug: r.locality?.slug ?? null,
      distanceKm: p.nearLat != null && p.nearLng != null && r.lat != null && r.lng != null
        ? Number(haversineKm(p.nearLat, p.nearLng, r.lat, r.lng).toFixed(2)) : null,
    }));
    // precise radius filter after coarse bbox
    if (p.nearLat != null && p.nearLng != null && p.radiusKm != null) {
      markers = markers.filter((m) => m.distanceKm != null && m.distanceKm <= p.radiusKm!);
    }
    return ok({ count: markers.length, truncated: rows.length >= p.limit, markers });
  } catch (e) {
    return serverError(e);
  }
}
