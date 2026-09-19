import { describe, expect, it } from "vitest";
import { latestDecisionBatch } from "@/lib/arena/decision-batch";
import type { DecisionRecord, TradeAction } from "@/types/arena";

function decision(
  agentId: string,
  action: TradeAction,
  confidence: number,
  createdAt: string,
  riskVerdict?: DecisionRecord["riskVerdict"]
): DecisionRecord {
  return {
    id: `${agentId}-${createdAt}`,
    agentId,
    agentName: agentId,
    action,
    symbol: "BTC",
    confidence,
    createdAt,
    riskVerdict,
  } as unknown as DecisionRecord;
}

describe("latestDecisionBatch", () => {
  it("returns an empty batch when there are no decisions", () => {
    expect(latestDecisionBatch([])).toMatchObject({ decisions: [], averageConfidence: 0 });
  });

  it("keeps one decision per agent and averages confidence", () => {
    const batch = latestDecisionBatch([
      decision("a", "BUY", 80, "2026-09-18T12:00:00.000Z"),
      decision("b", "HOLD", 40, "2026-09-18T12:01:00.000Z"),
      decision("c", "SHORT", 60, "2026-09-18T12:02:00.000Z"),
    ]);

    expect(batch.decisions.map((entry) => entry.agentId)).toEqual(["a", "c", "b"]);
    expect(batch.averageConfidence).toBe(60);
    expect(batch.latestAt).toBe("2026-09-18T12:02:00.000Z");
  });

  it("drops decisions from an earlier round", () => {
    const batch = latestDecisionBatch([
      decision("a", "BUY", 90, "2026-09-18T12:00:00.000Z"),
      decision("a", "SELL", 10, "2026-09-18T10:00:00.000Z"),
      decision("b", "HOLD", 70, "2026-09-18T10:00:00.000Z"),
    ]);

    expect(batch.decisions).toHaveLength(1);
    expect(batch.decisions[0]!.confidence).toBe(90);
    expect(batch.averageConfidence).toBe(90);
  });

  it("counts actions in a stable order and tallies risk blocks", () => {
    const batch = latestDecisionBatch([
      decision("a", "HOLD", 30, "2026-09-18T12:00:00.000Z"),
      decision("b", "BUY", 70, "2026-09-18T12:00:00.000Z"),
      decision("c", "BUY", 50, "2026-09-18T12:00:00.000Z"),
      decision("d", "SHORT", 40, "2026-09-18T12:00:00.000Z", "BLOCKED"),
    ]);

    expect(batch.actionCounts).toEqual([
      { action: "BUY", count: 2 },
      { action: "SHORT", count: 1 },
      { action: "HOLD", count: 1 },
    ]);
    expect(batch.blockedCount).toBe(1);
  });

  it("ignores decisions without a usable timestamp", () => {
    const batch = latestDecisionBatch([
      decision("a", "BUY", 80, "2026-09-18T12:00:00.000Z"),
      { ...decision("b", "HOLD", 20, "2026-09-18T12:00:00.000Z"), createdAt: undefined },
    ]);

    expect(batch.decisions).toHaveLength(1);
  });
});
