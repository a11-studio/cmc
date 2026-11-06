import type { AssetTrend, DailyCandleSource } from "@/lib/market/types";

export type DailyCandle = {
  /** UTC day start, epoch milliseconds. */
  dayStart: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

const DAY_MS = 86_400_000;

export function utcDayStart(date: Date | number): number {
  const ms = typeof date === "number" ? date : date.getTime();
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** Keep only completed days before `now`, sorted ascending, one candle per day. */
export function completedDailyCandles(candles: readonly DailyCandle[], now: Date): DailyCandle[] {
  const today = utcDayStart(now);
  const byDay = new Map<number, DailyCandle>();

  for (const candle of candles) {
    const valid = [candle.open, candle.high, candle.low, candle.close].every((value) => Number.isFinite(value) && value > 0);

    if (valid && candle.dayStart < today) {
      byDay.set(candle.dayStart, candle);
    }
  }

  return [...byDay.values()].sort((left, right) => left.dayStart - right.dayStart);
}

function lastN(candles: readonly DailyCandle[], n: number): DailyCandle[] | undefined {
  return candles.length >= n ? candles.slice(candles.length - n) : undefined;
}

function sma(candles: readonly DailyCandle[], n: number): number | undefined {
  const window = lastN(candles, n);
  return window ? window.reduce((sum, candle) => sum + candle.close, 0) / n : undefined;
}

function channel(candles: readonly DailyCandle[], n: number): { high?: number; low?: number } {
  const window = lastN(candles, n);

  if (!window) {
    return {};
  }

  return {
    high: Math.max(...window.map((candle) => candle.high)),
    low: Math.min(...window.map((candle) => candle.low)),
  };
}

function atr(candles: readonly DailyCandle[], n: number): number | undefined {
  if (candles.length < n + 1) {
    return undefined;
  }

  let sum = 0;

  for (let index = candles.length - n; index < candles.length; index += 1) {
    const candle = candles[index];
    const previousClose = candles[index - 1].close;
    sum += Math.max(candle.high - candle.low, Math.abs(candle.high - previousClose), Math.abs(candle.low - previousClose));
  }

  return sum / n;
}

function dailyVolatility(candles: readonly DailyCandle[], n: number): number | undefined {
  if (candles.length < n + 1) {
    return undefined;
  }

  const returns: number[] = [];

  for (let index = candles.length - n; index < candles.length; index += 1) {
    returns.push(candles[index].close / candles[index - 1].close - 1);
  }

  const mean = returns.reduce((sum, value) => sum + value, 0) / n;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / n;
  return Math.sqrt(variance);
}

/**
 * Trend indicators from completed daily candles, compared against the live price.
 * Returns undefined when there is not even one completed day.
 */
export function computeAssetTrend(input: {
  candles: readonly DailyCandle[];
  price: number;
  source: DailyCandleSource;
  now: Date;
}): AssetTrend | undefined {
  const candles = completedDailyCandles(input.candles, input.now);
  const last = candles.at(-1);

  if (!last || !(input.price > 0)) {
    return undefined;
  }

  const price = input.price;
  const sma50 = sma(candles, 50);
  const sma100 = sma(candles, 100);
  const sma200 = sma(candles, 200);
  const c10 = channel(candles, 10);
  const c20 = channel(candles, 20);
  const c55 = channel(candles, 55);
  const atr20 = atr(candles, 20);
  const close30Ago = candles.length > 30 ? candles[candles.length - 31].close : undefined;
  const volatility = dailyVolatility(candles, 30);

  const trend: AssetTrend = {
    source: input.source,
    asOfDay: new Date(last.dayStart).toISOString().slice(0, 10),
  };

  const assign = <K extends keyof AssetTrend>(key: K, value: number | undefined, places: number) => {
    if (value != null && Number.isFinite(value)) {
      (trend as Record<string, unknown>)[key] = round(value, places);
    }
  };

  const pricePlaces = price >= 100 ? 2 : 6;
  assign("sma50", sma50, pricePlaces);
  assign("sma100", sma100, pricePlaces);
  assign("sma200", sma200, pricePlaces);
  assign("high10", c10.high, pricePlaces);
  assign("low10", c10.low, pricePlaces);
  assign("high20", c20.high, pricePlaces);
  assign("low20", c20.low, pricePlaces);
  assign("high55", c55.high, pricePlaces);
  assign("low55", c55.low, pricePlaces);
  assign("atr20", atr20, pricePlaces);
  assign("atr20Percent", atr20 != null ? (atr20 / price) * 100 : undefined, 2);
  assign("return30dPercent", close30Ago ? (price / close30Ago - 1) * 100 : undefined, 2);
  assign("volatility30dPercent", volatility != null ? volatility * 100 : undefined, 2);
  assign("priceVsSma50Percent", sma50 ? (price / sma50 - 1) * 100 : undefined, 2);
  assign("priceVsSma200Percent", sma200 ? (price / sma200 - 1) * 100 : undefined, 2);

  return trend;
}
