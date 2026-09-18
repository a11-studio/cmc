import type { ReactNode } from "react";
import { ArenaBrand } from "@/components/layout/arena-brand";
import { IconRail } from "@/components/layout/icon-rail";
import { TopBar } from "@/components/layout/top-bar";
import type { MarketTickerQuote } from "@/types/arena";

export function AppShell({
  quotes,
  lastCycleCompletedAt,
  serverNow,
  autoRunCycle,
  tradingPaused,
  children,
}: {
  quotes: MarketTickerQuote[];
  lastCycleCompletedAt?: string | null;
  serverNow: string;
  autoRunCycle?: boolean;
  tradingPaused?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[#060606]">
      <div className="lg:grid lg:grid-cols-[104px_minmax(0,1fr)]">
        <div className="hidden lg:flex lg:flex-col">
          <div className="flex h-[72px] items-center justify-center">
            <ArenaBrand showWordmark={false} />
          </div>
          <IconRail />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            quotes={quotes}
            lastCycleCompletedAt={lastCycleCompletedAt}
            serverNow={serverNow}
            autoRunCycle={autoRunCycle}
            tradingPaused={tradingPaused}
          />
          <main className="min-w-0 flex-1 px-3 pb-3">{children}</main>
        </div>
      </div>
    </div>
  );
}
