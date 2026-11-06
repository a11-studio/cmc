import { BTC_LIQUIDATION_SIGNAL_AGENT_ID } from "@/lib/agent/btc-liquidation-decision";
import { DEFAULT_RISK_CONSTRAINTS, type RiskConstraints } from "@/lib/risk/constraints";

/**
 * Liquidation flow agent: deploy full equity in one cycle when the signal fires.
 * Trend filter and protective stops stay off until its signal mapping is reviewed;
 * they would override the rule it is meant to mirror.
 */
const BTC_LIQUIDATION_SIGNAL_CONSTRAINTS: Partial<RiskConstraints> = {
  maxTradePercent: 100,
  maxPositionPercent: 100,
  maxOpenPositions: 1,
  trendFilterSma: 0,
  protectiveStopAtr: 0,
};

/**
 * Per-persona protective settings, chosen from the 2-year hourly backtest
 * (Nov 2024 – Nov 2026, 0.1% fees): Turtle uses the classic 2N stop, the
 * speculator a wider 3N, and the long-only value agent keeps a 30% core under
 * its 200-day average instead of stopping out.
 */
const AGENT_CONSTRAINTS: Record<string, Partial<RiskConstraints>> = {
  [BTC_LIQUIDATION_SIGNAL_AGENT_ID]: BTC_LIQUIDATION_SIGNAL_CONSTRAINTS,
  "richard-dennis": { protectiveStopAtr: 2 },
  "jesse-livermore": { protectiveStopAtr: 3 },
  "warren-buffett": { trendFilterSma: 200, trendExitMaxAllocationPercent: 30, protectiveStopAtr: 0 },
};

export function riskConstraintsForAgent(agentId: string): Partial<RiskConstraints> {
  return AGENT_CONSTRAINTS[agentId] ?? {};
}

export function resolveRiskConstraints(
  agentId: string,
  overrides?: Partial<RiskConstraints>
): RiskConstraints {
  return {
    ...DEFAULT_RISK_CONSTRAINTS,
    ...riskConstraintsForAgent(agentId),
    ...overrides,
  };
}
