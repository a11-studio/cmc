import { MarketDataError } from "@/lib/market/errors";
import type { SupportedSymbol } from "@/lib/market/types";

export const SUPPORTED_SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "XRP"] as const satisfies readonly SupportedSymbol[];

export const ASSET_CATALOG: Record<
  SupportedSymbol,
  { name: string; cmcId: number }
> = {
  BTC: { name: "Bitcoin", cmcId: 1 },
  ETH: { name: "Ethereum", cmcId: 1027 },
  SOL: { name: "Solana", cmcId: 5426 },
  BNB: { name: "BNB", cmcId: 1839 },
  XRP: { name: "XRP", cmcId: 52 },
};

export function isSupportedSymbol(value: string): value is SupportedSymbol {
  return (SUPPORTED_SYMBOLS as readonly string[]).includes(value);
}

export function supportedSymbolsList(): string {
  const last = SUPPORTED_SYMBOLS.at(-1);

  if (SUPPORTED_SYMBOLS.length <= 1 || last == null) {
    return last ?? "";
  }

  return `${SUPPORTED_SYMBOLS.slice(0, -1).join(", ")}, and ${last}`;
}

export function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

export function parseSupportedSymbols(symbols: string[]): SupportedSymbol[] {
  if (symbols.length === 0) {
    throw new MarketDataError("At least one symbol is required", "UNSUPPORTED_SYMBOL");
  }

  const unique: SupportedSymbol[] = [];

  for (const raw of symbols) {
    const symbol = normalizeSymbol(raw);

    if (!isSupportedSymbol(symbol)) {
      throw new MarketDataError(
        `Unsupported symbol: ${raw}. Arena currently supports ${supportedSymbolsList()}.`,
        "UNSUPPORTED_SYMBOL"
      );
    }

    if (!unique.includes(symbol)) {
      unique.push(symbol);
    }
  }

  return unique;
}
