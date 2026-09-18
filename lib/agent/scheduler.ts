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

export function nextCycleAt(
  now: Date,
  lastCompletedAt?: Date | string | null,
  intervalMs = AGENT_CYCLE_INTERVAL_MS
): Date {
  const time = now.getTime();
  const slotStart = Math.floor(time / intervalMs) * intervalMs;
  const slotNext = new Date(slotStart + intervalMs);
  const completed = parseTimestamp(lastCompletedAt);

  if (completed == null) {
    return slotNext;
  }

  const cooldownNext = completed + intervalMs;
  return cooldownNext > time ? new Date(cooldownNext) : slotNext;
}

export function msUntilNextCycle(
  now: Date,
  lastCompletedAt?: Date | string | null,
  intervalMs = AGENT_CYCLE_INTERVAL_MS
): number {
  return Math.max(0, nextCycleAt(now, lastCompletedAt, intervalMs).getTime() - now.getTime());
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
