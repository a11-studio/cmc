import type { MarketSnapshot } from "@/lib/market/types";

export function cloneMarketSnapshot(snapshot: MarketSnapshot, cycleId: string): MarketSnapshot {
  return {
    cycleId,
    timestamp: snapshot.timestamp,
    assets: snapshot.assets.map((asset) => ({ ...asset })),
    market: { ...snapshot.market },
    ...(snapshot.news ? { news: snapshot.news.map((item) => ({ ...item })) } : {}),
  };
}

export function freezeMarketSnapshot(snapshot: MarketSnapshot): MarketSnapshot {
  for (const asset of snapshot.assets) {
    Object.freeze(asset);
  }

  Object.freeze(snapshot.assets);
  Object.freeze(snapshot.market);

  if (snapshot.news) {
    for (const item of snapshot.news) {
      Object.freeze(item);
    }

    Object.freeze(snapshot.news);
  }

  return Object.freeze(snapshot) as MarketSnapshot;
}

export function stampImmutableSnapshot(snapshot: MarketSnapshot, cycleId: string): MarketSnapshot {
  return freezeMarketSnapshot(cloneMarketSnapshot(snapshot, cycleId));
}

export function isUsableSnapshot(snapshot: MarketSnapshot | null | undefined): snapshot is MarketSnapshot {
  return Boolean(
    snapshot &&
      typeof snapshot.timestamp === "string" &&
      snapshot.timestamp.trim() &&
      Array.isArray(snapshot.assets) &&
      snapshot.assets.length > 0
  );
}
