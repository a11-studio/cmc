import { formatPercent } from "@/lib/format";
import type { RankedShare } from "@/lib/market/shares";

export function CompositionBar({ slices }: { slices: RankedShare[] }) {
  if (slices.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <div className="flex h-3 overflow-hidden rounded-full bg-white/6">
        {slices.map((slice) => (
          <div
            key={slice.id}
            className="h-full"
            style={{ width: `${slice.percent}%`, backgroundColor: slice.color }}
            title={`${slice.label} ${formatPercent(slice.percent, false, 0)}`}
          />
        ))}
      </div>
      <ul className="mt-6 space-y-3">
        {slices.map((slice) => (
          <li key={slice.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
              <span className="truncate font-medium">{slice.label}</span>
            </span>
            <span className="tabular-nums text-white/70">{formatPercent(slice.percent, false, 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
