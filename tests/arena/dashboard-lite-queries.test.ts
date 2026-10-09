import { describe, expect, it } from "vitest";
import {
  buildEquitySeriesByAgent,
  buildTradeCountsByAgent,
} from "@/lib/arena/dashboard-lite-queries";

describe("dashboard-lite query batching helpers", () => {
  it("keeps the newest limit rows per agent when batching equity history", () => {
    const rows = [
      { agent_id: "a", equity: 100, timestamp: "2026-01-01T10:00:00.000Z", cycle_id: "a-1" },
      { agent_id: "a", equity: 110, timestamp: "2026-01-02T10:00:00.000Z", cycle_id: "a-2" },
      { agent_id: "b", equity: 200, timestamp: "2026-01-03T10:00:00.000Z", cycle_id: "b-1" },
      { agent_id: "b", equity: 210, timestamp: "2026-01-04T10:00:00.000Z", cycle_id: "b-2" },
    ];

    const series = buildEquitySeriesByAgent(rows, ["a", "b"], 1);

    expect(series.a).toEqual([{ equity: 110, at: "2026-01-02T10:00:00.000Z", label: "a-2" }]);
    expect(series.b).toEqual([{ equity: 210, at: "2026-01-04T10:00:00.000Z", label: "b-2" }]);
  });

  it("counts trades per agent from a single batched agent_id list", () => {
    const counts = buildTradeCountsByAgent(
      [
        { agent_id: "a" },
        { agent_id: "a" },
        { agent_id: "b" },
      ],
      ["a", "b", "c"]
    );

    expect(counts.get("a")).toBe(2);
    expect(counts.get("b")).toBe(1);
    expect(counts.get("c")).toBe(0);
  });
});
