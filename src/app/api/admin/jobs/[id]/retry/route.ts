import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, badRequest, forbidden, serverError } from "@/lib/api";
import { requireAdmin, audit } from "@/lib/auth";
import { runSyncJob } from "@/lib/jobRunner";

export const dynamic = "force-dynamic";

// POST — retry a FAILED sync job (re-runs the same connector with stored params).
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return forbidden();
  try {
    const failed = await prisma.scrapingJob.findUnique({ where: { id: params.id }, include: { connector: true } });
    if (!failed) return badRequest("Unknown job");
    if (failed.status !== "FAILED") return badRequest("Only failed jobs can be retried");
    const job = await prisma.scrapingJob.create({
      data: { connectorId: failed.connectorId, kind: failed.kind, status: "RUNNING", triggeredBy: `ADMIN:${admin.id}`, startedAt: new Date(), paramsJson: failed.paramsJson },
    });
    await audit({ userId: admin.id, action: "job.retry", entity: "ScrapingJob", entityId: job.id, detail: { retriedFrom: failed.id } });
    const result = await runSyncJob(job.id);
    return ok(result);
  } catch (e) {
    return serverError(e);
  }
}
