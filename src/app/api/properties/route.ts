import { NextRequest } from "next/server";
import { searchParamsSchema } from "@/lib/types";
import { searchProperties } from "@/lib/search";
import { ok, badRequest, serverError, rateLimited, clientKey, tooManyRequests } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET /api/properties — validated, paginated, DB-level filtered search (Indore only).
export async function GET(req: NextRequest) {
  if (rateLimited(clientKey(req))) return tooManyRequests();
  try {
    const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = searchParamsSchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest("Invalid search parameters", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
    }
    const result = await searchProperties(parsed.data);
    const totalPages = Math.max(1, Math.ceil(result.total / parsed.data.limit));
    return ok({
      items: result.items,
      pagination: { page: parsed.data.page, limit: parsed.data.limit, total: result.total, totalPages },
      city: "Indore",
    });
  } catch (e) {
    return serverError(e);
  }
}
