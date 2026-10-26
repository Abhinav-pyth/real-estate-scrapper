import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, badRequest, unauthorized, serverError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({ propertyId: z.string().min(1) });

// GET — list saved properties for the logged-in user
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const saved = await prisma.savedProperty.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        property: {
          select: {
            id: true, titleNormalized: true, price: true, transactionType: true, propertyType: true,
            bedrooms: true, carpetArea: true, areaUnit: true, lastUpdatedAt: true, availability: true,
            locality: { select: { name: true, slug: true } },
            images: { select: { url: true }, take: 1 },
          },
        },
      },
    });
    return ok(saved.map((s) => ({ savedAt: s.createdAt, property: s.property })));
  } catch (e) {
    return serverError(e);
  }
}

// POST — toggle save (idempotent add; removes if already saved)
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return badRequest("propertyId required");
    const { propertyId } = parsed.data;
    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true } });
    if (!property) return badRequest("Unknown property");
    const existing = await prisma.savedProperty.findUnique({ where: { userId_propertyId: { userId: user.id, propertyId } } });
    if (existing) {
      await prisma.savedProperty.delete({ where: { id: existing.id } });
      return ok({ saved: false });
    }
    await prisma.savedProperty.create({ data: { userId: user.id, propertyId } });
    return ok({ saved: true });
  } catch (e) {
    return serverError(e);
  }
}
