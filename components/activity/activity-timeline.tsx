"use client";

import {
  ActivityEventActionBadge,
  ActivityEventDescription,
  ActivityEventExecutionContent,
} from "@/components/activity/activity-event-description";
import { formatClockTime } from "@/lib/format";
import {
  activityBodyPad,
  activityFeedActionCol,
  activityFeedDetailCol,
  activityFeedMetaCol,
  activityFeedRowGrid,
} from "@/components/activity/activity-feed-columns";
import { cn } from "@/lib/utils";
import type { ActivityEvent, ActivityEventType } from "@/types/arena";

/** Teal scale matches Agent allocation (`lib/market/shares` TEAL). */
const eventTone: Record<ActivityEventType, string> = {
  ANALYZING: "text-[#008D8A]",
  SIGNAL: "text-positive",
  NEWS: "text-muted-foreground",
  DECISION: "text-[#00D4CF]",
  RISK_CHECK: "text-muted-foreground",
  TRADE_EXECUTED: "text-positive",
  TRADE_REJECTED: "text-negative",
  ERROR: "text-negative",
};

const eventDot: Record<ActivityEventType, string> = {
  ANALYZING: "bg-[#008D8A]",
  SIGNAL: "bg-positive",
  NEWS: "bg-tertiary",
  DECISION: "bg-[#00D4CF]",
  RISK_CHECK: "bg-warning",
  TRADE_EXECUTED: "bg-positive",
  TRADE_REJECTED: "bg-negative",
  ERROR: "bg-negative",
};

const compactRowGrid = "grid grid-cols-[auto_16px_1fr] items-start";

function EventDot({
  type,
  showConnector,
  className,
}: {
  type: ActivityEventType;
  showConnector: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("relative flex w-4 shrink-0 justify-center self-stretch", className)}
    >
      <span
        className={cn(
          "relative z-10 mt-1.5 size-2 rounded-full",
          eventDot[type],
          type === "ANALYZING" && "animate-pulse"
        )}
      />
      {showConnector ? (
        <span className="absolute top-4 bottom-[-16px] w-px bg-border-subtle" />
      ) : null}
    </div>
  );
}

function EventBody({
  event,
  showAgent,
}: {
  event: ActivityEvent;
  showAgent: boolean;
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className={cn("text-xs font-medium tracking-wide uppercase", eventTone[event.type])}>
        {event.title}
      </p>
      <div className="mt-1.5">
        <ActivityEventDescription event={event} />
      </div>
      {showAgent ? <p className="mt-2 text-xs text-tertiary">{event.agentName}</p> : null}
    </div>
  );
}

function FeedEventMeta({
  event,
  showAgent,
  showConnector,
}: {
  event: ActivityEvent;
  showAgent: boolean;
  showConnector: boolean;
}) {
  return (
    <div className={cn(activityFeedMetaCol, activityBodyPad, "flex w-full items-start justify-start gap-4 text-left")}>
      <EventDot type={event.type} showConnector={showConnector} />
      <div className="min-w-0">
        <p className={cn("text-xs font-medium tracking-wide uppercase", eventTone[event.type])}>
          {event.title}
        </p>
        {showAgent ? <p className="mt-2 text-sm font-medium text-foreground">{event.agentName}</p> : null}
      </div>
    </div>
  );
}

export function ActivityTimeline({
  events,
  showAgent = false,
  alignWithActivityFeed = false,
}: {
  events: ActivityEvent[];
  showAgent?: boolean;
  /** Match Live cycles table columns on /activity. */
  alignWithActivityFeed?: boolean;
}) {
  const ordered = [...events].reverse();

  return (
    <ol className="space-y-0">
      {ordered.map((event, index) => {
        const rowBorder = cn("border-t border-white/6", index === 0 && "border-t-0");
        const showConnector = index < ordered.length - 1;

        if (alignWithActivityFeed) {
          return (
            <li
              key={event.id}
              className={cn("animate-arena-enter", activityFeedRowGrid, rowBorder)}
            >
              <time
                dateTime={event.createdAt}
                suppressHydrationWarning
                className={cn(
                  activityBodyPad,
                  "whitespace-nowrap text-xs tabular-nums text-tertiary"
                )}
              >
                {formatClockTime(event.createdAt)}
              </time>
              <FeedEventMeta event={event} showAgent={showAgent} showConnector={showConnector} />
              <div
                className={cn(
                  activityFeedDetailCol,
                  activityBodyPad,
                  "flex w-full items-start justify-start text-left"
                )}
              >
                <ActivityEventExecutionContent event={event} />
              </div>
              <div
                className={cn(
                  activityFeedActionCol,
                  activityBodyPad,
                  "flex items-start justify-end text-right"
                )}
              >
                <ActivityEventActionBadge event={event} />
              </div>
            </li>
          );
        }

        return (
          <li key={event.id} className={cn("animate-arena-enter", compactRowGrid, rowBorder)}>
            <time
              dateTime={event.createdAt}
              suppressHydrationWarning
              className={cn(
                activityBodyPad,
                "whitespace-nowrap text-xs tabular-nums text-tertiary"
              )}
            >
              {formatClockTime(event.createdAt)}
            </time>
            <EventDot type={event.type} showConnector={showConnector} className="py-4" />
            <div className={activityBodyPad}>
              <EventBody event={event} showAgent={showAgent} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
