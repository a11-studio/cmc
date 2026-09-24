import { describe, expect, it } from "vitest";
import { latestEquityHistoryRows } from "@/lib/agent/equity-history-rows";

describe("latestEquityHistoryRows", () => {
  it("keeps the newest rows in ascending time order", () => {
    const rows = latestEquityHistoryRows(
      [
        { timestamp: "2026-09-20T10:00:00.000Z", equity: 1 },
        { timestamp: "2026-09-24T16:00:00.000Z", equity: 4 },
        { timestamp: "2026-09-23T01:22:00.000Z", equity: 3 },
        { timestamp: "2026-09-22T08:00:00.000Z", equity: 2 },
      ],
      3
    );

    expect(rows.map((row) => row.timestamp)).toEqual([
      "2026-09-22T08:00:00.000Z",
      "2026-09-23T01:22:00.000Z",
      "2026-09-24T16:00:00.000Z",
    ]);
  });
});
