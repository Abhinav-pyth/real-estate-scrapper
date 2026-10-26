// Generic authorized-feed connector.
// This is the ONLY automated network connector enabled by default policy:
// it fetches JSON listings from an endpoint the operator has explicit permission to use
// (partner API, licensed feed, or a site that granted written scraping authorization).
// Configuration is env-based:
//   AUTHORIZED_FEED_URL  — JSON endpoint returning { listings: [...] }
//   AUTHORIZED_FEED_TOKEN— optional bearer token (sent as Authorization header)
// The endpoint must already return Indore-scoped data; each item is still validated
// against the normalized schema (city literal "Indore") before ingestion.

import { normalizedListingSchema, type NormalizedListing } from "../types";
import { normalizeTitle, computePricePerSqFt } from "../format";
import type { FetchOptions, RawListing, SourceConnector } from "./interface";

export class AuthorizedFeedConnector implements SourceConnector {
  readonly key = "authorized-feeds";
  readonly name = "Authorized listing feeds/APIs";

  constructor(
    private feedUrl: string = process.env.AUTHORIZED_FEED_URL || "",
    private token: string = process.env.AUTHORIZED_FEED_TOKEN || ""
  ) {}

  async isAllowed(): Promise<boolean> {
    // Allowed only when an operator-configured feed URL exists — we never crawl
    // arbitrary sites through this connector.
    return this.feedUrl.startsWith("https://") || this.feedUrl.startsWith("http://localhost");
  }

  async fetchListings(opts: FetchOptions): Promise<RawListing[]> {
    if (!(await this.isAllowed())) throw new Error("Authorized feed not configured (set AUTHORIZED_FEED_URL)");
    const res = await fetch(this.feedUrl, {
      headers: {
        "User-Agent": "indore-property-finder/1.0 (authorized partner feed consumer)",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      signal: opts.signal ?? AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Feed responded HTTP ${res.status}`);
    const json = (await res.json()) as { listings?: unknown[] };
    const items = Array.isArray(json.listings) ? json.listings : [];
    return items.slice(0, opts.maxListings).map((p) => {
      const o = p as Record<string, unknown>;
      return {
        externalId: o.id != null ? String(o.id) : null,
        url: String(o.url || ""),
        payload: p,
      };
    }).filter((r) => r.url.length > 0);
  }

  normalizeListing(raw: RawListing): NormalizedListing | null {
    const p = raw.payload as Record<string, any>;
    try {
      const listing: NormalizedListing = {
        connectorKey: this.key,
        externalId: raw.externalId ?? null,
        canonicalUrl: raw.url,
        titleOriginal: p.title ?? null,
        titleNormalized: normalizeTitle(String(p.title ?? p.titleNormalized ?? "")).slice(0, 200),
        transactionType: p.transactionType,
        propertyType: p.propertyType,
        price: p.price != null ? Math.round(Number(p.price)) : null,
        currency: "INR",
        rentFrequency: p.rentFrequency ?? null,
        carpetArea: p.carpetArea != null ? Number(p.carpetArea) : null,
        builtUpArea: p.builtUpArea != null ? Number(p.builtUpArea) : null,
        superBuiltUpArea: p.superBuiltUpArea != null ? Number(p.superBuiltUpArea) : null,
        areaUnit: p.areaUnit ?? "SQFT",
        bedrooms: p.bedrooms != null ? Number(p.bedrooms) : null,
        bathrooms: p.bathrooms != null ? Number(p.bathrooms) : null,
        furnishing: p.furnishing ?? null,
        floorNumber: p.floorNumber != null ? Number(p.floorNumber) : null,
        totalFloors: p.totalFloors != null ? Number(p.totalFloors) : null,
        projectName: p.projectName ?? null,
        builderName: p.builderName ?? null,
        streetOrRoad: p.streetOrRoad ?? null,
        pinCode: p.pinCode != null ? String(p.pinCode) : null,
        localitySlug: p.localitySlug ?? null,
        city: "Indore",
        state: "Madhya Pradesh",
        lat: p.lat != null ? Number(p.lat) : null,
        lng: p.lng != null ? Number(p.lng) : null,
        coordPrecision: p.lat != null && p.lng != null ? (p.coordPrecision ?? "EXACT") : "NONE",
        geoConfidence: p.geoConfidence ?? null,
        description: p.description ?? null,
        imageUrls: Array.isArray(p.imageUrls) ? p.imageUrls.map(String) : [],
        constructionStatus: p.constructionStatus ?? null,
        possessionDate: p.possessionDate ?? null,
        reraNumber: p.reraNumber ?? null,
        amenities: Array.isArray(p.amenities) ? p.amenities.map(String) : [],
        parkingAvailable: p.parkingAvailable ?? null,
        liftAvailable: p.liftAvailable ?? null,
        gatedCommunity: p.gatedCommunity ?? null,
        sourcePublishedAt: p.publishedAt ? new Date(String(p.publishedAt)) : null,
      };
      return listing;
    } catch {
      return null;
    }
  }

  validateListing(listing: NormalizedListing) {
    const parsed = normalizedListingSchema.safeParse(listing);
    if (parsed.success) {
      // PSF is recomputed centrally by the ingest pipeline (saveListing), never trusted from the feed.
      return { ok: true, errors: [] };
    }
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }

  reportError(message: string, meta?: Record<string, unknown>) {
    console.error(JSON.stringify({ connector: this.key, level: "ERROR", message, meta }));
  }
}
