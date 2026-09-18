import { MarketDataError } from "@/lib/market/errors";
import type { AssetSnapshot, MarketSnapshot } from "@/lib/market/types";
import type {
  CmcAsset,
  CmcDerivativesExchange,
  CmcDerivativesExchangesResponse,
  CmcDerivativeQuote,
  CmcFearGreedLatest,
  CmcFearGreedResponse,
  CmcGlobalMetricsResponse,
  CmcLiquidationQuote,
  CmcLiquidationsResponse,
  CmcQuote,
  CmcQuotesResponse,
} from "@/lib/market/cmc/types";
import { ASSET_CATALOG, normalizeSymbol } from "@/lib/market/symbols";
import type { SupportedSymbol } from "@/lib/market/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function percentFromPrior(current?: number, prior?: number): number | undefined {
  if (current == null || prior == null || !(Math.abs(prior) > 0)) {
    return undefined;
  }

  return ((current - prior) / Math.abs(prior)) * 100;
}

function yesterdayChange(provided?: number, current?: number, yesterday?: number): number | undefined {
  return provided ?? percentFromPrior(current, yesterday);
}

function flattenAssets(data: unknown): CmcAsset[] {
  if (Array.isArray(data)) {
    return data.filter(isRecord) as CmcAsset[];
  }

  if (!isRecord(data)) {
    return [];
  }

  const assets: CmcAsset[] = [];

  for (const value of Object.values(data)) {
    if (Array.isArray(value)) {
      assets.push(...(value.filter(isRecord) as CmcAsset[]));
    } else if (isRecord(value)) {
      assets.push(value as CmcAsset);
    }
  }

  return assets;
}

function usdQuote(asset: CmcAsset): CmcQuote | undefined {
  const quote = asset.quote;

  if (!quote) {
    return undefined;
  }

  if (Array.isArray(quote)) {
    return (
      quote.find((item) => normalizeSymbol(item.symbol ?? "") === "USD") ??
      quote.find((item) => optionalNumber(item.price) !== undefined)
    );
  }

  return quote.USD ?? quote.usd;
}

function pickAsset(assets: CmcAsset[], symbol: SupportedSymbol): CmcAsset | undefined {
  const cmcId = ASSET_CATALOG[symbol].cmcId;
  const matches = assets.filter((asset) => {
    if (normalizeSymbol(asset.symbol ?? "") === symbol) {
      return true;
    }

    return asset.id === cmcId;
  });

  if (matches.length === 0) {
    return undefined;
  }

  return [...matches].sort((a, b) => (a.cmc_rank ?? Number.MAX_SAFE_INTEGER) - (b.cmc_rank ?? Number.MAX_SAFE_INTEGER))[0];
}

export function assertCmcStatus(status: CmcQuotesResponse["status"] | CmcGlobalMetricsResponse["status"]) {
  const errorCode = Number(status?.error_code ?? 0);

  if (errorCode === 0) {
    return;
  }

  if (!Number.isFinite(errorCode)) {
    throw new MarketDataError("CoinMarketCap returned a malformed payload", "MALFORMED_RESPONSE");
  }

  throw new MarketDataError(
    status?.error_message?.trim() || "CoinMarketCap returned an error",
    errorCode === 401 || errorCode === 1001 || errorCode === 1002
      ? "CMC_UNAUTHORIZED"
      : errorCode === 429
        ? "CMC_RATE_LIMIT"
        : "CMC_UNAVAILABLE"
  );
}

export function toAssetSnapshot(asset: CmcAsset, symbol: SupportedSymbol): AssetSnapshot {
  const quote = usdQuote(asset);
  const price = optionalNumber(quote?.price);

  if (price === undefined) {
    throw new MarketDataError(
      `CoinMarketCap did not return a usable price for ${symbol}`,
      "MALFORMED_RESPONSE"
    );
  }

  return {
    symbol,
    price,
    marketCap: optionalNumber(quote?.market_cap),
    volume24h: optionalNumber(quote?.volume_24h),
    change1h: optionalNumber(quote?.percent_change_1h),
    change24h: optionalNumber(quote?.percent_change_24h),
    change7d: optionalNumber(quote?.percent_change_7d),
  };
}

export function normalizeQuotesResponse(
  payload: unknown,
  symbols: SupportedSymbol[],
  meta: { cycleId: string; timestamp: string }
): Omit<MarketSnapshot, "market" | "news"> & { market?: MarketSnapshot["market"] } {
  if (!isRecord(payload)) {
    throw new MarketDataError("CoinMarketCap returned a malformed payload", "MALFORMED_RESPONSE");
  }

  const response = payload as CmcQuotesResponse;
  assertCmcStatus(response.status);

  const assets = flattenAssets(response.data);
  const normalized: AssetSnapshot[] = [];

  for (const symbol of symbols) {
    const match = pickAsset(assets, symbol);

    if (!match) {
      throw new MarketDataError(
        `CoinMarketCap did not return ${symbol}`,
        "MISSING_ASSETS"
      );
    }

    normalized.push(toAssetSnapshot(match, symbol));
  }

  return {
    cycleId: meta.cycleId,
    timestamp: snapshotTimestamp(assets, meta.timestamp),
    assets: normalized,
  };
}

export function normalizeGlobalMetrics(payload: unknown): MarketSnapshot["market"] {
  if (!isRecord(payload)) {
    return {};
  }

  const response = payload as CmcGlobalMetricsResponse;
  const errorCode = Number(response.status?.error_code ?? 0);

  if (!Number.isFinite(errorCode) || errorCode !== 0) {
    return {};
  }

  const usd = response.data?.quote?.USD;
  const totalMarketCap = optionalNumber(usd?.total_market_cap);
  const totalVolume24h = optionalNumber(usd?.total_volume_24h);
  const btcDominance = optionalNumber(response.data?.btc_dominance);
  const derivativesVolume =
    optionalNumber(usd?.derivatives_volume_24h) ??
    optionalNumber(response.data?.derivatives_volume_24h) ??
    optionalNumber(response.data?.derivatives_volume_24h_reported);

  return {
    totalMarketCap,
    totalVolume24h,
    btcDominance,
    marketCapChange24h: yesterdayChange(
      optionalNumber(usd?.total_market_cap_yesterday_percentage_change),
      totalMarketCap,
      optionalNumber(usd?.total_market_cap_yesterday)
    ),
    volumeChange24h: yesterdayChange(
      optionalNumber(usd?.total_volume_24h_yesterday_percentage_change),
      totalVolume24h,
      optionalNumber(usd?.total_volume_24h_yesterday)
    ),
    btcDominanceChange24h: yesterdayChange(
      optionalNumber(response.data?.btc_dominance_24h_percentage_change),
      btcDominance,
      optionalNumber(response.data?.btc_dominance_yesterday)
    ),
    ...(derivativesVolume == null ? {} : { derivativesVolume24h: derivativesVolume }),
  };
}

function cmcStatusOk(status: CmcQuotesResponse["status"] | undefined): boolean {
  const errorCode = Number(status?.error_code ?? 0);
  return Number.isFinite(errorCode) && errorCode === 0;
}

function fearGreedRecord(data: CmcFearGreedResponse["data"]): CmcFearGreedLatest | undefined {
  if (Array.isArray(data)) {
    return data.find(isRecord) as CmcFearGreedLatest | undefined;
  }

  return isRecord(data) ? (data as CmcFearGreedLatest) : undefined;
}

export function normalizeFearGreed(payload: unknown): Pick<MarketSnapshot["market"], "fearGreed" | "fearGreedLabel"> {
  if (!isRecord(payload)) {
    return {};
  }

  const response = payload as CmcFearGreedResponse;

  if (!cmcStatusOk(response.status)) {
    return {};
  }

  const latest = fearGreedRecord(response.data);
  const value = optionalNumber(typeof latest?.value === "string" ? Number(latest.value) : latest?.value);
  const label = latest?.value_classification?.trim();

  return {
    ...(value == null ? {} : { fearGreed: value }),
    ...(label ? { fearGreedLabel: label } : {}),
  };
}

function usdDerivativeQuote(exchange: CmcDerivativesExchange): CmcDerivativeQuote | undefined {
  const quotes = exchange.quotes;

  if (Array.isArray(quotes)) {
    return (
      quotes.find((item) => normalizeSymbol(item.convert_symbol ?? "") === "USD") ??
      quotes.find(
        (item) =>
          optionalNumber(item.open_interest_usd) !== undefined ||
          optionalNumber(item.derivative_volume_usd) !== undefined ||
          optionalNumber(item.open_interest) !== undefined
      )
    );
  }

  return exchange.quote?.USD ?? exchange.quote?.usd;
}

function flattenDerivativesExchanges(data: CmcDerivativesExchangesResponse["data"]): CmcDerivativesExchange[] {
  if (Array.isArray(data)) {
    return data.filter(isRecord) as CmcDerivativesExchange[];
  }

  if (isRecord(data) && Array.isArray(data.exchanges)) {
    return data.exchanges.filter(isRecord) as CmcDerivativesExchange[];
  }

  return [];
}

export function normalizeDerivativesExchanges(
  payload: unknown
): Pick<
  MarketSnapshot["market"],
  | "openInterest"
  | "derivativesVolume24h"
  | "derivativesVenueCount"
  | "openInterestVenues"
  | "derivativesVolumeVenues"
> {
  if (!isRecord(payload)) {
    return {};
  }

  const response = payload as CmcDerivativesExchangesResponse;

  if (!cmcStatusOk(response.status)) {
    return {};
  }

  const exchanges = flattenDerivativesExchanges(response.data);
  const openInterestVenues: MarketSnapshot["market"]["openInterestVenues"] = [];
  const derivativesVolumeVenues: MarketSnapshot["market"]["derivativesVolumeVenues"] = [];
  let openInterest = 0;
  let volume = 0;
  let venues = 0;
  let hasOpenInterest = false;
  let hasVolume = false;

  for (const exchange of exchanges) {
    const quote = usdDerivativeQuote(exchange);
    const interest = optionalNumber(quote?.open_interest_usd) ?? optionalNumber(quote?.open_interest);
    const derivativeVolume = optionalNumber(quote?.derivative_volume_usd) ?? optionalNumber(quote?.derivative_volume);
    const name = exchange.exchange_name?.trim() || "Unnamed venue";

    if (interest != null || derivativeVolume != null) {
      venues += 1;
    }

    if (interest != null) {
      openInterest += interest;
      hasOpenInterest = true;
      openInterestVenues.push({ name, value: interest });
    }

    if (derivativeVolume != null) {
      volume += derivativeVolume;
      hasVolume = true;
      derivativesVolumeVenues.push({ name, value: derivativeVolume });
    }
  }

  return {
    ...(hasOpenInterest ? { openInterest, openInterestVenues } : {}),
    ...(hasVolume ? { derivativesVolume24h: volume, derivativesVolumeVenues } : {}),
    ...(venues > 0 ? { derivativesVenueCount: venues } : {}),
  };
}

function usdLiquidationQuote(data: CmcLiquidationsResponse["data"]): CmcLiquidationQuote | undefined {
  if (!data) {
    return undefined;
  }

  if (Array.isArray(data.quotes)) {
    return (
      data.quotes.find((item) => normalizeSymbol(item.symbol ?? "") === "USD") ??
      data.quotes.find((item) => optionalNumber(item.total_liquidations_24h) !== undefined)
    );
  }

  return data.quote?.USD ?? data.quote?.usd ?? data;
}

export function normalizeLiquidations(
  payload: unknown
): Pick<MarketSnapshot["market"], "liquidations24h" | "longLiquidations24h" | "shortLiquidations24h"> {
  if (!isRecord(payload)) {
    return {};
  }

  const response = payload as CmcLiquidationsResponse;

  if (!cmcStatusOk(response.status)) {
    return {};
  }

  const quote = usdLiquidationQuote(response.data);
  const total = optionalNumber(quote?.total_liquidations_24h);
  const longs = optionalNumber(quote?.long_liquidations_24h);
  const shorts = optionalNumber(quote?.short_liquidations_24h);

  return {
    ...(total == null ? {} : { liquidations24h: total }),
    ...(longs == null ? {} : { longLiquidations24h: longs }),
    ...(shorts == null ? {} : { shortLiquidations24h: shorts }),
  };
}

export function snapshotTimestamp(assets: CmcAsset[], fallback: string): string {
  for (const asset of assets) {
    const updated = usdQuote(asset)?.last_updated;
    if (typeof updated === "string" && updated.length > 0) {
      return updated;
    }
  }

  return fallback;
}
