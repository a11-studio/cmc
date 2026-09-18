// Probes every CoinMarketCap endpoint the Arena depends on and prints the live
// response. Used to produce the API-call evidence in the README, and to check a
// key quickly without booting the app.
//
// The endpoint paths mirror lib/market/cmc/client.ts.
//
//   node --env-file=.env.local scripts/cmc-probe.mjs

const BASE_URL = "https://pro-api.coinmarketcap.com";

// BTC, ETH, SOL, BNB, XRP — see lib/market/symbols.ts
const ARENA_IDS = "1,1027,5426,1839,52";

// CMC returns `quote` as a keyed object on v1/v2 and as an array on v3/v5, so
// the app tolerates both. Mirrors lib/market/normalize.ts.
function usdQuote(entry) {
  const quote = entry.quote ?? entry.quotes;

  if (Array.isArray(quote)) {
    return quote.find((item) => (item.symbol ?? item.convert_symbol) === "USD") ?? quote[0] ?? {};
  }

  return quote?.USD ?? {};
}

// `pick` narrows each response to the fields the Arena actually feeds into a
// snapshot, so the output doubles as documentation of what the agents see.
const ENDPOINTS = [
  {
    path: "/v3/cryptocurrency/quotes/latest",
    params: { id: ARENA_IDS, convert: "USD" },
    pick: (body) =>
      body.data.map((coin) => {
        const quote = usdQuote(coin);
        return {
          symbol: coin.symbol,
          price: quote.price,
          percent_change_24h: quote.percent_change_24h,
          volume_24h: quote.volume_24h,
        };
      }),
  },
  {
    path: "/v1/global-metrics/quotes/latest",
    params: { convert: "USD" },
    pick: (body) => ({
      btc_dominance: body.data.btc_dominance,
      total_market_cap: body.data.quote.USD.total_market_cap,
      total_volume_24h: body.data.quote.USD.total_volume_24h,
    }),
  },
  {
    path: "/v3/fear-and-greed/latest",
    params: {},
    pick: (body) => body.data,
  },
  {
    path: "/v5/exchange/derivatives/list",
    params: { convert: "USD", limit: "250" },
    pick: (body) => {
      const exchanges = body.data.exchanges ?? body.data;

      return {
        exchanges: exchanges.length,
        top_by_open_interest: exchanges
          .map((exchange) => ({
            exchange_name: exchange.exchange_name,
            open_interest: usdQuote(exchange).open_interest,
          }))
          .sort((left, right) => (right.open_interest ?? 0) - (left.open_interest ?? 0))
          .slice(0, 3),
      };
    },
  },
  {
    path: "/v5/derivatives/liquidations/quotes/latest",
    params: { convert: "USD" },
    pick: (body) => {
      const { total_liquidations_24h, long_liquidations_24h, short_liquidations_24h } = usdQuote(body.data);
      return { total_liquidations_24h, long_liquidations_24h, short_liquidations_24h };
    },
  },
];

const apiKey = process.env.CMC_API_KEY?.trim();

if (!apiKey) {
  console.error("CMC_API_KEY is not set. Try: node --env-file=.env.local scripts/cmc-probe.mjs");
  process.exit(1);
}

let failed = 0;

for (const { path, params, pick } of ENDPOINTS) {
  const url = new URL(path, BASE_URL);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  // The key travels in the X-CMC_PRO_API_KEY header, never in the URL, so this
  // line is safe to paste into a README.
  console.log(`\nGET ${url.toString()}`);

  const response = await fetch(url, {
    headers: { Accept: "application/json", "X-CMC_PRO_API_KEY": apiKey },
  });

  console.log(`${response.status} ${response.statusText}`);

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    failed += 1;
    console.log(JSON.stringify(body?.status ?? body, null, 2));
    continue;
  }

  console.log(JSON.stringify(pick(body), null, 2));
}

console.log(`\n${ENDPOINTS.length - failed}/${ENDPOINTS.length} endpoints responded 200.`);
process.exit(failed > 0 ? 1 : 0);
