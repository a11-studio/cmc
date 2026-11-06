import { randomUUID } from "node:crypto";
import {
  cmcGetJson,
  CMC_DERIVATIVES_EXCHANGES_PATH,
  CMC_FEAR_GREED_PATH,
  CMC_GLOBAL_METRICS_PATH,
  CMC_LIQUIDATIONS_PATH,
  CMC_QUOTES_PATH,
  type CmcFetch,
} from "@/lib/market/cmc/client";
import { MarketDataError } from "@/lib/market/errors";
import {
  normalizeDerivativesExchanges,
  normalizeFearGreed,
  normalizeGlobalMetrics,
  normalizeLiquidations,
  normalizeQuotesResponse,
} from "@/lib/market/normalize";
import { ASSET_CATALOG, parseSupportedSymbols } from "@/lib/market/symbols";
import { fetchBtcLiquidationSummary } from "@/lib/market/btc-liquidation-summary";
import { rememberSnapshot } from "@/lib/market/quote-history";
import type { DailyCandleSeries } from "@/lib/market/daily-candles";
import { computeAssetTrend } from "@/lib/market/trend";
import type { MarketDataProvider, MarketSnapshot, SupportedSymbol } from "@/lib/market/types";

export type DailyCandleLoader = (
  symbols: readonly SupportedSymbol[],
  now: Date
) => Promise<ReadonlyMap<SupportedSymbol, DailyCandleSeries>>;

type CoinMarketCapProviderOptions = {
  apiKey: string;
  fetchImpl?: CmcFetch;
  now?: () => Date;
  createCycleId?: () => string;
  /** Optional daily-candle source for assets[].trend. Trend context is skipped when absent or failing. */
  loadDailyCandles?: DailyCandleLoader;
};

async function safeLoadCandles(
  loader: DailyCandleLoader | undefined,
  symbols: readonly SupportedSymbol[],
  now: Date
): Promise<ReadonlyMap<SupportedSymbol, DailyCandleSeries>> {
  if (!loader) {
    return new Map();
  }

  try {
    return await loader(symbols, now);
  } catch {
    return new Map();
  }
}

export class CoinMarketCapProvider implements MarketDataProvider {
  private readonly apiKey: string;
  private readonly fetchImpl: CmcFetch;
  private readonly now: () => Date;
  private readonly createCycleId: () => string;
  private readonly loadDailyCandles?: DailyCandleLoader;

  constructor(options: CoinMarketCapProviderOptions) {
    const apiKey = options.apiKey.trim();

    if (!apiKey) {
      throw new MarketDataError("CMC_API_KEY is not configured", "MISSING_API_KEY");
    }

    this.apiKey = apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.createCycleId = options.createCycleId ?? randomUUID;
    this.loadDailyCandles = options.loadDailyCandles;
  }

  async getMarketSnapshot(symbols: string[]): Promise<MarketSnapshot> {
    const supported = parseSupportedSymbols(symbols);
    const ids = supported.map((symbol) => String(ASSET_CATALOG[symbol].cmcId)).join(",");
    const nowDate = this.now();
    const timestamp = nowDate.toISOString();
    const cycleId = this.createCycleId();

    const [quotesPayload, globalPayload, fearGreedPayload, derivativesPayload, liquidationsPayload, btcLiquidation, dailyCandles] =
      await Promise.all([
      cmcGetJson({
        apiKey: this.apiKey,
        path: CMC_QUOTES_PATH,
        params: { id: ids, convert: "USD" },
        fetchImpl: this.fetchImpl,
        required: true,
      }),
      cmcGetJson({
        apiKey: this.apiKey,
        path: CMC_GLOBAL_METRICS_PATH,
        params: { convert: "USD" },
        fetchImpl: this.fetchImpl,
        required: false,
      }),
      cmcGetJson({
        apiKey: this.apiKey,
        path: CMC_FEAR_GREED_PATH,
        params: {},
        fetchImpl: this.fetchImpl,
        required: false,
      }),
      cmcGetJson({
        apiKey: this.apiKey,
        path: CMC_DERIVATIVES_EXCHANGES_PATH,
        params: { convert: "USD", limit: "250" },
        fetchImpl: this.fetchImpl,
        required: false,
      }),
      cmcGetJson({
        apiKey: this.apiKey,
        path: CMC_LIQUIDATIONS_PATH,
        params: { convert: "USD" },
        fetchImpl: this.fetchImpl,
        required: false,
      }),
      fetchBtcLiquidationSummary({ apiKey: this.apiKey, fetchImpl: this.fetchImpl }),
      safeLoadCandles(this.loadDailyCandles, supported, nowDate),
    ]);

    const snapshot = normalizeQuotesResponse(quotesPayload, supported, {
      cycleId,
      timestamp,
    });
    const derivatives = normalizeDerivativesExchanges(derivativesPayload);

    const assets = snapshot.assets.map((asset) => {
      const series = dailyCandles.get(asset.symbol as SupportedSymbol);
      const trend = series
        ? computeAssetTrend({ candles: series.candles, price: asset.price, source: series.source, now: nowDate })
        : undefined;
      return trend ? { ...asset, trend } : asset;
    });

    const next = {
      ...snapshot,
      assets,
      market: {
        ...(globalPayload ? normalizeGlobalMetrics(globalPayload) : {}),
        ...normalizeFearGreed(fearGreedPayload),
        ...derivatives,
        ...normalizeLiquidations(liquidationsPayload),
        ...(btcLiquidation
          ? {
              btcLiquidation: {
                signal: btcLiquidation.read.signal,
                signalLabel: btcLiquidation.read.signalLabel,
                reason: btcLiquidation.read.reason,
                basedOn: btcLiquidation.read.basedOn,
                ...(btcLiquidation.updatedAt ? { updatedAt: btcLiquidation.updatedAt } : {}),
              },
            }
          : {}),
      },
    };

    rememberSnapshot(next, timestamp);
    return next;
  }
}
