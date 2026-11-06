import { describe, expect, it } from "vitest";
import { summarizeRuleReview, vetoMovePercent, type RuleDecisionRow } from "@/lib/arena/rule-review-core";
import { parseRuleCoreOutcome, parseVetoedProposal } from "@/lib/strategies/rule-core";

const agents = [
  { id: "richard-dennis", name: "Richard Dennis", hasRuleCore: true },
  { id: "jesse-livermore", name: "Jesse Livermore", hasRuleCore: false },
];

function decision(id: string, reasons: string[], createdAt = "2026-11-07T01:00:00.000Z"): RuleDecisionRow {
  return { id, agent_id: "richard-dennis", cycle_id: id, reasons, created_at: createdAt };
}

describe("rule core labels stored in decisions.reasons", () => {
  it("parses every outcome label and ignores model-only reasons", () => {
    expect(parseRuleCoreOutcome(["Rule core: no trade signal"])).toBe("RULE_ONLY");
    expect(parseRuleCoreOutcome(["Rule core: proposal confirmed", "x"])).toBe("CONFIRMED");
    expect(parseRuleCoreOutcome(["Rule core: proposal vetoed"])).toBe("VETOED");
    expect(parseRuleCoreOutcome(["Rule core: executed without review (model unavailable)"])).toBe("LLM_UNAVAILABLE");
    expect(parseRuleCoreOutcome(["Rule core: executed as proposed (review did not confirm or veto)"])).toBe("LLM_DEVIATED");
    expect(parseRuleCoreOutcome(["BTC above 20-day high"])).toBeNull();
    expect(parseVetoedProposal(["Rule core: proposal vetoed", "Vetoed: SHORT XRP 12.5%"])).toEqual({
      action: "SHORT",
      symbol: "XRP",
      allocationPercent: 12.5,
    });
  });
});

describe("summarizeRuleReview", () => {
  it("counts outcomes, exits, and what vetoes cost or saved", () => {
    const summary = summarizeRuleReview({
      agents,
      decisions: [
        decision("hold-1", ["Rule core: no trade signal", "No rule signal this cycle"]),
        decision("hold-2", ["Rule core: no trade signal"]),
        decision("confirm", ["Rule core: proposal confirmed", "Breakout holds"]),
        decision("veto-buy", ["Rule core: proposal vetoed", "Vetoed: BUY SOL 15%", "SOL price looks stale"], "2026-11-07T02:00:00.000Z"),
        decision("veto-short", ["Rule core: proposal vetoed", "Vetoed: SHORT ETH 10%", "Squeeze risk"], "2026-11-07T03:00:00.000Z"),
        decision("unavailable", ["Rule core: executed without review (model unavailable)"]),
        decision("model-era", ["Old free-form reason"]),
      ],
      exits: [
        { id: "e1", agent_id: "jesse-livermore", title: "TREND EXIT", description: "BTC long below SMA50", created_at: "2026-11-07T01:00:00.000Z" },
        { id: "e2", agent_id: "richard-dennis", title: "STOP-LOSS EXIT", description: "SOL stop", created_at: "2026-11-07T04:00:00.000Z" },
        { id: "e3", agent_id: "richard-dennis", title: "TRADE EXECUTED", description: "ignored", created_at: "2026-11-07T04:00:00.000Z" },
      ],
      vetoChecks: new Map([
        // SOL rose 4% after a vetoed BUY: the veto cost 4%.
        ["veto-buy", { entryPrice: 100, laterPrice: 104, laterAt: "2026-11-08T02:00:00.000Z" }],
        // ETH rose 2% after a vetoed SHORT: the veto saved 2%.
        ["veto-short", { entryPrice: 2_000, laterPrice: 2_040, laterAt: "2026-11-08T03:00:00.000Z" }],
      ]),
    });

    const dennis = summary.agents.find((agent) => agent.agentId === "richard-dennis");
    const livermore = summary.agents.find((agent) => agent.agentId === "jesse-livermore");

    expect(summary.ruleDecisions).toBe(6);
    expect(dennis).toMatchObject({ ruleHolds: 2, confirmed: 1, vetoed: 2, unreviewed: 1, stopExits: 1, trendExits: 0, vetoMovePercent: 1 });
    expect(livermore).toMatchObject({ hasRuleCore: false, trendExits: 1, vetoMovePercent: null });
    expect(summary.vetoes.map((veto) => [veto.decisionId, veto.check?.movePercent, veto.check?.hours])).toEqual([
      ["veto-short", -2, 24],
      ["veto-buy", 4, 24],
    ]);
    expect(summary.vetoes[1]?.reason).toBe("SOL price looks stale");
    expect(summary.exits.map((exit) => exit.kind)).toEqual(["STOP", "TREND"]);
  });

  it("measures veto moves in the vetoed trade's own direction", () => {
    expect(vetoMovePercent("BUY", { entryPrice: 100, laterPrice: 95, laterAt: "" })).toBe(-5);
    expect(vetoMovePercent("SHORT", { entryPrice: 100, laterPrice: 95, laterAt: "" })).toBe(5);
  });
});
