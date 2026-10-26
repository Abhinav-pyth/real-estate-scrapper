// Seed script: creates the Indore city, localities (geocoded via Nominatim with
// 1 req/s courtesy rate), source connectors with honest compliance statuses,
// and an admin user. It NEVER creates fake property listings.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { INDORE_LOCALITIES } from "./localities";

const prisma = new PrismaClient();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function geocodeLocality(name: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" +
    encodeURIComponent(`${name}, Indore, Madhya Pradesh, India`);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": process.env.GEOCODER_UA || "indore-property-finder-seed/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (!json.length) return null;
    return { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon), displayName: json[0].display_name };
  } catch {
    return null;
  }
}

// Honest connector registry. Statuses reflect verified robots.txt / ToS findings
// (documented in docs/DATA_COLLECTION_COMPLIANCE.md). No connector is enabled by
// default — admins must explicitly configure authorized feeds or use imports.
const CONNECTORS = [
  {
    key: "ninety-nine-acres", name: "99acres", websiteUrl: "https://www.99acres.com/",
    status: "DISABLED_BY_POLICY", scrapeAllowed: false,
    robotsNote: "robots.txt served 'Access Denied' to automated clients (Akamai edge block, checked 2026-10-26). ToS prohibits scraping. Use partner API/feed only.",
  },
  {
    key: "magicbricks", name: "Magicbricks", websiteUrl: "https://www.magicbricks.com/",
    status: "DISABLED_BY_POLICY", scrapeAllowed: false,
    robotsNote: "robots.txt served 'Access Denied' to automated clients (edge block, checked 2026-10-26). ToS prohibits scraping. Use licensed data partnership only.",
  },
  {
    key: "housing-com", name: "Housing.com", websiteUrl: "https://housing.com/",
    status: "DISABLED_BY_POLICY", scrapeAllowed: false,
    robotsNote: "robots.txt served 'Access Denied' to automated clients (edge block, checked 2026-10-26). ToS prohibits scraping. Use partner API only.",
  },
  {
    key: "nobroker", name: "NoBroker", websiteUrl: "https://www.nobroker.in/",
    status: "DISABLED_BY_POLICY", scrapeAllowed: false,
    robotsNote: "robots.txt (checked 2026-10-26) disallows /api/* and app paths for all agents; listing pages sit behind auth/anti-bot. Only authorized NoBrokerIn API/partnership permitted.",
  },
  {
    key: "olx-india", name: "OLX India", websiteUrl: "https://www.olx.in/",
    status: "DISABLED_BY_POLICY", scrapeAllowed: false,
    robotsNote: "robots.txt (checked 2026-10-26) disallows */nf/, */items/, /api/ for generic agents. OLX ToS prohibits automated collection without agreement.",
  },
  {
    key: "commonfloor", name: "CommonFloor", websiteUrl: "https://www.commonfloor.com/",
    status: "NOT_CONFIGURED", scrapeAllowed: false,
    robotsNote: "No usable permitted feed identified yet.",
  },
  {
    key: "local-agencies", name: "Local agency websites (Indore)", websiteUrl: null,
    status: "IMPORT_ONLY", scrapeAllowed: false,
    robotsNote: "Individual agencies may authorize feeds or CSV exports per-agreement. Check each site's robots.txt before any automated fetch.",
  },
  {
    key: "builders", name: "Builder / developer websites", websiteUrl: null,
    status: "IMPORT_ONLY", scrapeAllowed: false,
    robotsNote: "Only sites that grant explicit written permission; otherwise manual CSV import of public metadata.",
  },
  {
    key: "authorized-feeds", name: "Authorized listing feeds/APIs", websiteUrl: null,
    status: "PERMITTED_API", scrapeAllowed: true,
    robotsNote: "Generic adapter for official/partner APIs configured via environment variables (see .env.example).",
  },
  {
    key: "user-submissions", name: "User-submitted listings", websiteUrl: null,
    status: "PERMITTED_FEED", scrapeAllowed: true,
    robotsNote: "Listings submitted directly by owners/agents through the app with consent.",
  },
];

async function main() {
  console.log("Seeding Indore Property Finder…");

  const city = await prisma.city.upsert({
    where: { name: "Indore" },
    update: {},
    create: { name: "Indore", district: "Indore", state: "Madhya Pradesh", country: "India", isActive: true },
  });

  let i = 0;
  for (const loc of INDORE_LOCALITIES) {
    const existing = await prisma.locality.findUnique({ where: { slug: loc.slug } });
    let geo: { lat: number; lng: number } | null = null;
    let precision: string | null = existing?.geoPrecision ?? null;
    if (existing && existing.centerLat != null) {
      precision = existing.geoPrecision;
    } else {
      const g = await geocodeLocality(loc.name);
      if (g) { geo = { lat: g.lat, lng: g.lng }; precision = "LOCALITY_APPROXIMATE"; }
      await sleep(1100); // Nominatim usage policy: max 1 request/second
    }
    await prisma.locality.upsert({
      where: { slug: loc.slug },
      update: {
        name: loc.name, cityId: city.id, aliasesJson: JSON.stringify(loc.aliases),
        pinCodesJson: JSON.stringify(loc.pinCodes), isActive: true, sortOrder: i,
        ...(geo ? { centerLat: geo.lat, centerLng: geo.lng, geoPrecision: precision } : {}),
      },
      create: {
        slug: loc.slug, name: loc.name, cityId: city.id,
        aliasesJson: JSON.stringify(loc.aliases), pinCodesJson: JSON.stringify(loc.pinCodes),
        isActive: true, sortOrder: i,
        centerLat: geo?.lat ?? null, centerLng: geo?.lng ?? null, geoPrecision: precision,
      },
    });
    i++;
  }
  console.log(`Localities seeded: ${INDORE_LOCALITIES.length}`);

  for (const c of CONNECTORS) {
    await prisma.sourceConnector.upsert({
      where: { key: c.key },
      update: { name: c.name, status: c.status, scrapeAllowed: c.scrapeAllowed, robotsNote: c.robotsNote, websiteUrl: c.websiteUrl },
      create: { ...c, enabled: false },
    });
  }
  console.log(`Connectors registered: ${CONNECTORS.length}`);

  // Admin user — credentials from env; defaults are dev-only and clearly insecure.
  const adminEmail = process.env.ADMIN_EMAIL || "admin@localhost";
  const adminPass = process.env.ADMIN_PASSWORD || "change-me-admin";
  const hash = await bcrypt.hash(adminPass, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN", passwordHash: hash },
    create: { email: adminEmail, name: "Administrator", role: "ADMIN", passwordHash: hash },
  });
  console.log(`Admin user ensured: ${adminEmail}${process.env.ADMIN_PASSWORD ? "" : " (dev password 'change-me-admin' — change in production!)"}`);

  console.log("Seed complete. NOTE: no property listings are created by seed — connect a permitted source or import CSV/JSON.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
