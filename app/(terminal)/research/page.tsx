import type { ReactNode } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignedPercent } from "@/components/shared/signed-value";
import { AssetTicker } from "@/components/market/asset-icon";
import { formatUsd } from "@/lib/format";
import { createMarketDataProvider } from "@/lib/market/provider";
import { ASSET_CATALOG, SUPPORTED_SYMBOLS } from "@/lib/market/symbols";
import { isMarketDataError } from "@/lib/market/errors";
import type { AssetSnapshot, MarketSnapshot } from "@/lib/market/types";
import type { SupportedSymbol } from "@/lib/market/types";
import { lookupPriorMarketMetric, lookupPriorQuote, rememberSnapshot, type PriorMarketMetric, type PriorQuote } from "@/lib/market/quote-history";
import { getMomentumAlphaStore } from "@/lib/agent/runtime";
import { BtcLiquidationSignalCard } from "@/components/research/btc-liquidation-signal-card";
import { ResearchMarketCards } from "@/components/research/research-metrics";
import { hasServerEnv } from "@/lib/env.server";
import { fetchBtcLiquidationSummary, type BtcLiquidationSummary } from "@/lib/market/btc-liquidation-summary";
import { pageMetadataFromKey } from "@/lib/site-metadata";

export const metadata = pageMetadataFromKey("research");

export const revalidate = 60;

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ asset?: string | string[] }>;
}) {
  const params = await searchParams;
  const selected =
    typeof params.asset === "string" ? params.asset.toUpperCase() : undefined;

  let snapshot: MarketSnapshot | null = null;
  let errorMessage: string | null = null;

  try {
    snapshot = await createMarketDataProvider().getMarketSnapshot([...SUPPORTED_SYMBOLS]);
  } catch (error) {
    errorMessage = isMarketDataError(error)
      ? error.message
      : "Market data is unavailable.";
  }

  if (snapshot) {
    try {
      const store = await getMomentumAlphaStore();

      for (const cycle of store.listCycles()) {
        rememberSnapshot(cycle.snapshot, cycle.startedAt);
      }
    } catch {
      // Cycle history is optional context for the hourly prior.
    }
  }

  if (!snapshot || errorMessage) {
    return (
      <div className="space-y-6">
        <PageHeader
          kicker="Research"
          title="Quotes"
          description="Live market data from CoinMarketCap."
        />
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-negative">{errorMessage ?? "Market data is unavailable."}</p>
            <p className="mt-2 text-xs text-faint">
              Sample prices are not substituted when CoinMarketCap is unavailable.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const observedAt = new Date().toISOString();
  const btc = snapshot.assets.find((asset) => asset.symbol === "BTC");
  let liquidationSummary: BtcLiquidationSummary | null = null;

  if (btc && hasServerEnv("CMC_API_KEY")) {
    liquidationSummary = await fetchBtcLiquidationSummary({
      apiKey: process.env.CMC_API_KEY ?? "",
    });
  }

  return (
    <ResearchView
      snapshot={snapshot}
      liquidationSummary={liquidationSummary}
      spotPrice={btc?.price}
      selected={selected}
      priors={Object.fromEntries(
        snapshot.assets.map((asset) => [
          asset.symbol,
          lookupPriorQuote(asset.symbol, asset.price, observedAt),
        ])
      )}
      marketPriors={{
        openInterest: lookupPriorMarketMetric("openInterest", snapshot.market.openInterest, observedAt),
        derivativesVolume: lookupPriorMarketMetric(
          "derivativesVolume24h",
          snapshot.market.derivativesVolume24h,
          observedAt
        ),
      }}
    />
  );
}

function ResearchView({
  snapshot,
  liquidationSummary,
  spotPrice,
  selected,
  priors,
  marketPriors,
}: {
  snapshot: MarketSnapshot;
  liquidationSummary: BtcLiquidationSummary | null;
  spotPrice?: number;
  selected?: string;
  priors: Record<string, PriorQuote | undefined>;
  marketPriors: {
    openInterest?: PriorMarketMetric;
    derivativesVolume?: PriorMarketMetric;
  };
}) {
  const hasMarket =
    snapshot.market.totalMarketCap != null ||
    snapshot.market.totalVolume24h != null ||
    snapshot.market.btcDominance != null;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Research"
        title="Quotes"
        description="Live CoinMarketCap quotes. 1h uses the last stored snapshot around one hour ago — not the native CMC 1h field."
      />

      <ResearchMarketCards market={snapshot.market} priors={marketPriors} />

      <BtcLiquidationSignalCard summary={liquidationSummary} spotPrice={spotPrice} />

      {hasMarket ? (
        <Card className="px-6 py-5">
          <div className="grid gap-6 sm:grid-cols-3">
            <Metric
              label="Total market cap"
              value={formatOptionalUsd(snapshot.market.totalMarketCap, true)}
              change={snapshot.market.marketCapChange24h}
            />
            <Metric
              label="24h volume"
              value={formatOptionalUsd(snapshot.market.totalVolume24h, true)}
              change={snapshot.market.volumeChange24h}
            />
            <Metric
              label="BTC dominance"
              value={
                snapshot.market.btcDominance == null
                  ? "—"
                  : `${snapshot.market.btcDominance.toFixed(1)}%`
              }
              change={snapshot.market.btcDominanceChange24h}
            />
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {snapshot.assets.map((asset) => (
          <AssetCard
            key={asset.symbol}
            asset={asset}
            highlighted={selected === asset.symbol}
            prior={priors[asset.symbol]}
          />
        ))}
      </div>

      <p className="text-xs text-faint">
        Snapshot {snapshot.timestamp} · cycle {snapshot.cycleId}
      </p>
    </div>
  );
}

function AssetCard({
  asset,
  highlighted,
  prior,
}: {
  asset: AssetSnapshot;
  highlighted: boolean;
  prior?: PriorQuote;
}) {
  const symbol = asset.symbol as SupportedSymbol;
  const name = ASSET_CATALOG[symbol]?.name ?? asset.symbol;

  return (
    <Card id={asset.symbol.toLowerCase()} className={highlighted ? "border-border-strong" : undefined}>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-lg font-semibold">
            <AssetTicker symbol={asset.symbol} size="lg" className="gap-2" />
          </CardTitle>
          <p className="text-xs text-tertiary">{name}</p>
        </div>
        <SignedPercent value={asset.change24h} />
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-2xl font-semibold tabular-nums">{formatUsd(asset.price)}</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Row
            label={prior ? `${prior.ageMinutes}m` : "Arena 1h"}
            value={prior ? <SignedPercent value={prior.changePercent} /> : <span className="text-faint">pending</span>}
          />
          <Row label="1h" value={<SignedPercent value={asset.change1h} />} />
          <Row label="24h" value={<SignedPercent value={asset.change24h} />} />
          <Row label="7d" value={<SignedPercent value={asset.change7d} />} />
          <Row label="Volume" value={formatOptionalUsd(asset.volume24h, true)} />
          <Row label="Market cap" value={formatOptionalUsd(asset.marketCap, true)} />
          <Row label="RSI" value={formatOptionalNumber(asset.rsi)} />
          <Row label="MACD" value={asset.macd ?? "—"} />
          <Row label="EMA20" value={formatOptionalNumber(asset.ema20)} />
        </dl>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  change,
}: {
  label: string;
  value: ReactNode;
  change?: number;
}) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-tertiary uppercase">{label}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
        <p className="text-sm">
          <SignedPercent value={change} className="text-sm" />
          <span className="ml-1.5 text-white/40">24h</span>
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <dt className="text-tertiary">{label}</dt>
      <dd className="text-right tabular-nums text-foreground">{value}</dd>
    </>
  );
}

function formatOptionalUsd(value: number | undefined, compact = false): string {
  return value == null ? "—" : formatUsd(value, compact);
}

function formatOptionalNumber(value: number | undefined): string {
  return value == null ? "—" : String(value);
}
