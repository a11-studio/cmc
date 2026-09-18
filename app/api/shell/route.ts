import { isManualCycleEnabled } from "@/lib/agent/view";
import { getArenaCycleControl } from "@/lib/arena/data";
import { getShellMarket } from "@/lib/market/shell-market";

export const dynamic = "force-dynamic";

export async function GET() {
  const [market, cycle] = await Promise.all([getShellMarket(), getArenaCycleControl()]);

  return Response.json({
    quotes: market.quotes,
    lastCompletedAt: cycle.lastCompletedAt,
    serverNow: new Date().toISOString(),
    autoRunCycle: isManualCycleEnabled() && cycle.autoRun,
    tradingPaused: cycle.paused,
  });
}
