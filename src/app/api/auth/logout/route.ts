import { clearSessionCookie } from "@/lib/auth";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST() {
  clearSessionCookie();
  return ok({ loggedOut: true });
}
