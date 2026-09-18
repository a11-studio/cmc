import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { LiveRefresh } from "@/components/arena/live-refresh";
import { isManualCycleEnabled } from "@/lib/agent/view";
import { getArenaCycleControl } from "@/lib/arena/data";
import { getShellMarket } from "@/lib/market/shell-market";

export const dynamic = "force-dynamic";

export default async function TerminalLayout({ children }: { children: ReactNode }) {
  const [market, cycle] = await Promise.all([getShellMarket(), getArenaCycleControl()]);

  return (
    <AppShell
      quotes={market.quotes}
      lastCycleCompletedAt={cycle.lastCompletedAt}
      serverNow={new Date().toISOString()}
      autoRunCycle={isManualCycleEnabled() && cycle.autoRun}
      tradingPaused={cycle.paused}
    >
      {children}
      <LiveRefresh />
    </AppShell>
  );
}
