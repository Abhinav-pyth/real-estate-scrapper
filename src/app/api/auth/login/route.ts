import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, badRequest, unauthorized, serverError, rateLimited, clientKey, tooManyRequests } from "@/lib/api";
import { createSession, setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().email().toLowerCase(), password: z.string().min(1).max(128) });

// POST /api/auth/login — generic error message; never reveals whether the email exists.
export async function POST(req: NextRequest) {
  if (rateLimited(clientKey(req) + "|login")) return tooManyRequests();
  try {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return badRequest("Invalid credentials format");
    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return unauthorized(); // same response for unknown email and wrong password
    }
    const token = await createSession(user.id);
    setSessionCookie(token);
    return ok({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (e) {
    return serverError(e);
  }
}
