import Link from "next/link";
import { notFound } from "next/navigation";
import { DisabledAction } from "@/components/shared/disabled-action";
import { DataSourceNotice } from "@/components/shared/data-source-notice";
import { DataSourceBadge } from "@/components/shared/data-source-badge";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { AgentStorySections, AgentStatusWidgets } from "@/components/agents/agent-story";
import { TradeHeatmap } from "@/components/agents/trade-heatmap";
import { PauseTradingButton } from "@/components/agents/pause-trading-button";
import { RunCycleButton } from "@/components/agents/run-cycle-button";
import { StatusBadge } from "@/components/agents/status-badge";
import { Metric } from "@/components/shared/metric";
import { SignedPercent, SignedUsd } from "@/components/shared/signed-value";
import { SideBadge } from "@/components/shared/side-badge";
import { EquitySparkline } from "@/components/charts/equity-sparkline";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AssetTicker, CashTicker } from "@/components/market/asset-icon";
import { formatNumber, formatUsd } from "@/lib/format";
import { PersistenceNotice } from "@/components/shared/persistence-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { isArenaDebugControlsEnabled, isManualCycleEnabled } from "@/lib/agent/view";
import { findAgentDefinition } from "@/lib/agents/registry";
import { getArenaAgents, getArenaPersistenceMode, getLiveOrSampleBook } from "@/lib/arena/data";
import type { ArenaAgentDefinition } from "@/lib/agents/types";
import type { ActivityEvent, DecisionRecord, PositionRow, TradeRow } from "@/types/arena";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Agent",
};

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const definition = findAgentDefinition(id);

  if (!definition) {
    notFound();
  }

  if (definition.status !== "LIVE") {
    return <ReadyAgentProfile definition={definition} />;
  }

  const [agentList, book] = await Promise.all([getArenaAgents(), getLiveOrSampleBook(id)]);
  const agent = agentList.find((item) => item.id === id);

  if (!agent || !book) {
    notFound();
  }

  const live = agent.dataSource === "live";
  const events: ActivityEvent[] = book.events;
  const positions: PositionRow[] = book.positions;
  const trades: TradeRow[] = book.trades;
  const decisions: DecisionRecord[] = book.decisions;
  const cash = book.cash;
  const cashPercent = book.cashAllocationPercent;
  const equitySeries = book.equitySeries;
  const realizedPnl = "realizedPnl" in book ? book.realizedPnl : undefined;
  const latestMessage =
    live && "latestCycle" in book && book.latestCycle?.failure
      ? book.latestCycle.failure.message
      : live && "latestCycle" in book && book.latestCycle?.status === "BLOCKED"
        ? book.latestCycle.riskReason
        : null;

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to Arena
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <AgentAvatar mark={agent.mark} name={agent.name} size="lg" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {agent.name}
            </h1>
            <p className="mt-1 text-sm text-white/45">{agent.strategy}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">{agent.description}</span>
              <StatusBadge status={agent.status} />
              <DataSourceBadge source={agent.dataSource} />
            </div>
          </div>
        </div>
        {live ? (
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center justify-end gap-2">
              {isArenaDebugControlsEnabled() ? (
                <PauseTradingButton status={agent.status} agentId={agent.id} compact />
              ) : null}
              {isManualCycleEnabled() ? <RunCycleButton compact agentId={agent.id} /> : null}
            </div>
            {isManualCycleEnabled() ? (
              <p className="text-xs text-faint">Dev trigger · same path as the hourly cycle</p>
            ) : null}
          </div>
        ) : (
          <DisabledAction
            label="Pause"
            variant="secondary"
            reason="This agent is not autonomous yet."
          />
        )}
      </div>

      <DataSourceNotice
        source={live ? "live" : "sample"}
        detail={live ? undefined : "This agent is not autonomous yet."}
      />
      {live ? <PersistenceNotice mode={getArenaPersistenceMode()} /> : null}

      {latestMessage ? (
        <p className="text-sm text-warning">{latestMessage}</p>
      ) : null}

      <Card className="px-6 py-5">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Equity" value={formatUsd(agent.equity)} />
          <Metric label="Return" value={<SignedPercent value={agent.returnPercent} />} />
          <Metric
            label="Drawdown"
            value={<span className="text-negative">-{agent.drawdownPercent.toFixed(1)}%</span>}
          />
          <Metric label="Win Rate" value={`${agent.winRatePercent.toFixed(1)}%`} />
          <Metric label="Trades" value={agent.trades} />
        </div>
      </Card>

      <TradeHeatmap checks={book.tradeChecks} />

      <Card>
        <CardHeader className="border-b border-border-subtle">
          <CardTitle className="text-xs font-medium tracking-[0.16em] text-tertiary uppercase">
            Equity curve
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {equitySeries.length > 1 ? (
            <EquitySparkline points={equitySeries} />
          ) : (
            <p className="py-10 text-sm text-tertiary">
              Equity history will appear once this agent has completed cycles.
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="gap-4">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="trades">Trades</TabsTrigger>
          <TabsTrigger value="decisions">Decisions</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <AgentStorySections agentId={agent.id} />
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-xs font-medium tracking-[0.16em] text-tertiary uppercase">
                  Allocation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <CashTicker size="sm" className="text-muted-foreground" />
                  <span className="tabular-nums">
                    {formatUsd(cash)}
                    {cashPercent != null ? ` · ${cashPercent.toFixed(1)}%` : ""}
                  </span>
                </div>
                {positions.map((position) => (
                  <div key={position.symbol} className="flex items-center justify-between text-sm">
                    <AssetTicker symbol={position.symbol} size="sm" className="text-muted-foreground" />
                    <span className="tabular-nums">
                      {formatUsd(position.marketValue)} · {position.allocationPercent.toFixed(1)}%
                    </span>
                  </div>
                ))}
                {positions.length === 0 ? (
                  <p className="text-sm text-tertiary">No open positions.</p>
                ) : null}
                {realizedPnl != null ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Realized P&L</span>
                    <SignedUsd value={realizedPnl} />
                  </div>
                ) : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-xs font-medium tracking-[0.16em] text-tertiary uppercase">
                  Latest activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {events.length > 0 ? (
                  <ActivityTimeline events={events.slice(-4)} />
                ) : (
                  <p className="text-sm text-tertiary">No activity recorded yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="positions">
          <PositionTable positions={positions} />
        </TabsContent>

        <TabsContent value="trades">
          <TradeTable trades={trades} />
        </TabsContent>

        <TabsContent value="decisions" className="space-y-2">
          {decisions.length === 0 ? (
            <EmptyState
              title="No decisions recorded yet."
              description="The next cycle writes a TradeDecision here after Gemini returns a valid schema."
            />
          ) : (
            decisions.map((decision) => (
              <Link
                key={decision.id}
                href={`/decisions/${encodeURIComponent(decision.id)}`}
                className="flex items-center justify-between rounded-lg border border-border bg-surface-1 px-4 py-3 transition-colors hover:bg-surface-hover"
              >
                <span className="flex items-center gap-3">
                  <SideBadge action={decision.action} />
                  <AssetTicker symbol={decision.symbol} className="text-sm text-foreground" />
                </span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {decision.notional > 0 ? `${formatUsd(decision.notional)} · ` : ""}
                  {decision.confidence}% confidence
                </span>
              </Link>
            ))
          )}
        </TabsContent>

        <TabsContent value="activity">
          {events.length > 0 ? (
            <Card className="px-5">
              <ActivityTimeline events={events} />
            </Card>
          ) : (
            <EmptyState
              title="No activity recorded yet."
              description="Timeline events appear after this agent completes a cycle."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PositionTable({
  positions,
}: {
  positions: PositionRow[];
}) {
  if (positions.length === 0) {
    return (
      <EmptyState
        title="No open positions."
        description="This book is all cash until a BUY or SHORT is approved and filled."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-1">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Asset</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead className="text-right">Avg entry</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead className="text-right">Unrealized P&L</TableHead>
            <TableHead className="text-right">Allocation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((position) => (
            <TableRow key={position.symbol}>
              <TableCell className="font-medium">
                <AssetTicker symbol={position.symbol} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(position.quantity, 4)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatUsd(position.averageEntryPrice)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatUsd(position.currentPrice)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatUsd(position.marketValue)}
              </TableCell>
              <TableCell className="text-right">
                <SignedUsd value={position.unrealizedPnl} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {position.allocationPercent.toFixed(1)}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TradeTable({ trades }: { trades: TradeRow[] }) {
  if (trades.length === 0) {
    return (
      <EmptyState
        title="No trades recorded yet."
        description="Fills show up after Risk approves a decision and the Paper Engine executes it."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-1">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Side</TableHead>
            <TableHead>Asset</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead>Decision</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((trade) => (
            <TableRow key={trade.id}>
              <TableCell>
                <SideBadge action={trade.side} />
              </TableCell>
              <TableCell>
                <AssetTicker symbol={trade.symbol} />
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatUsd(trade.notional)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(trade.quantity, 4)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatUsd(trade.price)}</TableCell>
              <TableCell>
                {trade.decisionId ? (
                  <Link
                    href={`/decisions/${encodeURIComponent(trade.decisionId)}`}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    View
                  </Link>
                ) : (
                  <span className="text-faint">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ReadyAgentProfile({ definition }: { definition: ArenaAgentDefinition }) {
  return (
    <div className="space-y-8">
      <Link
        href="/"
        className="inline-flex text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to Arena
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <AgentAvatar mark={definition.mark} name={definition.displayName} size="lg" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{definition.displayName}</h1>
            <p className="mt-1 text-sm text-white/45">{definition.strategyName}</p>
            <p className="mt-3 max-w-2xl text-sm text-white/55">{definition.description}</p>
          </div>
        </div>
        <AgentStatusWidgets status={definition.status} riskProfile={definition.riskProfile} />
      </div>

      <AgentStorySections agentId={definition.id} />

      <TradeHeatmap
        checks={[]}
        emptyLabel="No autonomous trades yet. Squares stay empty until this agent starts cycling."
      />

      <p className="text-xs text-white/35">
        Inspired by a public track record, not a live Arena book. This agent can be evaluated manually. It has no
        autonomous cycles yet and no simulated performance.
      </p>
    </div>
  );
}
