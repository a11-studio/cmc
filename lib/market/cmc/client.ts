import { MarketDataError } from "@/lib/market/errors";
import type { CmcQuotesResponse } from "@/lib/market/cmc/types";

export const CMC_BASE_URL = "https://pro-api.coinmarketcap.com";
export const CMC_QUOTES_PATH = "/v3/cryptocurrency/quotes/latest";
export const CMC_GLOBAL_METRICS_PATH = "/v1/global-metrics/quotes/latest";
export const CMC_FEAR_GREED_PATH = "/v3/fear-and-greed/latest";
export const CMC_DERIVATIVES_EXCHANGES_PATH = "/v5/exchange/derivatives/list";
export const CMC_LIQUIDATIONS_PATH = "/v5/derivatives/liquidations/quotes/latest";
export const CMC_REVALIDATE_SECONDS = 60;
/** Without this a stalled connection holds the agent cycle open indefinitely. */
export const CMC_TIMEOUT_MS = 15_000;

export type CmcFetch = (input: string, init?: RequestInit) => Promise<Response>;

type CmcGetOptions = {
  apiKey: string;
  path: string;
  params: Record<string, string>;
  fetchImpl: CmcFetch;
  required: boolean;
};

function buildUrl(path: string, params: Record<string, string>): string {
  const url = new URL(path, CMC_BASE_URL);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

function errorFromStatus(status: number): MarketDataError {
  if (status === 401 || status === 403) {
    return new MarketDataError(
      "CoinMarketCap rejected the request. Check CMC_API_KEY.",
      "CMC_UNAUTHORIZED"
    );
  }

  if (status === 429) {
    return new MarketDataError("CoinMarketCap rate limit exceeded", "CMC_RATE_LIMIT");
  }

  return new MarketDataError("CoinMarketCap is unavailable", "CMC_UNAVAILABLE");
}

export async function cmcGetJson({
  apiKey,
  path,
  params,
  fetchImpl,
  required,
}: CmcGetOptions): Promise<unknown | null> {
  const url = buildUrl(path, params);

  let response: Response;

  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-CMC_PRO_API_KEY": apiKey,
      },
      signal: AbortSignal.timeout(CMC_TIMEOUT_MS),
      next: { revalidate: CMC_REVALIDATE_SECONDS },
    } as RequestInit);
  } catch (cause) {
    if (!required) {
      return null;
    }

    throw new MarketDataError("CoinMarketCap is unavailable", "CMC_UNAVAILABLE", { cause });
  }

  if (!response.ok) {
    if (!required) {
      return null;
    }

    throw errorFromStatus(response.status);
  }

  try {
    return (await response.json()) as CmcQuotesResponse;
  } catch (cause) {
    if (!required) {
      return null;
    }

    throw new MarketDataError("CoinMarketCap returned a malformed payload", "MALFORMED_RESPONSE", {
      cause,
    });
  }
}
