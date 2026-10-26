import { prisma } from "@/lib/db";
import { ok, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const [properties, localities, connectors] = await Promise.all([
      prisma.property.count(),
      prisma.locality.count({ where: { isActive: true } }),
      prisma.sourceConnector.count({ where: { enabled: true } }),
    ]);
    return ok({ status: "healthy", db: "up", counts: { properties, activeLocalities: localities, enabledConnectors: connectors }, time: new Date().toISOString() });
  } catch (e) {
    return serverError(e);
  }
}
