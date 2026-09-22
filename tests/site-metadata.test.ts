import { afterEach, describe, expect, it } from "vitest";
import { OG_IMAGE, resolveSiteUrl, rootMetadata } from "@/lib/site-metadata";

describe("site metadata", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it("resolves explicit site URL", () => {
    process.env = { ...env, NEXT_PUBLIC_SITE_URL: "https://thearena.buzz/" };
    expect(resolveSiteUrl()).toBe("https://thearena.buzz");
  });

  it("includes OG image on root metadata", () => {
    process.env = { ...env, NEXT_PUBLIC_SITE_URL: "https://example.com" };
    const metadata = rootMetadata();

    expect(metadata.openGraph?.images).toEqual([
      {
        url: OG_IMAGE.path,
        width: OG_IMAGE.width,
        height: OG_IMAGE.height,
        alt: OG_IMAGE.alt,
        type: OG_IMAGE.type,
      },
    ]);
    expect(metadata.twitter?.images).toEqual([OG_IMAGE.path]);
    expect(metadata.metadataBase?.toString()).toBe("https://example.com/");
    expect(metadata.manifest).toBe("/manifest.webmanifest");
    expect(metadata.icons).toEqual(
      expect.objectContaining({
        icon: [{ url: "/favicon.png", sizes: "128x128", type: "image/png" }],
      }),
    );
  });
});
