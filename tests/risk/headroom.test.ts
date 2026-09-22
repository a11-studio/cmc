import { describe, expect, it } from "vitest";

import { SUPPORTED_SYMBOLS } from "@/lib/market/symbols";
import type { MarketSnapshot } from "@/lib/market/types";
import { evaluateRisk } from "@/lib/risk/evaluate";
import { computeTradingHeadroom, type HeadroomPortfolio } from "@/lib/risk/headroom";

const PRICES: Record<string, number> = {
  BTC: 50_000,
  ETH: 2_500,
  SOL: 100,
  BNB: 600,
  XRP: 1.5,
};

function snapshot(): MarketSnapshot {
  return {
    cycleId: "cycle-1",
    timestamp: "2026-09-19T05:00:00.000Z",
    assets: SUPPORTED_SYMBOLS.map((symbol) => ({
      symbol,
      price: PRICES[symbol]!,
      change1h: 0,
      change24h: 0,
      change7d: 0,
      volume24h: 1_000_000,
      marketCap: 1_000_000_000,
    })),
    market: { btcDominance: 50 },
  } as unknown as MarketSnapshot;
}

function headroomFor(portfolio: HeadroomPortfolio) {
  return computeTradingHeadroom({ portfolio, symbols: SUPPORTED_SYMBOLS });
}

function symbolHeadroom(portfolio: HeadroomPortfolio, symbol: string) {
  return headroomFor(portfolio).perSymbol.find((entry) => entry.symbol === symbol)!;
}

const fullyDeployed: HeadroomPortfolio = {
  cash: 0,
  equity: 10_000,
  positions: [
    { symbol: "BTC", quantity: 0.12, marketValue: 6_000, allocationPercent: 60 },
    { symbol: "ETH", quantity: 1.6, marketValue: 4_000, allocationPercent: 40 },
  ],
};

describe("computeTradingHeadroom", () => {
  it("reports BUY as unavailable once cash is fully deployed", () => {
    const headroom = headroomFor(fullyDeployed);

    expect(headroom.cashPercentOfEquity).toBe(0);
    expect(headroom.executableActions).not.toContain("BUY");
    expect(headroom.executableActions).toContain("SELL");
    expect(headroom.perSymbol.every((entry) => entry.maxBuyPercentOfEquity === 0)).toBe(true);
    expect(headroom.notes.join(" ")).toContain("SELL part of a position first");
  });

  it("caps a BUY at available cash", () => {
    const entry = symbolHeadroom(
      {
        cash: 800,
        equity: 10_000,
        positions: [{ symbol: "BTC", quantity: 0.184, marketValue: 9_200, allocationPercent: 92 }],
      },
      "ETH"
    );

    // 8% cash is tighter than the 15% max trade.
    expect(entry.maxBuyPercentOfEquity).toBe(8);
  });

  it("caps a BUY at the max trade size when cash is plentiful", () => {
    const entry = symbolHeadroom({ cash: 10_000, equity: 10_000, positions: [] }, "BTC");

    expect(entry.maxBuyPercentOfEquity).toBe(15);
  });

  it("offers no room on an unheld symbol at the open position limit", () => {
    const entry = symbolHeadroom(
      {
        cash: 5_000,
        equity: 10_000,
        positions: [
          { symbol: "BTC", quantity: 0.04, marketValue: 2_000, allocationPercent: 20 },
          { symbol: "ETH", quantity: 0.8, marketValue: 2_000, allocationPercent: 20 },
          { symbol: "SOL", quantity: 10, marketValue: 1_000, allocationPercent: 10 },
        ],
      },
      "XRP"
    );

    expect(entry.maxBuyPercentOfEquity).toBe(0);
    expect(entry.maxShortPercentOfEquity).toBe(0);
    expect(headroomFor({
      cash: 5_000,
      equity: 10_000,
      positions: [
        { symbol: "BTC", quantity: 0.04, marketValue: 2_000, allocationPercent: 20 },
        { symbol: "ETH", quantity: 0.8, marketValue: 2_000, allocationPercent: 20 },
        { symbol: "SOL", quantity: 10, marketValue: 1_000, allocationPercent: 10 },
      ],
    }).notes.join(" ")).toContain("maximum of 3 positions");
  });

  it("offers SELL room on an open short (cover)", () => {
    const headroom = headroomFor({
      cash: 11_000,
      equity: 10_000,
      positions: [{ symbol: "ETH", quantity: -1, marketValue: -2_500, allocationPercent: -25 }],
    });
    const eth = headroom.perSymbol.find((entry) => entry.symbol === "ETH")!;

    expect(headroom.executableActions).toContain("SELL");
    expect(eth.maxSellPercentOfPosition).toBeGreaterThan(0);
  });

  it("only offers SELL room on symbols actually held", () => {
    const headroom = headroomFor(fullyDeployed);
    const btc = headroom.perSymbol.find((entry) => entry.symbol === "BTC")!;
    const sol = headroom.perSymbol.find((entry) => entry.symbol === "SOL")!;

    expect(btc.maxSellPercentOfPosition).toBeGreaterThan(0);
    expect(sol.maxSellPercentOfPosition).toBe(0);
  });

  it("agrees with the risk engine on what it reports as executable", () => {
    const portfolios: HeadroomPortfolio[] = [
      fullyDeployed,
      { cash: 10_000, equity: 10_000, positions: [] },
      {
        cash: 800,
        equity: 10_000,
        positions: [{ symbol: "BTC", quantity: 0.184, marketValue: 9_200, allocationPercent: 92 }],
      },
    ];

    for (const portfolio of portfolios) {
      const headroom = computeTradingHeadroom({ portfolio, symbols: SUPPORTED_SYMBOLS });

      for (const entry of headroom.perSymbol) {
        for (const [action, allocationPercent] of [
          ["BUY", entry.maxBuyPercentOfEquity],
          ["SELL", entry.maxSellPercentOfPosition],
          ["SHORT", entry.maxShortPercentOfEquity],
        ] as const) {
          if (allocationPercent <= 0) {
            continue;
          }

          const result = evaluateRisk({
            decision: {
              action,
              symbol: entry.symbol,
              allocationPercent,
              confidence: 70,
              timeHorizon: "SHORT",
              reasons: ["test"],
              riskFactors: ["test"],
            },
            snapshot: snapshot(),
            portfolio: {
              ...portfolio,
              dayStartEquity: portfolio.equity,
              drawdownPercent: 0,
            },
            agentStatus: "ACTIVE",
          });

          // The advertised maximum must execute in full, never get trimmed.
          expect(
            { symbol: entry.symbol, action, verdict: result.verdict },
            `${action} ${entry.symbol} at ${allocationPercent}%`
          ).toEqual({ symbol: entry.symbol, action, verdict: "APPROVED" });
        }
      }
    }
  });
});
