import { DEFAULT_RISK_CONSTRAINTS, type RiskConstraints } from "@/lib/risk/constraints";

/**
 * Per-persona protective settings, chosen from the 2-year hourly backtest
 * (Nov 2024 – Nov 2026, 0.1% fees): Turtle uses the classic 2N stop, the
 * speculator a wider 3N, and the long-only value agent keeps a 30% core under
 * its 200-day average instead of stopping out.
 */
const AGENT_CONSTRAINTS: Record<string, Partial<RiskConstraints>> = {
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
