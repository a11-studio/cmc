import { describe, expect, it, vi } from "vitest";
import { generateTradeDecision, createDecisionContext, validateTradeDecision } from "@/lib/ai/decision";
import { AiDecisionError } from "@/lib/ai/errors";
import { DEFAULT_GEMINI_MODEL, getGeminiApiKey, resolveGeminiModel, resolveGeminiModels } from "@/lib/ai/config";
import { MOMENTUM_ALPHA_SYSTEM_PROMPT, TRADE_DECISION_JSON_SCHEMA } from "@/lib/ai/prompts";
import type { DecisionContext, GeminiGenerateContent, TradeDecision } from "@/lib/ai/types";
import type { MarketSnapshot } from "@/lib/market/types";

function snapshot(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    cycleId: "cycle-42",
    timestamp: "2026-09-17T09:42:10.000Z",
    assets: [
      { symbol: "BTC", price: 76_606.73, change1h: 0.2, change24h: 1.1, change7d: 3.4, volume24h: 1 },
      { symbol: "ETH", price: 2_444.8, change1h: 0.3, change24h: 1.9, change7d: 6.2, volume24h: 1 },
      { symbol: "SOL", price: 100.55, change24h: 1.5 },
      { symbol: "BNB", price: 612.4, change24h: 1.1 },
      { symbol: "XRP", price: 2.31, change24h: 0.8 },
    ],
    market: { btcDominance: 54.1 },
    ...overrides,
  };
}

function context(overrides: Partial<DecisionContext> = {}): DecisionContext {
  const market = overrides.snapshot ?? snapshot();

  return createDecisionContext({
    agentId: "momentum-alpha",
    strategyName: "Narrative momentum",
    snapshot: market,
    portfolio: {
      cash: 8_200,
      equity: 10_000,
      positions: [
        {
          symbol: "ETH",
          quantity: 0.5,
          averageEntryPrice: 2_400,
          marketValue: 1_222.4,
          unrealizedPnl: 22.4,
          allocationPercent: 12.2,
        },
      ],
    },
    ...overrides,
  });
}

describe("executable headroom in the decision context", () => {
  it("tells a fully deployed agent that BUY cannot execute", async () => {
    let sent: Parameters<GeminiGenerateContent>[0] | undefined;

    await generateTradeDecision(
      context({
        portfolio: {
          cash: 0,
          equity: 10_000,
          positions: [
            {
              symbol: "BTC",
              quantity: 0.13,
              averageEntryPrice: 74_000,
              marketValue: 10_000,
              unrealizedPnl: 120,
              allocationPercent: 100,
            },
          ],
        },
      }),
      { generateContent: mockClient(validDecision(), (request) => (sent = request)) }
    );

    const payload = JSON.parse(sent!.contents.slice(sent!.contents.indexOf("{")));

    expect(payload.headroom.cashPercentOfEquity).toBe(0);
    expect(payload.headroom.executableActions).not.toContain("BUY");
    expect(payload.headroom.executableActions).toContain("SELL");
    expect(sent!.systemInstruction).toContain("EXECUTABLE HEADROOM");
  });

  it("offers BUY room while cash is available", async () => {
    let sent: Parameters<GeminiGenerateContent>[0] | undefined;

    await generateTradeDecision(context(), {
      generateContent: mockClient(validDecision(), (request) => (sent = request)),
    });

    const payload = JSON.parse(sent!.contents.slice(sent!.contents.indexOf("{")));
    const btc = payload.headroom.perSymbol.find((entry: { symbol: string }) => entry.symbol === "BTC");

    expect(payload.headroom.executableActions).toContain("BUY");
    expect(btc.maxBuyPercentOfEquity).toBe(15);
  });
});

function validDecision(overrides: Partial<TradeDecision> = {}): TradeDecision {
  return {
    action: "HOLD",
    symbol: "ETH",
    allocationPercent: 0,
    confidence: 62,
    timeHorizon: "SHORT",
    reasons: ["ETH 24h momentum is positive."],
    riskFactors: ["RSI is not supplied."],
    ...overrides,
  };
}

function mockClient(payload: unknown, inspect?: (request: Parameters<GeminiGenerateContent>[0]) => void): GeminiGenerateContent {
  return vi.fn(async (request) => {
    inspect?.(request);
    return { text: typeof payload === "string" ? payload : JSON.stringify(payload) };
  });
}

describe("Gemini model configuration", () => {
  it("rejects a missing GEMINI_API_KEY", () => {
    expect(() => getGeminiApiKey({})).toThrow(AiDecisionError);
    expect(() => getGeminiApiKey({ GEMINI_API_KEY: "  " })).toThrow(/GEMINI_API_KEY is not configured/);

    try {
      getGeminiApiKey({ GEMINI_API_KEY: "" });
      throw new Error("expected missing key to throw");
    } catch (error) {
      expect(error).toMatchObject({ code: "MISSING_API_KEY" });
    }
  });

  it("uses GEMINI_MODEL when set and a single default otherwise", () => {
    expect(resolveGeminiModel({})).toBe(DEFAULT_GEMINI_MODEL);
    expect(resolveGeminiModel({ GEMINI_MODEL: "  " })).toBe(DEFAULT_GEMINI_MODEL);
    expect(resolveGeminiModel({ GEMINI_MODEL: "gemini-custom-flash" })).toBe("gemini-custom-flash");
    expect(resolveGeminiModels({ GEMINI_FALLBACK_MODELS: "" })).toEqual([DEFAULT_GEMINI_MODEL]);
  });
});

describe("generateTradeDecision", () => {
  it("returns a valid BUY decision from structured JSON", async () => {
    const generateContent = mockClient(
      validDecision({
        action: "BUY",
        symbol: "ETH",
        allocationPercent: 8,
        confidence: 74,
        reasons: ["ETH has positive 7-day momentum."],
        riskFactors: ["Intraday range is extended."],
      })
    );

    const decision = await generateTradeDecision(context(), { generateContent });

    expect(decision.action).toBe("BUY");
    expect(decision.symbol).toBe("ETH");
    expect(decision.allocationPercent).toBe(8);
    expect(decision.confidence).toBe(74);
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: resolveGeminiModel(),
        systemInstruction: MOMENTUM_ALPHA_SYSTEM_PROMPT,
        responseJsonSchema: TRADE_DECISION_JSON_SCHEMA,
      })
    );
  });

  it("returns a valid SELL decision as a percent of the current position", async () => {
    const decision = await generateTradeDecision(context(), {
      generateContent: mockClient(
        validDecision({
          action: "SELL",
          symbol: "ETH",
          allocationPercent: 40,
          confidence: 68,
          reasons: ["ETH 1h momentum faded."],
          riskFactors: ["A later Risk Engine may still constrain this."],
        })
      ),
    });

    expect(decision.action).toBe("SELL");
    expect(decision.allocationPercent).toBe(40);
  });

  it("returns a valid HOLD decision", async () => {
    const decision = await generateTradeDecision(context(), {
      generateContent: mockClient(validDecision()),
    });

    expect(decision.action).toBe("HOLD");
    expect(decision.allocationPercent).toBe(0);
  });

  it("rejects a malformed model response", async () => {
    await expect(
      generateTradeDecision(context(), { generateContent: mockClient("not-json") })
    ).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
  });

  it("rejects an invalid symbol", async () => {
    await expect(
      generateTradeDecision(context(), {
        generateContent: mockClient(validDecision({ symbol: "DOGE" as TradeDecision["symbol"] })),
      })
    ).rejects.toMatchObject({ code: "SCHEMA_VALIDATION" });
  });

  it("rejects an invalid action", async () => {
    await expect(
      generateTradeDecision(context(), {
        generateContent: mockClient({ ...validDecision(), action: "YEET" }),
      })
    ).rejects.toMatchObject({ code: "SCHEMA_VALIDATION" });
  });

  it("rejects allocationPercent outside 0–100", async () => {
    await expect(
      generateTradeDecision(context(), {
        generateContent: mockClient(validDecision({ action: "BUY", allocationPercent: 140 })),
      })
    ).rejects.toMatchObject({ code: "SCHEMA_VALIDATION" });
  });

  it("rejects confidence outside 0–100", async () => {
    await expect(
      generateTradeDecision(context(), {
        generateContent: mockClient(validDecision({ confidence: -1 })),
      })
    ).rejects.toMatchObject({ code: "SCHEMA_VALIDATION" });
  });

  it("rejects HOLD with a non-zero allocation", async () => {
    await expect(
      generateTradeDecision(context(), {
        generateContent: mockClient(validDecision({ action: "HOLD", allocationPercent: 12 })),
      })
    ).rejects.toMatchObject({ code: "SCHEMA_VALIDATION" });
  });

  it("rejects missing required fields", async () => {
    await expect(
      generateTradeDecision(context(), {
        generateContent: mockClient({ action: "BUY", symbol: "ETH" }),
      })
    ).rejects.toMatchObject({ code: "SCHEMA_VALIDATION" });
  });

  it("does not convert a Gemini API error into HOLD", async () => {
    const generateContent = vi.fn(async () => {
      throw Object.assign(new Error("Gemini is down"), { status: 503 });
    });

    await expect(generateTradeDecision(context(), { generateContent })).rejects.toMatchObject({
      code: "GEMINI_UNAVAILABLE",
    });
  });

  it("maps a rate-limit error", async () => {
    const generateContent = vi.fn(async () => {
      throw Object.assign(new Error("Too many requests"), { status: 429 });
    });

    await expect(generateTradeDecision(context(), { generateContent })).rejects.toMatchObject({
      code: "GEMINI_RATE_LIMIT",
    });
  });

  it("maps an unavailable model error", async () => {
    const generateContent = vi.fn(async () => {
      throw Object.assign(new Error("Not found"), { status: 404 });
    });

    await expect(generateTradeDecision(context(), { generateContent })).rejects.toMatchObject({
      code: "MODEL_UNAVAILABLE",
    });
  });

  it("rejects an empty model response", async () => {
    await expect(
      generateTradeDecision(context(), { generateContent: async () => ({ text: "  " }) })
    ).rejects.toMatchObject({ code: "EMPTY_RESPONSE" });
  });

  it("does not mutate the MarketSnapshot or portfolio context", async () => {
    const market = snapshot();
    const portfolio = {
      cash: 8_200,
      equity: 10_000,
      positions: [
        {
          symbol: "ETH" as const,
          quantity: 0.5,
          averageEntryPrice: 2_400,
          marketValue: 1_222.4,
          unrealizedPnl: 22.4,
          allocationPercent: 12.2,
        },
      ],
    };
    const beforeMarket = JSON.stringify(market);
    const beforePortfolio = JSON.stringify(portfolio);
    const decisionContext = createDecisionContext({
      agentId: "momentum-alpha",
      snapshot: market,
      portfolio,
    });

    await generateTradeDecision(decisionContext, {
      generateContent: async (request) => {
        const parsed = JSON.parse(request.contents.slice(request.contents.indexOf("{"))) as {
          snapshot: { assets: { price: number }[] };
          portfolio: { cash: number };
        };
        parsed.snapshot.assets[0]!.price = 1;
        parsed.portfolio.cash = 0;
        return { text: JSON.stringify(validDecision()) };
      },
    });

    expect(JSON.stringify(market)).toBe(beforeMarket);
    expect(JSON.stringify(portfolio)).toBe(beforePortfolio);
    expect(market.assets[0]?.price).toBe(76_606.73);
    expect(portfolio.cash).toBe(8_200);
  });

  it("includes cycle, timestamp, agent, and strategy in the prompt payload", async () => {
    const generateContent = mockClient(validDecision(), (request) => {
      expect(request.contents).toContain("cycle-42");
      expect(request.contents).toContain("2026-09-17T09:42:10.000Z");
      expect(request.contents).toContain("momentum-alpha");
      expect(request.contents).toContain("Elon Musk");
      expect(request.contents).toContain("Narrative momentum");
      expect(request.systemInstruction).toContain("BUY: allocationPercent is the percent of current portfolio equity");
      expect(request.systemInstruction).toContain("SHORT: allocationPercent is the percent of current portfolio equity to short");
    });

    await generateTradeDecision(context(), { generateContent });
  });
});

describe("validateTradeDecision", () => {
  it("accepts optional stop-loss and take-profit percents", () => {
    expect(
      validateTradeDecision(
        validDecision({
          action: "BUY",
          allocationPercent: 6,
          stopLossPercent: 5,
          takeProfitPercent: 10,
        })
      )
    ).toMatchObject({ stopLossPercent: 5, takeProfitPercent: 10 });
  });

  it("drops an out-of-range stop loss instead of failing the decision", () => {
    // Gemini occasionally returns a price level or a negative percent here.
    // The field is decorative, so the trade must survive it.
    const decision = validateTradeDecision(
      validDecision({
        action: "BUY",
        allocationPercent: 6,
        stopLossPercent: -8,
        takeProfitPercent: 80_995,
      })
    );

    expect(decision).toMatchObject({ action: "BUY", allocationPercent: 6 });
    expect(decision.stopLossPercent).toBeUndefined();
    expect(decision.takeProfitPercent).toBeUndefined();
  });

  it("still rejects an out-of-range confidence", () => {
    expect(() => validateTradeDecision(validDecision({ confidence: 140 }))).toThrow(
      /confidence must be between 0 and 100/
    );
  });

  it("accepts SHORT", () => {
    expect(
      validateTradeDecision(
        validDecision({
          action: "SHORT",
          symbol: "BTC",
          allocationPercent: 10,
        })
      )
    ).toMatchObject({ action: "SHORT", symbol: "BTC", allocationPercent: 10 });
  });
});
