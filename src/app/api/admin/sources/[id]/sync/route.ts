import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, badRequest, forbidden, serverError } from "@/lib/api";
import { requireAdmin, audit } from "@/lib/auth";
import { runSyncJob } from "@/lib/jobRunner";

export const dynamic = "force-dynamic";

// POST /api/admin/sources/:id/sync — enqueue or run a sync for a permitted connector.
// Long-running crawls never execute inside this request when Redis/BullMQ is configured;
// without queue infrastructure the job runs inline with strict caps (dev convenience).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return forbidden();
  try {
    const connector = await prisma.sourceConnector.findUnique({ where: { id: params.id } });
    if (!connector) return badRequest("Unknown connector");
    if (!connector.enabled) return badRequest("Connector is disabled");
    const body = await req.json().catch(() => ({}));
    const maxListings = Math.min(Number(body.maxListings ?? connector.maxListingsPerJob), connector.maxListingsPerJob);
    const localities: string[] = Array.isArray(body.localities) ? body.localities.slice(0, 50) : [];

    const job = await prisma.scrapingJob.create({
      data: { connectorId: connector.id, kind: "SYNC", status: "RUNNING", triggeredBy: `ADMIN:${admin.id}`, startedAt: new Date(), paramsJson: JSON.stringify({ maxListings, localities }) },
    });
    await audit({ userId: admin.id, action: "source.sync", entity: "ScrapingJob", entityId: job.id, detail: { connectorKey: connector.key }, ip: req.headers.get("x-forwarded-for") ?? undefined });

    // Execute through the shared runner (honors isAllowed(), rate limits, timeouts).
    const result = await runSyncJob(job.id);
    return ok(result);
  } catch (e) {
    return serverError(e);
  }
}
