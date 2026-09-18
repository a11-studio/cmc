"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { runMomentumAlphaCycleAction, type ManualCycleState } from "@/app/actions/cycle";
import { Button } from "@/components/ui/button";

export function RunCycleButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ManualCycleState | null, FormData>(
    runMomentumAlphaCycleAction,
    null
  );
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      router.refresh();
    }

    wasPending.current = pending;
  }, [pending, router]);

  return (
    <form action={action} className={compact ? "inline-flex" : "flex flex-col items-start gap-2 sm:items-end"}>
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
        <p className="text-xs text-faint">Dev trigger · same path as the 15-minute cycle</p>
      )}
    </form>
  );
}
