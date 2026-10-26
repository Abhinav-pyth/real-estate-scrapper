import type { SourceConnector } from "./interface";
import { AuthorizedFeedConnector } from "./authorizedFeed";
import { POLICY_BLOCKED_CONNECTORS } from "./policyBlocked";

// Connector registry — add new providers here without touching core code.
const connectors = new Map<string, SourceConnector>();

export function registerConnector(c: SourceConnector) {
  connectors.set(c.key, c);
}

export function getConnector(key: string): SourceConnector | undefined {
  return connectors.get(key);
}

export function allConnectors(): SourceConnector[] {
  return [...connectors.values()];
}

// Built-in registrations
registerConnector(new AuthorizedFeedConnector());
for (const c of POLICY_BLOCKED_CONNECTORS) registerConnector(c);
