import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { DataSourceNotice } from "@/components/shared/data-source-notice";
import { DataSourceBadge } from "@/components/shared/data-source-badge";
import { SideBadge } from "@/components/shared/side-badge";
import { SignedPercent } from "@/components/shared/signed-value";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetTicker } from "@/components/market/asset-icon";
import { formatNumber, formatUsd } from "@/lib/format";
import { getLiveOrSampleDecision } from "@/lib/arena/data";
import type { DecisionRecord } from "@/types/arena";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Decision",
};

export default async function DecisionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const decision = await getLiveOrSampleDecision(id);

  if (!decision) {
    notFound();
  }

  const live = decision.dataSource === "live";

  return (
    <div className="space-y-6">
      <Link
        href={`/agents/${decision.agentId}`}
        className="inline-flex text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to {decision.agentName}
      </Link>

      <PageHeader
        title={
          <span className="inline-flex items-center gap-2.5">
            {decision.action}
            <AssetTicker symbol={decision.symbol} size="lg" className="gap-2" />
          </span>
        }
        description={
          decision.notional > 0
            ? `${formatUsd(decision.notional)} · ${decision.confidence}% confidence`
            : `${decision.confidence}% confidence`
        }
        actions={
          <span className="inline-flex items-center gap-2">
            <DataSourceBadge source={decision.dataSource} />
            <StatusChip decision={decision} />
          </span>
        }
      />

      <dl className="grid gap-3 rounded-[20px] bg-[#101010] px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-[11px] tracking-[0.14em] text-white/40 uppercase">Agent</dt>
          <dd className="mt-1 text-sm font-medium">{decision.agentName}</dd>
        </div>
        <div>
          <dt className="text-[11px] tracking-[0.14em] text-white/40 uppercase">Strategy</dt>
          <dd className="mt-1 text-sm font-medium">{decision.strategyName ?? decision.agentName}</dd>
        </div>
        <div>
          <dt className="text-[11px] tracking-[0.14em] text-white/40 uppercase">Decision</dt>
          <dd className="mt-1 text-sm font-medium">
            {decision.action} {decision.symbol}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] tracking-[0.14em] text-white/40 uppercase">Skill</dt>
          <dd className="mt-1 text-sm font-medium">{decision.skillName ?? decision.strategyName ?? "—"}</dd>
        </div>
      </dl>

      <DataSourceNotice
        source={live ? "live" : "sample"}
        detail={live ? undefined : "This decision and its market snapshot are sample demo data."}
      />

      {decision.failureMessage ? (
        <p className="text-sm text-negative">{decision.failureMessage}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <SideBadge action={decision.action} />
        <span className="text-sm text-muted-foreground">{decision.agentName}</span>
        {decision.cycleId ? (
          <span className="text-xs tabular-nums text-tertiary">{decision.cycleId}</span>
        ) : null}
      </div>

      <Tabs defaultValue="overview" className="gap-4">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="market">Market Data</TabsTrigger>
          <TabsTrigger value="reasoning">Reasoning</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-medium tracking-[0.16em] text-tertiary uppercase">
                Trade summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-2">
                <SummaryRow label="Side" value={decision.action} />
                <SummaryRow label="Asset" value={<AssetTicker symbol={decision.symbol} />} />
                <SummaryRow label="Allocation" value={`${decision.allocationPercent}%`} />
                <SummaryRow label="Confidence" value={`${decision.confidence}%`} />
                <SummaryRow label="Time horizon" value={decision.timeHorizon} />
                <SummaryRow label="Status" value={decision.status} />
                <SummaryRow
                  label="Amount"
                  value={decision.notional > 0 ? formatUsd(decision.notional) : "—"}
                />
                <SummaryRow
                  label="Quantity"
                  value={
                    decision.quantity > 0 ? (
                      <span className="inline-flex items-center gap-1.5">
                        {formatNumber(decision.quantity, 4)}
                        <AssetTicker symbol={decision.symbol} size="xs" />
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
                <SummaryRow
                  label="Price"
                  value={decision.price > 0 ? formatUsd(decision.price) : "—"}
                />
                {decision.resultingEquity != null ? (
                  <SummaryRow label="Resulting equity" value={formatUsd(decision.resultingEquity)} />
                ) : null}
                {decision.resultingQuantity != null ? (
                  <SummaryRow
                    label="Resulting position"
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        {formatNumber(decision.resultingQuantity, 4)}
                        <AssetTicker symbol={decision.symbol} size="xs" />
                      </span>
                    }
                  />
                ) : null}
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="market">
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-medium tracking-[0.16em] text-tertiary uppercase">
                Market context
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-2">
                <SummaryRow
                  label="Price"
                  value={
                    <span className="inline-flex items-center gap-2">
                      {formatUsd(decision.market.price)}
                      <SignedPercent value={decision.market.change24h} />
                    </span>
                  }
                />
                <SummaryRow label="1h change" value={<SignedPercent value={decision.market.change1h} />} />
                <SummaryRow
                  label="24h change"
                  value={<SignedPercent value={decision.market.change24h} />}
                />
                <SummaryRow
                  label="7d change"
                  value={<SignedPercent value={decision.market.change7d} />}
                />
                <SummaryRow
                  label="Volume"
                  value={
                    decision.market.volume24h == null ? "—" : formatUsd(decision.market.volume24h, true)
                  }
                />
                <SummaryRow
                  label="Market cap"
                  value={
                    decision.market.marketCap == null ? "—" : formatUsd(decision.market.marketCap, true)
                  }
                />
                <SummaryRow label="RSI" value={decision.market.rsi ?? "—"} />
                <SummaryRow label="MACD" value={decision.market.macd ?? "—"} />
                <SummaryRow
                  label="EMA20 / EMA50"
                  value={
                    decision.market.emaBias ??
                    (decision.market.ema20 != null && decision.market.ema50 != null
                      ? `${decision.market.ema20} / ${decision.market.ema50}`
                      : "—")
                  }
                />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reasoning">
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-medium tracking-[0.16em] text-tertiary uppercase">
                Key reasons
              </CardTitle>
            </CardHeader>
            <CardContent>
              {decision.reasons.length === 0 ? (
                <p className="text-sm text-tertiary">No reasons were returned for this cycle.</p>
              ) : (
                <ol className="space-y-3">
                  {decision.reasons.map((reason, index) => (
                    <li key={reason} className="flex gap-3 text-sm">
                      <span className="w-6 shrink-0 tabular-nums text-tertiary">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="text-foreground">{reason}</span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk">
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-medium tracking-[0.16em] text-tertiary uppercase">
                Risk
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {decision.riskVerdict ? (
                <p className="text-sm font-medium text-foreground">{decision.riskVerdict}</p>
              ) : null}
              <p className="text-sm text-foreground">{decision.riskCheck}</p>
              <div>
                <p className="mb-2 text-xs font-medium tracking-[0.16em] text-tertiary uppercase">
                  Risk factors
                </p>
                {decision.riskFactors.length === 0 ? (
                  <p className="text-sm text-tertiary">No risk factors were returned.</p>
                ) : (
                  <ul className="space-y-2">
                    {decision.riskFactors.map((factor) => (
                      <li key={factor} className="text-sm text-warning">
                        ⚠ {factor}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                <SummaryRow
                  label="Requested allocation"
                  value={`${decision.requestedAllocationPercent ?? decision.allocationPercent}%`}
                />
                <SummaryRow
                  label="Allowed allocation"
                  value={
                    decision.allowedAllocationPercent != null
                      ? `${decision.allowedAllocationPercent}%`
                      : "—"
                  }
                />
                {decision.stopLossPercent != null ? (
                  <SummaryRow label="Stop loss" value={`${decision.stopLossPercent}%`} />
                ) : null}
                {decision.takeProfitPercent != null ? (
                  <SummaryRow label="Take profit" value={`${decision.takeProfitPercent}%`} />
                ) : null}
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources">
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-medium tracking-[0.16em] text-tertiary uppercase">
                Sources
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {live ? (
                <>
                  <p>Market snapshot from CoinMarketCap for this cycle.</p>
                  <p>Decision from Gemini. Permission from the deterministic Risk Engine. Fill from the Paper Engine.</p>
                </>
              ) : (
                <>
                  <p>Market snapshot preserved with this sample decision.</p>
                  <p>Live CoinMarketCap quotes are on Research. They are not this demo snapshot.</p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusChip({ decision }: { decision: DecisionRecord }) {
  const tone =
    decision.status === "Blocked" || decision.status === "Failed" || decision.status === "Rejected"
      ? "bg-negative-muted text-negative"
      : decision.status === "Constrained"
        ? "bg-warning/15 text-warning"
        : "bg-positive-muted text-positive";

  return (
    <span className={`inline-flex h-5 items-center rounded-full px-2 text-xs font-medium ${tone}`}>
      ● {decision.riskVerdict ?? decision.status}
    </span>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border-subtle py-2 last:border-b-0">
      <dt className="text-sm text-tertiary">{label}</dt>
      <dd className="text-sm tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
