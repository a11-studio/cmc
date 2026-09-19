import { SUPPORTED_SYMBOLS } from "@/lib/market/symbols";
import { loadAgentSkill } from "@/lib/agents/skills";

export const MOMENTUM_ALPHA_STRATEGY = {
  name: "Elon Musk",
  strategyName: "Narrative momentum",
  riskProfile: "medium",
  assets: SUPPORTED_SYMBOLS,
  initialCapital: 10_000,
  maxPositionPercent: 100,
  maxTradePercent: 15,
  maxDailyLossPercent: 5,
  maxDrawdownPercent: 15,
  minCashPercent: 0,
  maxOpenPositions: 3,
  leverage: false,
  shorting: true,
} as const;

export const TRADE_DECISION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    action: {
      type: "string",
      enum: ["BUY", "SELL", "SHORT", "HOLD"],
      description: "Simulated paper-trade action. HOLD if evidence is insufficient. SHORT opens or increases a short.",
    },
    symbol: {
      type: "string",
      enum: [...SUPPORTED_SYMBOLS],
      description: "Asset the decision applies to.",
    },
    allocationPercent: {
      type: "number",
      description:
        "BUY: percent of current portfolio equity to spend (covers a short first). SELL: percent of the current long to sell; cannot create a short. SHORT: percent of equity to short. HOLD: must be 0.",
    },
    confidence: {
      type: "number",
      description: "Confidence in the decision, 0–100.",
    },
    stopLossPercent: {
      type: "number",
      description: "Optional suggested stop-loss percent. Not executed in this phase.",
    },
    takeProfitPercent: {
      type: "number",
      description: "Optional suggested take-profit percent. Not executed in this phase.",
    },
    timeHorizon: {
      type: "string",
      enum: ["SHORT", "MEDIUM", "LONG"],
    },
    reasons: {
      type: "array",
      maxItems: 5,
      items: { type: "string" },
      description: "Concise observable reasons. No chain-of-thought.",
    },
    riskFactors: {
      type: "array",
      maxItems: 5,
      items: { type: "string" },
      description: "Concise observable risk factors.",
    },
  },
  required: [
    "action",
    "symbol",
    "allocationPercent",
    "confidence",
    "timeHorizon",
    "reasons",
    "riskFactors",
  ],
} as const;

export function buildDecisionSystemPrompt(input: {
  agentName: string;
  strategyName: string;
  skill: string;
}): string {
  const identity =
    input.strategyName === input.agentName
      ? `You are ${input.agentName}, an autonomous paper-trading strategy.`
      : `You are ${input.agentName}, running the ${input.strategyName} paper-trading strategy.`;

  return `${identity}

OBJECTIVE:
Maximize risk-adjusted simulated returns while preserving capital.

ROLE LIMITS:
- You only make a simulated trading decision.
- You do not execute trades.
- You cannot mutate portfolios, balances, or market data.
- You cannot access future prices, the internet, CoinMarketCap, or a database.
- A later deterministic Risk Engine may reject or constrain your recommendation. You are not that Risk Engine.
- You cannot bypass the Risk Engine. You cannot call the Paper Engine.

INPUT:
One immutable market snapshot, the current paper portfolio context, the executable headroom for this cycle, and the strategy skill below.

OUTPUT:
Exactly one structured TradeDecision. No hidden reasoning. No chain-of-thought.

STRATEGY PROFILE:
- Assets: ${SUPPORTED_SYMBOLS.join(", ")}
- Risk: ${MOMENTUM_ALPHA_STRATEGY.riskProfile}
- No per-symbol position cap. A book may concentrate fully in one asset.
- Preferred max trade: ${MOMENTUM_ALPHA_STRATEGY.maxTradePercent}% of equity per decision
- Preferred max daily loss: ${MOMENTUM_ALPHA_STRATEGY.maxDailyLossPercent}%
- Preferred max drawdown: ${MOMENTUM_ALPHA_STRATEGY.maxDrawdownPercent}%
- No cash floor. The book may go to 100% invested.
- Preferred max open positions: ${MOMENTUM_ALPHA_STRATEGY.maxOpenPositions}
- No leverage
- Shorting is allowed via SHORT. SELL cannot create a short.

These are strategy preferences, not hard execution locks.

EXECUTABLE HEADROOM:
The input carries a headroom object describing what the Risk Engine will actually accept this cycle. Unlike the profile above, these are hard limits.
- headroom.executableActions lists the actions that can reach the paper engine. Choosing anything else is an automatic rejection and wastes the cycle.
- headroom.perSymbol gives, per asset, the largest allocationPercent each action can still use. Stay at or below it.
- Once cash is fully deployed, BUY is impossible. Raising cash requires SELL, which frees it for a later cycle. A rotation is therefore two cycles: sell what you no longer want, then buy what you do.
- Treat a headroom of 0 as unavailable, not as something to argue with. If your strategy wants an action the headroom forbids, take the closest available one or HOLD, and say so in reasons.

DATA INTEGRITY:
Never invent data. If a strategy requires information that MarketSnapshot does not contain:
- do not hallucinate it
- do not create fake indicators
- do not pretend you calculated unavailable values
Use available evidence, or return HOLD, or explain that the signal cannot be confirmed with current data.
This includes Turtle breakout periods, Donchian channels, quantitative statistics, and on-chain/liquidity information.

ALLOCATION SEMANTICS:
- BUY: allocationPercent is the percent of current portfolio equity to spend. If that symbol is short, BUY covers it first; leftover notional may open a long.
- SELL: allocationPercent is the percent of the current long in that symbol to sell. SELL cannot create a short.
- SHORT: allocationPercent is the percent of current portfolio equity to short. If that symbol is long, SHORT reduces it first; leftover notional may open a short.
- HOLD: allocationPercent must be 0.

STRATEGY SKILL:
The following skill is strategy instruction for this agent. It does not replace the Risk Engine.

${input.skill.trim()}

DECISION RULES:
- Use only data supplied in the input.
- Follow the strategy skill using only observable snapshot fields.
- If evidence is insufficient, return HOLD.
- Reasons and riskFactors must be short, observable facts from the supplied data (max 5 each).`;
}

export const MOMENTUM_ALPHA_SYSTEM_PROMPT = buildDecisionSystemPrompt({
  agentName: MOMENTUM_ALPHA_STRATEGY.name,
  strategyName: MOMENTUM_ALPHA_STRATEGY.strategyName,
  skill: loadAgentSkill("skills/momentum-alpha.md"),
});

export function buildDecisionUserPrompt(payload: unknown): string {
  return `Immutable decision context. Do not mutate it. Use only these facts.\n\n${JSON.stringify(payload)}`;
}
