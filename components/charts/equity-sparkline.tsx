"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatChartTime, formatUsd } from "@/lib/format";
import { SignedPercent, SignedUsd } from "@/components/shared/signed-value";
import { TickerPhrase } from "@/components/market/asset-icon";
import {
  equityChange,
  equityIndexAtSvgX,
  normalizeEquityPoints,
  type EquityChartPoint,
} from "@/lib/charts/equity";

const PLOT_HEIGHT = 216;
const HERO_HEIGHT = 165;
const AXIS_WIDTH = 56;
const PAD_X = 8;
const PAD_Y = 10;

export function EquitySparkline({
  points,
  className,
  variant = "full",
  referenceEquity,
  trendPositive,
}: {
  points: Array<number | EquityChartPoint>;
  className?: string;
  variant?: "full" | "hero";
  /** When set, line color and baseline use this instead of the first history point (e.g. starting capital). */
  referenceEquity?: number;
  /** When set, overrides green/red stroke (e.g. live P&L vs starting capital). */
  trendPositive?: boolean;
}) {
  const series = useMemo(() => normalizeEquityPoints(points), [points]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [plotWidth, setPlotWidth] = useState(720);
  const plotRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const fillId = useId().replace(/:/g, "");
  const isHero = variant === "hero";
  const plotHeight = isHero ? HERO_HEIGHT : PLOT_HEIGHT;
  const axisWidth = isHero ? 0 : AXIS_WIDTH;

  useLayoutEffect(() => {
    const node = plotRef.current;

    if (!node) {
      return;
    }

    function measure() {
      const width = node?.getBoundingClientRect().width ?? 0;
      if (width > 0) {
        setPlotWidth(width);
      }
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);

    return () => observer.disconnect();
  }, [series.length]);

  if (series.length < 2) {
    return null;
  }

  const equities = series.map((point) => point.equity);
  const min = Math.min(...equities);
  const max = Math.max(...equities);
  const range = max - min || 1;
  const innerWidth = Math.max(plotWidth - PAD_X * 2, 1);
  const innerHeight = plotHeight - PAD_Y * 2;
  const baseline = referenceEquity ?? series[0]!.equity;
  const latest = series.at(-1)!;
  const active = series[activeIndex ?? series.length - 1]!;
  const positive = trendPositive ?? latest.equity >= baseline;
  const stroke = positive ? (isHero ? "#8ADF7B" : "#A3E635") : "#F87171";
  const gradientId = `${fillId}-${positive ? "up" : "down"}`;
  const change = equityChange(active.equity, baseline);

  const coords = series.map((point, index) => {
    const x = PAD_X + (index / (series.length - 1)) * innerWidth;
    const y = PAD_Y + innerHeight - ((point.equity - min) / range) * innerHeight;
    return { x, y };
  });

  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${PAD_X},${PAD_Y + innerHeight} ${line} ${PAD_X + innerWidth},${PAD_Y + innerHeight}`;
  const ticks = [max, min + range / 2, min];
  const activeCoord = coords[activeIndex ?? coords.length - 1]!;
  const latestCoord = coords.at(-1)!;
  const baselineY = PAD_Y + innerHeight - ((baseline - min) / range) * innerHeight;
  const tooltipLeft = Math.min(Math.max((activeCoord.x / plotWidth) * 100, 18), 72);

  function setFromClientX(clientX: number) {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();

    if (!svg || !ctm) {
      return;
    }

    const svgX = new DOMPoint(clientX, 0).matrixTransform(ctm.inverse()).x;
    setActiveIndex(equityIndexAtSvgX(svgX, series.length, PAD_X, innerWidth));
  }

  return (
    <div className={cn("relative", className)}>
      {isHero ? null : (
        <div className="mb-3 flex items-end justify-between gap-4 px-1">
          <div>
            <p className="text-[11px] font-medium tracking-[0.16em] text-tertiary uppercase">
              {active.label ?? "Equity"}
            </p>
            <p className="mt-1 text-xl font-medium tabular-nums text-foreground">{formatUsd(active.equity)}</p>
          </div>
          <div className="text-right">
            <SignedUsd value={change.amount} className="block text-sm" />
            <SignedPercent value={change.percent} className="text-xs" digits={2} />
          </div>
        </div>
      )}

      <div className="relative" style={{ height: plotHeight + (isHero ? 0 : 24) }}>
        <div
          ref={plotRef}
          className="absolute top-0 left-0 cursor-crosshair"
          style={{ width: axisWidth ? `calc(100% - ${axisWidth}px)` : "100%", height: plotHeight }}
          onMouseMove={(event) => setFromClientX(event.clientX)}
          onMouseLeave={() => setActiveIndex(null)}
          onTouchStart={(event) => {
            const touch = event.touches[0];
            if (touch) {
              setFromClientX(touch.clientX);
            }
          }}
          onTouchMove={(event) => {
            const touch = event.touches[0];
            if (touch) {
              setFromClientX(touch.clientX);
            }
          }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${plotWidth} ${plotHeight}`}
            preserveAspectRatio="none"
            className="h-full w-full overflow-visible"
            role="img"
            aria-label="Equity curve"
          >
            <defs>
              <linearGradient id={`${fillId}-up`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={isHero ? "#8ADF7B" : "#A3E635"} stopOpacity={isHero ? "0.18" : "0.22"} />
                <stop offset="100%" stopColor={isHero ? "#8ADF7B" : "#A3E635"} stopOpacity="0" />
              </linearGradient>
              <linearGradient id={`${fillId}-down`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#F87171" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#F87171" stopOpacity="0" />
              </linearGradient>
            </defs>

            {ticks.map((tick, index) => {
              const y = PAD_Y + ((max - tick) / range) * innerHeight;

              return (
                <line
                  key={`${tick}-${index}`}
                  x1={PAD_X}
                  x2={PAD_X + innerWidth}
                  y1={y}
                  y2={y}
                  stroke={isHero ? "rgba(255,255,255,0.08)" : "#1D1D1F"}
                  strokeWidth="1"
                />
              );
            })}

            <line
              x1={PAD_X}
              x2={PAD_X + innerWidth}
              y1={baselineY}
              y2={baselineY}
              stroke={isHero ? "rgba(255,255,255,0.38)" : "rgba(138,138,142,0.55)"}
              strokeWidth="1"
              strokeDasharray="5 5"
            />

            <polygon points={area} fill={`url(#${gradientId})`} />
            <polyline
              points={line}
              fill="none"
              stroke={stroke}
              strokeWidth="1.75"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {activeIndex != null ? (
              <g>
                <line
                  x1={activeCoord.x}
                  x2={activeCoord.x}
                  y1={PAD_Y}
                  y2={PAD_Y + innerHeight}
                  stroke="#8A8A8E"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <line
                  x1={PAD_X}
                  x2={PAD_X + innerWidth}
                  y1={activeCoord.y}
                  y2={activeCoord.y}
                  stroke="#8A8A8E"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.45"
                />
                <circle
                  cx={activeCoord.x}
                  cy={activeCoord.y}
                  r="4.5"
                  fill="#0A0A0B"
                  stroke={stroke}
                  strokeWidth="2"
                />
              </g>
            ) : (
              <g>
                <circle
                  className="animate-equity-pulse"
                  cx={latestCoord.x}
                  cy={latestCoord.y}
                  r="3"
                  fill={stroke}
                />
                <circle cx={latestCoord.x} cy={latestCoord.y} r="3" fill={stroke} />
              </g>
            )}
          </svg>

          {activeIndex != null ? (
            <div
              className="pointer-events-none absolute top-3 z-10 w-[196px] -translate-x-1/2 rounded-md border border-white/10 bg-[#101010] px-3 py-2.5"
              style={{ left: `${tooltipLeft}%` }}
            >
              <p className="text-[11px] text-tertiary">{formatChartTime(active.at)}</p>
              <p className="mt-1 text-sm font-medium tabular-nums text-foreground">{formatUsd(active.equity)}</p>
              <p className="mt-0.5 flex items-center gap-2 text-xs">
                <SignedUsd value={change.amount} />
                <SignedPercent value={change.percent} digits={2} />
              </p>
              {active.label && !isHero ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  <TickerPhrase text={active.label} size="xs" />
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {isHero ? null : (
          <div className="pointer-events-none absolute top-0 right-0" style={{ width: axisWidth, height: plotHeight }}>
            {ticks.map((tick, index) => (
              <span
                key={`${tick}-${index}`}
                className="absolute right-0 text-[10px] tabular-nums text-tertiary"
                style={{
                  top: PAD_Y + ((max - tick) / range) * innerHeight,
                  transform: index === 0 ? "none" : index === ticks.length - 1 ? "translateY(-100%)" : "translateY(-50%)",
                }}
              >
                {formatUsd(tick, true)}
              </span>
            ))}
          </div>
        )}

        {isHero ? null : (
          <div
            className="absolute right-0 bottom-0 left-0 flex justify-between text-[10px] text-tertiary"
            style={{ paddingRight: axisWidth }}
          >
            <span>{formatChartTime(series[0]?.at)}</span>
            <span>{formatChartTime(latest.at)}</span>
          </div>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {formatUsd(active.equity)} {change.percent.toFixed(2)} percent versus start
        {!isHero && active.label ? `, ${active.label}` : ""}
      </p>
    </div>
  );
}
