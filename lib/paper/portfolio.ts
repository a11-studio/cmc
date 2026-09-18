import { isSupportedSymbol, normalizeSymbol } from "@/lib/market/symbols";
import type { MarketSnapshot } from "@/lib/market/types";
import type { SupportedSymbol } from "@/lib/market/types";
import { PaperTradingError } from "@/lib/paper/errors";
import type { OpenPosition, PaperAccount, PaperValuation, Portfolio, Position } from "@/lib/paper/types";

export const INITIAL_CAPITAL = 10_000;
const QUANTITY_EPSILON = 1e-10;

export function createPaperAccount(initialCapital = INITIAL_CAPITAL): PaperAccount {
  if (!(initialCapital > 0) || !Number.isFinite(initialCapital)) {
    throw new PaperTradingError("Initial capital must be a positive number", "INVALID_ALLOCATION");
  }

  return {
    initialCapital,
    cash: initialCapital,
    peakEquity: initialCapital,
    realizedPnl: 0,
    positions: [],
    trades: [],
  };
}

export function snapshotPrices(snapshot: MarketSnapshot): Map<SupportedSymbol, number> {
  if (!snapshot || !Array.isArray(snapshot.assets)) {
    throw new PaperTradingError("Market snapshot is invalid", "INVALID_SNAPSHOT");
  }

  const prices = new Map<SupportedSymbol, number>();

  for (const asset of snapshot.assets) {
    const symbol = normalizeSymbol(asset.symbol);

    if (!isSupportedSymbol(symbol) || !Number.isFinite(asset.price) || asset.price <= 0) {
      continue;
    }

    prices.set(symbol, asset.price);
  }

  return prices;
}

export function requirePrice(
  prices: Map<SupportedSymbol, number>,
  symbol: SupportedSymbol
): number {
  const price = prices.get(symbol);

  if (price === undefined) {
    throw new PaperTradingError(
      `Market snapshot does not include an execution price for ${symbol}`,
      "MISSING_PRICE"
    );
  }

  return price;
}

export function findPosition(
  positions: readonly OpenPosition[],
  symbol: SupportedSymbol
): OpenPosition | undefined {
  return positions.find((position) => position.symbol === symbol);
}

export function isClosedQuantity(quantity: number): boolean {
  return Math.abs(quantity) <= QUANTITY_EPSILON;
}

export function markToMarket(
  account: PaperAccount,
  snapshot: MarketSnapshot
): PaperValuation {
  const prices = snapshotPrices(snapshot);

  for (const position of account.positions) {
    requirePrice(prices, position.symbol);
  }

  const valued: Position[] = account.positions.map((position) => {
    const currentPrice = requirePrice(prices, position.symbol);
    const marketValue = currentPrice * position.quantity;
    const unrealizedPnl = (currentPrice - position.averageEntryPrice) * position.quantity;

    return {
      symbol: position.symbol,
      quantity: position.quantity,
      averageEntryPrice: position.averageEntryPrice,
      currentPrice,
      marketValue,
      unrealizedPnl,
      allocationPercent: 0,
    };
  });

  const marketValue = valued.reduce((sum, position) => sum + position.marketValue, 0);
  const unrealizedPnl = valued.reduce((sum, position) => sum + position.unrealizedPnl, 0);
  const equity = account.cash + marketValue;
  const peakEquity = Math.max(account.peakEquity, equity);
  const returnPercent =
    account.initialCapital === 0
      ? 0
      : ((equity - account.initialCapital) / account.initialCapital) * 100;
  const drawdownPercent = peakEquity === 0 ? 0 : ((peakEquity - equity) / peakEquity) * 100;

  const positions = valued.map((position) => ({
    ...position,
    allocationPercent: equity === 0 ? 0 : (position.marketValue / equity) * 100,
  }));

  const portfolio: Portfolio = {
    cash: account.cash,
    equity,
    realizedPnl: account.realizedPnl,
    unrealizedPnl,
    returnPercent,
    drawdownPercent,
  };

  return { portfolio, positions };
}

export function withPeakEquity(account: PaperAccount, equity: number): PaperAccount {
  return {
    ...account,
    peakEquity: Math.max(account.peakEquity, equity),
  };
}
