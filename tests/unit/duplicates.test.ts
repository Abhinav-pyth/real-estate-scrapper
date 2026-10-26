import { describe, it, expect } from "vitest";
import { detectDuplicates, clusterPairs, type DupInput } from "@/lib/duplicates";

const base: DupInput = {
  id: "a", connectorKey: "src-a", canonicalUrl: "https://a.example/l/1",
  titleNormalized: "3 bhk apartment shivaji nagar near mall", projectName: "Green Heights",
  localityName: "Shivaji Nagar", propertyType: "APARTMENT", transactionType: "SALE",
  price: 6500000, carpetArea: 1200, bedrooms: 3, lat: 22.72, lng: 75.86, coordPrecision: "EXACT",
};

describe("unit: duplicate detection", () => {
  it("same URL on same connector is CONFIRMED identity (upsert case)", () => {
    const r = detectDuplicates(base, { ...base, id: "b" });
    expect(r.classification).toBe("CONFIRMED");
  });
  it("cross-source strong match scores high", () => {
    const r = detectDuplicates(base, { ...base, id: "b", connectorKey: "src-b", canonicalUrl: "https://b.example/x/9", price: 6_550_000, carpetArea: 1210 });
    expect(r.confidence).toBeGreaterThanOrEqual(0.75);
    expect(["LIKELY", "CONFIRMED"]).toContain(r.classification);
  });
  it("different transaction type can NEVER be a duplicate", () => {
    const r = detectDuplicates(base, { ...base, id: "b", connectorKey: "src-b", canonicalUrl: "https://b.example/x/9", transactionType: "RENT" });
    expect(r.classification).toBe("UNIQUE");
  });
  it("price+address similarity alone does not auto-confirm", () => {
    const r = detectDuplicates(base, { ...base, id: "b", connectorKey: "src-b", canonicalUrl: "https://b.example/x/9", titleNormalized: "", projectName: null, carpetArea: null, bedrooms: null, lat: null, lng: null, coordPrecision: "NONE" });
    expect(r.classification).toBe("UNIQUE");
  });
  it("clusterPairs unions confirmed pairs", () => {
    const groups = clusterPairs(["1", "2", "3", "4"], [["1", "2"], ["2", "3"]]);
    expect(groups).toEqual([["1", "2", "3"]]);
  });
});
