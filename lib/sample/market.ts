import type { MarketSnapshot, SupportedSymbol } from "@/lib/market/types";
import { SUPPORTED_SYMBOLS } from "@/lib/market/symbols";
import type { MarketQuote } from "@/types/arena";

export const SAMPLE_MARK_AT = "2026-09-17T10:55:00.000Z";

export const SAMPLE_PRICES = {
  BTC: 76_606.73,
  ETH: 2_444.8,
  SOL: 100.55,
  BNB: 612.4,
  XRP: 2.31,
} as const satisfies Record<SupportedSymbol, number>;

export type SamplePrices = Record<SupportedSymbol, number>;

export const marketQuotes: MarketQuote[] = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    price: SAMPLE_PRICES.BTC,
    change1h: 0.2,
    change24h: 0.6,
    change7d: 3.4,
    volume24h: 28_400_000_000,
    marketCap: 1_528_000_000_000,
    rsi: 58,
    macd: "Bullish",
    ema20: 75_410,
    ema50: 73_880,
    emaBias: "Bullish",
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    price: SAMPLE_PRICES.ETH,
    change1h: 0.3,
    change24h: 1.9,
    change7d: 6.2,
    volume24h: 18_600_000_000,
    marketCap: 294_600_000_000,
    rsi: 61,
    macd: "Bullish",
    ema20: 2_388,
    ema50: 2_264,
    emaBias: "Bullish",
  },
  {
    symbol: "SOL",
    name: "Solana",
    price: SAMPLE_PRICES.SOL,
    change1h: -0.6,
    change24h: 1.5,
    change7d: 4.1,
    volume24h: 4_100_000_000,
    marketCap: 54_800_000_000,
    rsi: 52,
    macd: "Neutral",
    ema20: 98.4,
    ema50: 95.8,
    emaBias: "Neutral",
  },
  {
    symbol: "BNB",
    name: "BNB",
    price: SAMPLE_PRICES.BNB,
    change1h: 0.1,
    change24h: 1.1,
    change7d: 3.2,
    volume24h: 1_800_000_000,
    marketCap: 88_400_000_000,
    rsi: 55,
    macd: "Bullish",
    ema20: 598.2,
    ema50: 574.6,
    emaBias: "Bullish",
  },
  {
    symbol: "XRP",
    name: "XRP",
    price: SAMPLE_PRICES.XRP,
    change1h: -0.2,
    change24h: 0.8,
    change7d: 2.6,
    volume24h: 3_200_000_000,
    marketCap: 132_100_000_000,
    rsi: 54,
    macd: "Neutral",
    ema20: 2.24,
    ema50: 2.11,
    emaBias: "Neutral",
  },
];

export function sampleSnapshot(
  prices: SamplePrices,
  cycleId: string,
  timestamp: string
): MarketSnapshot {
  return {
    cycleId,
    timestamp,
    assets: SUPPORTED_SYMBOLS.map((symbol) => ({
      symbol,
      price: prices[symbol],
    })),
    market: {},
  };
}

export function sampleQuoteAt(
  symbol: SupportedSymbol,
  price: number,
  previousPrice?: number
): MarketQuote {
  const base = marketQuotes.find((quote) => quote.symbol === symbol);

  if (!base) {
    throw new Error(`No sample quote template for ${symbol}`);
  }

  const change24h =
    previousPrice && previousPrice > 0 ? ((price - previousPrice) / previousPrice) * 100 : base.change24h;

  return {
    ...base,
    price,
    change24h,
  };
}

export function getQuote(symbol: string) {
  return marketQuotes.find((quote) => quote.symbol === symbol);
}
