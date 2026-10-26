import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = config.appUrl.replace(/\/$/, "");
  const statics: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/search`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/map`, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/localities`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/how-it-works`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/about/data-policy`, changeFrequency: "yearly", priority: 0.2 },
  ];
  try {
    const locs = await prisma.locality.findMany({ where: { isActive: true, city: { name: "Indore" } }, select: { slug: true } });
    statics.push(...locs.map((l) => ({ url: `${base}/localities/${l.slug}`, changeFrequency: "daily" as const, priority: 0.6 })));
    const props = await prisma.property.findMany({ where: { availability: "ACTIVE" }, select: { id: true, lastUpdatedAt: true }, orderBy: { lastUpdatedAt: "desc" }, take: 5000 });
    statics.push(...props.map((p) => ({ url: `${base}/properties/${p.id}`, lastModified: p.lastUpdatedAt, changeFrequency: "daily" as const, priority: 0.5 })));
  } catch { /* DB unreachable — serve static part rather than erroring */ }
  return statics;
}
