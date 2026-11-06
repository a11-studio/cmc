import { describe, expect, it } from "vitest";
import { resolveRiskConstraints } from "@/lib/risk/agent-constraints";
import { DEFAULT_RISK_CONSTRAINTS } from "@/lib/risk/constraints";

describe("resolveRiskConstraints", () => {
  it("applies per-persona protective settings", () => {
    expect(resolveRiskConstraints("richard-dennis").protectiveStopAtr).toBe(2);
    expect(resolveRiskConstraints("jesse-livermore").protectiveStopAtr).toBe(3);
    expect(resolveRiskConstraints("paul-tudor-jones")).toEqual(DEFAULT_RISK_CONSTRAINTS);
  });

  it("keeps default caps for other agents", () => {
    expect(resolveRiskConstraints("jim-simons")).toEqual(DEFAULT_RISK_CONSTRAINTS);
    expect(resolveRiskConstraints("momentum-alpha").maxTradePercent).toBe(DEFAULT_RISK_CONSTRAINTS.maxTradePercent);
  });
});
