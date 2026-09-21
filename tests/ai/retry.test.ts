import { describe, expect, it, vi } from "vitest";
import { DEFAULT_GEMINI_FALLBACK_MODELS, DEFAULT_GEMINI_MODEL, resolveGeminiModels } from "@/lib/ai/config";
import { generateTradeDecisionWithFallback } from "@/lib/ai/retry";
import { createDecisionContext } from "@/lib/ai/decision";
import { isRetryableGeminiError } from "@/lib/ai/errors";
import type { GeminiGenerateContent, TradeDecision } from "@/lib/ai/types";
import type { MarketSnapshot } from "@/lib/market/types";

function snapshot(): MarketSnapshot {
  return {
    cycleId: "cycle-42",
    timestamp: "2026-09-17T09:42:10.000Z",
    assets: [
      { symbol: "BTC", price: 76_606.73, change24h: 1.1 },
      { symbol: "ETH", price: 2_444.8, change24h: 1.9 },
      { symbol: "SOL", price: 100.55, change24h: 1.5 },
      { symbol: "BNB", price: 612.4, change24h: 1.1 },
      { symbol: "XRP", price: 2.31, change24h: 0.8 },
    ],
    market: { btcDominance: 54.1 },
  };
}

function context() {
  return createDecisionContext({
    agentId: "momentum-alpha",
    strategyName: "Narrative momentum",
    snapshot: snapshot(),
    portfolio: { cash: 10_000, equity: 10_000, positions: [] },
  });
}

function validDecision(): TradeDecision {
  return {
    action: "HOLD",
    symbol: "ETH",
    allocationPercent: 0,
    confidence: 62,
    timeHorizon: "SHORT",
    reasons: ["ETH 24h momentum is positive."],
    riskFactors: ["RSI is not supplied."],
  };
}

describe("Gemini model fallbacks", () => {
  it("puts the primary model first and appends built-in fallbacks", () => {
    expect(resolveGeminiModels({})).toEqual([DEFAULT_GEMINI_MODEL, ...DEFAULT_GEMINI_FALLBACK_MODELS]);
    expect(resolveGeminiModels({ GEMINI_MODEL: "gemini-2.5-flash" })).toEqual([
      "gemini-2.5-flash",
      ...DEFAULT_GEMINI_FALLBACK_MODELS,
    ]);
  });

  it("uses an explicit fallback list when GEMINI_FALLBACK_MODELS is set", () => {
    expect(
      resolveGeminiModels({
        GEMINI_MODEL: "gemini-2.5-flash",
        GEMINI_FALLBACK_MODELS: "gemini-3.5-flash, gemini-2.5-flash-lite",
      })
    ).toEqual(["gemini-2.5-flash", "gemini-3.5-flash", "gemini-2.5-flash-lite"]);
  });

  it("uses built-in fallbacks when GEMINI_FALLBACK_MODELS is empty", () => {
    expect(resolveGeminiModels({ GEMINI_FALLBACK_MODELS: "" })).toEqual([
      DEFAULT_GEMINI_MODEL,
      ...DEFAULT_GEMINI_FALLBACK_MODELS,
    ]);
    expect(resolveGeminiModels({ GEMINI_FALLBACK_MODELS: "   " })).toEqual([
      DEFAULT_GEMINI_MODEL,
      ...DEFAULT_GEMINI_FALLBACK_MODELS,
    ]);
  });

  it("treats high-demand errors as retryable", () => {
    expect(
      isRetryableGeminiError(Object.assign(new Error("This model is currently experiencing high demand."), { status: 503 }))
    ).toBe(true);
  });

  it("retries the next Flash model after high demand", async () => {
    const generateContent: GeminiGenerateContent = vi.fn(async (request) => {
      if (request.model === "gemini-2.5-flash") {
        throw Object.assign(new Error("This model is currently experiencing high demand."), { status: 503 });
      }

      return { text: JSON.stringify(validDecision()) };
    });
    const sleep = vi.fn(async () => undefined);

    const decision = await generateTradeDecisionWithFallback(context(), {
      generateContent,
      models: ["gemini-2.5-flash", "gemini-2.5-flash-lite"],
      sleep,
    });

    expect(decision.action).toBe("HOLD");
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateContent).toHaveBeenNthCalledWith(1, expect.objectContaining({ model: "gemini-2.5-flash" }));
    expect(generateContent).toHaveBeenNthCalledWith(2, expect.objectContaining({ model: "gemini-2.5-flash-lite" }));
  });

  it("falls back after a timeout abort without retrying the same model", async () => {
    const generateContent: GeminiGenerateContent = vi.fn(async (request) => {
      if (request.model === "gemini-2.5-flash") {
        const error = new Error("This operation was aborted");
        error.name = "AbortError";
        throw error;
      }

      return { text: JSON.stringify(validDecision()) };
    });
    const sleep = vi.fn(async () => undefined);

    const decision = await generateTradeDecisionWithFallback(context(), {
      generateContent,
      models: ["gemini-2.5-flash", "gemini-2.5-flash-lite"],
      sleep,
    });

    expect(decision.action).toBe("HOLD");
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("does not fall back on a malformed response", async () => {
    const generateContent = vi.fn(async () => ({ text: "not-json" }));

    await expect(
      generateTradeDecisionWithFallback(context(), {
        generateContent,
        models: ["gemini-2.5-flash", "gemini-2.5-flash-lite"],
        sleep: async () => undefined,
      })
    ).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });

    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});
