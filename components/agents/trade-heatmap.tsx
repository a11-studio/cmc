"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TradeCheck } from "@/lib/agent/trade-outcomes";
import { buildTradeHeatmap, type HeatmapCell } from "@/lib/charts/trade-heatmap";
import { cn } from "@/lib/utils";

const WIN = ["#0E2A18", "#14532D", "#15803D", "#22C55E"] as const;
const LOSS = ["#3F1212", "#7F1D1D", "#B91C1C", "#F87171"] as const;

function cellStyle(cell: HeatmapCell) {
  if (cell.tone === "empty" || cell.level === 0) {
    return { backgroundColor: "#171717" };
  }

  if (cell.tone === "mixed") {
    return { backgroundColor: "#3F3F46" };
  }

  const scale = cell.tone === "win" ? WIN : LOSS;
  return { backgroundColor: scale[cell.level - 1] };
}

function cellTitle(cell: HeatmapCell) {
  if (cell.future) {
    return cell.label;
  }

  if (cell.wins === 0 && cell.losses === 0) {
    return `${cell.label}: no scored trades`;
  }

  const parts = [
    cell.wins ? `${cell.wins} confirmed` : null,
    cell.losses ? `${cell.losses} against` : null,
  ].filter(Boolean);

  return `${cell.label}: ${parts.join(", ")}`;
}

export function TradeHeatmap({
  checks,
  emptyLabel = "No scored trades yet. Squares fill after the next cycle marks a fill.",
}: {
  checks: TradeCheck[];
  emptyLabel?: string;
}) {
  const heatmap = useMemo(() => buildTradeHeatmap(checks), [checks]);

  return (
    <Card>
      <CardHeader className="border-b border-border-subtle">
        <CardTitle className="text-xs font-medium tracking-[0.16em] text-tertiary uppercase">
          Trade checks
        </CardTitle>
        <p className="mt-2 text-sm text-white/45">
          Next cycle versus fill. Green confirmed the side, red moved against it.
        </p>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="overflow-x-auto">
          <div className="inline-flex min-w-full flex-col gap-2">
            <div className="relative ml-[31px] h-4">
              {heatmap.months.map((month) => (
                <span
                  key={`${month.label}-${month.weekIndex}`}
                  className="absolute text-[10px] text-white/40"
                  style={{ left: `${month.weekIndex * 14}px` }}
                >
                  {month.label}
                </span>
              ))}
            </div>
            <div className="flex gap-[3px]">
              <div className="flex w-7 shrink-0 flex-col gap-[3px] text-[10px] leading-[11px] text-white/40">
                <span className="h-[11px]">Mon</span>
                <span className="h-[11px]" />
                <span className="h-[11px]">Wed</span>
                <span className="h-[11px]" />
                <span className="h-[11px]">Fri</span>
                <span className="h-[11px]" />
                <span className="h-[11px]" />
              </div>
              {heatmap.weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-[3px]">
                  {week.map((cell) => (
                    <span
                      key={cell.date}
                      title={cellTitle(cell)}
                      className={cn("size-[11px] rounded-[2px]", cell.future && "opacity-40")}
                      style={cellStyle(cell)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/40">
          <p>
            {heatmap.confirmed + heatmap.against === 0
              ? emptyLabel
              : `${heatmap.confirmed} confirmed · ${heatmap.against} against`}
          </p>
          <p className="flex items-center gap-[3px]">
            Against
            <span className="size-[11px] rounded-[2px]" style={{ backgroundColor: LOSS[0] }} />
            <span className="size-[11px] rounded-[2px]" style={{ backgroundColor: LOSS[3] }} />
            <span className="size-[11px] rounded-[2px]" style={{ backgroundColor: "#171717" }} />
            <span className="size-[11px] rounded-[2px]" style={{ backgroundColor: WIN[0] }} />
            <span className="size-[11px] rounded-[2px]" style={{ backgroundColor: WIN[3] }} />
            Confirmed
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
