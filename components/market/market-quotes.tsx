import type { CSSProperties } from "react";
import { formatUsd } from "@/lib/format";
import { SignedPercent } from "@/components/shared/signed-value";
import { AssetTicker } from "@/components/market/asset-icon";
import type { MarketTickerQuote } from "@/types/arena";

const TRACK_REPEATS = 4;

export function MarketQuotes({ quotes }: { quotes: MarketTickerQuote[] }) {
  if (quotes.length === 0) {
    return null;
  }

  const duration = `${Math.max(quotes.length * TRACK_REPEATS * 4, 40)}s`;

  return (
    <div
      className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)]"
      aria-label="Market ticker"
    >
      <div
        className="flex w-max animate-ticker hover:[animation-play-state:paused] motion-reduce:animate-none"
        style={{ "--ticker-duration": duration } as CSSProperties}
      >
        <QuoteTrack quotes={quotes} />
        <QuoteTrack quotes={quotes} ariaHidden />
      </div>
    </div>
  );
}

function QuoteTrack({
  quotes,
  ariaHidden,
}: {
  quotes: MarketTickerQuote[];
  ariaHidden?: boolean;
}) {
  return (
    <ul className="flex items-center" aria-hidden={ariaHidden || undefined}>
      {Array.from({ length: TRACK_REPEATS }, (_, repeat) =>
        quotes.map((quote) => (
          <li
            key={`${repeat}-${quote.symbol}`}
            className="flex shrink-0 items-center gap-2 px-5 text-sm tabular-nums"
          >
            <AssetTicker symbol={quote.symbol} size="sm" className="font-medium text-foreground" />
            <span className="text-muted-foreground">
              {quote.price == null ? "—" : formatUsd(quote.price)}
            </span>
            <SignedPercent value={quote.change24h} className="text-xs" />
          </li>
        ))
      )}
    </ul>
  );
}
