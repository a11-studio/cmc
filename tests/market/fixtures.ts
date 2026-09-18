import type { CmcQuotesResponse } from "@/lib/market/cmc/types";

export const v3QuotesFixture: CmcQuotesResponse = {
  status: { error_code: 0, error_message: null },
  data: {
    "1": {
      id: 1,
      name: "Bitcoin",
      symbol: "BTC",
      cmc_rank: 1,
      quote: [
        {
          symbol: "USD",
          price: 97420.12,
          volume_24h: 28_400_000_000,
          market_cap: 1_920_000_000_000,
          percent_change_1h: 0.4,
          percent_change_24h: 1.8,
          percent_change_7d: 4.6,
          last_updated: "2026-09-17T08:00:00.000Z",
        },
      ],
    },
    "1027": {
      id: 1027,
      name: "Ethereum",
      symbol: "ETH",
      cmc_rank: 2,
      quote: [
        {
          symbol: "USD",
          price: 4521,
          volume_24h: 2_400_000_000,
          market_cap: 543_200_000_000,
          percent_change_1h: 0.9,
          percent_change_24h: 3.8,
          percent_change_7d: 8.2,
          last_updated: "2026-09-17T08:00:00.000Z",
        },
      ],
    },
    "5426": {
      id: 5426,
      name: "Solana",
      symbol: "SOL",
      cmc_rank: 5,
      quote: [
        {
          symbol: "USD",
          price: 178.42,
          volume_24h: 4_100_000_000,
          market_cap: 84_600_000_000,
          percent_change_1h: -0.3,
          percent_change_24h: -1.2,
          percent_change_7d: 2.1,
          last_updated: "2026-09-17T08:00:00.000Z",
        },
      ],
    },
    "1839": {
      id: 1839,
      name: "BNB",
      symbol: "BNB",
      cmc_rank: 4,
      quote: [
        {
          symbol: "USD",
          price: 612.4,
          volume_24h: 1_800_000_000,
          market_cap: 88_400_000_000,
          percent_change_1h: 0.1,
          percent_change_24h: 1.1,
          percent_change_7d: 3.2,
          last_updated: "2026-09-17T08:00:00.000Z",
        },
      ],
    },
    "52": {
      id: 52,
      name: "XRP",
      symbol: "XRP",
      cmc_rank: 3,
      quote: [
        {
          symbol: "USD",
          price: 2.31,
          volume_24h: 3_200_000_000,
          market_cap: 132_100_000_000,
          percent_change_1h: -0.2,
          percent_change_24h: 0.8,
          percent_change_7d: 2.6,
          last_updated: "2026-09-17T08:00:00.000Z",
        },
      ],
    },
  },
};

export const v1QuotesFixture = {
  status: { error_code: 0, error_message: null },
  data: {
    BTC: {
      id: 1,
      name: "Bitcoin",
      symbol: "BTC",
      quote: {
        USD: {
          price: 100000,
          volume_24h: 10,
          market_cap: 20,
          percent_change_1h: 1,
          percent_change_24h: 2,
          percent_change_7d: 3,
        },
      },
    },
    ETH: {
      id: 1027,
      name: "Ethereum",
      symbol: "ETH",
      quote: {
        USD: {
          price: 4000,
          volume_24h: 11,
          market_cap: 21,
          percent_change_1h: 1.1,
          percent_change_24h: 2.2,
          percent_change_7d: 3.3,
        },
      },
    },
    SOL: {
      id: 5426,
      name: "Solana",
      symbol: "SOL",
      quote: {
        USD: {
          price: 180,
          volume_24h: 12,
          market_cap: 22,
          percent_change_1h: -1,
          percent_change_24h: -2,
          percent_change_7d: -3,
        },
      },
    },
    BNB: {
      id: 1839,
      name: "BNB",
      symbol: "BNB",
      quote: {
        USD: {
          price: 600,
          volume_24h: 13,
          market_cap: 23,
          percent_change_1h: 0.5,
          percent_change_24h: 1.5,
          percent_change_7d: 2.5,
        },
      },
    },
    XRP: {
      id: 52,
      name: "XRP",
      symbol: "XRP",
      quote: {
        USD: {
          price: 2,
          volume_24h: 14,
          market_cap: 24,
          percent_change_1h: -0.4,
          percent_change_24h: 0.6,
          percent_change_7d: 1.2,
        },
      },
    },
  },
};

export const sparseQuotesFixture = {
  status: { error_code: 0, error_message: null },
  data: [
    {
      id: 1,
      symbol: "BTC",
      quote: [{ symbol: "USD", price: 50000 }],
    },
    {
      id: 1027,
      symbol: "ETH",
      quote: [{ symbol: "USD", price: 3000, percent_change_24h: null, market_cap: null }],
    },
    {
      id: 5426,
      symbol: "SOL",
      quote: [{ symbol: "USD", price: 100, percent_change_24h: 1.5 }],
    },
    {
      id: 1839,
      symbol: "BNB",
      quote: [{ symbol: "USD", price: 600 }],
    },
    {
      id: 52,
      symbol: "XRP",
      quote: [{ symbol: "USD", price: 2, percent_change_24h: 0.8 }],
    },
  ],
};
