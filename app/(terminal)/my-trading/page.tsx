import { notFound } from "next/navigation";
import { MyTradingView } from "@/components/human-trader/my-trading-view";
import { getArenaAgents } from "@/lib/arena/data";
import { isArenaHumanTraderEnabled } from "@/lib/human-trader/flags";
import { marketSnapshotFromQuotes } from "@/lib/human-trader/market-snapshot";
import { getShellMarket } from "@/lib/market/shell-market";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Trading",
};

export default async function MyTradingPage() {
  if (!isArenaHumanTraderEnabled()) {
    notFound();
  }

  const [agents, market] = await Promise.all([getArenaAgents(), getShellMarket()]);

  return (
    <MyTradingView
      agents={agents}
      initialSnapshot={marketSnapshotFromQuotes(market.quotes)}
      marketSource={market.source}
    />
  );
}
