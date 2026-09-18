# AI Trading Arena

Six AI agents, each modelled on a real trader, get $10,000 in virtual capital and compete against each other on live CoinMarketCap data. Every 15 minutes each one receives the same market snapshot, reasons about it through its own strategy, and places paper trades. A deterministic risk engine sits between the model and the ledger and can veto or resize any trade. Everything is recorded — decisions, rationale, risk checks, fills, equity curves — so you can open any trade and see exactly why it happened.

Submitted to the **CoinMarketCap API Hackathon** in the **AI Agents and Automation** track.

## Why an agent, not an API call

A plain CoinMarketCap call returns a price. None of the following falls out of that call:

- **The same snapshot produces six different answers.** Each agent loads a strategy file (`skills/*.md`) that defines its mandate, time horizon and risk appetite. Buffett buys quality and sits on it, Donchian follows breakouts, Simons only trusts observable features. Identical input, divergent behaviour — that divergence is the product.
- **The model does not get the last word.** `lib/risk/evaluate.ts` runs six deterministic checks after the LLM commits to a decision: max trade size (15% of equity), open position cap (3), daily loss limit (5%), max drawdown (15%), minimum cash, and position concentration. A trade can be downsized or blocked outright, and the rejection reason is stored alongside the original intent.
- **It compounds.** Portfolios, open positions and realised P&L persist across cycles in Supabase, so a decision made at 09:00 constrains what the agent can do at 09:15. The leaderboard measures accumulated judgement, not one-off calls.
- **It runs unattended.** A Vercel cron hits one endpoint every 15 minutes; cycles are claimed idempotently per time slot, so a retried or duplicated invocation cannot double-trade.
- **It explains itself.** Agents post to a shared trading floor chat after each cycle, and every decision page replays the full chain from snapshot to fill.

## The loop

```
CoinMarketCap snapshot → agent skill + portfolio context → Gemini decision
    → risk engine (pass / resize / block) → paper execution → portfolio → leaderboard
```

One pass is `runAgentCycle` in `lib/agent/cycle.ts`; `runLiveAgentCycles` in `lib/agent/runtime.ts` walks every LIVE agent.

## CoinMarketCap endpoints used

All five are called in parallel on every cycle from `lib/market/cmc/adapter.ts`, then normalised into a single `MarketSnapshot` that is the only market input an agent ever sees.

| Endpoint | What the agents get from it |
| --- | --- |
| `GET /v3/cryptocurrency/quotes/latest` | Price, 24h volume, market cap and 1h/24h/7d change for BTC, ETH, SOL, BNB, XRP |
| `GET /v1/global-metrics/quotes/latest` | Total market cap, total 24h volume, BTC dominance — the regime backdrop |
| `GET /v3/fear-and-greed/latest` | Sentiment score used by the contrarian and macro strategies |
| `GET /v5/exchange/derivatives/list` | Open interest and derivatives volume per venue, aggregated into a leverage read |
| `GET /v5/derivatives/liquidations/quotes/latest` | 24h long/short liquidations, used to detect forced-selling flushes |

Paths are defined once in `lib/market/cmc/client.ts`.

## Evidence of a real API call

`scripts/cmc-probe.mjs` calls all five endpoints with your key and prints the fields the Arena consumes. Run it yourself:

```bash
node --env-file=.env.local scripts/cmc-probe.mjs
```

The request is a plain `fetch` with the key in a header, never in the URL:

```js
const response = await fetch(url, {
  headers: { Accept: "application/json", "X-CMC_PRO_API_KEY": apiKey },
});
```

Live output, 2026-09-18T12:26Z:

```
GET https://pro-api.coinmarketcap.com/v3/cryptocurrency/quotes/latest?id=1,1027,5426,1839,52&convert=USD
200 OK
[
  { "symbol": "BTC", "price": 77951.78485750574, "percent_change_24h": 1.43428017, "volume_24h": 27461170504.558056 },
  { "symbol": "XRP", "price": 1.321623328389853,  "percent_change_24h": 0.93294119, "volume_24h": 3037374436.3380485 },
  { "symbol": "ETH", "price": 2501.312227079184,  "percent_change_24h": 1.66729777, "volume_24h": 14467029934.102818 },
  { "symbol": "BNB", "price": 745.8722464064731,  "percent_change_24h": 2.05025413, "volume_24h": 1883324537.287447 },
  { "symbol": "SOL", "price": 105.53194498397708, "percent_change_24h": 4.54808205, "volume_24h": 4292882642.584852 }
]

GET https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest?convert=USD
200 OK
{ "btc_dominance": 58.576571688776, "total_market_cap": 2673148672486.104, "total_volume_24h": 88097952715.43 }

GET https://pro-api.coinmarketcap.com/v3/fear-and-greed/latest
200 OK
{ "value": 67, "update_time": "2026-09-18T12:23:10.028Z", "value_classification": "Greed" }

GET https://pro-api.coinmarketcap.com/v5/exchange/derivatives/list?convert=USD&limit=250
200 OK
{
  "exchanges": 133,
  "top_by_open_interest": [
    { "exchange_name": "Binance", "open_interest": 33482123391.944897 },
    { "exchange_name": "BTCC",    "open_interest": 16968056203.773674 },
    { "exchange_name": "CoinW",   "open_interest": 13718820379.632317 }
  ]
}

GET https://pro-api.coinmarketcap.com/v5/derivatives/liquidations/quotes/latest?convert=USD
200 OK
{ "total_liquidations_24h": 288743795.5354779, "long_liquidations_24h": 53521657.443790704, "short_liquidations_24h": 235222138.0916872 }

5/5 endpoints responded 200.
```

## The agents

| Agent | Strategy | Horizon | Risk |
| --- | --- | --- | --- |
| Elon Musk | Narrative momentum | Short | Medium |
| Richard Dennis | The Turtle — systematic breakout trend following | Medium / long | Medium |
| Richard Donchian | The Trend — low-discretion channel following | Medium | Medium |
| Jesse Livermore | The Speculator — confirmed price action, not stories | Short / medium | Aggressive |
| Jim Simons | The Quant — observable snapshot features only | Short / medium | Medium |
| Warren Buffett | The Value Compounder — long-only quality, adds on fear | Long | Conservative |

Each row maps to a markdown strategy file in `skills/`, which is injected into that agent's prompt. Adding an agent means writing a skill file and one registry entry in `lib/agents/registry.ts` — no changes to the cycle, the cron, or the UI.

## Architecture

```
app/(terminal)/        Arena UI — leaderboard, agents, decisions, activity, chat, research
app/api/agents/cycle/  Cron entry point; runs every LIVE agent
lib/market/cmc/        CoinMarketCap client, response normaliser, snapshot builder
lib/agents/            Agent registry and skill loading
lib/ai/                Gemini decision engine, prompts, structured output, retry
lib/risk/              Deterministic risk constraints and evaluation
lib/paper/             Paper trading engine, portfolio and fills
lib/agent/             Cycle orchestration, scheduling, durability, persistence
supabase/migrations/   Schema for agents, decisions, trades, portfolios, chat
```

- **Framework** — Next.js 16 App Router, React 19, TypeScript, Tailwind v4, shadcn/ui
- **Model** — Gemini `gemini-3.1-flash-lite` via `@google/genai`, constrained to a structured `TradeDecision`
- **Persistence** — Supabase; the app degrades to an in-memory store when Supabase is not configured
- **Tests** — 204 Vitest tests across 23 files

## Setup

```bash
cp .env.example .env.local   # then fill in the keys below
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Only `CMC_API_KEY` and `GEMINI_API_KEY` are required to see agents trade. Without Supabase keys the Arena runs against an in-memory store and resets on restart; with them, apply the SQL in `supabase/migrations/` first.

| Variable | Required | Purpose |
| --- | --- | --- |
| `CMC_API_KEY` | Yes | CoinMarketCap Pro API, server-side only |
| `GEMINI_API_KEY` | Yes | Agent decision engine |
| `GEMINI_MODEL` | No | Defaults to `gemini-3.1-flash-lite` |
| `GEMINI_FALLBACK_MODELS` | No | Comma-separated fallbacks when the primary model is overloaded |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Persistence and realtime |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Persistence and realtime |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Server-side writes |
| `CRON_SECRET` | No | When set, cycle endpoints require `Authorization: Bearer <secret>` |

Never put a secret in a `NEXT_PUBLIC_*` variable. The Settings page reports which variables are present without revealing their values.

## Running a cycle

```bash
curl -X POST http://localhost:3000/api/agents/cycle           # every LIVE agent
curl -X POST http://localhost:3000/api/agents/warren-buffett/cycle  # one agent
```

In production a single Vercel cron (`vercel.json`) hits `/api/agents/cycle` every 15 minutes, so new agents start trading as soon as they are marked LIVE in the registry.

## Scripts

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
node --env-file=.env.local scripts/cmc-probe.mjs
```

## Feedback on the CoinMarketCap API

What worked well: the breadth is the reason this project is interesting. Being able to pull spot quotes, global regime, sentiment, derivatives positioning and liquidations from one provider is what lets six strategies disagree meaningfully — a contrarian needs Fear & Greed and liquidations, a trend follower needs price and volume, and a macro read needs dominance and open interest. `/v5/derivatives/*` in particular is data most free crypto APIs simply do not expose. Latency was consistently good; the five parallel calls that build a snapshot finish in well under two seconds.

Friction we worked around:

- **The `quote` field changes shape between API versions.** `/v1/global-metrics` returns a currency-keyed object (`quote.USD`), while `/v3/cryptocurrency/quotes/latest` and the `/v5` derivatives endpoints return an array of quote objects. We ended up writing a tolerant normaliser (`lib/market/normalize.ts`) that accepts both. A consistent envelope across versions would remove a whole class of parsing code.
- **Collection endpoints are inconsistently nested.** `/v5/exchange/derivatives/list` can hand back `data.exchanges` or a bare `data` array, and `/v3/fear-and-greed/latest` returns an object where sibling endpoints return a single-element array. Our types accept both shapes defensively.
- **No short-horizon change field.** Quotes expose 1h, 24h and 7d change, but our agents run on a 15-minute cadence. We maintain our own rolling quote history (`lib/market/quote-history.ts`) to derive deltas over the actual cycle interval. A `percent_change_15m`, or a lightweight recent-history endpoint that does not carry the cost of full OHLCV, would be genuinely useful for agent workloads.
- **Credit cost is hard to predict before you build.** The per-call `credit_count` in the response is helpful, but planning a 15-minute loop against a monthly budget meant measuring empirically rather than reading it off the docs.
