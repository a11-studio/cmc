import { type DailyCandle, utcDayStart } from "@/lib/market/trend";
import type { DailyCandleSource, SupportedSymbol } from "@/lib/market/types";

/**
 * Daily OHLC from free public exchange APIs. The CMC plan in use has no historical
 * OHLCV endpoint, so trend context comes from exchange candles instead.
 *
 * Sources are tried in order. api.binance.com refuses US addresses (Vercel runs in
 * the US), so the market-data mirror goes first and US exchanges are fallbacks.
 */

export type DailyCandleFetch = (input: string, init?: RequestInit) => Promise<Response>;

export type DailyCandleSeries = {
  source: DailyCandleSource;
  candles: DailyCandle[];
};

const LOOKBACK_DAYS = 260;
const REQUEST_TIMEOUT_MS = 6_000;

type SourceSpec = {
  source: DailyCandleSource;
  url: (symbol: SupportedSymbol) => string;
  parse: (payload: unknown) => DailyCandle[];
};

function parseBinance(payload: unknown): DailyCandle[] {
  if (!Array.isArray(payload)) {
    throw new Error("Binance klines payload is not an array");
  }

  return payload.map((row) => {
    const [openTime, open, high, low, close] = row as [number, string, string, string, string];
    return { dayStart: utcDayStart(Number(openTime)), open: Number(open), high: Number(high), low: Number(low), close: Number(close) };
  });
}

function parseCoinbase(payload: unknown): DailyCandle[] {
  if (!Array.isArray(payload)) {
    throw new Error("Coinbase candles payload is not an array");
  }

  // [time (s), low, high, open, close, volume], newest first.
  return payload.map((row) => {
    const [time, low, high, open, close] = row as number[];
    return { dayStart: utcDayStart(time * 1000), open, high, low, close };
  });
}

const SOURCES: readonly SourceSpec[] = [
  {
    source: "binance",
    url: (symbol) => `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}USDT&interval=1d&limit=${LOOKBACK_DAYS}`,
    parse: parseBinance,
  },
  {
    source: "coinbase",
    url: (symbol) => `https://api.exchange.coinbase.com/products/${symbol}-USD/candles?granularity=86400`,
    parse: parseCoinbase,
  },
  {
    source: "binance-us",
    url: (symbol) => `https://api.binance.us/api/v3/klines?symbol=${symbol}USDT&interval=1d&limit=${LOOKBACK_DAYS}`,
    parse: parseBinance,
  },
];

async function fetchFromSource(spec: SourceSpec, symbol: SupportedSymbol, fetchImpl: DailyCandleFetch): Promise<DailyCandle[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(spec.url(symbol), { signal: controller.signal, cache: "no-store" });

    if (!response.ok) {
      throw new Error(`${spec.source} ${symbol}: HTTP ${response.status}`);
    }

    const candles = spec.parse(await response.json());

    if (candles.length === 0) {
      throw new Error(`${spec.source} ${symbol}: no candles`);
    }

    return candles;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchDailyCandles(
  symbol: SupportedSymbol,
  fetchImpl: DailyCandleFetch = fetch
): Promise<DailyCandleSeries | null> {
  for (const spec of SOURCES) {
    try {
      return { source: spec.source, candles: await fetchFromSource(spec, symbol, fetchImpl) };
    } catch {
      continue;
    }
  }

  return null;
}

/** Completed days only change at UTC midnight, so one fetch per symbol per day is enough. */
const dailyCache = new Map<string, DailyCandleSeries>();

export async function loadDailyCandles(
  symbols: readonly SupportedSymbol[],
  options: { fetchImpl?: DailyCandleFetch; now?: Date } = {}
): Promise<Map<SupportedSymbol, DailyCandleSeries>> {
  const day = new Date(utcDayStart(options.now ?? new Date())).toISOString().slice(0, 10);
  const result = new Map<SupportedSymbol, DailyCandleSeries>();

  await Promise.all(
    symbols.map(async (symbol) => {
      const key = `${day}:${symbol}`;
      const cached = dailyCache.get(key);

      if (cached) {
        result.set(symbol, cached);
        return;
      }

      const series = await fetchDailyCandles(symbol, options.fetchImpl);

      if (series) {
        dailyCache.set(key, series);
        result.set(symbol, series);
      }
    })
  );

  for (const key of dailyCache.keys()) {
    if (!key.startsWith(`${day}:`)) {
      dailyCache.delete(key);
    }
  }

  return result;
}
