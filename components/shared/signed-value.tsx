import { cn } from "@/lib/utils";
import { formatPercent, formatUsd } from "@/lib/format";

export function SignedPercent({
  value,
  className,
  digits = 1,
}: {
  value?: number | null;
  className?: string;
  digits?: number;
}) {
  if (value == null || !Number.isFinite(value)) {
    return <span className={cn("tabular-nums text-faint", className)}>—</span>;
  }

  const tone =
    value > 0 ? "text-positive" : value < 0 ? "text-negative" : "text-muted-foreground";

  return (
    <span className={cn("tabular-nums", tone, className)}>
      {formatPercent(value, true, digits)}
    </span>
  );
}

export function SignedUsd({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const tone =
    value > 0 ? "text-positive" : value < 0 ? "text-negative" : "text-muted-foreground";
  const prefix = value > 0 ? "+" : "";

  return (
    <span className={cn("tabular-nums", tone, className)}>
      {prefix}
      {formatUsd(value)}
    </span>
  );
}
