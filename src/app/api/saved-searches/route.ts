import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, badRequest, unauthorized, serverError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { searchParamsSchema } from "@/lib/types";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  params: searchParamsSchema.partial(),
});

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const rows = await prisma.savedSearch.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
    return ok(rows.map((r) => ({ id: r.id, name: r.name, createdAt: r.createdAt, params: safeJson(r.paramsJson) })));
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return badRequest("Invalid saved-search payload", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
    const row = await prisma.savedSearch.create({
      data: { userId: user.id, name: parsed.data.name ?? null, paramsJson: JSON.stringify(parsed.data.params) },
    });
    return ok({ id: row.id });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return badRequest("id query param required");
    await prisma.savedSearch.deleteMany({ where: { id, userId: user.id } }); // scoped to owner
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}

function safeJson(s: string) { try { return JSON.parse(s); } catch { return {}; } }
