# AI Trading Arena --- Technical Specification

Version: 2.0\
Status: MVP implementation spec\
Target: Cursor / Next.js / Supabase / CoinMarketCap API

## 1. Product

AI Trading Arena is a paper-trading competition where autonomous AI
agents receive the same market data and compete using virtual capital.

Core premise:

> Give AI \$10,000. See what it does.

Each agent: 1. receives an immutable market snapshot 2. analyzes the
market 3. produces a structured BUY / SELL / HOLD decision 4. passes the
decision through deterministic risk rules 5. executes a paper trade if
approved 6. records the complete decision and resulting portfolio state
7. appears in the live Arena leaderboard

The AI must never directly mutate portfolio state.

------------------------------------------------------------------------

## 2. Architecture

``` text
CoinMarketCap
      ↓
Market Data Layer
      ↓
Immutable MarketSnapshot
      ↓
AI Strategy / Decision Layer
      ↓
Structured TradeDecision
      ↓
Deterministic Risk Engine
      ↓
Paper Trading Engine
      ↓
Supabase Postgres
      ↓
Supabase Realtime
      ↓
Next.js UI
```

Responsibilities:

-   CMC → market and intelligence data
-   AI → decision generation
-   Risk Engine → permission / constraints
-   Paper Engine → deterministic execution
-   Supabase → persistent state
-   Realtime → live activity
-   Next.js → product experience

------------------------------------------------------------------------

## 3. Stack

### Frontend

-   Next.js
-   TypeScript
-   Tailwind CSS
-   shadcn/ui
-   Recharts or equivalent lightweight charting library

### Backend

-   Supabase Postgres
-   Supabase Auth
-   Supabase Realtime
-   Supabase Edge Functions where useful

### AI

-   Google Gemini API
-   Official `@google/genai` JavaScript/TypeScript SDK
-   Structured JSON output
-   Default model: `gemini-3.1-flash-lite`
-   AI receives structured market facts, not raw database access

### Market data

-   CoinMarketCap API
-   CMC MCP / Agent infrastructure where appropriate

### Deployment

-   Vercel
-   Supabase

------------------------------------------------------------------------

## 4. MVP Scope

Initial supported assets:

``` text
BTC
ETH
SOL
BNB
XRP
```

Initial capital:

``` text
$10,000 virtual USD
```

Initial agent:

``` text
Momentum Alpha
```

Initial risk profile:

``` text
Risk: Medium
Max position: 20%
Max trade: 15%
Max daily loss: 5%
Max drawdown: 15%
Minimum cash: 10%
Max open positions: 3
Leverage: none
Shorting: none
```

Decision cycle:

``` text
Every 15 minutes
```

MVP does NOT include: - real exchange execution - real user funds -
leverage - shorting - complex derivatives trading - user-created
strategies - backtesting - agent marketplace

These can be added later.

------------------------------------------------------------------------

# 5. Market Data Layer

Create a provider abstraction so the rest of the application does not
depend directly on CMC implementation details.

``` ts
interface MarketDataProvider {
  getMarketSnapshot(
    symbols: string[]
  ): Promise<MarketSnapshot>
}
```

The provider should normalize CMC responses into a stable internal
structure.

------------------------------------------------------------------------

## 6. MarketSnapshot

The snapshot is immutable for a single agent cycle.

Example:

``` ts
type MarketSnapshot = {
  cycleId: string
  timestamp: string

  assets: AssetSnapshot[]

  market: {
    totalMarketCap?: number
    totalVolume24h?: number
    btcDominance?: number
    marketCapChange24h?: number
  }

  news?: NewsSignal[]
}
```

Asset:

``` ts
type AssetSnapshot = {
  symbol: string
  price: number
  marketCap?: number
  volume24h?: number

  change1h?: number
  change24h?: number
  change7d?: number

  rsi?: number
  macd?: string
  ema20?: number
  ema50?: number

  sentiment?: number
}
```

Important:

The exact fields available depend on the CMC endpoint/API access
available to the project. Keep optional fields optional.

Do not make new CMC AI endpoints a hard MVP dependency.

------------------------------------------------------------------------

# 7. AI Decision Layer

The AI only returns a structured decision.

Provider for Phase 4:

``` text
Google Gemini API
Official @google/genai SDK
GEMINI_API_KEY (server-side only)
GEMINI_MODEL=gemini-3.1-flash-lite
Structured JSON output matching TradeDecision
```

Do not use OpenAI. Do not use NEXT_PUBLIC_GEMINI_API_KEY.

It must NOT: - execute trades - change balances - bypass risk limits -
write directly to portfolio tables - invent market data

Schema:

``` ts
type TradeDecision = {
  action: "BUY" | "SELL" | "HOLD"
  symbol: "BTC" | "ETH" | "SOL" | "BNB" | "XRP"

  allocationPercent: number
  confidence: number

  stopLossPercent?: number
  takeProfitPercent?: number

  timeHorizon: "SHORT" | "MEDIUM" | "LONG"

  reasons: string[]
  riskFactors: string[]
}
```

Constraints:

``` text
allocationPercent: 0–100
confidence: 0–100
reasons: max 5
riskFactors: max 5
```

The explanation should be concise and grounded in observable inputs.

Do NOT store or display hidden chain-of-thought.

Use short decision reasons such as:

``` text
ETH has positive 7-day momentum.
Volume is increasing.
MACD remains bullish.
Broader market trend is positive.
```

------------------------------------------------------------------------

# 8. Initial Strategy --- Momentum Alpha

The first agent should be intentionally simple.

Goal:

> Follow strong short-term momentum while respecting portfolio risk.

Inputs: - 1h change - 24h change - 7d change - volume change - RSI -
MACD - EMA20 / EMA50 - market trend - sentiment/news where available

Conceptual prompt:

``` text
You are Momentum Alpha, an autonomous paper-trading agent.

Your objective is to maximize risk-adjusted portfolio growth.

Analyze the supplied market snapshot and current portfolio.

Prefer assets showing:
- positive multi-period momentum
- increasing volume
- bullish technical confirmation
- supportive broader market conditions

Avoid chasing extremely overextended moves.

Return exactly one structured TradeDecision.

You must obey the supplied portfolio and risk constraints.
Do not invent facts.
If there is no sufficiently strong setup, return HOLD.
```

The strategy logic should live separately from UI.

------------------------------------------------------------------------

# 9. AI Prompt Inputs

Send only the data required for the decision.

Example:

``` json
{
  "agent": {
    "name": "Momentum Alpha",
    "riskProfile": "medium"
  },
  "portfolio": {
    "cash": 4200,
    "positions": []
  },
  "market": {
    "assets": []
  },
  "constraints": {
    "maxPositionPercent": 20,
    "maxTradePercent": 15,
    "minimumCashPercent": 10
  }
}
```

Do not send: - birth data - personal information - unrelated database
data - secrets - API keys

------------------------------------------------------------------------

# 10. Risk Engine

The Risk Engine is deterministic.

AI suggests.

Risk Engine decides whether the suggestion is permitted.

Example checks:

``` text
Is action valid?
Is symbol supported?
Is allocation within max trade?
Would resulting position exceed max position?
Would cash fall below minimum cash?
Has daily loss limit been reached?
Has maximum drawdown been reached?
Is the agent paused?
Is the market snapshot valid?
```

Example:

``` ts
type RiskResult = {
  approved: boolean
  reason?: string
  adjustedAllocationPercent?: number
}
```

Example event:

``` text
RISK CHECK
Position size approved (12%)
```

Rejected example:

``` text
RISK CHECK
Rejected: maximum position size exceeded
```

Risk rules must not depend on an LLM.

------------------------------------------------------------------------

# 11. Paper Trading Engine

The Paper Trading Engine executes only approved decisions.

BUY:

``` text
cash decreases
position increases
trade is recorded
portfolio equity recalculated
```

SELL:

``` text
position decreases
cash increases
trade is recorded
portfolio equity recalculated
```

HOLD:

``` text
no trade
portfolio is marked-to-market
decision is recorded
```

Execution price should come from the market snapshot used by that cycle.

Never allow the AI to choose an arbitrary execution price.

------------------------------------------------------------------------

# 12. Portfolio Model

Example:

``` ts
type Portfolio = {
  cash: number
  equity: number
  realizedPnl: number
  unrealizedPnl: number
  returnPercent: number
  drawdownPercent: number
}
```

Position:

``` ts
type Position = {
  symbol: string
  quantity: number
  averageEntryPrice: number
  currentPrice: number
  marketValue: number
  unrealizedPnl: number
  allocationPercent: number
}
```

Portfolio equity:

``` text
cash + market value of all positions
```

------------------------------------------------------------------------

# 13. Stop Loss / Take Profit

Initial defaults:

``` text
Stop loss: 5%
Take profit: 10%
```

These should be evaluated deterministically against subsequent market
snapshots.

The AI can suggest different values within allowed bounds, but the
execution engine owns the actual logic.

------------------------------------------------------------------------

# 14. Agent Lifecycle

Each cycle:

``` text
1. CREATE cycle_id
2. FETCH market data
3. NORMALIZE data
4. CREATE immutable MarketSnapshot
5. LOAD agent portfolio
6. AI ANALYSIS
7. VALIDATE structured output
8. RUN RISK ENGINE
9. EXECUTE paper trade if approved
10. UPDATE portfolio
11. RECORD events
12. BROADCAST realtime events
```

Example:

``` text
09:41:58  ANALYZING
09:42:01  SIGNAL
09:42:04  NEWS
09:42:07  DECISION
09:42:09  RISK CHECK
09:42:10  TRADE EXECUTED
```

------------------------------------------------------------------------

# 15. Idempotency

Every cycle must have a unique ID.

Never execute the same cycle twice.

Use:

``` text
cycle_id
agent_id
timestamp
```

with an appropriate uniqueness constraint.

If an Edge Function retries, it should detect an already-completed cycle
before creating another trade.

------------------------------------------------------------------------

# 16. Database

Suggested tables:

``` text
agents
agent_cycles
market_snapshots
decisions
risk_checks
trades
positions
portfolio_snapshots
activity_events
```

------------------------------------------------------------------------

## agents

``` text
id
name
description
strategy
initial_capital
status
risk_profile
created_at
updated_at
```

Status:

``` text
ACTIVE
PAUSED
ERROR
```

------------------------------------------------------------------------

## agent_cycles

``` text
id
agent_id
started_at
completed_at
status
market_snapshot_id
error
```

------------------------------------------------------------------------

## market_snapshots

``` text
id
cycle_id
timestamp
payload
```

Store the normalized snapshot required to reproduce the decision.

------------------------------------------------------------------------

## decisions

``` text
id
agent_id
cycle_id
action
symbol
allocation_percent
confidence
stop_loss_percent
take_profit_percent
time_horizon
reasons
risk_factors
created_at
```

------------------------------------------------------------------------

## risk_checks

``` text
id
decision_id
approved
reason
adjusted_allocation_percent
created_at
```

------------------------------------------------------------------------

## trades

``` text
id
agent_id
decision_id
symbol
side
quantity
price
notional
created_at
```

------------------------------------------------------------------------

## positions

``` text
id
agent_id
symbol
quantity
average_entry_price
updated_at
```

------------------------------------------------------------------------

## portfolio_snapshots

``` text
id
agent_id
timestamp
cash
equity
realized_pnl
unrealized_pnl
return_percent
drawdown_percent
```

------------------------------------------------------------------------

## activity_events

``` text
id
agent_id
cycle_id
type
title
description
metadata
created_at
```

Event types:

``` text
ANALYZING
SIGNAL
NEWS
DECISION
RISK_CHECK
TRADE_EXECUTED
TRADE_REJECTED
ERROR
```

------------------------------------------------------------------------

# 17. Realtime

Use Supabase Realtime for:

-   activity feed
-   portfolio updates
-   leaderboard changes
-   trade execution
-   agent status

The frontend should subscribe to agent activity events.

When a trade executes: 1. insert event 2. update portfolio 3. update
leaderboard 4. broadcast/update UI

------------------------------------------------------------------------

# 18. Arena Leaderboard

Primary metrics:

``` text
Rank
Agent
Strategy
Equity
Return
Drawdown
Trades
Status
```

Rank primarily by return/equity according to the chosen competition
metric.

Do not call the result a prediction of real-world trading performance.

The leaderboard represents simulated performance under the Arena's rules
and time period.

------------------------------------------------------------------------

# 19. Agent Detail

Show:

``` text
Agent name
Strategy
Status

Equity
Return
Drawdown
Win Rate
Trades
```

Charts:

``` text
Equity curve
Portfolio allocation
```

Tabs:

``` text
Overview
Positions
Trades
Decisions
Activity
```

------------------------------------------------------------------------

# 20. Decision Detail

A decision should answer:

> What did the agent see, what did it decide, and what happened next?

Sections:

``` text
Trade Summary
Market Context
Key Reasons
Risk Factors
Sources
```

Example:

``` text
BUY ETH
$1,200
78% confidence

Price       $4,521
24h         +3.8%
7d          +8.2%
RSI         67
MACD        Bullish

Reasons:
01 ETH has positive 7-day momentum.
02 Volume is increasing.
03 MACD remains bullish.
04 Broader market trend is positive.

Risk:
RSI is elevated.
```

Do not expose hidden chain-of-thought.

------------------------------------------------------------------------

# 21. Decision Replay

This is a key differentiator.

For every decision, preserve the exact MarketSnapshot.

The UI should allow:

``` text
What the agent saw
↓
Signal
↓
Decision
↓
Risk check
↓
Execution
```

The same snapshot should always produce the same displayed historical
context.

------------------------------------------------------------------------

# 22. Security

Never expose secrets in the browser.

Server-side only:

``` text
CMC_API_KEY
GEMINI_API_KEY
GEMINI_MODEL
SUPABASE_SERVICE_ROLE_KEY
```

`GEMINI_API_KEY` is a server-side secret. Never expose it as
`NEXT_PUBLIC_GEMINI_API_KEY`. `GEMINI_MODEL` is server-side config and
defaults to `gemini-3.1-flash-lite`.

Use environment variables.

Never commit `.env`.

Public client variables should only contain safe values such as:

``` text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

------------------------------------------------------------------------

# 23. Error Handling

Agent states:

``` text
ACTIVE
PAUSED
ERROR
```

If CMC fails:

``` text
do not make a decision
do not execute a trade
record an error event
```

If AI fails:

``` text
do not execute a trade
record failed cycle
```

If risk validation fails:

``` text
do not execute
record rejection
```

Never silently continue with missing market data.

------------------------------------------------------------------------

# 24. Testing

Prioritize deterministic tests for:

### Paper trading

``` text
BUY reduces cash
SELL increases cash
HOLD does not trade
portfolio equity is correct
P&L is correct
```

### Risk

``` text
max position enforced
max trade enforced
minimum cash enforced
daily loss limit enforced
drawdown limit enforced
paused agent cannot trade
```

### Idempotency

``` text
same cycle cannot execute twice
```

### Decision schema

``` text
invalid action rejected
invalid symbol rejected
allocation outside range rejected
confidence outside range rejected
```

------------------------------------------------------------------------

# 25. Development Phases

## Phase 1 --- Foundation

Create: - Next.js app - Tailwind - shadcn/ui - Supabase client -
environment setup - visual design system

Goal:

``` text
App shell renders.
```

## Phase 2 --- CMC Integration

Implement:

``` text
MarketDataProvider
CMC adapter
MarketSnapshot
```

Goal:

``` text
BTC / ETH / SOL / BNB / XRP market data visible.
```

## Phase 3 --- Paper Trading

Implement: - portfolios - positions - trades - P&L - execution engine

Goal:

``` text
Manual simulated BUY / SELL works.
```

## Phase 4 --- AI

Implement: - structured TradeDecision - Gemini API integration via
`@google/genai` - Momentum Alpha - decision persistence

Use structured JSON output. Mock Gemini in tests.

Do not implement OpenAI. Do not let the AI execute trades. Do not
implement the Risk Engine, autonomous loop, or UI wiring yet.

Goal:

``` text
AI can produce a valid decision.
```

## Phase 5 --- Risk

Implement deterministic risk engine.

Goal:

``` text
AI suggestions cannot violate portfolio constraints.
```

## Phase 6 --- Agent Loop

Implement scheduled cycles.

Goal:

``` text
Agent automatically analyzes and trades.
```

## Phase 7 --- Realtime

Implement: - activity events - live updates - status changes

Goal:

``` text
The UI visibly reacts to agent activity.
```

## Phase 8 --- Arena

Implement: - leaderboard - agent detail - decision detail - portfolio
charts

Goal:

``` text
Competition is understandable in under 30 seconds.
```

## Phase 9 --- Polish

Add: - animations - decision replay - empty states - error states - demo
data - performance improvements

------------------------------------------------------------------------

# 26. Cursor Workflow

Cursor should implement the project in small phases.

Do not ask Cursor to build the entire application in one prompt.

Recommended sequence:

``` text
1. Foundation
2. Database
3. CMC provider
4. Paper engine
5. AI decision
6. Risk engine
7. Agent loop
8. Realtime
9. Arena UI
10. Polish
```

After every phase: - run the app - run tests - fix TypeScript errors -
inspect UI - commit changes

------------------------------------------------------------------------

# 27. Cursor Prompt --- Foundation

Use:

``` text
Read TECHNICAL_SPEC.md and AI_TRADING_ARENA_VISUAL_SYSTEM.md.

Implement Phase 1 only.

Create the Next.js + TypeScript application structure, Tailwind/shadcn setup, Supabase client configuration, environment variable handling, and the initial application shell.

Follow the visual design system exactly.

Do not implement trading logic yet.

When finished:
1. run TypeScript checks
2. run lint
3. ensure the app starts
4. summarize changed files
```

------------------------------------------------------------------------

# 28. Cursor Prompt --- CMC

``` text
Read TECHNICAL_SPEC.md.

Implement Phase 2 only.

Create the MarketDataProvider abstraction and CoinMarketCap implementation.

Normalize BTC, ETH and SOL into MarketSnapshot.

Do not connect the AI yet.
Do not implement trading yet.

Use server-side API access and environment variables.

Add tests for normalization and missing optional fields.
```

------------------------------------------------------------------------

# 29. Cursor Prompt --- Paper Engine

``` text
Read TECHNICAL_SPEC.md.

Implement Phase 3 only.

Create the deterministic paper trading engine, portfolio calculations, positions, trades and P&L.

Do not involve Gemini.

Write tests for BUY, SELL, HOLD, position sizing and portfolio equity.
```

------------------------------------------------------------------------

# 30. Cursor Prompt --- AI

``` text
Read TECHNICAL_SPEC.md.

Implement Phase 4 only.

Add Gemini structured JSON output via @google/genai and the Momentum Alpha decision layer.

Use GEMINI_API_KEY server-side only. Never use NEXT_PUBLIC_GEMINI_API_KEY.
Use GEMINI_MODEL=gemini-3.1-flash-lite.

The AI must return only the TradeDecision schema.

Mock Gemini in tests.

Do not allow the AI to directly modify portfolio state.
Do not implement OpenAI.
Do not implement the Risk Engine, autonomous loop, or UI wiring.

Persist decisions and concise reasons.

Do not store chain-of-thought.
```

------------------------------------------------------------------------

# 31. Cursor Prompt --- Risk

``` text
Read TECHNICAL_SPEC.md.

Implement Phase 5 only.

Create a deterministic Risk Engine.

Every AI decision must pass through the Risk Engine before execution.

Write comprehensive tests for all portfolio constraints.

The LLM must never override these rules.
```

------------------------------------------------------------------------

# 32. Cursor Prompt --- Agent Loop

``` text
Read TECHNICAL_SPEC.md.

Implement Phase 6 only.

Create the autonomous agent cycle:

market snapshot → AI decision → risk check → paper execution → events.

Make cycles idempotent using cycle_id.

Do not execute duplicate cycles.
```

------------------------------------------------------------------------

# 33. Cursor Prompt --- Realtime

``` text
Read TECHNICAL_SPEC.md and AI_TRADING_ARENA_VISUAL_SYSTEM.md.

Implement Phase 7.

Add Supabase Realtime for agent activity, portfolio updates and trade execution.

Implement the Live Activity timeline.

Follow the visual system and use subtle animation only.
```

------------------------------------------------------------------------

# 34. Cursor Prompt --- Arena

``` text
Read TECHNICAL_SPEC.md and AI_TRADING_ARENA_VISUAL_SYSTEM.md.

Implement Phase 8.

Build the four core experiences:

1. Arena
2. Agent Detail
3. Live Activity
4. Decision / Trade Detail

Prioritize information hierarchy and visual polish.

The product should feel like a premium autonomous trading terminal, not a generic crypto dashboard.
```

------------------------------------------------------------------------

# 35. Hackathon Demo

Target demo duration:

``` text
3–5 minutes
```

Flow:

``` text
1. Open Arena
2. Show agents competing
3. Open Momentum Alpha
4. Show current equity and positions
5. Open Live Activity
6. Show ANALYZING
7. Show SIGNAL
8. Show DECISION
9. Show RISK CHECK
10. Show TRADE EXECUTED
11. Open Decision Detail
12. Show market context + reasons
13. Show Decision Replay
14. Return to leaderboard
```

Final product message:

> Same market. Different agents. Different decisions.

------------------------------------------------------------------------

# 36. Future Features

After MVP:

### Strategy Lab

Allow users to create strategies such as:

``` text
Momentum
News
Contrarian
Macro
Mean Reversion
```

### Agent Marketplace

Users can publish and compare agents.

### Backtesting

Run an agent against historical snapshots.

### More assets

Expand beyond BTC / ETH / SOL / BNB / XRP.

### Agent vs Agent

Run identical market snapshots and compare decisions.

### Real trading

Only as a separate future product with explicit user controls and
appropriate safeguards.

------------------------------------------------------------------------

# 37. Product Principle

The most important architectural principle:

``` text
AI decides.
Risk Engine protects.
Paper Engine executes.
CMC provides data.
Supabase remembers.
UI tells the story.
```

Keep these responsibilities separate.

The product becomes compelling when the user can see the complete chain:

``` text
MARKET
  ↓
AI ANALYSIS
  ↓
SIGNAL
  ↓
DECISION
  ↓
RISK
  ↓
TRADE
  ↓
PORTFOLIO
  ↓
LEADERBOARD
```

That chain is the core experience of AI Trading Arena.
