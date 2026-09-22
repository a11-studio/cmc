import { isManualCycleEnabled } from "@/lib/agent/view";
import { getArenaCycleControlStateForShell } from "@/lib/agent/cycle-control";
import { getShellMarket } from "@/lib/market/shell-market";

export const dynamic = "force-dynamic";

export async function GET() {
  const [market, cycle] = await Promise.all([getShellMarket(), getArenaCycleControlStateForShell()]);

  return Response.json({
    quotes: market.quotes,
    lastCompletedAt: cycle.lastCompletedAt,
    serverNow: new Date().toISOString(),
    autoRunCycle: isManualCycleEnabled() && cycle.autoRun,
    tradingPaused: cycle.paused,
    cycleInProgress: cycle.cycleInProgress,
  });
}
