import { BTC_LIQUIDATION_SIGNAL_AGENT_ID } from "@/lib/agent/btc-liquidation-decision";
import { DEFAULT_RISK_CONSTRAINTS, type RiskConstraints } from "@/lib/risk/constraints";

/** Liquidation flow agent: deploy full equity in one cycle when the signal fires. */
const BTC_LIQUIDATION_SIGNAL_CONSTRAINTS: Partial<RiskConstraints> = {
  maxTradePercent: 100,
  maxPositionPercent: 100,
  maxOpenPositions: 1,
};

export function riskConstraintsForAgent(agentId: string): Partial<RiskConstraints> {
  if (agentId === BTC_LIQUIDATION_SIGNAL_AGENT_ID) {
    return BTC_LIQUIDATION_SIGNAL_CONSTRAINTS;
  }

  return {};
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
