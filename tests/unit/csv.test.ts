import { describe, it, expect } from "vitest";
import { parseCsv, csvToObjects, validateCsvHeaders, rowToListing, slugify } from "@/lib/csv";

describe("unit: CSV parsing & validation", () => {
  it("parses quoted fields with embedded commas and escaped quotes", () => {
    const rows = parseCsv(`a,b\n"hello, world","say ""hi"""\n`);
    expect(rows[1]).toEqual(["hello, world", 'say "hi"']);
  });
  it("handles CRLF and BOM", () => {
    const rows = parseCsv("\ufeffx,y\r\n1,2\r\n");
    expect(rows[0][0]).toBe("x");
    expect(rows[1]).toEqual(["1", "2"]);
  });
  it("detects missing required headers", () => {
    expect(validateCsvHeaders(["title"])).toEqual(expect.arrayContaining(["canonicalUrl", "city"]));
    expect(validateCsvHeaders(["canonicalUrl", "title", "transactionType", "propertyType", "city"])).toEqual([]);
  });
  it("maps a valid row into a normalized listing scoped to Indore", () => {
    const listing = rowToListing({
      canonicalUrl: "https://example.com/listing/1",
      title: "2 BHK apartment in Vijay Nagar",
      transactionType: "SALE", propertyType: "APARTMENT", price: "4500000",
      carpetArea: "950", areaUnit: "SQFT", bedrooms: "2", locality: "Vijay Nagar", city: "Indore", pinCode: "452011",
    }, "manual-import");
    expect(listing.city).toBe("Indore");
    expect(listing.localitySlug).toBe("vijay-nagar");
    expect(listing.price).toBe(4500000);
    expect(listing.connectorKey).toBe("manual-import");
  });
  it("slugify normalizes locality names", () => {
    expect(slugify("  South Tukoganj ")).toBe("south-tukoganj");
  });
});
