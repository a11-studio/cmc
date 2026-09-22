import Link from "next/link";

/**
 * Marketing link to Research — no CoinMarketCap fetch on the homepage (see Research for live signal).
 */
export function CmcIntelligenceStrip() {
  return (
    <Link
      href="/research"
      className="group flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
    >
      <div className="min-w-0 space-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
          CMC market intelligence
        </p>
        <p className="text-sm font-medium text-white/90">BTC liquidations · 4h · LIVE</p>
      </div>
      <span className="shrink-0 text-sm font-medium text-white/55 transition-colors group-hover:text-white">
        View Research →
      </span>
    </Link>
  );
}
