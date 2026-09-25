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

/** How one-sided the anchor window is (long vs short share). */
export type LiquidationSignalStrength = "slight" | "moderate" | "strong";

export type BtcLiquidationSignalRead = {
  signal: LiquidationSignal;
  /** UI copy, e.g. "Slightly bearish", "Strongly bullish". */
  signalLabel: string;
  strength: LiquidationSignalStrength | null;
  /** One line — why the signal leans that way. */
  reason: string;
  /** `blend` = weighted 1h + 4h + 24h (see {@link LIQUIDATION_WINDOW_BLEND_WEIGHTS}). */
  basedOn: "1h" | "4h" | "24h" | "blend";
};

/** Recency-weighted blend for the headline badge (sums to 1). */
export const LIQUIDATION_WINDOW_BLEND_WEIGHTS: Record<LiquidationWindowStats["label"], number> = {
  "1h": 0.35,
  "4h": 0.4,
  "24h": 0.25,
};

const DOMINANCE_MARGIN_PERCENT = 3;
const SLIGHT_IMBALANCE_MAX = 12;
const STRONG_IMBALANCE_MIN = 22;

const WINDOW_ORDER: LiquidationWindowStats["label"][] = ["1h", "4h", "24h"];

function liquidationImbalancePercent(window: LiquidationWindowStats): number {
  return Math.abs(window.longSharePercent - window.shortSharePercent);
}

export function liquidationSignalStrength(imbalancePercent: number): LiquidationSignalStrength {
  if (imbalancePercent <= SLIGHT_IMBALANCE_MAX) {
    return "slight";
  }

  if (imbalancePercent >= STRONG_IMBALANCE_MIN) {
    return "strong";
  }

  return "moderate";
}

export function formatLiquidationSignalLabel(
  signal: LiquidationSignal,
  strength: LiquidationSignalStrength | null
): string {
  if (signal === "neutral") {
    return "Neutral";
  }

  const direction = signal === "bullish" ? "bullish" : "bearish";
  if (strength === "slight") {
    return `Slightly ${direction}`;
  }

  if (strength === "strong") {
    return `Strongly ${direction}`;
  }

  return direction.charAt(0).toUpperCase() + direction.slice(1);
}

/** Positive = more long liquidations (bearish); negative = more short liquidations (bullish). */
export function blendedLiquidationSkew(windows: readonly LiquidationWindowStats[]): number | null {
  let weightSum = 0;
  let weightedImbalance = 0;

  for (const window of windows) {
    const weight = LIQUIDATION_WINDOW_BLEND_WEIGHTS[window.label];
    if (weight == null) {
      continue;
    }

    const imbalance = window.longSharePercent - window.shortSharePercent;
    weightedImbalance += weight * imbalance;
    weightSum += weight;
  }

  if (!(weightSum > 0)) {
    return null;
  }

  return weightedImbalance / weightSum;
}

function windowSkewSnippet(window: LiquidationWindowStats): string {
  if (window.dominantSide === "long") {
    return `${window.label} long ${window.longSharePercent.toFixed(0)}%`;
  }

  if (window.dominantSide === "short") {
    return `${window.label} short ${window.shortSharePercent.toFixed(0)}%`;
  }

  return `${window.label} balanced`;
}

function formatBlendReason(windows: readonly LiquidationWindowStats[], skew: number, signal: LiquidationSignal): string {
  const ordered = WINDOW_ORDER.map((label) => windows.find((window) => window.label === label)).filter(
    (window): window is LiquidationWindowStats => window != null
  );
  const parts = ordered.map((window) => windowSkewSnippet(window)).join(" · ");

  if (signal === "neutral") {
    return `${parts} — blended flows are balanced (${skew >= 0 ? "+" : ""}${skew.toFixed(0)} skew).`;
  }

  const bias =
    signal === "bearish"
      ? "long-liquidation bias (downside / flush risk)"
      : "short-liquidation bias (squeeze / upside risk)";

  return `${parts} — blend leans ${bias} (${skew >= 0 ? "+" : ""}${skew.toFixed(0)} weighted skew).`;
}

function readFromBlendedWindows(windows: readonly LiquidationWindowStats[]): BtcLiquidationSignalRead {
  const skew = blendedLiquidationSkew(windows);

  if (skew == null) {
    return {
      signal: "neutral",
      strength: null,
      signalLabel: formatLiquidationSignalLabel("neutral", null),
      reason: "No BTC liquidation windows returned.",
      basedOn: "blend",
    };
  }

  const magnitude = Math.abs(skew);

  if (magnitude <= DOMINANCE_MARGIN_PERCENT) {
    return {
      signal: "neutral",
      strength: null,
      signalLabel: formatLiquidationSignalLabel("neutral", null),
      reason: formatBlendReason(windows, skew, "neutral"),
      basedOn: "blend",
    };
  }

  const signal: LiquidationSignal = skew > 0 ? "bearish" : "bullish";
  const strength = liquidationSignalStrength(magnitude);

  return {
    signal,
    strength,
    signalLabel: formatLiquidationSignalLabel(signal, strength),
    reason: formatBlendReason(windows, skew, signal),
    basedOn: "blend",
  };
}

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
    longSharePercent > shortSharePercent + DOMINANCE_MARGIN_PERCENT
      ? "long"
      : shortSharePercent > longSharePercent + DOMINANCE_MARGIN_PERCENT
        ? "short"
        : "even";

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
  if (windows.length === 0) {
    return {
      signal: "neutral",
      strength: null,
      signalLabel: formatLiquidationSignalLabel("neutral", null),
      reason: "No BTC liquidation windows returned.",
      basedOn: "blend",
    };
  }

  return readFromBlendedWindows(windows);
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
