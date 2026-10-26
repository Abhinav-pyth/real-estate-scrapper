import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, forbidden, serverError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/admin/jobs — recent ingestion jobs with counts & errors.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return forbidden();
  try {
    const take = Math.min(Number(req.nextUrl.searchParams.get("limit") || 30), 100);
    const jobs = await prisma.scrapingJob.findMany({
      orderBy: { startedAt: "desc" },
      take,
      include: { connector: { select: { key: true, name: true } } },
    });
    return ok(jobs);
  } catch (e) {
    return serverError(e);
  }
}
