import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET /api/localities — active Indore localities with listing counts.
export async function GET(_req: NextRequest) {
  try {
    const localities = await prisma.locality.findMany({
      where: { isActive: true, city: { name: "Indore" } },
      select: {
        slug: true, name: true, centerLat: true, centerLng: true, geoPrecision: true, pinCodesJson: true,
        _count: { select: { properties: true } },
      },
      orderBy: { sortOrder: "asc" },
    });
    return ok(localities.map((l) => ({ ...l, propertyCount: l._count.properties, _count: undefined })));
  } catch (e) {
    return serverError(e);
  }
}
