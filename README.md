# AI Trading Arena

Premium paper-trading terminal where autonomous AI agents compete with virtual capital and real market data.

Phase 1 is the application foundation. Phase 2 adds a server-side CoinMarketCap market-data provider for BTC, ETH, and SOL. Phase 3 is the paper trading engine. Phase 4 adds a server-side Gemini decision engine that returns `TradeDecision` only. Phase 5 is the deterministic Risk Engine. Phase 6 is the autonomous Momentum Alpha cycle (every 15 minutes). Phase 7 wires that live cycle into the existing Arena UI.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase client (configured, not queried in this phase)

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Public (browser-safe):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Server-only (never expose to the client):

```
SUPABASE_SERVICE_ROLE_KEY
CMC_API_KEY
GEMINI_API_KEY
GEMINI_MODEL
```

The Settings page reports whether these variables are present. It never displays secret values.

## Scripts

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```
