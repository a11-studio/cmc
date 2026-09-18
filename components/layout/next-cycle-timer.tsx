"use client";

import { startTransition, useActionState, useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { runMomentumAlphaCycleAction } from "@/app/actions/cycle";
import {
  formatCycleCountdown,
  msUntilNextCycle,
  nextCycleAt,
  shouldTriggerAutoCycle,
} from "@/lib/agent/scheduler";

let currentNow = 0;
let intervalId: number | undefined;
const listeners = new Set<() => void>();

function emit() {
  currentNow = Date.now();
  listeners.forEach((listener) => listener());
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);

  if (intervalId == null) {
    currentNow = Date.now();
    intervalId = window.setInterval(emit, 250);
    window.addEventListener("visibilitychange", emit);
  }

  return () => {
    listeners.delete(onStoreChange);

    if (listeners.size === 0 && intervalId != null) {
      window.clearInterval(intervalId);
      intervalId = undefined;
      window.removeEventListener("visibilitychange", emit);
    }
  };
}

function getSnapshot() {
  return currentNow;
}

export function NextCycleTimer({
  lastCompletedAt,
  serverNow,
  autoRun = false,
  paused = false,
}: {
  lastCompletedAt?: string | null;
  serverNow: string;
  autoRun?: boolean;
  paused?: boolean;
}) {
  const router = useRouter();
  const serverSnapshot = Date.parse(serverNow);
  const getServerSnapshot = useCallback(() => serverSnapshot, [serverSnapshot]);
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [, run, pending] = useActionState(runMomentumAlphaCycleAction, null);
  const firedDeadline = useRef<number | null>(null);
  const prevDeadline = useRef<number | null>(null);
  const prevCompletedAt = useRef(lastCompletedAt);
  const wasPending = useRef(false);
  const remainingMs = msUntilNextCycle(new Date(now), lastCompletedAt);
  const deadline = nextCycleAt(new Date(now), lastCompletedAt).getTime();

  useEffect(() => {
    const previousDeadline = prevDeadline.current;
    const completedChanged = prevCompletedAt.current !== lastCompletedAt;
    const missedDeadline =
      !completedChanged && previousDeadline != null && previousDeadline !== deadline ? previousDeadline : null;

    prevDeadline.current = deadline;
    prevCompletedAt.current = lastCompletedAt;

    if (
      !shouldTriggerAutoCycle({
        autoRun: autoRun && !paused,
        remainingMs,
        pending,
        deadline,
        firedDeadline: firedDeadline.current,
        missedDeadline,
      })
    ) {
      return;
    }

    firedDeadline.current = remainingMs <= 1000 ? deadline : missedDeadline;
    startTransition(() => {
      run(new FormData());
    });
  }, [autoRun, paused, remainingMs, pending, deadline, lastCompletedAt, run]);

  useEffect(() => {
    if (wasPending.current && !pending) {
      router.refresh();
    }

    wasPending.current = pending;
  }, [pending, router]);

  return (
    <p className="shrink-0 border-l border-white/8 pl-4 text-xs text-white/45 whitespace-nowrap">
      {pending ? (
        "Running cycle…"
      ) : paused ? (
        "Trading paused"
      ) : (
        <>
          Next cycle in{" "}
          <span className="font-medium tabular-nums text-foreground">
            {formatCycleCountdown(remainingMs)}
          </span>
        </>
      )}
    </p>
  );
}
