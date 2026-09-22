import type { SupportedSymbol } from "@/lib/market/types";
import { isClosedQuantity } from "@/lib/paper/portfolio";
import type { TradeAction } from "@/lib/paper/types";
import {
  closingAllocationCaps,
  openingAllocationCaps,
  tightestCap,
} from "@/lib/risk/caps";
import { DEFAULT_RISK_CONSTRAINTS, type RiskConstraints } from "@/lib/risk/constraints";

const PERCENT_EPSILON = 1e-8;

export type HeadroomPosition = {
  symbol: SupportedSymbol;
  quantity: number;
  marketValue: number;
  allocationPercent: number;
};

export type HeadroomPortfolio = {
  cash: number;
  equity: number;
  positions: readonly HeadroomPosition[];
};

export type SymbolHeadroom = {
  symbol: SupportedSymbol;
  /** Percent of equity this BUY could still spend, after every cap. */
  maxBuyPercentOfEquity: number;
  /** Percent of the open position a SELL can close (long) or cover (short). */
  maxSellPercentOfPosition: number;
  maxShortPercentOfEquity: number;
};

export type TradingHeadroom = {
  cash: number;
  cashPercentOfEquity: number;
  openPositions: number;
  maxOpenPositions: number;
  /** Actions that can reach the paper engine right now. HOLD is always here. */
  executableActions: TradeAction[];
  perSymbol: SymbolHeadroom[];
  notes: string[];
};

function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/**
 * What the risk engine would actually let this portfolio do this cycle.
 *
 * Agents deploy to zero cash and then keep proposing BUYs that the engine
 * rejects, burning a model call per cycle. Handing them the same limits the
 * engine uses lets them rotate through SELL instead of guessing.
 */
export function computeTradingHeadroom(input: {
  portfolio: HeadroomPortfolio;
  symbols: readonly SupportedSymbol[];
  constraints?: Partial<RiskConstraints>;
}): TradingHeadroom {
  const constraints = { ...DEFAULT_RISK_CONSTRAINTS, ...input.constraints };
  const { cash, equity, positions } = input.portfolio;

  const cashPercent = equity > 0 ? (cash / equity) * 100 : 0;
  const openPositions = positions.filter((position) => !isClosedQuantity(position.quantity)).length;
  const atPositionLimit = openPositions >= constraints.maxOpenPositions;

  const perSymbol = input.symbols.map((symbol) => {
    const existing = positions.find((position) => position.symbol === symbol);
    const isOpen = existing != null && !isClosedQuantity(existing.quantity);
    const signedAllocationPercent = isOpen ? existing.allocationPercent : 0;
    const wouldOpenNew = !isOpen && atPositionLimit;

    const maxBuy = wouldOpenNew
      ? 0
      : tightestCap(
          openingAllocationCaps({
            action: "BUY",
            symbol,
            cashPercent,
            signedAllocationPercent,
            constraints,
          })
        );

    const maxShort =
      !constraints.shorting || wouldOpenNew
        ? 0
        : tightestCap(
            openingAllocationCaps({
              action: "SHORT",
              symbol,
              cashPercent,
              signedAllocationPercent,
              constraints,
            })
          );

    const closingValue =
      isOpen && existing.quantity < 0 ? Math.abs(existing.marketValue) : existing?.marketValue ?? 0;

    const maxSell =
      isOpen && !isClosedQuantity(existing.quantity) && existing.quantity !== 0
        ? tightestCap([
            ...closingAllocationCaps({
              marketValue: closingValue,
              equity,
              constraints,
            }),
            ...(existing.quantity < 0
              ? [
                  {
                    code: "LEVERAGE_FORBIDDEN" as const,
                    max: closingValue > 0 ? (cash / closingValue) * 100 : 0,
                    detail: "Covering more than cash allows would require leverage",
                  },
                ]
              : []),
          ])
        : 0;

    return {
      symbol,
      maxBuyPercentOfEquity: round(maxBuy),
      maxSellPercentOfPosition: round(maxSell),
      maxShortPercentOfEquity: round(maxShort),
    };
  });

  const executableActions: TradeAction[] = ["HOLD"];
  const canBuy = perSymbol.some((entry) => entry.maxBuyPercentOfEquity > PERCENT_EPSILON);
  const canSell = perSymbol.some((entry) => entry.maxSellPercentOfPosition > PERCENT_EPSILON);
  const canShort = perSymbol.some((entry) => entry.maxShortPercentOfEquity > PERCENT_EPSILON);

  if (canBuy) {
    executableActions.unshift("BUY");
  }

  if (canSell) {
    executableActions.push("SELL");
  }

  if (canShort) {
    executableActions.push("SHORT");
  }

  const notes: string[] = [];

  const hasShort = positions.some((position) => position.quantity < 0);

  if (!canBuy && canSell) {
    notes.push(
      "BUY cannot execute: there is no spendable cash. SELL part of a position first to raise cash, then buy on a later cycle."
    );
  } else if (!canBuy) {
    notes.push("BUY cannot execute: there is no spendable cash.");
  }

  if (hasShort) {
    notes.push(
      "Open shorts can be reduced with SELL (percent of the short position) or BUY (percent of equity to spend). SELL does not apply to symbols you are not short."
    );
  }

  if (atPositionLimit) {
    notes.push(
      `Already holding the maximum of ${constraints.maxOpenPositions} positions, so a new symbol can only be opened after closing one.`
    );
  }

  return {
    cash: round(cash),
    cashPercentOfEquity: round(cashPercent),
    openPositions,
    maxOpenPositions: constraints.maxOpenPositions,
    executableActions,
    perSymbol,
    notes,
  };
}
