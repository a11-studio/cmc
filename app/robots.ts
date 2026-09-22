import type { MetadataRoute } from "next";
import { resolveSiteUrl } from "@/lib/site-metadata";

export default function robots(): MetadataRoute.Robots {
  const base = resolveSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/settings", "/my-trading"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
