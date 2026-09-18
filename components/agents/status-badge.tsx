import { cn } from "@/lib/utils";
import type { AgentStatus } from "@/types/arena";

const styles: Record<AgentStatus, string> = {
  ACTIVE: "bg-positive-muted text-positive",
  PAUSED: "bg-surface-hover text-muted-foreground",
  ERROR: "bg-negative-muted text-negative",
};

const labels: Record<AgentStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  ERROR: "Error",
};

export function StatusBadge({ status }: { status: AgentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-xs font-medium",
        styles[status]
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "ACTIVE" && "bg-positive",
          status === "PAUSED" && "bg-muted-foreground",
          status === "ERROR" && "bg-negative"
        )}
      />
      {labels[status]}
    </span>
  );
}
