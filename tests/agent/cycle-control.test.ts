import { describe, expect, it } from "vitest";

import { latestCycleCompletedAt } from "@/lib/agent/scheduler";

describe("arena cycle control helpers", () => {
  it("picks the newest completed cycle timestamp", () => {
    const last = latestCycleCompletedAt([
      { status: "COMPLETED", completedAt: "2026-09-21T10:00:00.000Z" },
      { status: "COMPLETED", completedAt: "2026-09-21T11:00:00.000Z" },
      { status: "SKIPPED_DUPLICATE", completedAt: "2026-09-21T12:00:00.000Z" },
    ]);

    expect(last).toBe("2026-09-21T11:00:00.000Z");
  });
});
