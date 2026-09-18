import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { LiveRefresh } from "@/components/arena/live-refresh";
import { isManualCycleEnabled } from "@/lib/agent/view";
import { getLastCycleCompletedAt, getLiveTradingStatus } from "@/lib/arena/data";
import { getShellMarket } from "@/lib/market/shell-market";

export const dynamic = "force-dynamic";

export default async function TerminalLayout({ children }: { children: ReactNode }) {
  const [market, lastCycleCompletedAt, tradingStatus] = await Promise.all([
    getShellMarket(),
    getLastCycleCompletedAt(),
    getLiveTradingStatus(),
  ]);

  return (
    <AppShell
      quotes={market.quotes}
      lastCycleCompletedAt={lastCycleCompletedAt}
      serverNow={new Date().toISOString()}
      autoRunCycle={isManualCycleEnabled() && tradingStatus === "ACTIVE"}
      tradingPaused={tradingStatus === "PAUSED"}
    >
      {children}
      <LiveRefresh />
    </AppShell>
  );
}
