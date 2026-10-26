import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, notFound, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

// Lists every source record for a property with per-source price/area kept SEPARATE
// (we never silently pick one when sources disagree).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const property = await prisma.property.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!property) return notFound("Property not found");
    const sources = await prisma.propertySource.findMany({
      where: { propertyId: params.id },
      include: { connector: { select: { key: true, name: true, websiteUrl: true, status: true } } },
      orderBy: { firstSeenAt: "asc" },
    });
    return ok(sources);
  } catch (e) {
    return serverError(e);
  }
}
