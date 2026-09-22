import { isArenaHumanTraderEnabled } from "@/lib/human-trader/flags";
import { marketSnapshotFromQuotes } from "@/lib/human-trader/market-snapshot";
import { getShellMarket } from "@/lib/market/shell-market";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isArenaHumanTraderEnabled()) {
    return Response.json({ error: "Human trader is disabled" }, { status: 404 });
  }

  const market = await getShellMarket();

  return Response.json({
    snapshot: marketSnapshotFromQuotes(market.quotes),
    source: market.source,
  });
}
