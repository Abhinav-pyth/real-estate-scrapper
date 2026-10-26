import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  const base = config.appUrl.replace(/\/$/, "");
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/saved", "/login", "/register"] },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
