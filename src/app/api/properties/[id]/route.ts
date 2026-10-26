import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, notFound, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const property = await prisma.property.findUnique({
      where: { id: params.id },
      include: {
        city: { select: { name: true, state: true, country: true } },
        locality: { select: { slug: true, name: true, centerLat: true, centerLng: true } },
        images: { orderBy: { sortOrder: "asc" } },
        sources: { include: { connector: { select: { key: true, name: true, websiteUrl: true } } } },
      },
    });
    if (!property) return notFound("Property not found");
    const amenities = (() => { try { return JSON.parse(property.amenitiesJson) as string[]; } catch { return []; } })();
    return ok({ ...property, amenities });
  } catch (e) {
    return serverError(e);
  }
}
