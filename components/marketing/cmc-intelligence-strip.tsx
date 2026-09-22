import Link from "next/link";
import type { BtcLiquidationSummary } from "@/lib/market/btc-liquidation-summary";
import { cn } from "@/lib/utils";

export function CmcIntelligenceStrip({
  liquidationSummary,
}: {
  liquidationSummary: BtcLiquidationSummary | null;
}) {
  const signal = liquidationSummary?.read.signal;
  const window = liquidationSummary?.read.basedOn ?? "4h";

  return (
    <Link
      href="/research"
      className="group flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
    >
      <div className="min-w-0 space-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
          CMC market intelligence
        </p>
        <p className="text-sm font-medium text-white/90">
          BTC liquidations · {window} · LIVE
          {signal ? (
            <span className={cn("ml-1 capitalize text-white/65")}>· {signal}</span>
          ) : null}
        </p>
      </div>
      <span className="shrink-0 text-sm font-medium text-white/55 transition-colors group-hover:text-white">
        View Research →
      </span>
    </Link>
  );
}
