import { afterEach, describe, expect, it, vi } from "vitest";
import { AGENT_CYCLE_INTERVAL_MS } from "@/lib/agent/constants";
import {
  createAgentLoopScheduler,
  cycleIdForSlot,
  formatCycleCountdown,
  latestCycleCompletedAt,
  msUntilNextCycle,
  nextCycleAt,
  shouldTriggerAutoCycle,
} from "@/lib/agent/scheduler";

describe("Momentum Alpha scheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses a 15-minute cycle interval", () => {
    expect(AGENT_CYCLE_INTERVAL_MS).toBe(15 * 60 * 1000);
  });

  it("reuses the same cycle id inside a 15-minute slot", () => {
    const now = new Date("2026-09-17T11:00:00.000Z");
    const laterInSlot = new Date(now.getTime() + 14 * 60 * 1000);
    const nextSlot = new Date(now.getTime() + 15 * 60 * 1000);

    expect(cycleIdForSlot(now)).toBe(cycleIdForSlot(laterInSlot));
    expect(cycleIdForSlot(now)).not.toBe(cycleIdForSlot(nextSlot));
  });

  it("counts down to the next 15-minute slot as mm:ss", () => {
    const now = new Date("2026-09-17T11:06:18.000Z");

    expect(nextCycleAt(now).toISOString()).toBe("2026-09-17T11:15:00.000Z");
    expect(msUntilNextCycle(now)).toBe(8 * 60 * 1000 + 42 * 1000);
    expect(formatCycleCountdown(msUntilNextCycle(now))).toBe("08:42");
    expect(formatCycleCountdown(msUntilNextCycle(new Date("2026-09-17T11:00:00.000Z")))).toBe("15:00");
  });

  it("resets the countdown after a cycle completes", () => {
    const completedAt = "2026-09-17T11:06:18.000Z";
    const now = new Date("2026-09-17T11:06:18.000Z");
    const later = new Date("2026-09-17T11:07:18.000Z");

    expect(formatCycleCountdown(msUntilNextCycle(now, completedAt))).toBe("15:00");
    expect(formatCycleCountdown(msUntilNextCycle(later, completedAt))).toBe("14:00");
    expect(latestCycleCompletedAt([
      { status: "SKIPPED_DUPLICATE", completedAt: "2026-09-17T11:07:00.000Z" },
      { status: "COMPLETED", completedAt },
    ])).toBe(completedAt);
  });

  it("auto-runs a local cycle in the last second, and if the deadline was skipped", () => {
    expect(
      shouldTriggerAutoCycle({
        autoRun: true,
        remainingMs: 800,
        pending: false,
        deadline: 100,
        firedDeadline: null,
      })
    ).toBe(true);

    expect(
      shouldTriggerAutoCycle({
        autoRun: true,
        remainingMs: 800,
        pending: false,
        deadline: 100,
        firedDeadline: 100,
      })
    ).toBe(false);

    expect(
      shouldTriggerAutoCycle({
        autoRun: true,
        remainingMs: 8 * 60 * 1000,
        pending: false,
        deadline: 200,
        firedDeadline: null,
        missedDeadline: 100,
      })
    ).toBe(true);

    expect(
      shouldTriggerAutoCycle({
        autoRun: true,
        remainingMs: 8 * 60 * 1000,
        pending: false,
        deadline: 200,
        firedDeadline: 100,
        missedDeadline: 100,
      })
    ).toBe(false);

    expect(
      shouldTriggerAutoCycle({
        autoRun: false,
        remainingMs: 0,
        pending: false,
        deadline: 100,
        firedDeadline: null,
      })
    ).toBe(false);
  });

  it("invokes the cycle runner every 15 minutes", async () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => undefined);
    const scheduler = createAgentLoopScheduler({ run, intervalMs: AGENT_CYCLE_INTERVAL_MS });

    scheduler.start();
    expect(run).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(AGENT_CYCLE_INTERVAL_MS);
    expect(run).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(AGENT_CYCLE_INTERVAL_MS);
    expect(run).toHaveBeenCalledTimes(2);

    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);
  });
});
