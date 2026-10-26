import { NextResponse } from "next/server";
import { config } from "./config";

// Consistent error envelope. Never leaks internals/secrets in production messages.
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers || {}) } });
}

// ---------- Route helpers shared by pages & API ----------

/** Redirect a URLSearchParams-style object into /search with normalized keys. */
export function toSearchUrl(params: Record<string, string | number | null | undefined>): string {
  const map: Record<string, string> = {
    q: "q", locality: "locality", tx: "transactionType", type: "propertyType",
    minPrice: "minPrice", maxPrice: "maxPrice", beds: "bedrooms", baths: "bathrooms",
    furnishing: "furnishing", construction: "constructionStatus", source: "source",
    sort: "sort", page: "page", minArea: "minCarpetArea", hasCoordinates: "hasCoordinates",
    hasImages: "hasImages", priceReduced: "priceReduced", gatedCommunity: "gatedCommunity",
    parking: "parking", lift: "lift", incomplete: "incomplete", verified: "verified",
  };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "") continue;
    sp.set(map[k] ?? k, String(v));
  }
  const s = sp.toString();
  return s ? `/search?${s}` : "/search";
}

/** Basic client-ip extraction for audit logging. */
export function requestIp(req: Request): string | undefined {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : undefined;
}

export function err(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { success: false, error: { code, message, ...(details != null && !config.isProduction ? { details } : {}) } },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export function badRequest(message: string, details?: unknown) { return err(400, "BAD_REQUEST", message, details); }
export function unauthorized() { return err(401, "UNAUTHORIZED", "Authentication required"); }
export function forbidden() { return err(403, "FORBIDDEN", "Administrator access required"); }
export function notFound(message = "Not found") { return err(404, "NOT_FOUND", message); }
export function tooManyRequests() { return err(429, "RATE_LIMITED", "Too many requests. Please slow down."); }
export function serverError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[api-error]", msg);
  return err(500, "INTERNAL_ERROR", config.isProduction ? "An internal error occurred" : msg);
}

// ---------- Simple in-memory fixed-window rate limiter ----------
// For multi-instance deployments use Redis (see docs/DEPLOYMENT.md).
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimited(key: string): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + config.rateLimit.windowMs });
    return false;
  }
  b.count += 1;
  return b.count > config.rateLimit.max;
}

export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : "local") + "|" + new URL(req.url).pathname;
}
