"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { runMomentumAlphaCycleAction, type ManualCycleState } from "@/app/actions/cycle";
import { Button } from "@/components/ui/button";
import { ARENA_LIVE_REFRESH_EVENT } from "@/lib/arena/live-events";

export function RunCycleButton({ compact = false, agentId }: { compact?: boolean; agentId?: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ManualCycleState | null, FormData>(
    runMomentumAlphaCycleAction,
    null
  );
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      window.dispatchEvent(new Event(ARENA_LIVE_REFRESH_EVENT));
      router.refresh();
    }

    wasPending.current = pending;
  }, [pending, router]);

  return (
    <form action={action} className={compact ? "inline-flex" : "flex flex-col items-start gap-2 sm:items-end"}>
      {agentId ? <input type="hidden" name="agentId" value={agentId} /> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Running…" : "Run Cycle"}
      </Button>
      {compact ? null : state ? (
        <p
          className={
            state.ok ? "text-xs text-muted-foreground" : "text-xs text-negative"
          }
        >
          {state.message}
        </p>
      ) : (
        <p className="text-xs text-faint">Dev trigger · same path as the hourly cycle</p>
      )}
    </form>
  );
}
