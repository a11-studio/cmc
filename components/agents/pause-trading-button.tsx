"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { setMomentumAlphaTradingAction, type TradingControlState } from "@/app/actions/trading";
import { Button } from "@/components/ui/button";
import type { AgentStatus } from "@/types/arena";

export function PauseTradingButton({
  status,
  agentId,
}: {
  status: AgentStatus;
  compact?: boolean;
  agentId?: string;
}) {
  const router = useRouter();
  const paused = status === "PAUSED";
  const [, action, pending] = useActionState<TradingControlState | null, FormData>(
    setMomentumAlphaTradingAction,
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
    <form action={action} className="inline-flex">
      {agentId ? <input type="hidden" name="agentId" value={agentId} /> : null}
      <input type="hidden" name="intent" value={paused ? "resume" : "pause"} />
      <Button type="submit" variant={paused ? "default" : "secondary"} disabled={pending}>
        {pending ? (paused ? "Resuming…" : "Pausing…") : paused ? "Resume" : "Pause"}
      </Button>
    </form>
  );
}
