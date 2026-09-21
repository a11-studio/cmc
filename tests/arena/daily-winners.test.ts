import { describe, expect, it } from "vitest";
import { buildDailyPnlByAgent, pickDailyWinners, utcDayKeyFromIso } from "@/lib/arena/daily-winners-core";

const meta = new Map([
  ["a", { name: "Agent A", mark: "turtle" as const, strategy: "Trend following" }],
  ["b", { name: "Agent B", mark: "momentum" as const, strategy: "Narrative momentum" }],
]);

describe("daily winners", () => {
  it("uses first and last snapshot per UTC day", () => {
    expect(utcDayKeyFromIso("2026-09-21T08:00:00.000Z")).toBe("2026-09-21");

    const byAgent = buildDailyPnlByAgent(
      [
        { agent_id: "a", equity: 10_000, timestamp: "2026-09-21T08:00:00.000Z" },
        { agent_id: "a", equity: 10_200, timestamp: "2026-09-21T16:00:00.000Z" },
        { agent_id: "b", equity: 10_000, timestamp: "2026-09-21T09:00:00.000Z" },
        { agent_id: "b", equity: 10_500, timestamp: "2026-09-21T17:00:00.000Z" },
      ],
      meta
    );

    const winners = pickDailyWinners(byAgent, meta);

    expect(winners).toHaveLength(1);
    expect(winners[0]).toMatchObject({
      dayKey: "2026-09-21",
      agentId: "b",
      dailyPnl: 500,
    });
  });

  it("returns one card per day sorted newest first", () => {
    const byAgent = buildDailyPnlByAgent(
      [
        { agent_id: "a", equity: 10_000, timestamp: "2026-09-20T08:00:00.000Z" },
        { agent_id: "a", equity: 10_100, timestamp: "2026-09-20T18:00:00.000Z" },
        { agent_id: "b", equity: 10_000, timestamp: "2026-09-21T08:00:00.000Z" },
        { agent_id: "b", equity: 10_050, timestamp: "2026-09-21T18:00:00.000Z" },
      ],
      meta
    );

    const winners = pickDailyWinners(byAgent, meta);

    expect(winners.map((winner) => winner.dayKey)).toEqual(["2026-09-21", "2026-09-20"]);
    expect(winners[0]?.agentId).toBe("b");
    expect(winners[1]?.agentId).toBe("a");
  });
});
