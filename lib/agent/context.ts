import type { DecisionPortfolioContext } from "@/lib/ai/types";
import type { PaperValuation } from "@/lib/paper/types";
import type { RiskPortfolioState } from "@/lib/risk/types";

export function toDecisionPortfolio(valuation: PaperValuation): DecisionPortfolioContext {
  return {
    cash: valuation.portfolio.cash,
    equity: valuation.portfolio.equity,
    positions: valuation.positions.map((position) => ({
      symbol: position.symbol,
      quantity: position.quantity,
      averageEntryPrice: position.averageEntryPrice,
      marketValue: position.marketValue,
      unrealizedPnl: position.unrealizedPnl,
      allocationPercent: position.allocationPercent,
    })),
  };
}

export function toRiskPortfolio(valuation: PaperValuation, dayStartEquity: number): RiskPortfolioState {
  return {
    cash: valuation.portfolio.cash,
    equity: valuation.portfolio.equity,
    drawdownPercent: valuation.portfolio.drawdownPercent,
    dayStartEquity,
    positions: valuation.positions.map((position) => ({
      symbol: position.symbol,
      quantity: position.quantity,
      marketValue: position.marketValue,
      allocationPercent: position.allocationPercent,
    })),
  };
}
