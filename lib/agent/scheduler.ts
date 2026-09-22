import { AGENT_CYCLE_INTERVAL_MS, MOMENTUM_ALPHA_AGENT } from "@/lib/agent/constants";

export function cycleIdForSlot(
  now: Date,
  agentId: string = MOMENTUM_ALPHA_AGENT.id,
  intervalMs = AGENT_CYCLE_INTERVAL_MS
): string {
  const slot = Math.floor(now.getTime() / intervalMs);
  return `${agentId}-${slot}`;
}

function parseTimestamp(value: Date | string | null | undefined): number | undefined {
  if (value == null) {
    return undefined;
  }

  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : undefined;
}

export function latestCycleCompletedAt(
  cycles: readonly { status: string; completedAt?: string | null }[]
): string | null {
  let latest = Number.NEGATIVE_INFINITY;

  for (const cycle of cycles) {
    if (cycle.status === "SKIPPED_DUPLICATE" || cycle.status === "SKIPPED_PAUSED") {
      continue;
    }

    const completed = parseTimestamp(cycle.completedAt);

    if (completed != null && completed > latest) {
      latest = completed;
    }
  }

  return latest > 0 ? new Date(latest).toISOString() : null;
}

/** Next UTC-aligned hourly slot (matches GitHub Actions `0 * * * *` and `cycleIdForSlot`). */
export function nextCycleAt(
  now: Date,
  _lastCompletedAt?: Date | string | null,
  intervalMs = AGENT_CYCLE_INTERVAL_MS
): Date {
  const time = now.getTime();
  const slotStart = Math.floor(time / intervalMs) * intervalMs;
  return new Date(slotStart + intervalMs);
}

export function msUntilNextCycle(
  now: Date,
  _lastCompletedAt?: Date | string | null,
  intervalMs = AGENT_CYCLE_INTERVAL_MS
): number {
  return Math.max(0, nextCycleAt(now, undefined, intervalMs).getTime() - now.getTime());
}

export function shouldTriggerAutoCycle(input: {
  autoRun: boolean;
  remainingMs: number;
  pending: boolean;
  deadline: number;
  firedDeadline: number | null;
  missedDeadline?: number | null;
}): boolean {
  if (!input.autoRun || input.pending || !Number.isFinite(input.deadline)) {
    return false;
  }

  if (input.remainingMs <= 1000 && input.firedDeadline !== input.deadline) {
    return true;
  }

  return (
    input.missedDeadline != null &&
    Number.isFinite(input.missedDeadline) &&
    input.firedDeadline !== input.missedDeadline
  );
}

/** Faster /api/shell polling around the UTC hourly slot (production cron). */
export function shouldPollArenaShellForCycle(
  now: Date,
  intervalMs = AGENT_CYCLE_INTERVAL_MS
): boolean {
  const msIntoSlot = now.getTime() % intervalMs;
  const tenMinutes = 10 * 60 * 1000;
  const threeMinutes = 3 * 60 * 1000;

  return msIntoSlot < tenMinutes || intervalMs - msIntoSlot <= threeMinutes;
}

export function formatCycleCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function createAgentLoopScheduler(options: {
  run: () => Promise<unknown> | unknown;
  intervalMs?: number;
}): {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
} {
  const intervalMs = options.intervalMs ?? AGENT_CYCLE_INTERVAL_MS;
  let timer: ReturnType<typeof setInterval> | undefined;
  let inFlight = false;

  async function tick() {
    if (inFlight) {
      return;
    }

    inFlight = true;

    try {
      await options.run();
    } finally {
      inFlight = false;
    }
  }

  return {
    start() {
      if (timer) {
        return;
      }

      timer = setInterval(() => {
        void tick();
      }, intervalMs);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
    },
    isRunning() {
      return timer != null;
    },
  };
}
