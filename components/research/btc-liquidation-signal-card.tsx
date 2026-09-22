import { DashboardCard, DashboardCardSubtitle, DashboardCardTitle } from "@/components/arena/dashboard-card";
import { AssetTicker } from "@/components/market/asset-icon";
import { formatUsd } from "@/lib/format";
import {
  BTC_LIQUIDATION_MAGNET_OFFSET_USD,
  buildBtcLiquidationMagnetBands,
  type BtcLiquidationMagnetLevel,
} from "@/lib/market/btc-liquidation-magnets";
import type { BtcLiquidationSummary, LiquidationSignal } from "@/lib/market/btc-liquidation-summary";
import { cn } from "@/lib/utils";

const SIGNAL_STYLES: Record<LiquidationSignal, { label: string; className: string }> = {
  bullish: { label: "Bullish", className: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/25" },
  bearish: { label: "Bearish", className: "bg-rose-500/15 text-rose-300 ring-rose-400/25" },
  neutral: { label: "Neutral", className: "bg-white/8 text-white/70 ring-white/15" },
};

function MagnetRow({ label, magnet }: { label: string; magnet: BtcLiquidationMagnetLevel }) {
  const biasLabel = magnet.liquidationBias === "long" ? "long-liq magnet" : "short-liq magnet";

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        magnet.emphasized
          ? "border-white/20 bg-white/[0.06] ring-1 ring-inset ring-white/10"
          : "border-white/8 bg-white/[0.03]"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-white/40">{label}</p>
        {magnet.emphasized ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-white/55">Stronger pull</span>
        ) : null}
      </div>
      <p className="mt-1 text-[17px] font-semibold tabular-nums text-white">{formatUsd(magnet.price)}</p>
      <p className="mt-1 text-[12px] text-white/50">
        {formatUsd(magnet.offsetUsd, true)} {magnet.side === "below" ? "below" : "above"} spot · {biasLabel}
      </p>
    </div>
  );
}

export function BtcLiquidationSignalCard({
  summary,
  spotPrice,
}: {
  summary: BtcLiquidationSummary | null;
  spotPrice?: number;
}) {
  const signal = summary?.read.signal;
  const tone = signal ? SIGNAL_STYLES[signal] : null;
  const magnets =
    spotPrice != null && signal != null ? buildBtcLiquidationMagnetBands(spotPrice, signal) : null;

  return (
    <DashboardCard className="md:col-span-2 xl:col-span-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <DashboardCardTitle className="flex items-center gap-2">
            <AssetTicker symbol="BTC" size="md" className="gap-2" />
            Liquidation signal
          </DashboardCardTitle>
          <DashboardCardSubtitle>
            Long vs short liquidations and {formatUsd(BTC_LIQUIDATION_MAGNET_OFFSET_USD, true)} magnet bands around spot.
          </DashboardCardSubtitle>
        </div>
      </div>

      {!summary || !tone ? (
        <p className="mt-8 text-sm text-white/40">Liquidation signal is unavailable right now.</p>
      ) : (
        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={cn(
                "inline-flex rounded-full px-4 py-1.5 text-[15px] font-semibold tracking-wide ring-1 ring-inset",
                tone.className
              )}
            >
              {tone.label}
            </span>
            <p className="text-sm text-white/55">{summary.read.reason}</p>
          </div>

          {magnets ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <MagnetRow label="Magnet below" magnet={magnets.below} />
              <MagnetRow label="Magnet above" magnet={magnets.above} />
            </div>
          ) : null}

          <ul className="divide-y divide-white/8 rounded-2xl border border-white/8">
            {summary.windows.map((window) => (
              <li key={window.label} className="grid gap-3 px-4 py-3 sm:grid-cols-[3.5rem_1fr_auto] sm:items-center">
                <p className="text-[12px] font-medium uppercase tracking-wide text-white/45">{window.label}</p>
                <div className="flex h-2 overflow-hidden rounded-full bg-white/8">
                  <span className="bg-[#F87171]" style={{ width: `${window.longSharePercent}%` }} />
                  <span className="bg-[#8ADF7B]" style={{ width: `${window.shortSharePercent}%` }} />
                </div>
                <p className="text-right text-[12px] tabular-nums text-white/50">{formatUsd(window.totalUsd, true)}</p>
              </li>
            ))}
          </ul>

          <p className="text-[11px] text-white/35">
            Red = long liqs · Green = short liqs · Signal uses {summary.read.basedOn} window
            {summary.updatedAt ? ` · ${summary.updatedAt}` : ""}
          </p>
        </div>
      )}
    </DashboardCard>
  );
}
