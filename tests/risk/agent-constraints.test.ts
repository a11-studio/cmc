import { describe, expect, it } from "vitest";
import { BTC_LIQUIDATION_SIGNAL_AGENT_ID } from "@/lib/agent/btc-liquidation-decision";
import { resolveRiskConstraints } from "@/lib/risk/agent-constraints";
import { DEFAULT_RISK_CONSTRAINTS } from "@/lib/risk/constraints";

describe("resolveRiskConstraints", () => {
  it("allows full-equity trades for the BTC liquidation agent", () => {
    const constraints = resolveRiskConstraints(BTC_LIQUIDATION_SIGNAL_AGENT_ID);

    expect(constraints.maxTradePercent).toBe(100);
    expect(constraints.maxPositionPercent).toBe(100);
    expect(constraints.maxOpenPositions).toBe(1);
  });

  it("keeps default caps for other agents", () => {
    expect(resolveRiskConstraints("warren-buffett").maxTradePercent).toBe(
      DEFAULT_RISK_CONSTRAINTS.maxTradePercent
    );
  });
});
