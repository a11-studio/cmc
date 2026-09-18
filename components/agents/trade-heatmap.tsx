"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TickerPhrase } from "@/components/market/asset-icon";
import { SignedPercent } from "@/components/shared/signed-value";
import type { TradeCheck } from "@/lib/agent/trade-outcomes";
import { formatChartTime, formatUsd } from "@/lib/format";
import {
  groupTradeChecksByDay,
  tradeCheckMovePercent,
  tradeCheckTone,
  type TradeCheckTone,
} from "@/lib/charts/trade-heatmap";
import { cn } from "@/lib/utils";

const TONE: Record<TradeCheckTone, string> = {
  win: "#22C55E",
  loss: "#F87171",
  pending: "#171717",
};

function outcomeLabel(win: boolean | null) {
  if (win === true) {
    return "Confirmed";
  }

  if (win === false) {
    return "Against";
  }

  return "Waiting for next 15m check";
}

function TradeCheckCell({ check }: { check: TradeCheck }) {
  const [open, setOpen] = useState(false);
  const tone = tradeCheckTone(check.win);
  const move = tradeCheckMovePercent(check.fillPrice, check.checkPrice);

  return (
    <Tooltip open={open} onOpenChange={setOpen} delayDuration={0}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${check.side} ${check.symbol} ${outcomeLabel(check.win)}`}
          className="size-3.5 rounded-[3px] border border-white/5"
          style={{ backgroundColor: TONE[tone] }}
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
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
          {formatUsd(check.fillPrice)}
          {check.checkPrice != null ? ` → ${formatUsd(check.checkPrice)}` : ""}
        </p>
        {move != null ? <SignedPercent value={move} className="mt-0.5 block text-xs" digits={2} /> : null}
        <p
          className={cn(
            "mt-1 text-[11px]",
            tone === "win" ? "text-positive" : tone === "loss" ? "text-negative" : "text-tertiary"
          )}
        >
          {outcomeLabel(check.win)}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export function TradeHeatmap({
  checks,
  emptyLabel = "Squares appear after a fill. Color waits for the next 15-minute check.",
}: {
  checks: TradeCheck[];
  emptyLabel?: string;
}) {
  const groups = useMemo(() => groupTradeChecksByDay(checks), [checks]);
  const confirmed = checks.filter((check) => check.win === true).length;
  const against = checks.filter((check) => check.win === false).length;
  const pending = checks.filter((check) => check.win == null).length;

  return (
    <Card className="overflow-visible">
      <CardHeader className="border-b border-border-subtle">
        <CardTitle className="text-xs font-medium tracking-[0.16em] text-tertiary uppercase">
          Trade checks
        </CardTitle>
        <p className="mt-2 text-sm text-white/45">
          One square per fill. Green confirmed the side at the next 15-minute check, red moved against it.
        </p>
      </CardHeader>
      <CardContent className="pt-4">
        {groups.length === 0 ? (
          <p className="text-[11px] text-white/40">{emptyLabel}</p>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.date} className="flex items-start gap-3">
                <p className="w-12 shrink-0 pt-0.5 text-[10px] text-white/40">{group.label}</p>
                <div className="flex flex-wrap gap-[4px]">
                  {group.checks.map((check) => (
                    <TradeCheckCell key={check.tradeId} check={check} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/40">
          {checks.length > 0 ? (
            <p>
              {confirmed} confirmed · {against} against
              {pending ? ` · ${pending} pending` : ""}
            </p>
          ) : (
            <span />
          )}
          <p className="flex items-center gap-[3px]">
            Against
            <span className="size-[11px] rounded-[2px]" style={{ backgroundColor: TONE.loss }} />
            <span className="size-[11px] rounded-[2px]" style={{ backgroundColor: TONE.pending }} />
            <span className="size-[11px] rounded-[2px]" style={{ backgroundColor: TONE.win }} />
            Confirmed
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
