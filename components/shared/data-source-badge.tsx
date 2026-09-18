import { cn } from "@/lib/utils";
import type { DataSource } from "@/types/arena";

export function DataSourceBadge({ source }: { source: DataSource }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium",
        source === "live" ? "bg-positive-muted text-positive" : "bg-surface-hover text-tertiary"
      )}
    >
      {source === "live" ? "Live" : source === "roster" ? "Ready" : "Sample"}
    </span>
  );
}
