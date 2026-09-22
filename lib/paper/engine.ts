import { randomUUID } from "node:crypto";
import { isSupportedSymbol, normalizeSymbol, supportedSymbolsList } from "@/lib/market/symbols";
import type { MarketSnapshot } from "@/lib/market/types";
import type { SupportedSymbol } from "@/lib/market/types";
import { PaperTradingError } from "@/lib/paper/errors";
import {
  findPosition,
  isClosedQuantity,
  markToMarket,
  requirePrice,
  snapshotPrices,
  withPeakEquity,
} from "@/lib/paper/portfolio";
import type {
  ExecutePaperDecisionOptions,
  OpenPosition,
  PaperAccount,
  PaperExecution,
  PaperTradingErrorCode,
  Trade,
  TradeAction,
  TradeDecision,
} from "@/lib/paper/types";

const ACTIONS: readonly TradeAction[] = ["BUY", "SELL", "HOLD", "SHORT"];
const QUANTITY_EPSILON = 1e-10;

function reject(
  account: PaperAccount,
  snapshot: MarketSnapshot | undefined,
  action: TradeAction,
  code: PaperTradingErrorCode,
  reason: string
): PaperExecution {
  return {
    ok: false,
    action,
    code,
    reason,
    account,
    valuation: snapshot ? safeValuation(account, snapshot) : undefined,
  };
}

function safeValuation(account: PaperAccount, snapshot: MarketSnapshot) {
  try {
    return markToMarket(account, snapshot);
  } catch {
    return undefined;
  }
}

function parseAction(action: string): TradeAction | undefined {
  return ACTIONS.find((item) => item === action);
}

function parseSymbol(symbol: string): SupportedSymbol | undefined {
  const normalized = normalizeSymbol(symbol);
  return isSupportedSymbol(normalized) ? normalized : undefined;
}

function replacePosition(
  positions: readonly OpenPosition[],
  next: OpenPosition | { symbol: SupportedSymbol; close: true }
): OpenPosition[] {
  const remaining = positions.filter((position) => position.symbol !== next.symbol);

  if ("close" in next) {
    return remaining;
  }

  return [...remaining, next];
}

function applySignedFill(
  existing: OpenPosition | undefined,
  signedQuantity: number,
  price: number,
  symbol: SupportedSymbol
): { next: OpenPosition | { symbol: SupportedSymbol; close: true }; realizedPnl: number; closedAbs: number } {
  if (!existing || isClosedQuantity(existing.quantity)) {
    return {
      next: { symbol, quantity: signedQuantity, averageEntryPrice: price },
      realizedPnl: 0,
      closedAbs: 0,
    };
  }

  const sameDirection =
    (existing.quantity > 0 && signedQuantity > 0) || (existing.quantity < 0 && signedQuantity < 0);

  if (sameDirection) {
    const totalQuantity = existing.quantity + signedQuantity;
    const averageEntryPrice =
      (existing.quantity * existing.averageEntryPrice + signedQuantity * price) / totalQuantity;

    return {
      next: { symbol, quantity: totalQuantity, averageEntryPrice },
      realizedPnl: 0,
      closedAbs: 0,
    };
  }

  const existingAbs = Math.abs(existing.quantity);
  const fillAbs = Math.abs(signedQuantity);
  const closedAbs = Math.min(existingAbs, fillAbs);
  const existingSign = existing.quantity > 0 ? 1 : -1;
  const realizedPnl = (price - existing.averageEntryPrice) * existingSign * closedAbs;
  const remainingQty = existing.quantity + signedQuantity;

  if (isClosedQuantity(remainingQty)) {
    return { next: { symbol, close: true }, realizedPnl, closedAbs };
  }

  if (fillAbs + QUANTITY_EPSILON < existingAbs) {
    return {
      next: {
        symbol,
        quantity: remainingQty,
        averageEntryPrice: existing.averageEntryPrice,
      },
      realizedPnl,
      closedAbs,
    };
  }

  return {
    next: { symbol, quantity: remainingQty, averageEntryPrice: price },
    realizedPnl,
    closedAbs,
  };
}

function commitFill(input: {
  account: PaperAccount;
  snapshot: MarketSnapshot;
  action: Exclude<TradeAction, "HOLD">;
  symbol: SupportedSymbol;
  signedQuantity: number;
  price: number;
  createdAt: string;
  createTradeId: () => string;
}): PaperExecution {
  const { account, snapshot, action, symbol, signedQuantity, price, createdAt, createTradeId } = input;
  const existing = findPosition(account.positions, symbol);
  const fill = applySignedFill(existing, signedQuantity, price, symbol);
  const quantity = Math.abs(signedQuantity);
  const notional = quantity * price;
  const includeRealized = fill.closedAbs > QUANTITY_EPSILON || action === "SELL";

  const trade: Trade = {
    id: createTradeId(),
    symbol,
    side: action,
    quantity,
    price,
    notional,
    cycleId: snapshot.cycleId,
    createdAt,
    ...(includeRealized ? { realizedPnl: fill.realizedPnl } : {}),
  };

  const nextAccountBase: PaperAccount = {
    ...account,
    cash: account.cash - signedQuantity * price,
    realizedPnl: account.realizedPnl + fill.realizedPnl,
    positions: replacePosition(account.positions, fill.next),
    trades: [...account.trades, trade],
  };
  const valuation = markToMarket(nextAccountBase, snapshot);
  const nextAccount = withPeakEquity(nextAccountBase, valuation.portfolio.equity);

  return {
    ok: true,
    action,
    trade: nextAccount.trades[nextAccount.trades.length - 1],
    account: nextAccount,
    valuation: markToMarket(nextAccount, snapshot),
  };
}

export function executePaperDecision(
  account: PaperAccount,
  decision: TradeDecision,
  snapshot: MarketSnapshot,
  options: ExecutePaperDecisionOptions = {}
): PaperExecution {
  const action = parseAction(decision.action);

  if (!action) {
    return reject(
      account,
      snapshot,
      "HOLD",
      "INVALID_ACTION",
      `Invalid action: ${String(decision.action)}`
    );
  }

  const symbol = parseSymbol(decision.symbol);

  if (!symbol) {
    return reject(
      account,
      snapshot,
      action,
      "UNSUPPORTED_SYMBOL",
      `Unsupported symbol: ${String(decision.symbol)}. Arena currently supports ${supportedSymbolsList()}.`
    );
  }

  try {
    const prices = snapshotPrices(snapshot);
    const preTrade = markToMarket(account, snapshot);

    if (action === "HOLD") {
      const nextAccount = withPeakEquity(account, preTrade.portfolio.equity);
      return {
        ok: true,
        action: "HOLD",
        account: nextAccount,
        valuation: markToMarket(nextAccount, snapshot),
      };
    }

    if (!Number.isFinite(decision.allocationPercent) || decision.allocationPercent <= 0 || decision.allocationPercent > 100) {
      return reject(
        account,
        snapshot,
        action,
        "INVALID_ALLOCATION",
        "allocationPercent must be greater than 0 and at most 100"
      );
    }

    const price = requirePrice(prices, symbol);
    const now = options.now ?? (() => new Date());
    const createTradeId = options.createTradeId ?? randomUUID;
    const createdAt = now().toISOString();

    if (action === "BUY" || action === "SHORT") {
      const notional = preTrade.portfolio.equity * (decision.allocationPercent / 100);

      if (!(notional > 0) || !Number.isFinite(notional)) {
        return reject(account, snapshot, action, "INVALID_ALLOCATION", `${action} notional must be positive`);
      }

      if (action === "BUY" && notional > account.cash + QUANTITY_EPSILON) {
        return reject(
          account,
          snapshot,
          action,
          "INSUFFICIENT_CASH",
          `Insufficient cash for BUY ${symbol}: need ${notional}, have ${account.cash}`
        );
      }

      const signedQuantity = action === "BUY" ? notional / price : -(notional / price);

      return commitFill({
        account,
        snapshot,
        action,
        symbol,
        signedQuantity,
        price,
        createdAt,
        createTradeId,
      });
    }

    const existing = findPosition(account.positions, symbol);

    if (!existing || isClosedQuantity(existing.quantity)) {
      return reject(
        account,
        snapshot,
        action,
        "INSUFFICIENT_POSITION",
        `Insufficient ${symbol} position to SELL`
      );
    }

    if (existing.quantity < -QUANTITY_EPSILON) {
      const closeAbs = Math.abs(existing.quantity) * (decision.allocationPercent / 100);

      if (!(closeAbs > 0)) {
        return reject(
          account,
          snapshot,
          action,
          "INSUFFICIENT_POSITION",
          `Insufficient ${symbol} short to cover`
        );
      }

      const notional = closeAbs * price;

      if (notional > account.cash + QUANTITY_EPSILON) {
        return reject(
          account,
          snapshot,
          action,
          "INSUFFICIENT_CASH",
          `Insufficient cash to cover ${symbol} short: need ${notional}, have ${account.cash}`
        );
      }

      return commitFill({
        account,
        snapshot,
        action: "BUY",
        symbol,
        signedQuantity: closeAbs,
        price,
        createdAt,
        createTradeId,
      });
    }

    if (existing.quantity <= QUANTITY_EPSILON) {
      return reject(
        account,
        snapshot,
        action,
        "INSUFFICIENT_POSITION",
        `Insufficient ${symbol} position to SELL`
      );
    }

    const sellQuantity = existing.quantity * (decision.allocationPercent / 100);

    if (!(sellQuantity > 0) || sellQuantity > existing.quantity + QUANTITY_EPSILON) {
      return reject(
        account,
        snapshot,
        action,
        "INSUFFICIENT_POSITION",
        `Insufficient ${symbol} position to SELL`
      );
    }

    const quantity = Math.min(sellQuantity, existing.quantity);

    return commitFill({
      account,
      snapshot,
      action: "SELL",
      symbol,
      signedQuantity: -quantity,
      price,
      createdAt,
      createTradeId,
    });
  } catch (error) {
    if (error instanceof PaperTradingError) {
      return reject(account, snapshot, action, error.code, error.message);
    }

    throw error;
  }
}
