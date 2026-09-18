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
import { rememberSnapshot } from "@/lib/market/quote-history";
import type { MarketDataProvider, MarketSnapshot } from "@/lib/market/types";

type CoinMarketCapProviderOptions = {
  apiKey: string;
  fetchImpl?: CmcFetch;
  now?: () => Date;
  createCycleId?: () => string;
};

export class CoinMarketCapProvider implements MarketDataProvider {
  private readonly apiKey: string;
  private readonly fetchImpl: CmcFetch;
  private readonly now: () => Date;
  private readonly createCycleId: () => string;

  constructor(options: CoinMarketCapProviderOptions) {
    const apiKey = options.apiKey.trim();

    if (!apiKey) {
      throw new MarketDataError("CMC_API_KEY is not configured", "MISSING_API_KEY");
    }

    this.apiKey = apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.createCycleId = options.createCycleId ?? randomUUID;
  }

  async getMarketSnapshot(symbols: string[]): Promise<MarketSnapshot> {
    const supported = parseSupportedSymbols(symbols);
    const ids = supported.map((symbol) => String(ASSET_CATALOG[symbol].cmcId)).join(",");
    const timestamp = this.now().toISOString();
    const cycleId = this.createCycleId();

    const [quotesPayload, globalPayload, fearGreedPayload, derivativesPayload, liquidationsPayload] = await Promise.all([
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
    ]);

    const snapshot = normalizeQuotesResponse(quotesPayload, supported, {
      cycleId,
      timestamp,
    });
    const derivatives = normalizeDerivativesExchanges(derivativesPayload);

    const next = {
      ...snapshot,
      market: {
        ...(globalPayload ? normalizeGlobalMetrics(globalPayload) : {}),
        ...normalizeFearGreed(fearGreedPayload),
        ...derivatives,
        ...normalizeLiquidations(liquidationsPayload),
      },
    };

    rememberSnapshot(next, timestamp);
    return next;
  }
}
