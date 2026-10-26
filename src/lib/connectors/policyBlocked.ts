// Policy-blocked connectors: 99acres, Magicbricks, Housing.com, NoBroker, OLX, CommonFloor.
// Verified findings (2026-10-26, recorded in docs/DATA_COLLECTION_COMPLIANCE.md):
//  - 99acres / Magicbricks / Housing.com: robots.txt requests blocked at CDN edge; ToS prohibit scraping.
//  - NoBroker: robots.txt disallows API/app paths; listings behind anti-bot/auth.
//  - OLX India: robots.txt disallows item/nf/api paths for generic agents.
// Therefore these connectors refuse to fetch and report "Not configured" status.
// If a licensed partner API is later obtained, implement a real connector class and
// register it here — no other code changes are needed.

import type { FetchOptions, RawListing, SourceConnector } from "./interface";
import type { NormalizedListing } from "../types";

class PolicyBlockedConnector implements SourceConnector {
  constructor(public readonly key: string, public readonly name: string, public readonly reason: string) {}

  async isAllowed(): Promise<boolean> {
    return false; // No authorized integration configured for this provider.
  }

  async fetchListings(_opts: FetchOptions): Promise<RawListing[]> {
    throw new Error(`${this.name}: automated collection not permitted (${this.reason}). Configure an authorized API/feed or use CSV import.`);
  }

  normalizeListing(_raw: RawListing): NormalizedListing | null {
    return null;
  }

  validateListing(_listing: NormalizedListing) {
    return { ok: false, errors: ["Connector disabled by policy"] };
  }

  reportError(message: string, meta?: Record<string, unknown>) {
    console.error(JSON.stringify({ connector: this.key, level: "ERROR", message, meta }));
  }
}

export const POLICY_BLOCKED_CONNECTORS: SourceConnector[] = [
  new PolicyBlockedConnector("ninety-nine-acres", "99acres", "robots.txt/edge block + ToS prohibits scraping"),
  new PolicyBlockedConnector("magicbricks", "Magicbricks", "robots.txt/edge block + ToS prohibits scraping"),
  new PolicyBlockedConnector("housing-com", "Housing.com", "robots.txt/edge block + ToS prohibits scraping"),
  new PolicyBlockedConnector("nobroker", "NoBroker", "robots.txt disallows listing APIs; auth-gated content"),
  new PolicyBlockedConnector("olx-india", "OLX India", "robots.txt disallows item paths for generic agents"),
  new PolicyBlockedConnector("commonfloor", "CommonFloor", "no usable permitted feed identified"),
];
