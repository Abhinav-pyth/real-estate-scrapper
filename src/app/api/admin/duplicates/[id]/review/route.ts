import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, badRequest, forbidden, serverError } from "@/lib/api";
import { requireAdmin, audit } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({ decision: z.enum(["MERGE", "REJECT"]) });

// POST — admin decision on a duplicate candidate.
// MERGE keeps BOTH PropertySource rows on the surviving property (original URLs preserved);
// the losing property is marked REMOVED_BY_SOURCE-linked but its sources move, nothing is deleted silently.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return forbidden();
  try {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return badRequest("decision must be MERGE or REJECT");
    const cand = await prisma.duplicateCandidate.findUnique({ where: { id: params.id } });
    if (!cand) return badRequest("Unknown candidate");
    if (cand.status !== "OPEN") return badRequest("Already reviewed");

    if (parsed.data.decision === "MERGE") {
      await prisma.$transaction(async (tx) => {
        // re-home sources & images of B onto A; keep both raw records intact
        await tx.propertySource.updateMany({ where: { propertyId: cand.propertyBId }, data: { propertyId: cand.propertyAId } });
        await tx.propertyImage.updateMany({ where: { propertyId: cand.propertyBId }, data: { propertyId: cand.propertyAId } });
        await tx.property.update({ where: { id: cand.propertyBId }, data: { availability: "REMOVED_BY_SOURCE" } });
        await tx.duplicateCandidate.update({ where: { id: cand.id }, data: { status: "MERGED", reviewedBy: admin.id, reviewedAt: new Date() } });
      });
    } else {
      await prisma.duplicateCandidate.update({ where: { id: cand.id }, data: { status: "REJECTED", reviewedBy: admin.id, reviewedAt: new Date() } });
    }
    await audit({ userId: admin.id, action: `duplicate.${parsed.data.decision.toLowerCase()}`, entity: "DuplicateCandidate", entityId: cand.id });
    return ok({ reviewed: true, decision: parsed.data.decision });
  } catch (e) {
    return serverError(e);
  }
}
