import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { MarketSnapshot, SupportedSymbol } from "@/lib/market/types";

export const QUOTE_LOOKBACK_MS = 15 * 60 * 1000;
const MIN_LOOKBACK_MS = 8 * 60 * 1000;
const MAX_LOOKBACK_MS = 25 * 60 * 1000;
const MAX_POINTS = 180;
const BUCKET_MS = 60_000;

export type QuoteHistoryPoint = {
  timestamp: string;
  prices: Partial<Record<SupportedSymbol, number>>;
  openInterest?: number;
  derivativesVolume24h?: number;
};

export type PriorQuote = {
  symbol: string;
  price: number;
  at: string;
  ageMinutes: number;
  changePercent: number;
};

export type PriorMarketMetric = {
  value: number;
  at: string;
  ageMinutes: number;
  changePercent: number;
};

type HistoryStore = {
  points: QuoteHistoryPoint[];
};

function persistEnabled() {
  return process.env.VITEST !== "true" && process.env.NODE_ENV !== "test";
}

function historyFilePath() {
  return process.env.ARENA_QUOTE_HISTORY_PATH ?? join(process.cwd(), ".data", "quote-history.json");
}

function isHistoryPoint(value: unknown): value is QuoteHistoryPoint {
  if (typeof value !== "object" || value == null) {
    return false;
  }

  const point = value as QuoteHistoryPoint;
  return typeof point.timestamp === "string" && typeof point.prices === "object" && point.prices != null;
}

function loadFromDisk(): QuoteHistoryPoint[] {
  if (!persistEnabled()) {
    return [];
  }

  try {
    const parsed = JSON.parse(readFileSync(historyFilePath(), "utf8")) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isHistoryPoint) : [];
  } catch {
    return [];
  }
}

function saveToDisk(points: QuoteHistoryPoint[]) {
  if (!persistEnabled()) {
    return;
  }

  try {
    const file = historyFilePath();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(points)}\n`);
  } catch {
    // History is best-effort context for Research; live quotes still render.
  }
}

function historyStore(): HistoryStore {
  const globalState = globalThis as typeof globalThis & { __arenaQuoteHistoryV2?: HistoryStore };

  if (!globalState.__arenaQuoteHistoryV2) {
    globalState.__arenaQuoteHistoryV2 = { points: loadFromDisk() };
  }

  return globalState.__arenaQuoteHistoryV2;
}

export function bucketTimestamp(iso: string): string {
  const ms = Date.parse(iso);

  if (!Number.isFinite(ms)) {
    return iso;
  }

  return new Date(Math.floor(ms / BUCKET_MS) * BUCKET_MS).toISOString();
}

export function resetQuoteHistory() {
  historyStore().points = [];

  if (persistEnabled()) {
    saveToDisk([]);
  }
}

export function rememberSnapshot(snapshot: MarketSnapshot | null | undefined, observedAt?: string) {
  if (!snapshot?.timestamp || !Array.isArray(snapshot.assets) || snapshot.assets.length === 0) {
    return;
  }

  const prices: QuoteHistoryPoint["prices"] = {};

  for (const asset of snapshot.assets) {
    if (!Number.isFinite(asset.price) || asset.price <= 0) {
      continue;
    }

    prices[asset.symbol as SupportedSymbol] = asset.price;
  }

  if (Object.keys(prices).length === 0) {
    return;
  }

  rememberQuotePoint({
    timestamp: observedAt || snapshot.timestamp,
    prices,
    openInterest: snapshot.market.openInterest,
    derivativesVolume24h: snapshot.market.derivativesVolume24h,
  });
}

export function rememberQuotePoint(point: QuoteHistoryPoint) {
  const points = historyStore().points;
  const timestamp = bucketTimestamp(point.timestamp);
  const existing = points.findIndex((item) => item.timestamp === timestamp);

  if (existing >= 0) {
    points[existing] = {
      timestamp,
      prices: { ...points[existing]?.prices, ...point.prices },
      openInterest: point.openInterest ?? points[existing]?.openInterest,
      derivativesVolume24h: point.derivativesVolume24h ?? points[existing]?.derivativesVolume24h,
    };
    saveToDisk(points);
    return;
  }

  points.push({
    timestamp,
    prices: { ...point.prices },
    openInterest: point.openInterest,
    derivativesVolume24h: point.derivativesVolume24h,
  });
  points.sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));

  if (points.length > MAX_POINTS) {
    points.splice(0, points.length - MAX_POINTS);
  }

  saveToDisk(points);
}

export function percentChange(current: number, previous: number): number | undefined {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) {
    return undefined;
  }

  return ((current - previous) / previous) * 100;
}

export function lookupPriorQuote(
  symbol: string,
  currentPrice: number,
  nowIso: string,
  lookbackMs = QUOTE_LOOKBACK_MS
): PriorQuote | undefined {
  const now = Date.parse(nowIso);

  if (!Number.isFinite(now)) {
    return undefined;
  }

  const target = now - lookbackMs;
  const candidates = historyStore().points.flatMap((point) => {
    const at = Date.parse(point.timestamp);
    const price = point.prices[symbol as SupportedSymbol];
    const age = now - at;

    if (!Number.isFinite(at) || price == null || price <= 0) {
      return [];
    }

    if (age < MIN_LOOKBACK_MS || age > MAX_LOOKBACK_MS) {
      return [];
    }

    return [{ at: point.timestamp, price, age, distance: Math.abs(at - target) }];
  });

  const match = candidates.sort((left, right) => left.distance - right.distance)[0];

  if (!match) {
    return undefined;
  }

  const change = percentChange(currentPrice, match.price);

  if (change == null) {
    return undefined;
  }

  return {
    symbol,
    price: match.price,
    at: match.at,
    ageMinutes: Math.max(1, Math.round(match.age / 60_000)),
    changePercent: change,
  };
}

export function lookupPriorMarketMetric(
  field: "openInterest" | "derivativesVolume24h",
  current: number | undefined,
  nowIso: string,
  lookbackMs = QUOTE_LOOKBACK_MS
): PriorMarketMetric | undefined {
  if (current == null || !Number.isFinite(current) || current <= 0) {
    return undefined;
  }

  const now = Date.parse(nowIso);

  if (!Number.isFinite(now)) {
    return undefined;
  }

  const target = now - lookbackMs;
  const candidates = historyStore().points.flatMap((point) => {
    const at = Date.parse(point.timestamp);
    const value = point[field];
    const age = now - at;

    if (!Number.isFinite(at) || value == null || value <= 0) {
      return [];
    }

    if (age < MIN_LOOKBACK_MS || age > MAX_LOOKBACK_MS) {
      return [];
    }

    return [{ at: point.timestamp, value, age, distance: Math.abs(at - target) }];
  });

  const match = candidates.sort((left, right) => left.distance - right.distance)[0];

  if (!match) {
    return undefined;
  }

  const change = percentChange(current, match.value);

  if (change == null) {
    return undefined;
  }

  return {
    value: match.value,
    at: match.at,
    ageMinutes: Math.max(1, Math.round(match.age / 60_000)),
    changePercent: change,
  };
}
