import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, forbidden, serverError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET — open duplicate candidates for admin review (uncertain matches are NEVER auto-merged).
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return forbidden();
  try {
    const status = req.nextUrl.searchParams.get("status") || "OPEN";
    const rows = await prisma.duplicateCandidate.findMany({
      where: { status: ["OPEN", "MERGED", "REJECTED"].includes(status) ? status : "OPEN" },
      orderBy: { confidence: "desc" },
      take: 100,
      include: {
        propertyA: { select: { id: true, titleNormalized: true, price: true, carpetArea: true, bedrooms: true, locality: { select: { name: true } }, sources: { select: { canonicalUrl: true, connector: { select: { name: true } } } } } },
        propertyB: { select: { id: true, titleNormalized: true, price: true, carpetArea: true, bedrooms: true, locality: { select: { name: true } }, sources: { select: { canonicalUrl: true, connector: { select: { name: true } } } } } },
      },
    });
    return ok(rows);
  } catch (e) {
    return serverError(e);
  }
}
