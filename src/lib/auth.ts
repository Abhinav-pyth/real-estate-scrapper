import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { config } from "./config";

// Cookie-name + hashing scheme shared by API routes and server components.
const COOKIE_NAME = "ipf_session";

export function hashToken(token: string): string {
  return crypto.createHmac("sha256", config.sessionSecret).update(token).digest("hex");
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + config.sessionTtlDays * 86400_000),
    },
  });
  return token;
}

export function setSessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    path: "/",
    maxAge: config.sessionTtlDays * 86400,
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE_NAME);
}

export async function getSessionUser() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function audit(params: { userId?: string | null; action: string; entity?: string; entityId?: string; detail?: unknown; ip?: string }) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity ?? null,
        entityId: params.entityId ?? null,
        detailJson: JSON.stringify(params.detail ?? {}),
        ip: params.ip ?? null,
      },
    });
  } catch (e) {
    console.error("audit log write failed", (e as Error).message);
  }
}
