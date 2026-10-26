// Central ingestion pipeline: idempotent save + observation tracking + duplicate scan.
// Used by connectors, CSV/JSON imports, and user submissions so behavior is identical.

import { prisma } from "./db";
import type { NormalizedListing } from "./types";
import { completenessScore, computePricePerSqFt, normalizeTitle } from "./format";
import { detectDuplicates, type DupInput } from "./duplicates";

export interface IngestOutcome {
  status: "NEW" | "UPDATED" | "PRICE_CHANGED" | "UNCHANGED";
  propertyId: string;
}

const STALE_AFTER_DAYS = 14; // ACTIVE listings not seen this long become STALE

export async function saveListing(listing: NormalizedListing): Promise<IngestOutcome> {
  const city = await prisma.city.findUnique({ where: { name: "Indore" } });
  if (!city) throw new Error("City Indore not seeded");
  if (listing.city !== "Indore") throw new Error(`Out-of-scope listing rejected: city=${listing.city}`);

  const connector = await prisma.sourceConnector.upsert({
    where: { key: listing.connectorKey },
    update: { updatedAt: new Date() },
    create: { key: listing.connectorKey, name: listing.connectorKey, status: "IMPORT_ONLY", enabled: true },
  });

  // Idempotency: match on (connectorId, externalId) or canonicalUrl
  let existingSource = null;
  if (listing.externalId) {
    existingSource = await prisma.propertySource.findUnique({
      where: { connectorId_externalId: { connectorId: connector.id, externalId: String(listing.externalId) } },
    });
  }
  if (!existingSource) {
    existingSource = await prisma.propertySource.findFirst({ where: { connectorId: connector.id, canonicalUrl: listing.canonicalUrl } });
  }

  const locality = listing.localitySlug
    ? await prisma.locality.findUnique({ where: { slug: listing.localitySlug } })
    : null;

  const psf = computePricePerSqFt(listing);
  const score = completenessScore({
    ...listing, imageUrls: listing.imageUrls, lat: listing.coordPrecision === "EXACT" || listing.coordPrecision === "LOCALITY_APPROXIMATE" ? listing.lat : null,
    localityId: locality?.id, canonicalUrl: listing.canonicalUrl,
  });

  const coreData = {
    titleNormalized: listing.titleNormalized || normalizeTitle(listing.titleOriginal ?? ""),
    titleOriginal: listing.titleOriginal ?? null,
    transactionType: listing.transactionType,
    propertyType: listing.propertyType,
    price: listing.price ?? null,
    currency: listing.currency || "INR",
    rentFrequency: listing.rentFrequency ?? null,
    carpetArea: listing.carpetArea ?? null,
    builtUpArea: listing.builtUpArea ?? null,
    superBuiltUpArea: listing.superBuiltUpArea ?? null,
    areaUnit: listing.areaUnit ?? null,
    pricePerSqFt: psf,
    bedrooms: listing.bedrooms ?? null,
    bathrooms: listing.bathrooms ?? null,
    furnishing: listing.furnishing ?? null,
    floorNumber: listing.floorNumber ?? null,
    totalFloors: listing.totalFloors ?? null,
    projectName: listing.projectName ?? null,
    builderName: listing.builderName ?? null,
    streetOrRoad: listing.streetOrRoad ?? null,
    pinCode: listing.pinCode ?? null,
    description: listing.description ?? null,
    constructionStatus: listing.constructionStatus ?? null,
    possessionDate: listing.possessionDate ?? null,
    reraNumber: listing.reraNumber ?? null,
    amenitiesJson: JSON.stringify(listing.amenities ?? []),
    parkingAvailable: listing.parkingAvailable ?? null,
    liftAvailable: listing.liftAvailable ?? null,
    gatedCommunity: listing.gatedCommunity ?? null,
    lat: listing.lat ?? null,
    lng: listing.lng ?? null,
    coordPrecision: listing.coordPrecision ?? (listing.lat != null ? "EXACT" : "NONE"),
    geoConfidence: listing.geoConfidence ?? null,
    localityId: locality?.id ?? null,
    sourcePublishedAt: listing.sourcePublishedAt ?? null,
    lastCheckedAt: new Date(),
    completenessScore: score,
  };

  let propertyId: string;
  let outcome: IngestOutcome["status"] = "NEW";

  if (existingSource) {
    propertyId = existingSource.propertyId;
    const prev = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!prev) throw new Error("Integrity error: source without property");

    const priceChanged = (prev.price ?? null) !== (coreData.price ?? null);
    const otherChanged =
      prev.titleNormalized !== coreData.titleNormalized ||
      (prev.carpetArea ?? null) !== (coreData.carpetArea ?? null) ||
      (prev.availability !== "ACTIVE" && prev.availability !== "STALE");

    await prisma.$transaction(async (tx) => {
      await tx.property.update({
        where: { id: propertyId },
        data: {
          ...coreData,
          lastUpdatedAt: new Date(),
          availability: "ACTIVE",
          missingSinceCount: 0,
        },
      });
      await tx.propertySource.update({
        where: { id: existingSource.id },
        data: { lastCheckedAt: new Date(), availability: "ACTIVE", rawDataJson: JSON.stringify(listing).slice(0, 60000) },
      });
      await tx.propertyObservation.create({
        data: {
          propertyId,
          price: coreData.price,
          availability: "ACTIVE",
          changeType: priceChanged
            ? (coreData.price != null && prev.price != null && coreData.price < prev.price ? "PRICE_DECREASE" : "PRICE_INCREASE")
            : otherChanged ? "UPDATED" : "UNCHANGED",
        },
      });
    });
    outcome = priceChanged ? "PRICE_CHANGED" : otherChanged ? "UPDATED" : "UNCHANGED";
  } else {
    const created = await prisma.property.create({
      data: {
        ...coreData,
        cityId: city.id,
        firstDiscoveredAt: new Date(),
        observations: { create: { price: coreData.price, availability: "ACTIVE", changeType: "DISCOVERED" } },
        sources: {
          create: {
            connectorId: connector.id,
            externalId: listing.externalId ? String(listing.externalId) : null,
            canonicalUrl: listing.canonicalUrl,
            rawTitle: listing.titleOriginal ?? null,
            rawDataJson: JSON.stringify(listing).slice(0, 60000),
          },
        },
        images: {
          createMany: {
            data: (listing.imageUrls ?? []).slice(0, 20).map((url, idx) => ({
              url, sortOrder: idx, rightsNote: "Referenced from source; not rehosted. Display subject to source permissions.",
            })),
          },
        },
      },
      include: { sources: true },
    });
    propertyId = created.id;
    outcome = "NEW";
  }

  await runDuplicateScan(propertyId);
  return { status: outcome, propertyId };
}

/** Scan the new/updated property against candidates in the same locality+type+transaction. */
async function runDuplicateScan(propertyId: string) {
  const p = await prisma.property.findUnique({
    where: { id: propertyId },
    include: { locality: true, sources: { include: { connector: true } } },
  });
  if (!p) return;
  const asInput = (x: typeof p): DupInput => {
    const src = x.sources[0];
    return {
      id: x.id, externalId: src?.externalId, connectorKey: src?.connector.key ?? "",
      canonicalUrl: src?.canonicalUrl ?? "", titleNormalized: x.titleNormalized,
      projectName: x.projectName, localityName: x.locality?.name ?? null,
      propertyType: x.propertyType, transactionType: x.transactionType, price: x.price,
      carpetArea: x.carpetArea, builtUpArea: x.builtUpArea, bedrooms: x.bedrooms,
      lat: x.lat, lng: x.lng, coordPrecision: x.coordPrecision,
    };
  };

  const candidates = await prisma.property.findMany({
    where: {
      id: { not: propertyId },
      cityId: p.cityId,
      transactionType: p.transactionType,
      propertyType: p.propertyType,
      ...(p.localityId ? { localityId: p.localityId } : {}),
      ...(p.price != null ? { price: { gte: Math.round(p.price * 0.85), lte: Math.round(p.price * 1.15) } } : {}),
    },
    include: { locality: true, sources: { include: { connector: true } } },
    take: 200,
  });

  for (const c of candidates) {
    const res = detectDuplicates(asInput(p), asInput(c));
    if (res.classification === "UNIQUE") continue;
    const [aId, bId] = p.id < c.id ? [p.id, c.id] : [c.id, p.id];
    await prisma.duplicateCandidate.upsert({
      where: { propertyAId_propertyBId: { propertyAId: aId, propertyBId: bId } },
      update: { confidence: res.confidence, classification: res.classification, signalsJson: JSON.stringify(res.signals) },
      create: {
        propertyAId: aId, propertyBId: bId, confidence: res.confidence,
        classification: res.classification, signalsJson: JSON.stringify(res.signals),
      },
    });
  }
}

/** Mark listings that were not seen for too many days as STALE; two consecutive absences → UNAVAILABLE_AT_SOURCE candidate. */
export async function applyStalenessPolicy() {
  const staleCutoff = new Date(Date.now() - STALE_AFTER_DAYS * 86400_000);
  const result = await prisma.property.updateMany({
    where: { availability: "ACTIVE", lastCheckedAt: { lt: staleCutoff } },
    data: { availability: "STALE" },
  });
  return result.count;
}
