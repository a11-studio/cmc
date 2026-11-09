"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TickerPhrase } from "@/components/market/asset-icon";
import { SignedPercent } from "@/components/shared/signed-value";
import type { TradeCheck } from "@/lib/agent/trade-outcomes";
import { formatChartTime, formatUsd } from "@/lib/format";
import {
  buildHourlyCheckGrid,
  HOURLY_GRID_DAYS,
  summarizeTradeChecks,
  tradeCheckMovePercent,
  tradeCheckTone,
  type TradeCheckTone,
} from "@/lib/charts/trade-heatmap";
import { cn } from "@/lib/utils";

const TONE: Record<TradeCheckTone, string> = {
  win: "#22C55E",
  loss: "#F87171",
  pending: "transparent",
  hold: "transparent",
  blocked: "transparent",
};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const LABELED_HOURS = new Set([0, 6, 12, 18]);

// 24 columns fit a phone at 7px and match the old grid's 11px from sm up.
const GAP_CLASS = "gap-[2px] sm:gap-[3px]";
const CELL = "size-[7px] sm:size-[11px]";
const CELL_ROW = "h-[7px] sm:h-[11px]";
const CELL_COL = "w-[7px] sm:w-[11px]";
const LABEL_COL = "w-9 sm:w-11";

function outcomeLabel(check: TradeCheck) {
  const tone = tradeCheckTone(check);

  if (tone === "win") {
    return "Confirmed";
  }

  if (tone === "loss") {
    return "Against";
  }

  if (tone === "hold") {
    return "HOLD · not counted";
  }

  if (tone === "blocked") {
    return "Blocked by risk · not counted";
  }

  return "Waiting for the next hourly cycle";
}

function cellClassName(tone: TradeCheckTone) {
  if (tone === "pending") {
    return "border-white/50 bg-transparent";
  }

  if (tone === "hold") {
    return "border-transparent bg-white/[0.16]";
  }

  if (tone === "blocked") {
    return "border-[#F59E0B]/70 bg-[#F59E0B]/20";
  }

  return "border-white/5";
}

function TradeCheckCell({ check }: { check: TradeCheck }) {
  const [open, setOpen] = useState(false);
  const tone = tradeCheckTone(check);
  const move = tradeCheckMovePercent(check.fillPrice, check.checkPrice);

  return (
    <Tooltip open={open} onOpenChange={setOpen} delayDuration={0}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${check.side} ${check.symbol} ${outcomeLabel(check)}`}
          className={cn(`${CELL} shrink-0 rounded-[2px] border`, cellClassName(tone))}
          style={TONE[tone] === "transparent" ? undefined : { backgroundColor: TONE[tone] }}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
        />
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        sideOffset={8}
        className="w-[196px] max-w-none flex-col items-start gap-0 border border-white/10 bg-[#101010] px-3 py-2.5 text-left text-foreground"
      >
        <p className="text-[11px] text-tertiary">{formatChartTime(check.createdAt)}</p>
        <p className="mt-1 text-sm font-medium text-foreground">
          {check.side} <TickerPhrase text={check.symbol} size="xs" />
        </p>
        {check.fillPrice != null ? (
          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
            {formatUsd(check.fillPrice)}
            {check.checkPrice != null ? ` → ${formatUsd(check.checkPrice)}` : ""}
          </p>
        ) : null}
        {move != null ? <SignedPercent value={move} className="mt-0.5 block text-xs" digits={2} /> : null}
        {check.fills > 1 ? (
          <p className="mt-0.5 text-[11px] text-tertiary">{check.fills} fills this hour, incl. protective exits</p>
        ) : null}
        <p
          className={cn(
            "mt-1 text-[11px]",
            tone === "win"
              ? "text-positive"
              : tone === "loss"
                ? "text-negative"
                : tone === "blocked"
                  ? "text-warning"
                  : "text-tertiary"
          )}
        >
          {outcomeLabel(check)}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

function EmptyHour() {
  return <div className={`${CELL} shrink-0 rounded-[2px] bg-white/[0.035]`} aria-hidden="true" />;
}

function hourLabel(hour: number) {
  return String(hour).padStart(2, "0");
}

export function TradeHeatmap({
  checks,
  emptyLabel = "Squares appear after the first hourly cycle. Color comes one cycle later.",
}: {
  checks: TradeCheck[];
  emptyLabel?: string;
}) {
  const rows = useMemo(() => buildHourlyCheckGrid(checks), [checks]);
  const summary = useMemo(
    () => summarizeTradeChecks(rows.flatMap((row) => row.hours.filter((check): check is TradeCheck => check != null))),
    [rows]
  );

  return (
    <Card className="overflow-visible">
      <CardHeader className="border-b border-border-subtle">
        <CardTitle className="text-xs font-medium tracking-[0.16em] text-tertiary uppercase">
          Trade checks
        </CardTitle>
        <p className="mt-2 text-sm text-white/45">
          One square per hourly cycle. A trade turns green when price moved its way by the next cycle, red when it
          moved against it. HOLD hours stay grey and do not count.
        </p>
      </CardHeader>
      <CardContent className="pt-5">
        {rows.length === 0 ? (
          <p className="text-[11px] text-white/40">{emptyLabel}</p>
        ) : (
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-5 sm:px-5">
            <div className="overflow-x-auto overflow-y-hidden py-0.5">
              <div className={`inline-flex min-w-0 flex-col ${GAP_CLASS}`}>
                <div className={`flex ${GAP_CLASS}`}>
                  <div className={`${LABEL_COL} shrink-0 text-[10px] leading-none text-white/30`}>UTC</div>
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className={`${CELL_COL} shrink-0 overflow-visible whitespace-nowrap text-[10px] leading-none text-white/40`}
                    >
                      {LABELED_HOURS.has(hour) ? hourLabel(hour) : ""}
                    </div>
                  ))}
                </div>

                {rows.map((row) => (
                  <div key={row.date} className={`flex ${GAP_CLASS}`}>
                    <div
                      className={`flex ${LABEL_COL} shrink-0 ${CELL_ROW} items-center whitespace-nowrap text-[10px] leading-none text-white/40`}
                    >
                      {row.label}
                    </div>
                    {row.hours.map((check, hour) =>
                      check ? <TradeCheckCell key={hour} check={check} /> : <EmptyHour key={hour} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 text-[11px] text-white/40">
          {rows.length > 0 ? (
            <p>
              Last {HOURLY_GRID_DAYS} days · {summary.trades} trades · {summary.confirmed} confirmed · {summary.against}{" "}
              against
              {summary.pending ? ` · ${summary.pending} pending` : ""}
              {summary.hitRatePercent != null ? ` · ${summary.hitRatePercent.toFixed(0)}% hit rate` : ""}
              {summary.held ? ` · ${summary.held} hold` : ""}
              {summary.blocked ? ` · ${summary.blocked} blocked` : ""}
            </p>
          ) : (
            <span />
          )}
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="flex items-center gap-1.5">
              <span className="size-[11px] rounded-[2px]" style={{ backgroundColor: "#22C55E" }} />
              Confirmed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-[11px] rounded-[2px]" style={{ backgroundColor: "#F87171" }} />
              Against
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-[11px] rounded-[2px] border border-white/50" />
              Pending
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-[11px] rounded-[2px] bg-white/[0.16]" />
              Hold
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
