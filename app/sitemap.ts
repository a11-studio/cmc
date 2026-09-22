import type { MetadataRoute } from "next";
import { listLiveAgents } from "@/lib/agents/registry";
import { absoluteSiteUrl, PAGE_SEO } from "@/lib/site-metadata";

const INDEXABLE_PAGES: Array<keyof typeof PAGE_SEO> = [
  "home",
  "agents",
  "activity",
  "chat",
  "research",
  "winners",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = INDEXABLE_PAGES.map((key) => {
    const page = PAGE_SEO[key];
    return {
      url: absoluteSiteUrl(page.path),
      lastModified: now,
      changeFrequency: key === "home" || key === "activity" ? "hourly" : "daily",
      priority: key === "home" ? 1 : 0.8,
    };
  });

  const agentEntries: MetadataRoute.Sitemap = listLiveAgents().map((agent) => ({
    url: absoluteSiteUrl(`/agents/${agent.id}`),
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  return [...staticEntries, ...agentEntries];
}
