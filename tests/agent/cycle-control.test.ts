import { describe, expect, it } from "vitest";

import { isFreshCycleClaim, STALE_CYCLE_CLAIM_MS } from "@/lib/agent/cycle-claim";
import { latestCycleCompletedAt } from "@/lib/agent/scheduler";

describe("arena cycle control helpers", () => {
  it("treats only recent CLAIMED rows as an active cycle", () => {
    const now = Date.parse("2026-09-22T08:00:00.000Z");
    const fresh = new Date(now - STALE_CYCLE_CLAIM_MS + 60_000).toISOString();
    const stale = new Date(now - STALE_CYCLE_CLAIM_MS - 1).toISOString();

    expect(isFreshCycleClaim(fresh, now)).toBe(true);
    expect(isFreshCycleClaim(stale, now)).toBe(false);
    expect(isFreshCycleClaim(null, now)).toBe(false);
  });

  it("uses the same stale window as durable cycle reclaim", () => {
    expect(STALE_CYCLE_CLAIM_MS).toBe(10 * 60 * 1000);
  });

  it("picks the newest completed cycle timestamp", () => {
    const last = latestCycleCompletedAt([
      { status: "COMPLETED", completedAt: "2026-09-21T10:00:00.000Z" },
      { status: "COMPLETED", completedAt: "2026-09-21T11:00:00.000Z" },
      { status: "SKIPPED_DUPLICATE", completedAt: "2026-09-21T12:00:00.000Z" },
    ]);

    expect(last).toBe("2026-09-21T11:00:00.000Z");
  });
});
