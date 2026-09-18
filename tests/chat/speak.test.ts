import { describe, expect, it } from "vitest";
import {
  chatMessageId,
  cycleChatBrief,
  parseChatReply,
  parseChatTurn,
  resolveAskedAgent,
  shouldSpeakThisCycle,
} from "@/lib/chat/speak";
import type { AgentCycleResult } from "@/lib/agent/types";

describe("arena floor chat", () => {
  it("speaks on a stable subset of cycle ids", () => {
    const spoken = ["a", "b", "c", "d", "e", "f", "g", "h", "i"].filter(shouldSpeakThisCycle);
    expect(spoken.length).toBeGreaterThan(0);
    expect(spoken.length).toBeLessThan(9);
    expect(shouldSpeakThisCycle("momentum-alpha-1")).toBe(shouldSpeakThisCycle("momentum-alpha-1"));
  });

  it("parses a floor take and a skipped turn", () => {
    expect(
      parseChatTurn({
        speak: true,
        body: "  Tape looks heavy on SOL. ",
        askAgentId: "richard-dennis",
      })
    ).toEqual({
      speak: true,
      body: "Tape looks heavy on SOL.",
      askAgentId: "richard-dennis",
    });

    expect(parseChatTurn({ speak: false, body: "", askAgentId: "" })).toEqual({
      speak: false,
      body: "",
      askAgentId: null,
    });
    expect(parseChatReply({ body: " Stay with the breakout. " })).toBe("Stay with the breakout.");
  });

  it("only lets a live peer be asked", () => {
    const peers = [{ id: "richard-dennis" }];
    expect(resolveAskedAgent("richard-dennis", "momentum-alpha", peers)).toBe("richard-dennis");
    expect(resolveAskedAgent("momentum-alpha", "momentum-alpha", peers)).toBeNull();
    expect(resolveAskedAgent("jim-simons", "momentum-alpha", peers)).toBeNull();
  });

  it("summarizes a cycle without leaking execution as a chat trade", () => {
    const brief = cycleChatBrief({
      status: "COMPLETED",
      agentId: "momentum-alpha",
      strategy: "Narrative momentum",
      cycleId: "c1",
      snapshotTimestamp: null,
      snapshot: null,
      decision: {
        action: "BUY",
        symbol: "SOL",
        allocationPercent: 15,
        confidence: 70,
        timeHorizon: "SHORT",
        reasons: ["Tape"],
        riskFactors: [],
      },
      riskResult: {
        verdict: "APPROVED",
        approved: true,
        executable: true,
        code: "APPROVED",
        reason: "ok",
        decision: {
          action: "BUY",
          symbol: "SOL",
          allocationPercent: 15,
          confidence: 70,
          timeHorizon: "SHORT",
          reasons: ["Tape"],
          riskFactors: [],
        },
        checks: [],
      },
      execution: {
        ok: true,
        action: "BUY",
        account: {
          initialCapital: 10_000,
          cash: 10_000,
          peakEquity: 10_000,
          realizedPnl: 0,
          positions: [],
          trades: [],
        },
        valuation: {
          snapshot: {
            cycleId: "c1",
            timestamp: "2026-09-18T12:00:00.000Z",
            assets: [],
            market: {},
          },
          portfolio: {
            cash: 8500,
            equity: 10_000,
            realizedPnl: 0,
            unrealizedPnl: 0,
            returnPercent: 0,
            drawdownPercent: 0,
          },
          positions: [],
        },
        trade: {
          id: "t1",
          symbol: "SOL",
          side: "BUY",
          quantity: 1,
          price: 100,
          notional: 100,
          cycleId: "c1",
          createdAt: "2026-09-18T12:00:00.000Z",
        },
      },
      valuation: null,
      account: {
        initialCapital: 10_000,
        cash: 10_000,
        peakEquity: 10_000,
        realizedPnl: 0,
        positions: [],
        trades: [],
      },
      events: [],
      startedAt: "2026-09-18T12:00:00.000Z",
      completedAt: "2026-09-18T12:00:01.000Z",
      trace: {
        agentId: "momentum-alpha",
        strategy: "Narrative momentum",
        cycleId: "c1",
        snapshotTimestamp: null,
        decision: null,
        riskResult: null,
        execution: null,
      },
    } as AgentCycleResult);

    expect(brief).toContain("BUY SOL 15%");
    expect(brief).toContain("APPROVED");
    expect(chatMessageId("momentum-alpha", "c1", "take")).toBe("chat-momentum-alpha-c1-take");
  });
});
