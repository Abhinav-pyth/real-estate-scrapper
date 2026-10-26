// Shared human-readable labels for enum-like string fields stored in the DB.
export const TX_LABELS: Record<string, string> = {
  SALE: "Buy",
  RENT: "Rent",
  COMMERCIAL_SALE: "Commercial sale",
  COMMERCIAL_RENT: "Commercial rent",
};

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  APARTMENT: "Apartment / Flat",
  INDEPENDENT_HOUSE: "Independent house",
  VILLA: "Villa",
  RESIDENTIAL_PLOT: "Residential plot",
  COMMERCIAL_PLOT: "Commercial plot",
  OFFICE_SPACE: "Office space",
  SHOP: "Shop / Showroom",
  WAREHOUSE: "Warehouse",
  INDUSTRIAL: "Industrial property",
  AGRICULTURAL_LAND: "Agricultural land",
};

export const AVAILABILITY_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  STALE: "Stale — needs re-check",
  UNAVAILABLE_AT_SOURCE: "Unavailable at source",
  REMOVED_BY_SOURCE: "Removed by source",
  PENDING_VERIFICATION: "Pending verification",
};

export const CONNECTOR_STATUS_LABELS: Record<string, string> = {
  NOT_CONFIGURED: "Not configured",
  PERMITTED_API: "Permitted API",
  PERMITTED_FEED: "Permitted feed",
  IMPORT_ONLY: "Import only (CSV/JSON)",
  DISABLED_BY_POLICY: "Disabled by policy (ToS / robots.txt)",
};

export const COORD_PRECISION_LABELS: Record<string, string> = {
  EXACT: "Exact coordinates",
  LOCALITY_APPROXIMATE: "Approximate (locality-level)",
  NONE: "No coordinates",
};

export function txLabel(v?: string | null) { return (v && TX_LABELS[v]) || v || "—"; }
export function propertyTypeLabel(v?: string | null) { return (v && PROPERTY_TYPE_LABELS[v]) || v || "—"; }
export function availabilityLabel(v?: string | null) { return (v && AVAILABILITY_LABELS[v]) || v || "—"; }
export function connectorStatusLabel(v?: string | null) { return (v && CONNECTOR_STATUS_LABELS[v]) || v || "—"; }
