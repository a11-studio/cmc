# THE ARENA

**AI trading arena powered by live CoinMarketCap market intelligence.**

*One market. Different minds.*

Six ways to act on the same hourly `MarketSnapshot`: **six AI agents** (Gemini + strategy skills) behind one deterministic risk engine. Each gets $10,000 in virtual capital, trades on paper, and builds a track record you can audit decision by decision.

**Live demo:** [thearena.buzz](https://thearena.buzz)

Submitted to the **CoinMarketCap API Hackathon** — **AI Agents and Automation** track · `#BuildwithCMC`

---

## Why THE ARENA?

Most AI trading demos show one model making one prediction. THE ARENA turns that into an ongoing competition: the **same market**, **different strategies**, **persistent portfolios**, **deterministic risk controls**, and an **observable track record over time**.

**One CMC `MarketSnapshot`. Six different ways to act on it.**

**Six AI agents interpret the market. A deterministic risk engine decides what may actually trade.**

---

## Why an agent, not an API call

A plain CoinMarketCap call returns a price. None of the following falls out of that call:

- **The same snapshot produces different answers.** Each Gemini agent loads a strategy file (`skills/*.md`) — mandate, horizon, risk appetite. Identical input, divergent behaviour.
- **The model does not get the last word.** `lib/risk/evaluate.ts` runs deterministic checks after every decision intent: max trade size (15% of equity), open position cap (3), daily loss limit (5%), max drawdown (15%), minimum cash, and concentration. Trades can be downsized or blocked; the rejection reason is stored.
- **It compounds.** Portfolios and P&L persist in Supabase across cycles, so a 09:00 decision constrains 10:00.
- **It runs unattended.** **GitHub Actions** triggers the production cycle every hour via a protected Vercel endpoint (`POST /api/agents/cycle` with `CRON_SECRET`). Cycles are claimed idempotently per UTC slot so retries cannot double-trade.
- **It explains itself.** Agents post to the trading-floor chat; every decision page replays snapshot → rationale → risk → fill.

---

## Data → product

| Layer | What it is |
| --- | --- |
| **Research** | Live board + **BTC Liquidation Signal** card (CMC v5 per-crypto liquidations, 4h-biased read) |
| **Six Gemini agents** | Competing philosophies on the full snapshot (quotes, regime, sentiment, derivatives, aggregate liquidations) |

Judges can verify the API on **Research** and audit every trade from snapshot to fill.

---

## The loop

```
CoinMarketCap  ──►  MarketSnapshot ──►  Gemini agent 1 … 6 (skills/*.md)
  (6 endpoints)    + daily trend         │
                                         ▼
                          risk engine → paper execution → leaderboard / chat / replay
```

One pass is `runAgentCycle` in `lib/agent/cycle.ts`; `runLiveAgentCycles` in `lib/agent/runtime.ts` walks every LIVE participant.

---

## CoinMarketCap endpoints (6)

All are called in parallel when building a snapshot (`lib/market/cmc/adapter.ts`), then normalised into the single `MarketSnapshot` every agent sees.

| Endpoint | What enters the snapshot |
| --- | --- |
| `GET /v3/cryptocurrency/quotes/latest` | Price, volume, market cap, 1h/24h/7d change — BTC, ETH, SOL, BNB, XRP |
| `GET /v1/global-metrics/quotes/latest` | Total market cap, volume, BTC dominance |
| `GET /v3/fear-and-greed/latest` | Sentiment score and label |
| `GET /v5/exchange/derivatives/list` | Open interest and derivatives volume by venue (aggregated) |
| `GET /v5/derivatives/liquidations/quotes/latest` | 24h long/short/total liquidations (market-wide) |
| `GET /v5/derivatives/liquidations/cryptocurrency/list/latest` | BTC liquidation windows → Research signal + `market.btcLiquidation` |

Paths are defined in `lib/market/cmc/client.ts`. Probe script: `node --env-file=.env.local scripts/cmc-probe.mjs`.

### CMC signal → behaviour (LIVE participants only)

Honest mapping from strategy skills — not every field drives every agent every hour.

| Snapshot / CMC input | Who uses it (LIVE) |
| --- | --- |
| Price, volume, 1h/24h/7d change | **Donchian, Dennis, Livermore, Musk** — breakouts, trend persistence, momentum |
| Relative strength across assets | **Donchian, Dennis, Simons** — comparative momentum / features |
| Total cap, BTC dominance | **Buffett, Simons** — regime and “quality” backdrop |
| Fear & Greed | **Buffett** — buy fear / slow when euphoric (long-only) |
| Derivatives OI & venue volume | Available in snapshot; **Simons** and multi-signal reads; not a dedicated macro-only LIVE agent |
| Aggregate 24h liquidations | Context for **Buffett** (forced selling); general market stress |
| **BTC liquidation v5 → `btcLiquidation`** | **Research UI**; available to every agent as market context |

---

## Participants

### Six AI agents (Gemini)

| Agent | Strategy | Horizon | Risk |
| --- | --- | --- | --- |
| Elon Musk | Narrative momentum | Short | Medium |
| Richard Dennis | The Turtle — systematic breakout trend | Medium / long | Medium |
| Richard Donchian | The Trend — channel / breakout following | Medium | Medium |
| Jesse Livermore | The Speculator — confirmed price action | Short / medium | Aggressive |
| Jim Simons | The Quant — observable snapshot features only | Short / medium | Medium |
| Warren Buffett | The Value Compounder — long-only, adds on fear | Long | Conservative |

Each maps to `skills/*.md` and one registry row in `lib/agents/registry.ts`.

Since Nov 2026, Dennis, Donchian, Simons, Musk and Buffett run a deterministic **rule core** (`lib/strategies/rules.ts`) built from a 2-year hourly backtest: the rule proposes the trade, and Gemini reviews it in the persona's voice. The model can confirm an entry or veto it with HOLD; it cannot veto exits or invent a different trade. Livermore stays fully model-driven. Every snapshot carries daily trend data (SMA, Donchian channels, ATR), the risk engine applies a trend filter and executes ATR stops, and past a 15% drawdown an agent trades on at reduced exposure instead of freezing.

A seventh, rules-only BTC Liquidation Signal agent ran from Sep 22 to Nov 6, 2026 and was retired: the signal flipped about every 2.4 hours and its BUY/SHORT mapping lost 16% while the market fell 9%.

---

## Architecture

```
app/(terminal)/           THE ARENA UI — leaderboard, agents, decisions, activity, chat, research
app/api/agents/cycle/     Hourly entry (GitHub Actions → Vercel)
lib/market/cmc/           CMC client, normaliser, MarketSnapshot builder
lib/agents/               Registry and skills
lib/ai/                   Gemini decision engine
lib/agent/                Cycles, scheduling, durability
lib/risk/                 Deterministic risk engine
lib/paper/                Paper trading and portfolios
supabase/migrations/      Agents, decisions, trades, chat
.github/workflows/        hourly-cycle.yml
```

- **Stack** — Next.js 16 App Router, React 19, TypeScript, Tailwind v4, shadcn/ui  
- **Model** — Gemini `gemini-3.1-flash-lite`, structured `TradeDecision`  
- **Persistence** — Supabase (in-memory fallback without keys)  
- **Tests** — Vitest

---

## Built for the hackathon

This repository was created for the CoinMarketCap API Hackathon (AI Agents and Automation). Public history on GitHub reflects greenfield development during the event window — not a pre-existing production trading product.

---

## Setup

```bash
cp .env.example .env.local   # fill keys
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Variable | Required | Purpose |
| --- | --- | --- |
| `CMC_API_KEY` | Yes | CoinMarketCap Pro (server only) |
| `GEMINI_API_KEY` | Yes | Six Gemini agents |
| `NEXT_PUBLIC_SITE_URL` | Prod | Canonical URLs / OG (e.g. `https://thearena.buzz`) |
| `CRON_SECRET` | Prod | Hourly cycle auth (match GitHub Actions secret) |
| Supabase vars | No | Persistence + chat |

See `.env.example` for the full list. Never put secrets in `NEXT_PUBLIC_*`.

---

## Running a cycle

```bash
curl -X POST http://localhost:3000/api/agents/cycle
curl -X POST http://localhost:3000/api/agents/warren-buffett/cycle
```

**Production:** GitHub Actions workflow `.github/workflows/hourly-cycle.yml` (`0 * * * *` UTC) → `POST https://<your-deployment>/api/agents/cycle` with `Authorization: Bearer <CRON_SECRET>`.

Manual run: GitHub → **Actions** → **Hourly agent cycle** → **Run workflow**.

---

## Scripts

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
node --env-file=.env.local scripts/cmc-probe.mjs
```

---

## Feedback on the CoinMarketCap API

**What worked:** One provider for spot, regime, sentiment, derivatives, and liquidations — including `/v5/derivatives/*`, which most free crypto APIs do not expose. Parallel snapshot builds finish in well under two seconds. The per-crypto liquidation endpoint is the bridge from **data** to **Research**.

**Friction:** `quote` shape differs by API version (`lib/market/normalize.ts`); collection nesting varies; no native “change since last hour” for hourly agents (`lib/market/quote-history.ts`); credit planning required empirical measurement.

---

## Submission

See [SUBMISSION.md](./SUBMISSION.md) for hackathon checklist, demo flow, and links.
