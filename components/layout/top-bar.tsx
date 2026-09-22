import { ArenaBrand } from "@/components/layout/arena-brand";
import { MarketQuotes } from "@/components/market/market-quotes";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NextCycleTimer } from "@/components/layout/next-cycle-timer";
import type { MarketTickerQuote } from "@/types/arena";

export function TopBar({
  quotes,
  lastCompletedAt,
  serverNow,
  autoRunCycle,
  tradingPaused,
  cycleInProgress,
  showDebugControls,
  showHumanTrader,
}: {
  quotes: MarketTickerQuote[];
  lastCompletedAt?: string | null;
  serverNow: string;
  autoRunCycle?: boolean;
  tradingPaused?: boolean;
  cycleInProgress?: boolean;
  showDebugControls?: boolean;
  showHumanTrader?: boolean;
}) {
  return (
    <header className="flex h-[72px] shrink-0 items-center gap-4 bg-[#060606] pr-3 pl-3 lg:pl-0">
      <div className="flex items-center gap-3 lg:hidden">
        <MobileNav showDebugControls={showDebugControls} showHumanTrader={showHumanTrader} />
        <ArenaBrand showWordmark={false} />
      </div>
      <p className="hidden min-w-[148px] shrink-0 xl:block">
        <span className="block text-[11px] font-semibold tracking-[0.2em] text-foreground uppercase">
          Arena
        </span>
        <span className="mt-0.5 block text-[11px] text-white/40">Different minds. Same market.</span>
      </p>
      <div className="min-w-0 flex-1 overflow-hidden">
        <MarketQuotes quotes={quotes} />
      </div>
      <NextCycleTimer
        lastCompletedAt={lastCompletedAt}
        serverNow={serverNow}
        autoRun={autoRunCycle}
        paused={tradingPaused}
        cycleInProgress={cycleInProgress}
      />
    </header>
  );
}
