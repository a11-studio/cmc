import type { ComponentType } from "react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { isSupportedSymbol } from "@/lib/market/symbols";
import type { SupportedSymbol } from "@/lib/market/types";

const sizeClass = {
  xs: "size-3.5",
  sm: "size-4",
  md: "size-5",
  lg: "size-8",
  xl: "size-10",
} as const;

function BitcoinMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-full" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#F7931A" />
      <path
        fill="#fff"
        d="M22.5 14.12c.28-1.86-1.14-2.86-3.08-3.53l.63-2.52-1.54-.38-.61 2.46c-.4-.1-.82-.2-1.23-.29l.62-2.47-1.54-.39-.63 2.52c-.33-.07-.66-.15-.98-.23l.002-.01-2.12-.53-.41 1.64s1.14.26 1.12.28c.62.15.73.56.71.89l-.71 2.87c.04.01.1.03.16.05l-.16-.04-1 4.01c-.08.19-.27.47-.56.36.01.02-1.12-.28-1.12-.28l-.76 1.76 2 .5c.37.09.74.19 1.1.28l-.64 2.55 1.54.38.63-2.52c.42.11.83.22 1.22.32l-.63 2.51 1.54.39.63-2.55c2.62.5 4.59.3 5.42-2.07.67-1.91-.03-3.01-1.41-3.73 1-.23 1.76-.89 1.96-2.26zm-3.51 4.92c-.47 1.91-3.69.88-4.73.62l.84-3.38c1.04.26 4.38.77 3.89 2.76zm.48-4.95c-.43 1.74-3.11.85-3.97.64l.76-3.06c.87.21 3.66.62 3.21 2.42z"
      />
    </svg>
  );
}

function EthereumMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-full" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#627EEA" />
      <path fill="#fff" fillOpacity="0.6" d="M16.5 6v7.4l6.25 2.79z" />
      <path fill="#fff" d="M16.5 6 10.25 16.19 16.5 13.4z" />
      <path fill="#fff" fillOpacity="0.6" d="M16.5 21.97v4.02L22.76 17.6z" />
      <path fill="#fff" d="M16.5 25.99v-4.03l-6.25-4.36z" />
      <path fill="#fff" fillOpacity="0.2" d="M16.5 20.57 22.75 16.2 16.5 13.42z" />
      <path fill="#fff" fillOpacity="0.6" d="M10.25 16.2 16.5 20.57v-7.15z" />
    </svg>
  );
}

function SolanaMark() {
  const gradientId = `solana-${useId().replace(/:/g, "")}`;

  return (
    <svg viewBox="0 0 32 32" className="size-full" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#0B0B0C" />
      <defs>
        <linearGradient id={gradientId} x1="8" y1="24" x2="24" y2="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00FFA3" />
          <stop offset="1" stopColor="#DC1FFF" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        d="M10.2 19.55c.14-.14.33-.22.53-.22h11.02c.33 0 .5.4.27.64l-2.16 2.2a.75.75 0 0 1-.53.22H8.31c-.33 0-.5-.4-.27-.64zM10.2 9.83c.14-.14.33-.22.53-.22h11.02c.33 0 .5.4.27.64l-2.16 2.2a.75.75 0 0 1-.53.22H8.31c-.33 0-.5-.4-.27-.64zM21.8 14.63c-.14-.14-.33-.22-.53-.22H10.25c-.33 0-.5.4-.27.64l2.16 2.2c.14.14.33.22.53.22h11.02c.33 0 .5-.4.27-.64z"
      />
    </svg>
  );
}

function BnbMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-full" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#F3BA2F" />
      <path
        fill="#fff"
        d="M16 8.4 12.55 11.85 16 15.3l3.45-3.45zm-5.2 5.2L7.35 16 10.8 19.45 14.25 16zm10.4 0L17.75 16 21.2 19.45 24.65 16zM16 16.7 12.55 20.15 16 23.6l3.45-3.45zM16 13.55 13.55 16 16 18.45 18.45 16z"
      />
    </svg>
  );
}

function XrpMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-full" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#23292F" />
      <path
        fill="#fff"
        d="M8.4 9.6c.55-.55 1.45-.55 2 0L16 15.2l5.6-5.6c.55-.55 1.45-.55 2 0 .55.55.55 1.45 0 2L18 17.2c-1.1 1.1-2.9 1.1-4 0L8.4 11.6c-.55-.55-.55-1.45 0-2z"
      />
      <path
        fill="#fff"
        d="M8.4 22.4c.55.55 1.45.55 2 0L16 16.8l5.6 5.6c.55.55 1.45.55 2 0 .55-.55.55-1.45 0-2L18 14.8c-1.1-1.1-2.9-1.1-4 0L8.4 20.4c-.55.55-.55 1.45 0 2z"
      />
    </svg>
  );
}

function CashMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-full" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#17A34A" />
      <g
        fill="none"
        stroke="#fff"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(16 16) scale(0.92) translate(-12 -12)"
      >
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </g>
    </svg>
  );
}

function FallbackMark({ symbol }: { symbol: string }) {
  return (
    <svg viewBox="0 0 32 32" className="size-full" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#3A3A3C" />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fill="#fff"
        fontSize="13"
        fontFamily="var(--font-sans), ui-sans-serif, system-ui"
        fontWeight="600"
      >
        {symbol.slice(0, 1)}
      </text>
    </svg>
  );
}

const marks: Record<SupportedSymbol, ComponentType> = {
  BTC: BitcoinMark,
  ETH: EthereumMark,
  SOL: SolanaMark,
  BNB: BnbMark,
  XRP: XrpMark,
};

const cashSymbols = new Set(["USD", "USDT", "USDC", "CASH"]);

export function AssetIcon({
  symbol,
  size = "sm",
  className,
}: {
  symbol: string;
  size?: keyof typeof sizeClass;
  className?: string;
}) {
  const normalized = symbol.trim().toUpperCase();
  const Mark = cashSymbols.has(normalized)
    ? CashMark
    : isSupportedSymbol(normalized)
      ? marks[normalized]
      : undefined;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 overflow-hidden rounded-full ring-1 ring-white/10",
        sizeClass[size],
        className
      )}
    >
      {Mark ? <Mark /> : <FallbackMark symbol={normalized || "?"} />}
    </span>
  );
}

export function AssetTicker({
  symbol,
  size = "sm",
  className,
}: {
  symbol: string;
  size?: keyof typeof sizeClass;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <AssetIcon symbol={symbol} size={size} />
      <span>{symbol}</span>
    </span>
  );
}

export function CashTicker({
  size = "sm",
  className,
}: {
  size?: keyof typeof sizeClass;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <AssetIcon symbol="USD" size={size} />
      <span>Cash</span>
    </span>
  );
}

export function TickerPhrase({
  text,
  size = "xs",
  className,
}: {
  text: string;
  size?: keyof typeof sizeClass;
  className?: string;
}) {
  const parts = text.trim().split(/\s+/);
  const last = parts.at(-1)?.toUpperCase();

  if (!last || !isSupportedSymbol(last)) {
    return <span className={className}>{text}</span>;
  }

  const prefix = parts.slice(0, -1).join(" ");

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {prefix ? <span>{prefix}</span> : null}
      <AssetTicker symbol={last} size={size} />
    </span>
  );
}
