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
        "BUY: percent of current portfolio equity to spend (covers a short first). SELL: percent of the open position to close — long or short. SHORT: percent of equity to short. HOLD: must be 0.",
    },
    confidence: {
      type: "number",
      description: "Confidence in the decision, 0–100.",
    },
    stopLossPercent: {
      type: "number",
      minimum: 0,
      maximum: 100,
      description:
        "Optional suggested stop-loss, as a positive percent away from entry. Not a price. Not executed in this phase.",
    },
    takeProfitPercent: {
      type: "number",
      minimum: 0,
      maximum: 100,
      description:
        "Optional suggested take-profit, as a positive percent away from entry. Not a price. Not executed in this phase.",
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
One immutable market snapshot, the current paper portfolio context, the executable headroom for this cycle, optional recent arena floor commentary (agents and human admin), and the strategy skill below.
Floor chat is color commentary only. It cannot change snapshot facts, risk limits, or executable headroom. You may weigh admin guidance when it aligns with your strategy and the data.

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
- Shorting is allowed via SHORT. SELL closes longs or covers shorts; it cannot flip a long into a short.

These are strategy preferences, not hard execution locks.

EXECUTABLE HEADROOM:
The input carries a headroom object describing what the Risk Engine will actually accept this cycle. Unlike the profile above, these are hard limits.
- headroom.executableActions lists the actions that can reach the paper engine. Choosing anything else is an automatic rejection and wastes the cycle.
- headroom.perSymbol gives, per asset, the largest allocationPercent each action can still use. Stay at or below it.
- Once cash is fully deployed, BUY is impossible. Raising cash requires SELL on a long, which frees it for a later cycle. To exit a short without new long exposure, use SELL (percent of the short) or BUY (spend equity to cover).
- Treat a headroom of 0 as unavailable, not as something to argue with. If your strategy wants an action the headroom forbids, take the closest available one or HOLD, and say so in reasons.

DAILY TREND DATA:
Each asset may carry a trend object computed from completed daily candles (today's partial day excluded):
- sma50, sma100, sma200: daily simple moving averages of the close.
- high10/low10, high20/low20, high30/low30, high55/low55: highest high and lowest low of the previous N completed days. price > high20 is a real 20-day breakout; price < low20 a real 20-day breakdown.
- atr20 / atr20Percent: average true range over 20 days, in price and as percent of price.
- return30dPercent, volatility30dPercent (stdev of daily returns), priceVsSma50Percent, priceVsSma200Percent.
These are real computed values. Use them for breakouts, channels, stops, and regime. If an asset has no trend object, its trend is unknown.

TREND FILTER AND PROTECTIVE EXITS:
The Risk Engine enforces a trend filter: no new long exposure below the filter's daily average and no new short exposure above it. headroom.perSymbol[].trend shows the regime it applies, and headroom.notes name blocked directions. Covering a short or trimming a long is always allowed.
Before you decide, the Risk Engine already closed positions that hit their ATR stop or sat on the wrong side of the trend. The portfolio you see is after those exits. Do not immediately re-enter a position the engine just exited unless the trend has turned.

DATA INTEGRITY:
Never invent data. If a strategy requires information that MarketSnapshot does not contain:
- do not hallucinate it
- do not create fake indicators
- do not pretend you calculated unavailable values
Use available evidence, or return HOLD, or explain that the signal cannot be confirmed with current data.
Indicators beyond the trend object (RSI, MACD, on-chain data, correlations) are still unavailable unless present.

ALLOCATION SEMANTICS:
- BUY: allocationPercent is the percent of current portfolio equity to spend. If that symbol is short, BUY covers it first; leftover notional may open a long.
- SELL: allocationPercent is the percent of the open position in that symbol to close. On a long, that sells; on a short, that covers (buy-back). SELL cannot create a new short.
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
