import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET /api/suggestions?q=... — typeahead over localities, projects, roads, PIN codes.
export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
    if (q.length < 1) return ok([]);
    const like = { contains: q };
    const [localities, projects, roads] = await Promise.all([
      prisma.locality.findMany({ where: { isActive: true, city: { name: "Indore" }, OR: [{ name: like }, { slug: { contains: q } }] }, select: { slug: true, name: true }, take: 8 }),
      prisma.property.findMany({ where: { city: { name: "Indore" }, projectName: like }, select: { projectName: true }, distinct: ["projectName"], take: 6 }),
      prisma.property.findMany({ where: { city: { name: "Indore" }, streetOrRoad: like }, select: { streetOrRoad: true }, distinct: ["streetOrRoad"], take: 6 }),
    ]);
    const out = [
      ...localities.map((l) => ({ type: "locality" as const, label: l.name, value: l.slug })),
      ...projects.map((p) => ({ type: "project" as const, label: p.projectName!, value: p.projectName! })),
      ...roads.map((r) => ({ type: "road" as const, label: r.streetOrRoad!, value: r.streetOrRoad! })),
    ];
    return ok(out.slice(0, 12));
  } catch (e) {
    return serverError(e);
  }
}
