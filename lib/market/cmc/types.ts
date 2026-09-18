export type CmcStatus = {
  error_code?: number | string;
  error_message?: string | null;
};

export type CmcQuote = {
  symbol?: string;
  price?: number | null;
  volume_24h?: number | null;
  market_cap?: number | null;
  percent_change_1h?: number | null;
  percent_change_24h?: number | null;
  percent_change_7d?: number | null;
  last_updated?: string | null;
};

export type CmcAsset = {
  id?: number;
  name?: string;
  symbol?: string;
  cmc_rank?: number;
  quote?: CmcQuote[] | Record<string, CmcQuote | undefined>;
};

export type CmcQuotesResponse = {
  status?: CmcStatus;
  data?: unknown;
};

export type CmcGlobalMetricsResponse = {
  status?: CmcStatus;
  data?: {
    btc_dominance?: number | null;
    btc_dominance_yesterday?: number | null;
    btc_dominance_24h_percentage_change?: number | null;
    derivatives_volume_24h?: number | null;
    derivatives_volume_24h_reported?: number | null;
    quote?: Record<
      string,
      {
        total_market_cap?: number | null;
        total_market_cap_yesterday?: number | null;
        total_volume_24h?: number | null;
        total_volume_24h_yesterday?: number | null;
        total_market_cap_yesterday_percentage_change?: number | null;
        total_volume_24h_yesterday_percentage_change?: number | null;
        derivatives_volume_24h?: number | null;
      }
    >;
  };
};

export type CmcFearGreedLatest = {
  value?: number | string | null;
  value_classification?: string | null;
  update_time?: string | null;
};

export type CmcFearGreedResponse = {
  status?: CmcStatus;
  data?: CmcFearGreedLatest | CmcFearGreedLatest[];
};

export type CmcDerivativeQuote = {
  convert_symbol?: string | null;
  open_interest?: number | null;
  open_interest_usd?: number | null;
  derivative_volume?: number | null;
  derivative_volume_usd?: number | null;
};

export type CmcDerivativesExchange = {
  exchange_id?: number;
  exchange_name?: string | null;
  quotes?: CmcDerivativeQuote[];
  quote?: Record<string, CmcDerivativeQuote | undefined>;
};

export type CmcDerivativesExchangesResponse = {
  status?: CmcStatus;
  data?: {
    exchanges?: CmcDerivativesExchange[];
  } | CmcDerivativesExchange[];
};

export type CmcLiquidationQuote = {
  symbol?: string | null;
  total_liquidations_24h?: number | null;
  long_liquidations_24h?: number | null;
  short_liquidations_24h?: number | null;
};

export type CmcLiquidationsResponse = {
  status?: CmcStatus;
  data?: {
    quotes?: CmcLiquidationQuote[];
    quote?: Record<string, CmcLiquidationQuote | undefined>;
    total_liquidations_24h?: number | null;
    long_liquidations_24h?: number | null;
    short_liquidations_24h?: number | null;
  };
};
