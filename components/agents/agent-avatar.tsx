import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { AgentMark } from "@/types/arena";

const portraits: Partial<Record<AgentMark, string>> = {
  momentum: "/agents/elon-musk.jpg",
  turtle: "/agents/richard-dennis.jpg",
  trend: "/agents/richard-donchian.jpg",
  speculator: "/agents/jesse-livermore.jpg",
  jones: "/agents/paul-tudor-jones.jpg",
  quant: "/agents/jim-simons.jpg",
  burry: "/agents/michael-burry.jpg",
  buffett: "/agents/warren-buffett.jpg",
  hayes: "/agents/arthur-hayes.jpg",
  liquidation: "/agents/btc-liquidation-signal.png",
};

const markStyles: Record<AgentMark, string> = {
  momentum: "bg-positive-muted text-positive",
  news: "bg-ai-muted text-ai",
  contrarian: "bg-negative-muted text-negative",
  macro: "bg-warning-muted text-warning",
  turtle: "bg-[#0B1F0C] text-[#8ADF7B]",
  trend: "bg-[#0C3E3D] text-[#00D4CF]",
  speculator: "bg-[#1A1408] text-[#F59E0B]",
  jones: "bg-[#101820] text-[#93C5FD]",
  quant: "bg-[#14141C] text-[#C4B5FD]",
  burry: "bg-negative-muted text-negative",
  buffett: "bg-[#0B1A14] text-[#6EE7B7]",
  hayes: "bg-[#1A1208] text-[#FDBA74]",
  liquidation: "bg-[#1A0F14] text-[#F87171]",
};

function MomentumGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[14px]">
      <path
        d="M4 16.5 10 10l4 3.5L20 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M14.5 6H20v5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function NewsGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[14px]">
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      <path
        d="M7.2 12a4.8 4.8 0 0 1 4.8-4.8M16.8 12A4.8 4.8 0 0 1 12 16.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M5 12a7 7 0 0 1 7-7M19 12a7 7 0 0 1-7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ContrarianGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[14px]">
      <path
        d="M12 5 20 19H4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 10v5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MacroGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[14px]">
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <ellipse
        cx="12"
        cy="12"
        rx="9"
        ry="4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        transform="rotate(-24 12 12)"
      />
    </svg>
  );
}

function LiquidationGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[14px]">
      <path
        d="M12 4v16M8.5 7.5h7M7 11h10M8.5 14.5h7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M6 18c2-2 4-3 6-3s4 1 6 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CompoundGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[14px]">
      <path
        d="M4 19c5.5 0 11.5-3.5 16-14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M4 19h16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const glyphs: Record<AgentMark, ReactNode> = {
  momentum: <MomentumGlyph />,
  news: <NewsGlyph />,
  contrarian: <ContrarianGlyph />,
  macro: <MacroGlyph />,
  turtle: <MomentumGlyph />,
  trend: <MomentumGlyph />,
  speculator: <NewsGlyph />,
  jones: <MacroGlyph />,
  quant: <NewsGlyph />,
  burry: <ContrarianGlyph />,
  buffett: <CompoundGlyph />,
  hayes: <MacroGlyph />,
  liquidation: <LiquidationGlyph />,
};

const sizePx = {
  sm: 28,
  md: 32,
  lg: 44,
} as const;

export function AgentAvatar({
  mark,
  name,
  size = "md",
}: {
  mark: AgentMark;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass = size === "sm" ? "size-7" : size === "lg" ? "size-11" : "size-8";
  const portrait = portraits[mark];
  const pixels = sizePx[size];

  if (portrait) {
    return (
      <span
        aria-hidden="true"
        title={name}
        className={cn("relative inline-flex shrink-0 overflow-hidden rounded-full ring-1 ring-white/10", sizeClass)}
      >
        <Image
          src={portrait}
          alt=""
          width={pixels}
          height={pixels}
          className={cn(
            "size-full object-cover",
            mark === "liquidation" ? "object-center" : "object-[center_18%]"
          )}
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md",
        markStyles[mark],
        sizeClass
      )}
    >
      {glyphs[mark]}
    </span>
  );
}
