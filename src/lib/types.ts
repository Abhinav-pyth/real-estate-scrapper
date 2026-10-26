import { z } from "zod";

// ---------- Enum-like string unions (portable across SQLite/Postgres) ----------

export const TRANSACTION_TYPES = ["SALE", "RENT", "COMMERCIAL_SALE", "COMMERCIAL_RENT"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const PROPERTY_TYPES = [
  "APARTMENT",
  "INDEPENDENT_HOUSE",
  "VILLA",
  "RESIDENTIAL_PLOT",
  "COMMERCIAL_PLOT",
  "OFFICE_SPACE",
  "SHOP",
  "WAREHOUSE",
  "INDUSTRIAL",
  "AGRICULTURAL_LAND",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const AREA_UNITS = ["SQFT", "SQYD", "SQUARE_METER", "GUNTHA", "BIGHA", "HECTARE", "ACRE"] as const;
export type AreaUnit = (typeof AREA_UNITS)[number];

export const FURNISHING = ["FURNISHED", "SEMI_FURNISHED", "UNFURNISHED", "NA"] as const;
export const CONSTRUCTION_STATUS = ["READY_TO_MOVE", "UNDER_CONSTRUCTION", "NEWLY_BUILT", "NA"] as const;
export const COORD_PRECISION = ["EXACT", "LOCALITY_APPROXIMATE", "NONE"] as const;
export const AVAILABILITY = ["ACTIVE", "STALE", "UNAVAILABLE_AT_SOURCE", "REMOVED_BY_SOURCE", "PENDING_VERIFICATION"] as const;
export const VERIFICATION = ["UNVERIFIED", "METADATA_CHECKED", "VERIFIED"] as const;

// ---------- Normalized listing (common schema across all sources) ----------

export const normalizedListingSchema = z.object({
  // identity / provenance — REQUIRED, never fabricated
  connectorKey: z.string().min(1),
  externalId: z.string().nullish(),
  canonicalUrl: z.string().url(),
  titleOriginal: z.string().nullish(),
  titleNormalized: z.string().min(1),

  transactionType: z.enum(TRANSACTION_TYPES),
  propertyType: z.enum(PROPERTY_TYPES),

  price: z.number().int().positive().nullish(), // whole INR
  currency: z.string().default("INR"),
  rentFrequency: z.enum(["MONTHLY", "YEARLY"]).nullish(),

  carpetArea: z.number().positive().nullish(),
  builtUpArea: z.number().positive().nullish(),
  superBuiltUpArea: z.number().positive().nullish(),
  areaUnit: z.enum(AREA_UNITS).nullish(),

  bedrooms: z.number().int().min(0).max(20).nullish(),
  bathrooms: z.number().int().min(0).max(20).nullish(),
  furnishing: z.enum(FURNISHING).nullish(),
  floorNumber: z.number().int().nullish(),
  totalFloors: z.number().int().nullish(),

  projectName: z.string().nullish(),
  builderName: z.string().nullish(),
  streetOrRoad: z.string().nullish(),
  pinCode: z.string().regex(/^\d{6}$/).nullish(),
  localitySlug: z.string().nullish(),
  city: z.literal("Indore"), // hard scope guard — reject other cities even if similarly named
  state: z.string().default("Madhya Pradesh"),

  lat: z.number().min(-90).max(90).nullish(),
  lng: z.number().min(-180).max(180).nullish(),
  coordPrecision: z.enum(COORD_PRECISION).nullish(),
  geoConfidence: z.number().min(0).max(1).nullish(),

  description: z.string().max(2000).nullish(),
  imageUrls: z.array(z.string().url()).default([]),
  constructionStatus: z.enum(CONSTRUCTION_STATUS).nullish(),
  possessionDate: z.string().nullish(),
  reraNumber: z.string().nullish(),
  amenities: z.array(z.string()).default([]),
  parkingAvailable: z.boolean().nullish(),
  liftAvailable: z.boolean().nullish(),
  gatedCommunity: z.boolean().nullish(),

  sourcePublishedAt: z.coerce.date().nullish(),
});
export type NormalizedListing = z.infer<typeof normalizedListingSchema>;

// ---------- Search API parameters ----------

export const searchParamsSchema = z.object({
  q: z.string().max(120).optional(),                       // free text: locality/project/road/PIN
  city: z.literal("Indore").default("Indore"),
  locality: z.string().max(80).optional(),                 // slug
  transactionType: z.enum(TRANSACTION_TYPES).optional(),
  propertyType: z.enum(PROPERTY_TYPES).optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().positive().optional(),
  minCarpetArea: z.coerce.number().nonnegative().optional(),
  maxCarpetArea: z.coerce.number().positive().optional(),
  bedrooms: z.coerce.number().int().min(1).max(10).optional(),
  bathrooms: z.coerce.number().int().min(1).max(10).optional(),
  furnishing: z.enum(FURNISHING).optional(),
  constructionStatus: z.enum(CONSTRUCTION_STATUS).optional(),
  gatedCommunity: z.coerce.boolean().optional(),
  parking: z.coerce.boolean().optional(),
  lift: z.coerce.boolean().optional(),
  source: z.string().max(60).optional(),                   // connector key
  hasCoordinates: z.coerce.boolean().optional(),
  hasImages: z.coerce.boolean().optional(),
  priceReduced: z.coerce.boolean().optional(),
  verified: z.coerce.boolean().optional(),
  incomplete: z.coerce.boolean().optional(),               // low completeness score
  availability: z.enum(AVAILABILITY).default("ACTIVE"),
  // geographic
  bbox: z.string().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/).optional(), // lat1,lng1,lat2,lng2
  nearLat: z.coerce.number().min(-90).max(90).optional(),
  nearLng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(50).optional(),
  // sorting & paging
  sort: z.enum(["price_asc", "price_desc", "newest", "updated", "area_desc", "psf_asc", "distance"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchParams = z.infer<typeof searchParamsSchema>;

export const BUDGET_BUCKETS_BUY = [
  { label: "Under ₹10 L", min: 0, max: 1_000_000 },
  { label: "₹10–20 L", min: 1_000_000, max: 2_000_000 },
  { label: "₹20–30 L", min: 2_000_000, max: 3_000_000 },
  { label: "₹30–50 L", min: 3_000_000, max: 5_000_000 },
  { label: "₹50–75 L", min: 5_000_000, max: 7_500_000 },
  { label: "₹75 L–1 Cr", min: 7_500_000, max: 10_000_000 },
  { label: "₹1–2 Cr", min: 10_000_000, max: 20_000_000 },
  { label: "₹2 Cr+", min: 20_000_000, max: undefined },
] as const;

export const BUDGET_BUCKETS_RENT = [
  { label: "Under ₹5,000/month", min: 0, max: 5_000 },
  { label: "₹5,000–10,000/month", min: 5_000, max: 10_000 },
  { label: "₹10,000–20,000/month", min: 10_000, max: 20_000 },
  { label: "₹20,000–30,000/month", min: 20_000, max: 30_000 },
  { label: "₹30,000–50,000/month", min: 30_000, max: 50_000 },
  { label: "₹50,000+/month", min: 50_000, max: undefined },
] as const;

// ---------- CSV import row schema ----------

export const csvRowSchema = z.object({
  canonicalUrl: z.string().url(),
  externalId: z.string().optional(),
  title: z.string().min(3),
  transactionType: z.enum(TRANSACTION_TYPES),
  propertyType: z.enum(PROPERTY_TYPES),
  price: z.coerce.number().int().positive().optional(),
  rentFrequency: z.enum(["MONTHLY", "YEARLY"]).optional(),
  carpetArea: z.coerce.number().positive().optional(),
  builtUpArea: z.coerce.number().positive().optional(),
  areaUnit: z.enum(AREA_UNITS).optional(),
  bedrooms: z.coerce.number().int().optional(),
  bathrooms: z.coerce.number().int().optional(),
  furnishing: z.enum(FURNISHING).optional(),
  projectName: z.string().optional(),
  builderName: z.string().optional(),
  locality: z.string().optional(),
  pinCode: z.string().regex(/^\d{6}$/).optional(),
  city: z.literal("Indore"),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().url().optional(),
  reraNumber: z.string().optional(),
  sourcePublishedAt: z.string().optional(),
});
export type CsvRow = z.infer<typeof csvRowSchema>;
