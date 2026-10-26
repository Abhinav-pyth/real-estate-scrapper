// Common Source Connector interface — every provider implements this.
// Implementations live in src/lib/connectors/<key>.ts and register themselves
// in registry.ts so new providers can be added without touching core code.

import type { NormalizedListing } from "../types";

export interface FetchOptions {
  maxListings: number;
  localities?: string[];      // slugs to process
  since?: Date;               // incremental sync when supported
  signal?: AbortSignal;
}

export interface RawListing {
  externalId?: string | null;
  url: string;
  payload: unknown;           // provider-native shape (kept for auditing)
}

export interface SourceConnector {
  readonly key: string;
  readonly name: string;

  /** Whether automated collection is permitted for this source. MUST return false
   *  unless an authorized API/feed/agreement is configured. */
  isAllowed(): Promise<boolean>;

  /** Fetch raw listings from the source (network boundary). */
  fetchListings(opts: FetchOptions): Promise<RawListing[]>;

  /** Convert a raw listing into the common normalized schema. */
  normalizeListing(raw: RawListing): NormalizedListing | null;

  /** Validate a normalized listing against the shared Zod schema. */
  validateListing(listing: NormalizedListing): { ok: boolean; errors: string[] };

  /** Report an error encountered during ingestion (structured logging hook). */
  reportError(message: string, meta?: Record<string, unknown>): void;

  // saveListings + detectDuplicates are handled centrally by the ingestion
  // pipeline (src/lib/ingest.ts) so behavior stays consistent across sources.
}
