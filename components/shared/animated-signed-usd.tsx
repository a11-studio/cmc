"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { SignedUsd } from "@/components/shared/signed-value";
import { formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

const DURATION_MS = 620;

// Two cycles so a reel can roll forward past 9 into the next 0 without a
// backwards jump. A roll never exceeds 9 + 9 places.
const REEL = Array.from({ length: 20 }, (_, index) => index % 10);

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

function formatSignedUsd(value: number): string {
  return value > 0 ? `+${formatUsd(value)}` : formatUsd(value);
}

function toCents(value: number): number {
  return Math.round(Math.abs(value) * 100);
}

// `place` is the dollar exponent: 0 = ones, -2 = cents, 3 = thousands.
function digitAt(cents: number, place: number): number {
  return Math.floor(cents / 10 ** (place + 2)) % 10;
}

type Cell =
  | { kind: "static"; char: string }
  | { kind: "digit"; place: number };

// Layout comes from the target so the number never reflows while it animates.
function buildCells(target: number): Cell[] {
  const cells: Cell[] = [];
  const sign = target > 0 ? "+" : target < 0 ? "-" : "";

  if (sign) {
    cells.push({ kind: "static", char: sign });
  }

  cells.push({ kind: "static", char: "$" });

  const wholeDollars = Math.floor(toCents(target) / 100);

  for (let place = Math.max(String(wholeDollars).length - 1, 0); place >= 0; place -= 1) {
    cells.push({ kind: "digit", place });

    if (place % 3 === 0 && place > 0) {
      cells.push({ kind: "static", char: "," });
    }
  }

  cells.push({ kind: "static", char: "." });
  cells.push({ kind: "digit", place: -1 });
  cells.push({ kind: "digit", place: -2 });

  return cells;
}

function AnimatedSignedUsdInner({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const reels = useRef(new Map<number, HTMLSpanElement>());
  // Cents currently on screen, so an interrupted run resumes from there.
  const displayedRef = useRef(0);
  const hasRunRef = useRef(false);

  const cells = buildCells(value);

  useEffect(() => {
    const from = hasRunRef.current ? displayedRef.current : 0;
    const to = toCents(value);
    hasRunRef.current = true;

    // Each reel rolls forward from its current digit to its target digit, so
    // the motion is one continuous slide that lands on an exact digit.
    const plan = [...reels.current.keys()].map((place) => {
      const start = digitAt(from, place);
      const end = digitAt(to, place);

      return { place, start, distance: (end - start + 10) % 10 };
    });

    function paint(eased: number) {
      for (const { place, start, distance } of plan) {
        const reel = reels.current.get(place);

        if (reel) {
          reel.style.transform = `translateY(${-(start + distance * eased)}em)`;
        }
      }
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (from === to || reduced) {
      displayedRef.current = to;
      paint(1);
      return;
    }

    const startedAt = performance.now();

    function tick(now: number) {
      const progress = Math.min((now - startedAt) / DURATION_MS, 1);
      paint(easeOutCubic(progress));

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }

      displayedRef.current = to;

      // Re-anchor to the canonical position; the glyph shown is identical.
      for (const { place } of plan) {
        const reel = reels.current.get(place);

        if (reel) {
          reel.style.transform = `translateY(${-digitAt(to, place)}em)`;
        }
      }
    }

    let frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span aria-live="polite">
      <span className="sr-only">{formatSignedUsd(value)}</span>

      <span
        aria-hidden
        className={cn("inline-flex items-end tabular-nums", className, "leading-none")}
      >
        {cells.map((cell, index) =>
          cell.kind === "static" ? (
            <span key={`${index}-${cell.char}`} className="block h-[1em]">
              {cell.char}
            </span>
          ) : (
            <span
              key={`digit-${cell.place}`}
              className="relative block h-[1em] w-[1ch] overflow-hidden"
            >
              <span
                ref={(node) => {
                  const map = reels.current;

                  if (node) {
                    map.set(cell.place, node);
                  }

                  return () => {
                    map.delete(cell.place);
                  };
                }}
                className="absolute inset-x-0 top-0 flex flex-col"
              >
                {REEL.map((digit, position) => (
                  <span key={position} className="block h-[1em] text-center">
                    {digit}
                  </span>
                ))}
              </span>
            </span>
          )
        )}
      </span>
    </span>
  );
}

const subscribe = () => () => {};

export function AnimatedSignedUsd({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  if (!mounted) {
    return <SignedUsd value={value} className={cn(className, "invisible")} aria-hidden />;
  }

  return <AnimatedSignedUsdInner value={value} className={className} />;
}
