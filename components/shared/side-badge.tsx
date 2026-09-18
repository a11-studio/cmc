import { cn } from "@/lib/utils";
import type { TradeAction } from "@/types/arena";

const styles: Record<TradeAction, string> = {
  BUY: "bg-positive-muted text-positive",
  SELL: "bg-negative-muted text-negative",
  SHORT: "bg-negative-muted text-negative",
  HOLD: "bg-surface-3 text-muted-foreground",
};

export function SideBadge({ action }: { action: TradeAction }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium",
        styles[action]
      )}
    >
      {action}
    </span>
  );
}
