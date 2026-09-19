import { CompositionBar } from "@/components/arena/composition-bar";
import { DashboardCard, DashboardCardSubtitle, DashboardCardTitle } from "@/components/arena/dashboard-card";
import { ConfidenceGauge } from "@/components/charts/confidence-gauge";
import { SignedPercent } from "@/components/shared/signed-value";
import { formatUsd } from "@/lib/format";
import { rankShares, type RankedShare } from "@/lib/market/shares";
import type { PriorMarketMetric } from "@/lib/market/quote-history";
import type { MarketSnapshot } from "@/lib/market/types";

function MetricHero({
  value,
  prior,
}: {
  value?: number;
  prior?: PriorMarketMetric;
}) {
  return (
    <div className="mt-8 flex items-end justify-between gap-3">
      <p className="text-[32px] leading-none font-medium tabular-nums">
        {value == null ? "—" : formatUsd(value, true)}
      </p>
      {value == null ? null : prior ? (
        <p className="text-[13px] text-white/45">
          <SignedPercent value={prior.changePercent} className="text-[13px]" />
          <span className="ml-1.5">{prior.ageMinutes}m</span>
        </p>
      ) : (
        <p className="text-[13px] text-white/35">1h pending</p>
      )}
    </div>
  );
}

function liquidationShares(longs?: number, shorts?: number): RankedShare[] {
  const total = (longs ?? 0) + (shorts ?? 0);

  if (!(total > 0)) {
    return [];
  }

  return [
    {
      id: "long",
      label: "Long liqs",
      value: longs ?? 0,
      percent: ((longs ?? 0) / total) * 100,
      color: "#F87171",
    },
    {
      id: "short",
      label: "Short liqs",
      value: shorts ?? 0,
      percent: ((shorts ?? 0) / total) * 100,
      color: "#8ADF7B",
    },
  ].filter((slice) => slice.value > 0);
}

function FearGreedCard({ value, label }: { value?: number; label?: string }) {
  return (
    <DashboardCard>
      <DashboardCardTitle>Fear & Greed</DashboardCardTitle>
      <DashboardCardSubtitle>CMC Crypto Fear and Greed Index</DashboardCardSubtitle>

      {value == null ? (
        <p className="mt-10 text-sm text-white/40">Fear and Greed is not in this CoinMarketCap snapshot.</p>
      ) : (
        <div className="mx-auto mt-6 w-full max-w-[240px] flex-1">
          <ConfidenceGauge value={value} label="index" className="mx-auto max-w-[240px]" />
          {label ? <p className="mt-1 text-center text-[13px] font-medium text-white/55">{label}</p> : null}
        </div>
      )}
    </DashboardCard>
  );
}

function OpenInterestCard({
  value,
  venueCount,
  venues,
  prior,
}: {
  value?: number;
  venueCount?: number;
  venues?: MarketSnapshot["market"]["openInterestVenues"];
  prior?: PriorMarketMetric;
}) {
  const slices = rankShares(venues ?? []);

  return (
    <DashboardCard>
      <DashboardCardTitle>Open interest</DashboardCardTitle>
      <DashboardCardSubtitle>Share of OI across derivatives venues</DashboardCardSubtitle>
      <MetricHero value={value} prior={prior} />
      <CompositionBar slices={slices} />
      <p className="mt-auto pt-8 text-[12px] text-white/40">
        {venueCount != null ? `${venueCount} CMC derivatives venues` : "Venue count unavailable"}
      </p>
    </DashboardCard>
  );
}

function DerivativesCard({
  volume,
  venueCount,
  venues,
  longLiquidations,
  shortLiquidations,
  liquidations,
  prior,
}: {
  volume?: number;
  venueCount?: number;
  venues?: MarketSnapshot["market"]["derivativesVolumeVenues"];
  longLiquidations?: number;
  shortLiquidations?: number;
  liquidations?: number;
  prior?: PriorMarketMetric;
}) {
  const liquidationSlices = liquidationShares(longLiquidations, shortLiquidations);
  const slices = liquidationSlices.length > 0 ? liquidationSlices : rankShares(venues ?? []);

  return (
    <DashboardCard>
      <DashboardCardTitle>Derivatives</DashboardCardTitle>
      <DashboardCardSubtitle>
        {liquidationSlices.length > 0 ? "24h volume and long vs short liquidations" : "24h futures and perpetual volume"}
      </DashboardCardSubtitle>
      <MetricHero value={volume} prior={prior} />
      <CompositionBar slices={slices} />
      <p className="mt-auto pt-8 text-[12px] text-white/40">
        {liquidations != null
          ? `${formatUsd(liquidations, true)} liquidated 24h`
          : venueCount != null
            ? `${venueCount} venues reporting volume`
            : "Derivatives volume unavailable"}
      </p>
    </DashboardCard>
  );
}

export function ResearchMarketCards({
  market,
  priors,
}: {
  market: MarketSnapshot["market"];
  priors?: {
    openInterest?: PriorMarketMetric;
    derivativesVolume?: PriorMarketMetric;
  };
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      <FearGreedCard value={market.fearGreed} label={market.fearGreedLabel} />
      <OpenInterestCard
        value={market.openInterest}
        venueCount={market.derivativesVenueCount}
        venues={market.openInterestVenues}
        prior={priors?.openInterest}
      />
      <DerivativesCard
        volume={market.derivativesVolume24h}
        venueCount={market.derivativesVenueCount}
        venues={market.derivativesVolumeVenues}
        longLiquidations={market.longLiquidations24h}
        shortLiquidations={market.shortLiquidations24h}
        liquidations={market.liquidations24h}
        prior={priors?.derivativesVolume}
      />
    </div>
  );
}
