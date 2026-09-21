import {
  cmcGetJson,
  CMC_LIQUIDATIONS_BY_CRYPTO_PATH,
  type CmcFetch,
} from "@/lib/market/cmc/client";
import { ASSET_CATALOG } from "@/lib/market/symbols";

export type LiquidationWindowStats = {
  label: "1h" | "4h" | "24h";
  totalUsd: number;
  longUsd: number;
  shortUsd: number;
  longSharePercent: number;
  shortSharePercent: number;
  dominantSide: "long" | "short" | "even";
};

export type LiquidationSignal = "bullish" | "bearish" | "neutral";

export type BtcLiquidationSignalRead = {
  signal: LiquidationSignal;
  /** One line — why the signal leans that way. */
  reason: string;
  basedOn: "1h" | "4h" | "24h";
};

export type BtcLiquidationSummary = {
  symbol: "BTC";
  windows: LiquidationWindowStats[];
  read: BtcLiquidationSignalRead;
  updatedAt?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function cmcStatusOk(status: unknown): boolean {
  if (!isRecord(status)) {
    return false;
  }

  return Number(status.error_code) === 0;
}

function readWindow(
  quote: Record<string, unknown>,
  label: LiquidationWindowStats["label"]
): LiquidationWindowStats | null {
  const suffix = label;
  const total = optionalNumber(quote[`total_liquidations_${suffix}`]);
  const longUsd = optionalNumber(quote[`long_liquidations_${suffix}`]) ?? 0;
  const shortUsd = optionalNumber(quote[`short_liquidations_${suffix}`]) ?? 0;
  const totalUsd = total ?? longUsd + shortUsd;

  if (!(totalUsd > 0)) {
    return null;
  }

  const longSharePercent = (longUsd / totalUsd) * 100;
  const shortSharePercent = (shortUsd / totalUsd) * 100;
  const dominantSide =
    longSharePercent > shortSharePercent + 3 ? "long" : shortSharePercent > longSharePercent + 3 ? "short" : "even";

  return {
    label,
    totalUsd,
    longUsd,
    shortUsd,
    longSharePercent,
    shortSharePercent,
    dominantSide,
  };
}

export function buildBtcLiquidationSignalRead(windows: readonly LiquidationWindowStats[]): BtcLiquidationSignalRead {
  const anchor = windows.find((window) => window.label === "4h") ?? windows.find((window) => window.label === "1h");

  if (!anchor) {
    return {
      signal: "neutral",
      reason: "No BTC liquidation windows returned.",
      basedOn: "4h",
    };
  }

  if (anchor.dominantSide === "short") {
    return {
      signal: "bullish",
      reason: `Shorts took ${anchor.shortSharePercent.toFixed(0)}% of ${anchor.label} liquidations — squeeze / upside bias.`,
      basedOn: anchor.label,
    };
  }

  if (anchor.dominantSide === "long") {
    return {
      signal: "bearish",
      reason: `Longs took ${anchor.longSharePercent.toFixed(0)}% of ${anchor.label} liquidations — flush / downside bias.`,
      basedOn: anchor.label,
    };
  }

  return {
    signal: "neutral",
    reason: `Long and short liquidations are balanced over ${anchor.label}.`,
    basedOn: anchor.label,
  };
}

export function normalizeBtcLiquidationSummaryPayload(payload: unknown): BtcLiquidationSummary | null {
  if (!isRecord(payload) || !cmcStatusOk(payload.status) || !isRecord(payload.data)) {
    return null;
  }

  const list = payload.data.cryptocurrencies;
  const entry = Array.isArray(list)
    ? list.find((row) => isRecord(row) && (row.symbol === "BTC" || row.crypto_id === ASSET_CATALOG.BTC.cmcId)) ??
      list[0]
    : null;

  if (!isRecord(entry)) {
    return null;
  }

  const quotes = entry.quotes;
  const quote = Array.isArray(quotes)
    ? (quotes.find((row) => isRecord(row) && row.symbol === "USD") as Record<string, unknown> | undefined) ??
      (isRecord(quotes[0]) ? quotes[0] : null)
    : isRecord(quotes)
      ? quotes
      : null;

  if (!isRecord(quote)) {
    return null;
  }

  const windows = (["1h", "4h", "24h"] as const)
    .map((label) => readWindow(quote, label))
    .filter((window): window is LiquidationWindowStats => window != null);

  if (windows.length === 0) {
    return null;
  }

  const updatedAt = typeof quote.last_updated === "string" ? quote.last_updated : undefined;

  return {
    symbol: "BTC",
    windows,
    read: buildBtcLiquidationSignalRead(windows),
    updatedAt,
  };
}

export async function fetchBtcLiquidationSummary(input: {
  apiKey: string;
  fetchImpl?: CmcFetch;
}): Promise<BtcLiquidationSummary | null> {
  const payload = await cmcGetJson({
    apiKey: input.apiKey,
    path: CMC_LIQUIDATIONS_BY_CRYPTO_PATH,
    params: {
      crypto_id: String(ASSET_CATALOG.BTC.cmcId),
      crypto_symbol: "BTC",
      convert: "USD",
      limit: "1",
    },
    fetchImpl: input.fetchImpl ?? fetch,
    required: false,
  });

  if (!payload) {
    return null;
  }

  return normalizeBtcLiquidationSummaryPayload(payload);
}
