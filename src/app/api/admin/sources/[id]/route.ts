import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, badRequest, forbidden, serverError } from "@/lib/api";
import { requireAdmin, audit } from "@/lib/auth";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  rateLimitPerMin: z.number().int().min(1).max(60).optional(),
  maxListingsPerJob: z.number().int().min(1).max(5000).optional(),
  scheduleCron: z.string().max(60).nullable().optional(),
});

// PATCH — admin toggles/limits. Note: enabling a DISABLED_BY_POLICY connector is blocked;
// policy status can only change when an authorization is recorded (docs/DATA_COLLECTION.md).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return forbidden();
  try {
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return badRequest("Invalid update payload", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
    const connector = await prisma.sourceConnector.findUnique({ where: { id: params.id } });
    if (!connector) return badRequest("Unknown connector");
    if (parsed.data.enabled === true && connector.status === "DISABLED_BY_POLICY") {
      return badRequest("This source is disabled by collection policy. Enable only after documenting authorization in SourceConnector.robotsNote and changing status.");
    }
    const updated = await prisma.sourceConnector.update({ where: { id: params.id }, data: parsed.data });
    await audit({ userId: admin.id, action: "source.update", entity: "SourceConnector", entityId: params.id, detail: parsed.data, ip: req.headers.get("x-forwarded-for") ?? undefined });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
