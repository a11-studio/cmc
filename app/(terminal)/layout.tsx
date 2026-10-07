import type { ReactNode } from "react";
import { getArenaCycleControlStateForShell } from "@/lib/agent/cycle-control";
import { isArenaDebugControlsEnabled, isManualCycleEnabled } from "@/lib/agent/view";
import { AppShell } from "@/components/layout/app-shell";
import { isArenaHumanTraderEnabled } from "@/lib/human-trader/flags";
import { getShellMarket } from "@/lib/market/shell-market";

export default async function TerminalLayout({ children }: { children: ReactNode }) {
  const [market, cycle] = await Promise.all([getShellMarket(), getArenaCycleControlStateForShell()]);

  return (
    <AppShell
      initialShell={{
        quotes: market.quotes,
        lastCompletedAt: cycle.lastCompletedAt,
        serverNow: new Date().toISOString(),
        autoRunCycle: isManualCycleEnabled() && cycle.autoRun,
        tradingPaused: cycle.paused,
        cycleInProgress: cycle.cycleInProgress,
      }}
      showDebugControls={isArenaDebugControlsEnabled()}
      showHumanTrader={isArenaHumanTraderEnabled()}
    >
      {children}
    </AppShell>
  );
}
