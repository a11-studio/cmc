import type { AgentCycleResult } from "@/lib/agent/types";
import type { Trade } from "@/lib/paper/types";
import type { SupportedSymbol } from "@/lib/market/types";

export type TradeCheckSide = Exclude<Trade["side"], never>;

export type TradeCheck = {
  tradeId: string;
  symbol: SupportedSymbol;
  side: Trade["side"];
  fillPrice: number;
  checkPrice: number;
  createdAt: string;
  checkedAt: string;
  win: boolean;
};

export function scoreTradeCheck(side: Trade["side"], fillPrice: number, checkPrice: number): boolean | null {
  if (!(fillPrice > 0) || !(checkPrice > 0) || fillPrice === checkPrice) {
    return null;
  }

  const rose = checkPrice > fillPrice;

  if (side === "BUY") {
    return rose;
  }

  return !rose;
}

function snapshotPrice(cycle: AgentCycleResult, symbol: SupportedSymbol): number | undefined {
  const price = cycle.snapshot?.assets.find((asset) => asset.symbol === symbol)?.price;
  return price != null && price > 0 ? price : undefined;
}

export function scoreTradesAgainstNextCheck(
  trades: readonly Trade[],
  cycles: readonly AgentCycleResult[]
): TradeCheck[] {
  const orderedCycles = [...cycles].sort(
    (left, right) => Date.parse(left.completedAt) - Date.parse(right.completedAt)
  );

  return trades.flatMap((trade) => {
    const origin = orderedCycles.find((cycle) => cycle.cycleId === trade.cycleId);
    const after = Date.parse(origin?.completedAt ?? trade.createdAt);

    if (!Number.isFinite(after)) {
      return [];
    }

    const next = orderedCycles.find((cycle) => {
      const completed = Date.parse(cycle.completedAt);
      return completed > after && snapshotPrice(cycle, trade.symbol) != null;
    });
    const checkPrice = next ? snapshotPrice(next, trade.symbol) : undefined;

    if (!next || checkPrice == null) {
      return [];
    }

    const win = scoreTradeCheck(trade.side, trade.price, checkPrice);

    if (win == null) {
      return [];
    }

    return [
      {
        tradeId: trade.id,
        symbol: trade.symbol,
        side: trade.side,
        fillPrice: trade.price,
        checkPrice,
        createdAt: trade.createdAt,
        checkedAt: next.completedAt,
        win,
      },
    ];
  });
}
