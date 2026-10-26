// Central configuration — all secrets via environment variables only.
export const config = {
  appName: "Indore Property Finder",
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  // Geographic scope (release 1: Indore ONLY)
  city: "Indore",
  district: "Indore",
  state: "Madhya Pradesh",
  country: "India",
  // Map provider: "osm" (default, no key needed) or "google"
  mapProvider: (process.env.NEXT_PUBLIC_MAP_PROVIDER as "osm" | "google") || "osm",
  googleMapsApiKeyPublic: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  googleGeocodingKeyServer: process.env.GOOGLE_GEOCODING_API_KEY || "",
  nominatimUserAgent: process.env.GEOCODER_UA || "indore-property-finder/1.0 (self-hosted; contact set via GEOCODER_UA)",
  // Auth
  sessionSecret: process.env.SESSION_SECRET || "dev-only-insecure-secret-change-me",
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS || 30),
  // Redis / BullMQ (optional)
  redisUrl: process.env.REDIS_URL || "",
  // Rate limiting (anonymous API requests per window)
  rateLimit: { windowMs: 60_000, max: Number(process.env.API_RATE_LIMIT_MAX || 120) },
  // Uploads
  maxCsvBytes: Number(process.env.MAX_CSV_BYTES || 2_000_000),
  // Ads placeholder — never render fake ads
  adsenseClientId: process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || "",
  isProduction: process.env.NODE_ENV === "production",
};

export function assertScope(cityName: string): boolean {
  return cityName.trim().toLowerCase() === config.city.toLowerCase();
}
