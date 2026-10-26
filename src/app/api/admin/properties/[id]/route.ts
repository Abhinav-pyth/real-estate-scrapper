import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, badRequest, forbidden, serverError } from "@/lib/api";
import { requireAdmin, audit } from "@/lib/auth";

export const dynamic = "force-dynamic";

const editSchema = z.object({
  titleNormalized: z.string().min(3).max(200).optional(),
  projectName: z.string().max(120).nullable().optional(),
  builderName: z.string().max(120).nullable().optional(),
  streetOrRoad: z.string().max(160).nullable().optional(),
  pinCode: z.string().regex(/^\d{6}$/).nullable().optional(),
  verificationStatus: z.enum(["UNVERIFIED", "METADATA_CHECKED", "VERIFIED"]).optional(),
  availability: z.enum(["ACTIVE", "STALE", "UNAVAILABLE_AT_SOURCE", "REMOVED_BY_SOURCE", "PENDING_VERIFICATION"]).optional(),
  isFeatured: z.boolean().optional(),
  featuredLabel: z.string().max(80).nullable().optional(),
});

// PATCH — correct normalized fields only. Prices come from sources; admins fix parsing mistakes, never invent values.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return forbidden();
  try {
    const parsed = editSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return badRequest("Invalid edit payload", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
    const updated = await prisma.property.update({ where: { id: params.id }, data: parsed.data });
    await audit({ userId: admin.id, action: "property.edit", entity: "Property", entityId: params.id, detail: parsed.data });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

// DELETE — takedown per source agreement or law (soft removal; audit-logged).
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return forbidden();
  try {
    await prisma.property.update({ where: { id: params.id }, data: { availability: "REMOVED_BY_SOURCE" } });
    await audit({ userId: admin.id, action: "property.takedown", entity: "Property", entityId: params.id });
    return ok({ removed: true });
  } catch (e) {
    return serverError(e);
  }
}
