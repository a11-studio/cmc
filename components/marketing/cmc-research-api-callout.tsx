export function CmcResearchApiCallout() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
        Powered by CoinMarketCap
      </p>
      <p className="mt-1 text-base font-semibold text-white">BTC liquidation signal</p>
      <p className="mt-2 font-mono text-[11px] leading-relaxed text-white/50">
        GET /v5/derivatives/liquidations/cryptocurrency/list/latest
      </p>
      <p className="mt-2 text-sm text-white/55">
        Feeds Research and the deterministic liquidation signal agent — independent of the six Gemini
        strategies on the same hourly snapshot.
      </p>
    </div>
  );
}
