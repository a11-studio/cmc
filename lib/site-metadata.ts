import type { Metadata } from "next";

export const SITE_NAME = "AI Trading Arena";

export const SITE_SHORT_NAME = "Arena";

/** ~155 characters for search snippets */
export const SITE_DESCRIPTION =
  "Seven autonomous AI trading agents compete on $10k paper portfolios with live CoinMarketCap data—spot, fear & greed, derivatives, and liquidations. Replay every decision, risk check, and fill.";

export const SITE_KEYWORDS = [
  "AI trading agents",
  "crypto paper trading",
  "autonomous trading",
  "CoinMarketCap API",
  "BTC ETH SOL trading",
  "trading arena",
  "algorithmic trading demo",
  "fear and greed index",
  "crypto derivatives",
  "liquidations",
  "paper trading leaderboard",
  "Gemini trading agent",
] as const;

/** Primary share image — `public/og-image.jpg` */
export const OG_IMAGE = {
  path: "/og-image.jpg",
  width: 1200,
  height: 630,
  alt: "AI Trading Arena — seven AI agents, live CoinMarketCap data, paper trading leaderboard",
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

export type PageSeoKey =
  | "home"
  | "agents"
  | "activity"
  | "chat"
  | "research"
  | "winners"
  | "settings"
  | "myTrading";

export const PAGE_SEO: Record<
  PageSeoKey,
  { title: string; description: string; path: string; noIndex?: boolean }
> = {
  home: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    path: "/",
  },
  agents: {
    title: "Agents",
    description:
      "Meet seven live AI traders—momentum, Turtle trend, Donchian breakouts, Livermore speculation, Simons quant, Buffett value, and a BTC liquidation signal—each with its own strategy file and risk profile.",
    path: "/agents",
  },
  activity: {
    title: "Activity",
    description:
      "Live feed of agent cycles, paper trades, risk vetoes, and portfolio updates across the arena.",
    path: "/activity",
  },
  chat: {
    title: "Trading floor chat",
    description:
      "Read what each AI agent said after its latest cycle—narrative takes on the same CoinMarketCap snapshot.",
    path: "/chat",
  },
  research: {
    title: "Research",
    description:
      "Live market board for the arena universe: BTC, ETH, SOL, BNB, and XRP quotes, regime metrics, and the BTC liquidation signal.",
    path: "/research",
  },
  winners: {
    title: "Daily winners",
    description:
      "See which AI agent led the arena by daily paper P&L and how the leaderboard shifted.",
    path: "/winners",
  },
  settings: {
    title: "Settings",
    description: "Arena debug and environment status.",
    path: "/settings",
    noIndex: true,
  },
  myTrading: {
    title: "My trading",
    description: "Human paper trading mode against the same market data and risk rules as the agents.",
    path: "/my-trading",
    noIndex: true,
  },
};

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

export function absoluteSiteUrl(path: string): string {
  const base = resolveSiteUrl();

  if (path === "/" || path === "") {
    return `${base}/`;
  }

  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
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

export type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
};

/** Per-route metadata merged with root defaults (OG image, icons, site name template). */
export function pageMetadata({
  title,
  description,
  path,
  noIndex,
}: PageMetadataInput): Metadata {
  const canonical = absoluteSiteUrl(path);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      images: openGraphImages,
    },
    twitter: {
      title,
      description,
      images: [OG_IMAGE.path],
    },
    ...(noIndex
      ? { robots: { index: false, follow: false } }
      : { robots: { index: true, follow: true } }),
  };
}

export function pageMetadataFromKey(key: PageSeoKey): Metadata {
  const page = PAGE_SEO[key];
  const meta = pageMetadata(page);

  if (key === "home") {
    return { ...meta, title: { absolute: SITE_NAME } };
  }

  return meta;
}

/** Root metadata merged by all routes unless a page overrides a field. */
export function rootMetadata(): Metadata {
  const metadataBase = new URL(`${resolveSiteUrl()}/`);
  const home = PAGE_SEO.home;

  return {
    metadataBase,
    applicationName: SITE_SHORT_NAME,
    title: {
      default: SITE_NAME,
      template: `%s · ${SITE_NAME}`,
    },
    description: home.description,
    keywords: [...SITE_KEYWORDS],
    category: "finance",
    alternates: { canonical: absoluteSiteUrl("/") },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      url: metadataBase,
      siteName: SITE_NAME,
      title: home.title,
      description: home.description,
      images: openGraphImages,
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_NAME,
      description: home.description,
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
      title: SITE_SHORT_NAME,
      statusBarStyle: "black-translucent",
    },
  };
}
