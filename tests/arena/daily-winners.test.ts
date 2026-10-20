import { describe, expect, it } from "vitest";
import {
  buildDailyPnlByAgent,
  pickDailyWinners,
  stabilizeIntradayEquitySpikes,
  utcDayKeyFromIso,
} from "@/lib/arena/daily-winners-core";

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

  it("carries prior close as open when a day has only one snapshot", () => {
    const byAgent = buildDailyPnlByAgent(
      [
        { agent_id: "a", equity: 10_000, timestamp: "2026-09-20T18:00:00.000Z" },
        { agent_id: "a", equity: 9_500, timestamp: "2026-09-21T12:00:00.000Z" },
      ],
      meta
    );

    const bucket = byAgent.get("a")?.get("2026-09-21");

    expect(bucket).toEqual({ openEquity: 10_000, closeEquity: 9_500 });
  });

  it("picks the least loss on an all-red day instead of a flat zero", () => {
    const byAgent = buildDailyPnlByAgent(
      [
        { agent_id: "a", equity: 10_000, timestamp: "2026-09-22T08:00:00.000Z" },
        { agent_id: "a", equity: 9_800, timestamp: "2026-09-22T18:00:00.000Z" },
        { agent_id: "b", equity: 10_000, timestamp: "2026-09-21T18:00:00.000Z" },
        { agent_id: "b", equity: 10_000, timestamp: "2026-09-22T12:00:00.000Z" },
      ],
      meta
    );

    const winners = pickDailyWinners(byAgent, meta);
    const day = winners.find((winner) => winner.dayKey === "2026-09-22");

    expect(day?.agentId).toBe("a");
    expect(day?.dailyPnl).toBe(-200);
  });

  it("stabilizes corrupt intraday equity spikes before daily PnL", () => {
    const stabilized = stabilizeIntradayEquitySpikes([
      {
        agent_id: "btc-liquidation-signal",
        equity: 8_637,
        timestamp: "2026-10-19T17:56:36.224Z",
      },
      {
        agent_id: "btc-liquidation-signal",
        equity: 17_288,
        timestamp: "2026-10-19T21:53:16.437Z",
      },
    ]);

    expect(stabilized).toHaveLength(1);
    expect(stabilized[0]?.equity).toBe(8_637);
  });

  it("rejects implausible +80% daily winner and picks the next agent", () => {
    const byAgent = buildDailyPnlByAgent(
      [
        { agent_id: "btc", equity: 8_800, timestamp: "2026-10-18T20:00:00.000Z" },
        { agent_id: "btc", equity: 8_637, timestamp: "2026-10-19T17:00:00.000Z" },
        { agent_id: "other", equity: 10_000, timestamp: "2026-10-18T20:00:00.000Z" },
        { agent_id: "other", equity: 10_150, timestamp: "2026-10-19T20:00:00.000Z" },
      ],
      new Map([
        ["btc", { name: "BTC", mark: "momentum" as const, strategy: "s" }],
        ["other", { name: "Other", mark: "turtle" as const, strategy: "s" }],
      ])
    );

    const winners = pickDailyWinners(
      byAgent,
      new Map([
        ["btc", { name: "BTC", mark: "momentum" as const, strategy: "s" }],
        ["other", { name: "Other", mark: "turtle" as const, strategy: "s" }],
      ]),
      new Map([["btc", 10_000], ["other", 10_000]])
    );

    const day = winners.find((winner) => winner.dayKey === "2026-10-19");

    expect(day?.agentId).toBe("other");
    expect(day?.dailyPnl).toBe(150);
  });
});
