"use client";

import { useState } from "react";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { CycleResultList } from "@/components/activity/cycle-result-list";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import type { ActivityFeedSlice } from "@/lib/arena/activity-feed-core";
import { cn } from "@/lib/utils";

function ShowMoreButton({
  expanded,
  count,
  noun,
  onToggle,
}: {
  expanded: boolean;
  count: number;
  noun: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "w-full rounded-lg border border-border bg-surface-1 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors",
        "hover:border-border-subtle hover:bg-surface-2 hover:text-foreground"
      )}
    >
      {expanded ? "Show less" : `Show more (${count} earlier ${count === 1 ? noun : `${noun}s`})`}
    </button>
  );
}

export function ActivityFeedPanel({
  latest,
  older,
}: {
  latest: ActivityFeedSlice;
  older: ActivityFeedSlice;
}) {
  const [cyclesExpanded, setCyclesExpanded] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);

  const hasMoreCycles = older.cycles.length > 0;
  const hasMoreEvents = older.events.length > 0;

  const cycles = cyclesExpanded ? [...latest.cycles, ...older.cycles] : latest.cycles;
  const events = timelineExpanded ? [...latest.events, ...older.events] : latest.events;

  if (latest.cycles.length === 0 && older.cycles.length === 0) {
    return (
      <EmptyState title="No cycles yet." description="Run a cycle or wait for the next hourly slot." />
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <CycleResultList cycles={cycles} />

        {hasMoreCycles ? (
          <ShowMoreButton
            expanded={cyclesExpanded}
            count={older.cycles.length}
            noun="cycle"
            onToggle={() => setCyclesExpanded((value) => !value)}
          />
        ) : null}
      </div>

      <div className="space-y-4">
        {events.length > 0 ? (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <ActivityTimeline events={events} showAgent alignWithActivityFeed />
            </div>
          </Card>
        ) : (
          <EmptyState
            title={hasMoreEvents ? "No steps in this batch yet." : "No live activity yet."}
            description={hasMoreEvents ? "Earlier steps are behind Show more." : "Steps appear after agents complete a cycle."}
          />
        )}

        {hasMoreEvents ? (
          <ShowMoreButton
            expanded={timelineExpanded}
            count={older.events.length}
            noun="step"
            onToggle={() => setTimelineExpanded((value) => !value)}
          />
        ) : null}
      </div>
    </div>
  );
}
