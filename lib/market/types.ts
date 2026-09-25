export type SupportedSymbol = "BTC" | "ETH" | "SOL" | "BNB" | "XRP";

export type MarketVenueShare = {
  name: string;
  value: number;
};

export type NewsSignal = {
  headline: string;
  source?: string;
  sentiment?: number;
  url?: string;
};

export type BtcLiquidationSnapshotRead = {
  signal: "bullish" | "bearish" | "neutral";
  signalLabel?: string;
  reason: string;
  basedOn: "1h" | "4h" | "24h" | "blend";
  updatedAt?: string;
};

export type AssetSnapshot = {
  symbol: string;
  price: number;
  marketCap?: number;
  volume24h?: number;
  change1h?: number;
  change24h?: number;
  change7d?: number;
  rsi?: number;
  macd?: string;
  ema20?: number;
  ema50?: number;
  sentiment?: number;
};

export type MarketSnapshot = {
  cycleId: string;
  timestamp: string;
  assets: AssetSnapshot[];
  market: {
    totalMarketCap?: number;
    totalVolume24h?: number;
    btcDominance?: number;
    marketCapChange24h?: number;
    volumeChange24h?: number;
    btcDominanceChange24h?: number;
    fearGreed?: number;
    fearGreedLabel?: string;
    openInterest?: number;
    derivativesVolume24h?: number;
    derivativesVenueCount?: number;
    openInterestVenues?: MarketVenueShare[];
    derivativesVolumeVenues?: MarketVenueShare[];
    liquidations24h?: number;
    longLiquidations24h?: number;
    shortLiquidations24h?: number;
    /** Same read as Research → BTC Liquidation signal (4h-biased). */
    btcLiquidation?: BtcLiquidationSnapshotRead;
  };
  news?: NewsSignal[];
};

export interface MarketDataProvider {
  getMarketSnapshot(symbols: string[]): Promise<MarketSnapshot>;
}
