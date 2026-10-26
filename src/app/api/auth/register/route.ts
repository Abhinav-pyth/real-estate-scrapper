import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, badRequest, serverError, rateLimited, clientKey, tooManyRequests } from "@/lib/api";
import { createSession, setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1).max(80).optional(),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128),
});

// POST /api/auth/register — public signup (USER role only; ADMIN is never self-serviceable)
export async function POST(req: NextRequest) {
  if (rateLimited(clientKey(req))) return tooManyRequests();
  try {
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid registration data", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
    const { email, password, name } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return badRequest("An account with this email already exists");
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, passwordHash, name: name ?? null, role: "USER" } });
    const token = await createSession(user.id);
    setSessionCookie(token);
    return ok({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (e) {
    return serverError(e);
  }
}
