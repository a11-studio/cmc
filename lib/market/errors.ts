export type MarketDataErrorCode =
  | "MISSING_API_KEY"
  | "UNSUPPORTED_SYMBOL"
  | "CMC_UNAVAILABLE"
  | "CMC_UNAUTHORIZED"
  | "CMC_RATE_LIMIT"
  | "MALFORMED_RESPONSE"
  | "MISSING_ASSETS";

export class MarketDataError extends Error {
  readonly code: MarketDataErrorCode;

  constructor(message: string, code: MarketDataErrorCode, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "MarketDataError";
    this.code = code;
  }
}

export function isMarketDataError(error: unknown): error is MarketDataError {
  return error instanceof MarketDataError;
}
