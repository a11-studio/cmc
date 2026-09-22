"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { DashboardCard, DashboardCardSubtitle, DashboardCardTitle } from "@/components/arena/dashboard-card";
import { EquitySparkline } from "@/components/charts/equity-sparkline";
import { SignedPercent, SignedUsd } from "@/components/shared/signed-value";
import { AssetTicker, CashTicker } from "@/components/market/asset-icon";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import {
  clearHumanTraderStateInBrowser,
  loadHumanTraderStateFromBrowser,
  saveHumanTraderStateToBrowser,
} from "@/lib/human-trader/client-storage";
import { buildHumanVsAiLeaderboard, humanRankInLeaderboard } from "@/lib/human-trader/leaderboard";
import { accountAfterTrade, resetHumanTraderState } from "@/lib/human-trader/storage";
import {
  estimateHumanTradeQuantity,
  executeHumanNotionalTrade,
  maxHumanTradeNotional,
  type HumanNotionalTradeInput,
} from "@/lib/human-trader/trade";
import { markToMarket } from "@/lib/paper/portfolio";
import type { MarketSnapshot } from "@/lib/market/types";
import { SUPPORTED_SYMBOLS } from "@/lib/market/symbols";
import type { SupportedSymbol } from "@/lib/market/types";
import { formatPercent, formatUsd } from "@/lib/format";
import type { HumanTraderPersistedState } from "@/lib/human-trader/types";
import type { LeaderboardAgent, MarketSource } from "@/types/arena";
import { cn } from "@/lib/utils";

type TradeDraft = {
  symbol: SupportedSymbol;
  action: "BUY" | "SELL" | "SHORT";
  dollarAmount: string;
};

export function MyTradingView({
  agents,
  initialSnapshot,
  marketSource,
}: {
  agents: LeaderboardAgent[];
  initialSnapshot: MarketSnapshot;
  marketSource: MarketSource;
}) {
  const [state, setState] = useState<HumanTraderPersistedState | null>(null);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [tradeDraft, setTradeDraft] = useState<TradeDraft | null>(null);
  const [tradeError, setTradeError] = useState<string | null>(null);

  useEffect(() => {
    setState(loadHumanTraderStateFromBrowser());
  }, []);

  const refreshSnapshot = useCallback(async () => {
    const response = await fetch("/api/human-trader/snapshot", { cache: "no-store" });

    if (!response.ok) {
      return;
    }

    const body = (await response.json()) as { snapshot: MarketSnapshot };
    setSnapshot(body.snapshot);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshSnapshot();
    }, 30_000);

    return () => window.clearInterval(id);
  }, [refreshSnapshot]);

  const valuation = useMemo(() => {
    if (!state) {
      return null;
    }

    try {
      return markToMarket(state.account, snapshot);
    } catch {
      return null;
    }
  }, [state, snapshot]);

  const leaderboard = useMemo(() => {
    if (!valuation) {
      return [];
    }

    return buildHumanVsAiLeaderboard(agents, {
      equity: valuation.portfolio.equity,
      returnPercent: valuation.portfolio.returnPercent,
    });
  }, [agents, valuation]);

  const rank = humanRankInLeaderboard(leaderboard);
  const invested =
    valuation == null ? 0 : valuation.portfolio.equity - valuation.portfolio.cash;

  function persist(next: HumanTraderPersistedState) {
    setState(next);
    saveHumanTraderStateToBrowser(next);
  }

  function handleReset() {
    clearHumanTraderStateInBrowser();
    persist(resetHumanTraderState());
    setTradeDraft(null);
    setTradeError(null);
  }

  function handleConfirmTrade() {
    if (!state || !tradeDraft || !valuation) {
      return;
    }

    const dollarAmount = Number.parseFloat(tradeDraft.dollarAmount);

    if (!(dollarAmount > 0)) {
      setTradeError("Enter a positive dollar amount.");
      return;
    }

    const input: HumanNotionalTradeInput = {
      action: tradeDraft.action,
      symbol: tradeDraft.symbol,
      dollarAmount,
    };

    const result = executeHumanNotionalTrade(state.account, snapshot, input, {
      now: () => new Date(),
      createTradeId: () => `human-${Date.now()}`,
    });

    if (!result.ok) {
      setTradeError(result.reason);
      return;
    }

    const at = new Date().toISOString();
    persist(
      accountAfterTrade(state, result.account, result.valuation.portfolio.equity, at)
    );
    setTradeDraft(null);
    setTradeError(null);
  }

  if (!state || !valuation) {
    return null;
  }

  const { portfolio, positions } = valuation;
  const pnl = portfolio.equity - state.account.initialCapital;
  const cashAllocPercent =
    portfolio.equity > 0 ? (portfolio.cash / portfolio.equity) * 100 : 0;
  const tradeMaxNotional = tradeDraft
    ? maxHumanTradeNotional(state.account, snapshot, tradeDraft)
    : 0;

  return (
    <div className="space-y-3">
      <PageHeader
        kicker="Debug"
        title="My Trading"
        description="Local paper account — compete with the Arena agents. Not persisted to Supabase."
        actions={
          <Button type="button" variant="outline" size="sm" onClick={handleReset}>
            Reset account
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <DashboardCard className="xl:col-span-2" tone={pnl >= 0 ? "performance" : "performance-down"}>
          <DashboardCardTitle>Your book</DashboardCardTitle>
          <DashboardCardSubtitle>
            Virtual ${state.account.initialCapital.toLocaleString()} · market feed: {marketSource}
          </DashboardCardSubtitle>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <Metric label="Equity" value={formatUsd(portfolio.equity)} />
            <Metric label="Return" value={formatPercent(portfolio.returnPercent, true, 2)} />
            <Metric label="Cash" value={formatUsd(portfolio.cash)} />
            <Metric label="Invested" value={formatUsd(invested)} />
            <Metric
              label="P&amp;L"
              value={<SignedUsd value={pnl} />}
            />
            <Metric label="Rank vs AI" value={rank == null ? "—" : `#${rank}`} />
          </div>
          <div className="mt-6 h-[165px]">
            {state.equityHistory.length >= 2 ? (
              <EquitySparkline
                points={state.equityHistory}
                variant="hero"
                className="h-full"
                referenceEquity={state.account.initialCapital}
                trendPositive={pnl >= 0}
              />
            ) : (
              <div className="flex h-full items-end">
                <div className="h-px w-full bg-white/10" />
              </div>
            )}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-white/10 pt-4 text-sm md:grid-cols-4">
            <div>
              <dt className="text-white/45">Realized</dt>
              <dd className="mt-1 tabular-nums">
                <SignedUsd value={portfolio.realizedPnl} />
              </dd>
            </div>
            <div>
              <dt className="text-white/45">Unrealized</dt>
              <dd className="mt-1 tabular-nums">
                <SignedUsd value={portfolio.unrealizedPnl} />
              </dd>
            </div>
            <div>
              <dt className="text-white/45">Starting</dt>
              <dd className="mt-1 tabular-nums">{formatUsd(state.account.initialCapital)}</dd>
            </div>
            <div>
              <dt className="text-white/45">Trades</dt>
              <dd className="mt-1 tabular-nums">{state.account.trades.length}</dd>
            </div>
          </dl>
        </DashboardCard>

        <DashboardCard>
          <DashboardCardTitle>Human vs AI</DashboardCardTitle>
          <DashboardCardSubtitle>Sorted by live equity</DashboardCardSubtitle>
          <ul className="mt-4 space-y-2">
            {leaderboard.map((row) => (
              <li
                key={row.id}
                className={cn(
                  "flex items-center justify-between rounded-xl px-3 py-2 text-sm",
                  row.isHuman ? "bg-[#1d3d1d] font-medium text-[#8ADF7B]" : "bg-[#141414]"
                )}
              >
                <span>
                  #{row.rank} {row.name}
                </span>
                <span className="tabular-nums">{formatUsd(row.equity)}</span>
              </li>
            ))}
          </ul>
        </DashboardCard>
      </div>

      <DashboardCard>
        <DashboardCardTitle>Market</DashboardCardTitle>
        <DashboardCardSubtitle>
          Same paper engine and risk limits as the agents (15% max trade, 3 positions)
        </DashboardCardSubtitle>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-white/45">
              <tr>
                <th className="pb-2 pr-4 font-medium">Asset</th>
                <th className="pb-2 pr-4 font-medium">Price</th>
                <th className="pb-2 pr-4 font-medium">24h</th>
                <th className="pb-2 pr-4 font-medium">Position</th>
                <th className="pb-2 pr-4 font-medium">Avg entry</th>
                <th className="pb-2 pr-4 font-medium">Value</th>
                <th className="pb-2 font-medium">Trade</th>
              </tr>
            </thead>
            <tbody>
              {SUPPORTED_SYMBOLS.map((symbol) => {
                const asset = snapshot.assets.find((row) => row.symbol === symbol);
                const position = positions.find((row) => row.symbol === symbol);
                const price = asset?.price;
                const hasLong = position != null && position.quantity > 0;
                const hasShort = position != null && position.quantity < 0;

                return (
                  <tr key={symbol} className="border-t border-white/8">
                    <td className="py-3 pr-4 font-medium">
                      <AssetTicker symbol={symbol} size="sm" />
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {price == null ? "—" : formatUsd(price)}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {asset?.change24h == null ? (
                        "—"
                      ) : (
                        <SignedPercent value={asset.change24h} digits={2} />
                      )}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {position ? position.quantity.toFixed(6) : "—"}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {position ? formatUsd(position.averageEntryPrice) : "—"}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {position ? formatUsd(position.marketValue) : "—"}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={price == null}
                          className="border-[#15803D]/60 bg-[#14532D]/35 text-[#8ADF7B] hover:bg-[#15803D]/45 hover:text-[#bbf7d0]"
                          onClick={() => {
                            setTradeError(null);
                            setTradeDraft({ symbol, action: "BUY", dollarAmount: "" });
                          }}
                        >
                          {hasShort ? "Cover" : "Buy"}
                        </Button>
                        {hasLong ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={price == null}
                            onClick={() => {
                              setTradeError(null);
                              setTradeDraft({ symbol, action: "SELL", dollarAmount: "" });
                            }}
                          >
                            Sell
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={price == null}
                          className="border-[#B91C1C]/55 bg-[#7F1D1D]/35 text-[#F87171] hover:bg-[#991B1B]/45 hover:text-[#fecaca]"
                          onClick={() => {
                            setTradeError(null);
                            setTradeDraft({ symbol, action: "SHORT", dollarAmount: "" });
                          }}
                        >
                          Short
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DashboardCard>

      <DashboardCard>
        <DashboardCardTitle>Portfolio</DashboardCardTitle>
        <DashboardCardSubtitle>
          Cash available {formatUsd(portfolio.cash)} ({formatPercent(cashAllocPercent, false, 1)} of
          equity)
        </DashboardCardSubtitle>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-white/45">
              <tr>
                <th className="pb-2 pr-4">Symbol</th>
                <th className="pb-2 pr-4">Qty</th>
                <th className="pb-2 pr-4">Avg entry</th>
                <th className="pb-2 pr-4">Price</th>
                <th className="pb-2 pr-4">Value</th>
                <th className="pb-2 pr-4">Unrealized</th>
                <th className="pb-2">Alloc %</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-white/8 bg-white/[0.03]">
                <td className="py-2 pr-4 font-medium">
                  <CashTicker size="sm" />
                </td>
                <td className="py-2 pr-4 tabular-nums text-white/45">—</td>
                <td className="py-2 pr-4 tabular-nums text-white/45">—</td>
                <td className="py-2 pr-4 tabular-nums text-white/45">—</td>
                <td className="py-2 pr-4 tabular-nums">{formatUsd(portfolio.cash)}</td>
                <td className="py-2 pr-4 tabular-nums text-white/45">—</td>
                <td className="py-2 tabular-nums">{cashAllocPercent.toFixed(1)}%</td>
              </tr>
              {positions.map((position) => (
                  <tr key={position.symbol} className="border-t border-white/8">
                    <td className="py-2 pr-4 font-medium">
                      <AssetTicker symbol={position.symbol} size="sm" />
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{position.quantity.toFixed(6)}</td>
                    <td className="py-2 pr-4 tabular-nums">
                      {formatUsd(position.averageEntryPrice)}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{formatUsd(position.currentPrice)}</td>
                    <td className="py-2 pr-4 tabular-nums">{formatUsd(position.marketValue)}</td>
                    <td className="py-2 pr-4 tabular-nums">
                      <SignedUsd value={position.unrealizedPnl} />
                    </td>
                    <td className="py-2 tabular-nums">
                      {position.allocationPercent.toFixed(1)}%
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardCard>

      {tradeDraft ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center sm:p-6">
          <DashboardCard className="h-auto w-full max-w-md shrink-0">
            <DashboardCardTitle className="flex flex-wrap items-center gap-2">
              <span>
                {tradeDraft.action === "BUY" &&
                positions.some((p) => p.symbol === tradeDraft.symbol && p.quantity < 0)
                  ? "Cover"
                  : tradeDraft.action}
              </span>
              <AssetTicker symbol={tradeDraft.symbol} size="sm" />
            </DashboardCardTitle>
            <DashboardCardSubtitle>
              {tradeDraft.action === "BUY" ? "Buy long or cover short · " : null}
              {tradeDraft.action === "SHORT" ? "Open or add short · " : null}
              Price:{" "}
              {snapshot.assets.find((a) => a.symbol === tradeDraft.symbol)?.price != null
                ? formatUsd(
                    snapshot.assets.find((a) => a.symbol === tradeDraft.symbol)!.price
                  )
                : "—"}
            </DashboardCardSubtitle>
            <p className="mt-3 text-xs text-white/45">
              Arena limits (same as agents): up to 3 open positions · 15% of equity per trade
            </p>
            <div className="mt-4 flex items-baseline justify-between gap-3">
              <span className="text-sm text-white/60">Dollar amount</span>
              <button
                type="button"
                disabled={!(tradeMaxNotional > 0)}
                className="text-sm font-medium tabular-nums text-[#8ADF7B] enabled:hover:underline disabled:cursor-not-allowed disabled:text-white/25"
                onClick={() => {
                  setTradeError(null);
                  setTradeDraft({
                    ...tradeDraft,
                    dollarAmount: tradeMaxNotional.toFixed(2),
                  });
                }}
              >
                Max {formatUsd(tradeMaxNotional)}
              </button>
            </div>
            <input
              type="number"
              min="0"
              step="0.01"
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-3 py-2 text-foreground tabular-nums"
              value={tradeDraft.dollarAmount}
              onChange={(event) =>
                setTradeDraft({ ...tradeDraft, dollarAmount: event.target.value })
              }
            />
            <p className="mt-2 text-xs text-white/45">
              Est. qty:{" "}
              {(() => {
                const amount = Number.parseFloat(tradeDraft.dollarAmount);
                if (!(amount > 0)) {
                  return "—";
                }

                const qty = estimateHumanTradeQuantity(state.account, snapshot, {
                  action: tradeDraft.action,
                  symbol: tradeDraft.symbol,
                  dollarAmount: amount,
                });

                return qty == null ? "—" : qty.toFixed(8);
              })()}
            </p>
            {tradeError ? <p className="mt-2 text-sm text-[#F87171]">{tradeError}</p> : null}
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setTradeDraft(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleConfirmTrade}
                className={cn(
                  tradeDraft.action === "BUY" &&
                    "border-[#15803D]/60 bg-[#14532D]/35 text-[#8ADF7B] hover:bg-[#15803D]/45",
                  tradeDraft.action === "SHORT" &&
                    "border-[#B91C1C]/55 bg-[#7F1D1D]/35 text-[#F87171] hover:bg-[#991B1B]/45"
                )}
              >
                Confirm
              </Button>
            </div>
          </DashboardCard>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-white/45">{label}</p>
      <p className="mt-1 text-[15px] font-medium tabular-nums">{value}</p>
    </div>
  );
}
