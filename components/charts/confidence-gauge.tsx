"use client";

import { useId } from "react";
import { arcPoint, clampPercent } from "@/lib/charts/confidence";
import { cn } from "@/lib/utils";

const CX = 100;
const CY = 118;
const RADIUS = 82;
const STROKE = 12;

export function ConfidenceGauge({
  value,
  label = "confidence",
  className,
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  const gradientId = `confidence-arc-${useId().replace(/:/g, "")}`;
  const percent = clampPercent(value);
  const knob = arcPoint(CX, CY, RADIUS, percent);
  const track = `M ${CX - RADIUS} ${CY} A ${RADIUS} ${RADIUS} 0 0 1 ${CX + RADIUS} ${CY}`;

  return (
    <div className={cn("relative w-full", className)}>
      <svg
        viewBox="0 18 200 122"
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label={`${percent.toFixed(0)} ${label}`}
      >
        <defs>
          <linearGradient id={gradientId} x1={CX - RADIUS} y1={CY} x2={CX + RADIUS} y2={CY} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EA3943" />
            <stop offset="25%" stopColor="#EA8C00" />
            <stop offset="50%" stopColor="#F3D42F" />
            <stop offset="75%" stopColor="#93D900" />
            <stop offset="100%" stopColor="#16C784" />
          </linearGradient>
        </defs>
        <path d={track} fill="none" stroke={`url(#${gradientId})`} strokeWidth={STROKE} strokeLinecap="round" />
        <circle cx={knob.x} cy={knob.y} r="7.5" fill="#101010" />
        <circle cx={knob.x} cy={knob.y} r="5.75" fill="#fff" />
        <text
          x={CX}
          y={CY - 22}
          textAnchor="middle"
          fill="#fff"
          fontSize="36"
          fontWeight="500"
          fontFamily="var(--font-sans), ui-sans-serif, system-ui"
        >
          {percent.toFixed(0)}
        </text>
        <text
          x={CX}
          y={CY + 2}
          textAnchor="middle"
          fill="rgba(255,255,255,0.45)"
          fontSize="11"
          fontFamily="var(--font-sans), ui-sans-serif, system-ui"
        >
          {label}
        </text>
      </svg>
    </div>
  );
}
