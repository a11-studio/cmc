"use client";

import { formatClockTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActivityEvent, ActivityEventType } from "@/types/arena";

const eventTone: Record<ActivityEventType, string> = {
  ANALYZING: "text-ai",
  SIGNAL: "text-positive",
  NEWS: "text-muted-foreground",
  DECISION: "text-ai",
  RISK_CHECK: "text-muted-foreground",
  TRADE_EXECUTED: "text-positive",
  TRADE_REJECTED: "text-negative",
  ERROR: "text-negative",
};

const eventDot: Record<ActivityEventType, string> = {
  ANALYZING: "bg-ai",
  SIGNAL: "bg-positive",
  NEWS: "bg-tertiary",
  DECISION: "bg-ai",
  RISK_CHECK: "bg-warning",
  TRADE_EXECUTED: "bg-positive",
  TRADE_REJECTED: "bg-negative",
  ERROR: "bg-negative",
};

export function ActivityTimeline({
  events,
  showAgent = false,
}: {
  events: ActivityEvent[];
  showAgent?: boolean;
}) {
  const ordered = [...events].reverse();

  return (
    <ol className="space-y-0">
      {ordered.map((event, index) => (
        <li key={event.id} className="animate-arena-enter grid grid-cols-[72px_16px_1fr] gap-3 py-3">
          <time
            dateTime={event.createdAt}
            suppressHydrationWarning
            className="pt-0.5 text-xs tabular-nums text-tertiary"
          >
            {formatClockTime(event.createdAt)}
          </time>
          <div className="relative flex justify-center">
            <span
              className={cn(
                "relative z-10 mt-1.5 size-2 rounded-full",
                eventDot[event.type],
                event.type === "ANALYZING" && "animate-pulse"
              )}
            />
            {index < ordered.length - 1 ? (
              <span className="absolute top-4 bottom-[-12px] w-px bg-border-subtle" />
            ) : null}
          </div>
          <div>
            <p className={cn("text-xs font-medium tracking-wide uppercase", eventTone[event.type])}>
              {event.title}
            </p>
            <p className="mt-0.5 text-sm text-foreground">{event.description}</p>
            {showAgent ? (
              <p className="mt-1 text-xs text-tertiary">{event.agentName}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
