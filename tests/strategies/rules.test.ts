import { describe, expect, it, vi } from "vitest";
import type { DecisionContext, DecisionPositionContext } from "@/lib/ai/types";
import type { AssetSnapshot, AssetTrend, SupportedSymbol } from "@/lib/market/types";
import type { TradeDecision } from "@/lib/paper/types";
import { computeTradingHeadroom } from "@/lib/risk/headroom";
import { decideWithRuleCore } from "@/lib/strategies/rule-core";
import { hasRuleCore, proposeRuleDecision } from "@/lib/strategies/rules";

function trend(overrides: Partial<AssetTrend> = {}): AssetTrend {
  return {
    source: "binance",
    asOfDay: "2026-11-05",
    sma50: 100,
    sma100: 100,
    sma200: 100,
    high10: 120,
    low10: 80,
    high20: 120,
    low20: 80,
    high30: 120,
    low30: 80,
    high55: 120,
    low55: 80,
    atr20: 4,
    atr20Percent: 4,
    return30dPercent: 0,
    volatility30dPercent: 3,
    ...overrides,
  };
}

/** Quiet market: every asset at 100 inside its channels, BTC above its averages. */
function asset(symbol: SupportedSymbol, overrides: Partial<AssetSnapshot> = {}): AssetSnapshot {
  return { symbol, price: 110, change24h: 0, change7d: 0, trend: trend(), ...overrides };
}

function context(input: {
  agentId: string;
  assets?: Partial<Record<SupportedSymbol, Partial<AssetSnapshot>>>;
  positions?: DecisionPositionContext[];
  timestamp?: string;
  withHeadroom?: boolean;
}): DecisionContext {
  const symbols: SupportedSymbol[] = ["BTC", "ETH", "SOL", "BNB", "XRP"];
  const snapshot = {
    cycleId: "cycle-rules",
    timestamp: input.timestamp ?? "2026-11-06T02:00:00.000Z",
    assets: symbols.map((symbol) => asset(symbol, input.assets?.[symbol])),
    market: {},
  };
  const positions = input.positions ?? [];
  const invested = positions.reduce((sum, position) => sum + position.marketValue, 0);
  const portfolio = { cash: 10_000 - invested, equity: 10_000, positions };

  return {
    agentId: input.agentId,
    agentName: input.agentId,
    strategyName: "test",
    skill: "test",
    cycleId: snapshot.cycleId,
    snapshotTimestamp: snapshot.timestamp,
    snapshot,
    portfolio,
    ...(input.withHeadroom === false ? {} : { headroom: computeTradingHeadroom({ portfolio, symbols, snapshot }) }),
  };
}

function held(symbol: SupportedSymbol, allocationPercent: number, price = 110): DecisionPositionContext {
  const marketValue = allocationPercent * 100;
  return { symbol, quantity: marketValue / price, averageEntryPrice: price, marketValue, unrealizedPnl: 0, allocationPercent };
}

describe("rule cores", () => {
  it("every live persona has a rule core", () => {
    for (const id of ["richard-dennis", "richard-donchian", "jim-simons", "momentum-alpha", "jesse-livermore", "paul-tudor-jones"]) {
      expect(hasRuleCore(id)).toBe(true);
    }

    expect(proposeRuleDecision(context({ agentId: "warren-buffett" }))).toBeNull();
  });

  it("holds when the snapshot has no trend data", () => {
    const proposal = proposeRuleDecision(
      context({ agentId: "richard-dennis", assets: Object.fromEntries((["BTC", "ETH", "SOL", "BNB", "XRP"] as const).map((s) => [s, { trend: undefined }])) })
    );

    expect(proposal?.decision.action).toBe("HOLD");
  });

  it("Turtle buys a 20-day breakout above SMA50 and shorts a 20-day breakdown below it", () => {
    const up = proposeRuleDecision(context({ agentId: "richard-dennis", assets: { SOL: { price: 125 } } }));
    const down = proposeRuleDecision(context({ agentId: "richard-dennis", assets: { XRP: { price: 70 } } }));

    expect(up?.decision).toMatchObject({ action: "BUY", symbol: "SOL", allocationPercent: 15 });
    expect(up?.basis[0]).toContain("20-day high");
    expect(down?.decision).toMatchObject({ action: "SHORT", symbol: "XRP" });
  });

  it("Turtle exits a long below the 10-day low before taking a new breakout", () => {
    const proposal = proposeRuleDecision(
      context({ agentId: "richard-dennis", assets: { SOL: { price: 125 }, ETH: { price: 78 } }, positions: [held("ETH", 20, 78)] })
    );

    expect(proposal?.decision).toMatchObject({ action: "SELL", symbol: "ETH", allocationPercent: 15 / 0.2 });
  });

  it("Donchian shorts a 20-day breakdown only when BTC is under SMA100", () => {
    const bearish = proposeRuleDecision(
      context({ agentId: "richard-donchian", assets: { BTC: { price: 90 }, XRP: { price: 70 } } })
    );
    const bullish = proposeRuleDecision(context({ agentId: "richard-donchian", assets: { XRP: { price: 70 } } }));

    expect(bearish?.decision).toMatchObject({ action: "SHORT", symbol: "XRP" });
    expect(bullish?.decision.action).toBe("HOLD");
  });

  it("Simons buys only when 1/7/30-day momentum all agree and BTC is over SMA100", () => {
    const strong = { change24h: 2, change7d: 8, trend: trend({ return30dPercent: 20 }) };
    const agree = proposeRuleDecision(context({ agentId: "jim-simons", assets: { ETH: strong } }));
    const btcDown = proposeRuleDecision(context({ agentId: "jim-simons", assets: { ETH: strong, BTC: { price: 90 } } }));

    expect(agree?.decision).toMatchObject({ action: "BUY", symbol: "ETH" });
    expect(btcDown?.decision.action).toBe("HOLD");
  });

  it("Elon longs weekly leaders above SMA50 and shorts laggards below it", () => {
    const ranked = { ETH: { change7d: 10 }, SOL: { change7d: 6 }, BNB: { price: 90, change7d: -3 } };
    const first = proposeRuleDecision(context({ agentId: "momentum-alpha", assets: ranked }));
    const afterLongs = proposeRuleDecision(
      context({ agentId: "momentum-alpha", assets: ranked, positions: [held("ETH", 25), held("SOL", 25)] })
    );
    const exit = proposeRuleDecision(
      context({ agentId: "momentum-alpha", assets: ranked, timestamp: "2026-11-06T15:00:00.000Z", positions: [held("BNB", 20, 90)] })
    );

    expect(first?.decision).toMatchObject({ action: "BUY", symbol: "ETH" });
    expect(afterLongs?.decision).toMatchObject({ action: "SHORT", symbol: "BNB" });
    expect(exit?.decision).toMatchObject({ action: "SELL", symbol: "BNB" });
  });

  it("Livermore trades 10-day breakouts and breakdowns with the asset's SMA50", () => {
    const up = proposeRuleDecision(context({ agentId: "jesse-livermore", assets: { SOL: { price: 125 } } }));
    const down = proposeRuleDecision(context({ agentId: "jesse-livermore", assets: { XRP: { price: 70 } } }));
    const againstTrend = proposeRuleDecision(
      context({ agentId: "jesse-livermore", assets: { SOL: { price: 125, trend: trend({ sma50: 130 }) } } })
    );

    expect(up?.decision).toMatchObject({ action: "BUY", symbol: "SOL", allocationPercent: 15 });
    expect(down?.decision).toMatchObject({ action: "SHORT", symbol: "XRP" });
    expect(againstTrend?.decision.action).toBe("HOLD");
  });

  it("Jones goes long above SMA50 and short below it, and holds while the side is unchanged", () => {
    const regime = {
      ETH: { price: 130, trend: trend({ return30dPercent: 10 }) },
      XRP: { price: 70, trend: trend({ return30dPercent: -10 }) },
    };
    const first = proposeRuleDecision(context({ agentId: "paul-tudor-jones", assets: regime }));
    const second = proposeRuleDecision(context({ agentId: "paul-tudor-jones", assets: regime, positions: [held("ETH", 30, 130)] }));
    const holding = proposeRuleDecision(
      context({ agentId: "paul-tudor-jones", assets: { XRP: { price: 95, trend: trend({ return30dPercent: 1 }) } }, positions: [held("XRP", -30, 95)] })
    );
    const flipped = proposeRuleDecision(
      context({ agentId: "paul-tudor-jones", assets: { XRP: { price: 105 } }, positions: [held("XRP", -30, 105)] })
    );

    expect(first?.decision).toMatchObject({ action: "BUY", symbol: "ETH" });
    expect(second?.decision).toMatchObject({ action: "SHORT", symbol: "XRP" });
    expect(holding?.decision.action).toBe("HOLD");
    expect(flipped?.decision).toMatchObject({ action: "SELL", symbol: "XRP" });
  });
});

function reviewer(answer: Partial<TradeDecision> | Error) {
  return vi.fn(async (reviewContext: DecisionContext): Promise<TradeDecision> => {
    void reviewContext;
    if (answer instanceof Error) {
      throw answer;
    }

    return { action: "HOLD", symbol: "BTC", allocationPercent: 0, confidence: 60, timeHorizon: "MEDIUM", reasons: ["llm"], riskFactors: [], ...answer };
  });
}

describe("rule core review", () => {
  const entry = () => context({ agentId: "richard-dennis", assets: { SOL: { price: 125 } } });

  it("skips the model entirely when the rule holds", async () => {
    const review = reviewer({});
    const result = await decideWithRuleCore(context({ agentId: "richard-dennis" }), review);

    expect(result?.outcome).toBe("RULE_ONLY");
    expect(review).not.toHaveBeenCalled();
  });

  it("keeps the rule's size when the model confirms, with the model's wording", async () => {
    const review = reviewer({ action: "BUY", symbol: "SOL", allocationPercent: 3, reasons: ["Clean breakout"] });
    const result = await decideWithRuleCore(entry(), review);

    expect(result?.outcome).toBe("CONFIRMED");
    expect(result?.decision).toMatchObject({ action: "BUY", symbol: "SOL", allocationPercent: 15 });
    expect(result?.decision.reasons).toContain("Clean breakout");
    expect(review.mock.calls[0]?.[0]).toHaveProperty("ruleProposal.vetoAllowed", true);
  });

  it("lets the model veto an entry with HOLD", async () => {
    const result = await decideWithRuleCore(entry(), reviewer({ reasons: ["SOL price looks stale"] }));

    expect(result?.outcome).toBe("VETOED");
    expect(result?.decision.action).toBe("HOLD");
  });

  it("does not let the model veto an exit", async () => {
    const exit = context({ agentId: "richard-dennis", assets: { ETH: { price: 78 } }, positions: [held("ETH", 20, 78)] });
    const result = await decideWithRuleCore(exit, reviewer({}));

    expect(result?.outcome).toBe("LLM_DEVIATED");
    expect(result?.decision.action).toBe("SELL");
  });

  it("executes the rule when the model is unavailable or answers something else", async () => {
    const down = await decideWithRuleCore(entry(), reviewer(new Error("503")));
    const other = await decideWithRuleCore(entry(), reviewer({ action: "SHORT", symbol: "BTC", allocationPercent: 5 }));

    expect(down?.outcome).toBe("LLM_UNAVAILABLE");
    expect(other?.outcome).toBe("LLM_DEVIATED");
    expect(other?.decision).toMatchObject({ action: "BUY", symbol: "SOL" });
  });
});

describe("leftover positions", () => {
  it("does not top up a dust position as if the system were in a trade", () => {
    const proposal = proposeRuleDecision(
      context({ agentId: "richard-donchian", assets: { BTC: { price: 90 } }, positions: [held("BTC", -0.4, 90)] })
    );

    expect(proposal?.decision.action).toBe("HOLD");
  });
});
