import { formatPercent } from "@/lib/format";
import type { RankedShare } from "@/lib/market/shares";

export function CompositionTrack({ slices }: { slices: readonly RankedShare[] }) {
  if (slices.length === 0) {
    return <div className="h-2 w-full rounded-[20px] bg-[#1A2E2E]" />;
  }

  let start = 0;
  const layers = slices.map((slice) => {
    const layer = { ...slice, start };
    start += slice.percent;
    return layer;
  });

  return (
    <div className="relative h-2 w-full">
      {layers.map((layer, index) => (
        <div
          key={layer.id}
          title={`${layer.label} ${formatPercent(layer.percent, false, 0)}`}
          className="absolute inset-y-0"
          style={{
            left: `${layer.start}%`,
            width: `${Math.max(100 - layer.start, 0)}%`,
            backgroundColor: layer.color,
            zIndex: index,
            borderTopRightRadius: 20,
            borderBottomRightRadius: 20,
            borderTopLeftRadius: index === 0 ? 20 : 0,
            borderBottomLeftRadius: index === 0 ? 20 : 0,
          }}
        />
      ))}
    </div>
  );
}

export function CompositionBar({ slices }: { slices: RankedShare[] }) {
  if (slices.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <CompositionTrack slices={slices} />
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
