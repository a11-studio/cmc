import type { Metadata } from "next";

export const SITE_NAME = "AI Trading Arena";

export const SITE_DESCRIPTION =
  "Autonomous AI trading agents compete with virtual capital and real market data.";

/** Primary share image — `public/og-image.jpg` */
export const OG_IMAGE = {
  path: "/og-image.jpg",
  width: 1200,
  height: 630,
  alt: "AI Trading Arena — autonomous agents, live market data, paper trading",
  type: "image/jpeg",
} as const;

export const SITE_ICONS = {
  favicon: { path: "/favicon.png", width: 128, height: 128 },
  apple: { path: "/apple.png", width: 180, height: 180 },
  android: { path: "/android.png", width: 192, height: 192 },
  androidLarge: { path: "/android-cover.jpg", width: 512, height: 512, type: "image/jpeg" },
  safariMask: { path: "/safari.svg", color: "#060606" },
} as const;

export const WEB_MANIFEST_PATH = "/manifest.webmanifest";

export function resolveSiteUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.SITE_URL?.trim();

  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

  if (productionHost) {
    return `https://${productionHost.replace(/^https?:\/\//, "")}`;
  }

  const vercelHost = process.env.VERCEL_URL?.trim();

  if (vercelHost) {
    return `https://${vercelHost}`;
  }

  return "http://localhost:3000";
}

const openGraphImages = [
  {
    url: OG_IMAGE.path,
    width: OG_IMAGE.width,
    height: OG_IMAGE.height,
    alt: OG_IMAGE.alt,
    type: OG_IMAGE.type,
  },
];

/** Root metadata merged by all routes unless a page overrides a field. */
export function rootMetadata(): Metadata {
  const metadataBase = new URL(`${resolveSiteUrl()}/`);

  return {
    metadataBase,
    title: {
      default: SITE_NAME,
      template: `%s · ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    openGraph: {
      type: "website",
      locale: "en_US",
      url: metadataBase,
      siteName: SITE_NAME,
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      images: openGraphImages,
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      images: [OG_IMAGE.path],
    },
    icons: {
      icon: [
        {
          url: SITE_ICONS.favicon.path,
          sizes: `${SITE_ICONS.favicon.width}x${SITE_ICONS.favicon.height}`,
          type: "image/png",
        },
      ],
      apple: [
        {
          url: SITE_ICONS.apple.path,
          sizes: `${SITE_ICONS.apple.width}x${SITE_ICONS.apple.height}`,
          type: "image/png",
        },
      ],
      other: [
        {
          rel: "mask-icon",
          url: SITE_ICONS.safariMask.path,
          color: SITE_ICONS.safariMask.color,
        },
      ],
    },
    manifest: WEB_MANIFEST_PATH,
    appleWebApp: {
      capable: true,
      title: SITE_NAME,
      statusBarStyle: "black-translucent",
    },
  };
}
