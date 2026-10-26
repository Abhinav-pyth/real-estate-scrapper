import { prisma } from "@/lib/db";
import { ok, forbidden, serverError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/admin/sources — connector registry with honest status (never exposes scraping controls publicly).
export async function GET() {
  if (!(await requireAdmin())) return forbidden();
  try {
    const connectors = await prisma.sourceConnector.findMany({
      include: { _count: { select: { properties: true, jobs: true } } },
      orderBy: { name: "asc" },
    });
    return ok(connectors);
  } catch (e) {
    return serverError(e);
  }
}
