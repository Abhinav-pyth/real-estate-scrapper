import { describe, it, expect } from "vitest";
import { toSqft, computePricePerSqFt, formatPriceINR, completenessScore, normalizeTitle, haversineKm } from "@/lib/format";

describe("unit: area & price math", () => {
  it("converts sq yards to sqft (9x)", () => expect(toSqft(100, "SQYD")).toBeCloseTo(900));
  it("converts square meters to sqft", () => expect(toSqft(100, "SQUARE_METER")).toBeCloseTo(1076.39, 2));
  it("converts guntha (MP) to sqft", () => expect(toSqft(1, "GUNTHA")).toBeCloseTo(1089));
  it("returns null for unknown units instead of guessing", () => expect(toSqft(100, "MYSTERY")).toBeNull());

  it("computes PSF only with compatible area; prefers carpet", () => {
    const psf = computePricePerSqFt({ price: 5_000_000, carpetArea: 1000, builtUpArea: 1200, areaUnit: "SQFT" });
    expect(psf).toBe(5000);
  });
  it("PSF null when price missing — never fabricates", () => {
    expect(computePricePerSqFt({ price: null, carpetArea: 1000, areaUnit: "SQFT" })).toBeNull();
  });
  it("PSF null when no area at all", () => {
    expect(computePricePerSqFt({ price: 5_000_000, areaUnit: "SQFT" })).toBeNull();
  });

  it("formats lakh/crore the Indian way", () => {
    expect(formatPriceINR(2_500_000)).toBe("₹25 L");
    expect(formatPriceINR(12_000_000)).toBe("₹1.2 Cr");
    expect(formatPriceINR(8500, { rent: true })).toBe("₹8,500/month");
  });
  it("missing price renders honest placeholder", () => {
    expect(formatPriceINR(null)).toBe("Price not available");
  });

  it("completeness score is 0..100 and rewards real fields", () => {
    const low = completenessScore({ titleNormalized: "x", canonicalUrl: "u" });
    const high = completenessScore({ titleNormalized: "nice home", canonicalUrl: "u", price: 4000000, localityId: "l", carpetArea: 900, bedrooms: 2, imageUrls: ["i"], lat: 22.7 });
    expect(low).toBeGreaterThanOrEqual(0);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(100);
  });

  it("normalizeTitle strips punctuation noise", () => {
    expect(normalizeTitle("  2 BHK Flat, Vijay Nagar!! ")).toBe("2 bhk flat vijay nagar");
  });

  it("haversine distance sanity (~km)", () => {
    const km = haversineKm(22.7225, 75.852, 22.6948, 75.854); // Palam -> Vijay Nagar approx
    expect(km).toBeGreaterThan(2);
    expect(km).toBeLessThan(6);
  });
});
