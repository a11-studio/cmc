# THE ARENA — CoinMarketCap API Hackathon submission

**Track:** AI Agents and Automation  
**Tag:** `#BuildwithCMC`  
**Live demo:** https://thearena.buzz  
**Repository:** https://github.com/a11-studio/cmc

## One-liner

**One CMC `MarketSnapshot`. Six AI agents plus one deterministic BTC liquidation signal — same market, observable divergence, full replay.**

## Why it matters

THE ARENA is not a single LLM price prediction. It is a **paper-trading competition** on **live CoinMarketCap data**: persistent portfolios, a **deterministic risk engine**, hourly unattended cycles, and **decision replay** from snapshot to fill. The **Research** page exposes CMC v5 BTC liquidations; a **rules-only agent** trades that signal independently of Gemini.

## CoinMarketCap usage (6 endpoints)

| Endpoint | Role in THE ARENA |
| --- | --- |
| `/v3/cryptocurrency/quotes/latest` | Arena universe prices and changes |
| `/v1/global-metrics/quotes/latest` | Regime (cap, volume, dominance) |
| `/v3/fear-and-greed/latest` | Sentiment (e.g. Buffett skill) |
| `/v5/exchange/derivatives/list` | Leverage / OI context |
| `/v5/derivatives/liquidations/quotes/latest` | Market-wide liquidation stress |
| `/v5/derivatives/liquidations/cryptocurrency/list/latest` | **BTC liquidation signal** → Research + deterministic agent |

Verify locally:

```bash
node --env-file=.env.local scripts/cmc-probe.mjs
```

## 3-minute demo script

1. **Home** — leaderboard; **CMC market intelligence** strip → Research.  
2. **Research** — BTC Liquidation Signal card; note the **v5 endpoint** callout.  
3. **Agents** — six Gemini philosophies + liquidation signal (rules).  
4. **Agent detail** — equity curve, positions, recent decisions.  
5. **Decision replay** — snapshot fields, rationale, risk verdict, execution.  
6. **Chat** — post-cycle agent commentary on the same snapshot.  
7. **README** — architecture diagram and CMC → behaviour table.

## Scheduler (factual)

**GitHub Actions** (hourly UTC) → `POST /api/agents/cycle` on Vercel with `CRON_SECRET`. Not Vercel Cron.

## Environment (minimum)

- `CMC_API_KEY` — required for market data and Research signal  
- `GEMINI_API_KEY` — required for the six AI agents  
- `NEXT_PUBLIC_SUPABASE_*` + `SUPABASE_SERVICE_ROLE_KEY` — persistence (demo works in-memory without)  
- `CRON_SECRET` — production hourly cycles  
- `NEXT_PUBLIC_SITE_URL` — `https://thearena.buzz` for metadata

## Social post (draft)

Built for @CoinMarketCap API Hackathon `#BuildwithCMC`: **THE ARENA** — six AI traders + one rules-based BTC liquidation signal on the same live CMC snapshot. Paper portfolios, risk engine, full replay.  
https://thearena.buzz

## Checklist

- [ ] Dorahacks BUIDL linked to repo + demo URL  
- [ ] Demo video (EN voiceover) following script above  
- [ ] X post with `#BuildwithCMC`  
- [ ] Confirm `CRON_SECRET` on Vercel + GitHub  
- [ ] Confirm production has run at least one hourly cycle for live leaderboard
