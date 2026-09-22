import type { DecisionContext } from "@/lib/ai/types";
import type { TradeDecision } from "@/lib/paper/types";
import type { BtcLiquidationSnapshotRead } from "@/lib/market/types";

export const BTC_LIQUIDATION_SIGNAL_AGENT_ID = "btc-liquidation-signal";

export function isBtcLiquidationSignalAgent(agentId: string): boolean {
  return agentId === BTC_LIQUIDATION_SIGNAL_AGENT_ID;
}

function hold(reason: string): TradeDecision {
  return {
    action: "HOLD",
    symbol: "BTC",
    allocationPercent: 0,
    confidence: 70,
    timeHorizon: "SHORT",
    reasons: [reason],
    riskFactors: [],
  };
}

function activeDecision(
  action: "BUY" | "SHORT",
  allocationPercent: number,
  read: BtcLiquidationSnapshotRead
): TradeDecision {
  return {
    action,
    symbol: "BTC",
    allocationPercent,
    confidence: 88,
    timeHorizon: "SHORT",
    reasons: [
      `BTC liquidation signal is ${read.signal} (${read.basedOn} window).`,
      read.reason,
    ],
    riskFactors: ["Signal is coarse flow bias, not a price forecast."],
  };
}

function btcHeadroomAllocation(context: DecisionContext, action: "BUY" | "SHORT"): number {
  const entry = context.headroom?.perSymbol.find((row) => row.symbol === "BTC");

  if (!entry) {
    return 0;
  }

  const cap = action === "BUY" ? entry.maxBuyPercentOfEquity : entry.maxShortPercentOfEquity;
  return cap > 0 ? cap : 0;
}

/**
 * Rule-based decision engine for the BTC Liquidation Signal agent.
 * Matches Research → BTC Liquidation signal card semantics.
 */
export function tradeDecisionFromBtcLiquidationSignal(context: DecisionContext): TradeDecision {
  const read = context.snapshot.market.btcLiquidation;

  if (!read) {
    return hold("BTC liquidation signal is unavailable in this snapshot — HOLD.");
  }

  if (read.signal === "neutral") {
    return hold(`Neutral liquidation flow: ${read.reason}`);
  }

  if (read.signal === "bullish") {
    const allocationPercent = btcHeadroomAllocation(context, "BUY");

    if (allocationPercent <= 0) {
      return hold(`Bullish signal but no BUY headroom: ${read.reason}`);
    }

    return activeDecision("BUY", allocationPercent, read);
  }

  const allocationPercent = btcHeadroomAllocation(context, "SHORT");

  if (allocationPercent <= 0) {
    return hold(`Bearish signal but no SHORT headroom: ${read.reason}`);
  }

  return activeDecision("SHORT", allocationPercent, read);
}
