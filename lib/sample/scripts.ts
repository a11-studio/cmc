import { SAMPLE_MARK_AT, SAMPLE_PRICES, type SamplePrices } from "@/lib/sample/market";
import type { SampleAgentDefinition, SampleStep } from "@/lib/sample/replay";

function px(btc: number, eth: number, sol: number): SamplePrices {
  const scale = btc / SAMPLE_PRICES.BTC;

  return {
    BTC: btc,
    ETH: eth,
    SOL: sol,
    BNB: Number((SAMPLE_PRICES.BNB * scale).toFixed(2)),
    XRP: Number((SAMPLE_PRICES.XRP * scale).toFixed(4)),
  };
}

function step(
  at: string,
  cycleId: string,
  prices: SamplePrices,
  rest: Omit<SampleStep, "at" | "cycleId" | "prices">
): SampleStep {
  return { at, cycleId, prices, ...rest };
}

const mark = (at: string, cycleId: string, prices: SamplePrices): SampleStep =>
  step(at, cycleId, prices, { action: "HOLD", symbol: "ETH" });

export const sampleAgentDefinitions: SampleAgentDefinition[] = [
  {
    id: "momentum-alpha",
    name: "Elon Musk",
    strategy: "Momentum",
    description: "Follows short-term trend while respecting position caps",
    status: "ACTIVE",
    mark: "momentum",
    steps: [
      step("2026-09-01T14:00:00.000Z", "ma-001", px(71_200, 2_008, 88.4), {
        action: "BUY",
        symbol: "BTC",
        allocationPercent: 12,
        confidence: 74,
        timeHorizon: "MEDIUM",
        reasons: ["BTC recovered above its 20-day trend.", "Breadth across majors is improving."],
        riskFactors: ["BTC remains volatile around session highs."],
      }),
      step("2026-09-04T18:00:00.000Z", "ma-002", px(72_850, 2_094, 91.2), {
        action: "BUY",
        symbol: "SOL",
        allocationPercent: 10,
        confidence: 71,
        reasons: ["SOL is catching up to BTC strength.", "Volume is expanding on the bounce."],
        riskFactors: ["SOL can reverse quickly after short squeezes."],
      }),
      mark("2026-09-08T11:20:00.000Z", "ma-003", px(74_100, 2_180, 94.1)),
      step("2026-09-12T16:45:00.000Z", "ma-004", px(75_200, 2_290, 96.8), {
        action: "SELL",
        symbol: "SOL",
        allocationPercent: 100,
        confidence: 69,
        reasons: ["SOL extended quickly versus BTC.", "Lock in a realized gain inside the trade-size cap."],
        riskFactors: ["Selling strength may miss a further squeeze."],
      }),
      mark("2026-09-14T09:00:00.000Z", "ma-005", px(75_640, 2_338, 97.9)),
      step("2026-09-16T21:04:00.000Z", "ma-006", px(76_120, 2_398, 99.1), {
        action: "BUY",
        symbol: "ETH",
        allocationPercent: 12,
        confidence: 76,
        reasons: ["ETH has positive 7-day momentum.", "The broader market trend is still higher."],
        riskFactors: ["RSI is rising into the low sixties."],
      }),
      mark("2026-09-17T04:30:00.000Z", "ma-007", px(76_340, 2_420, 98.7)),
      step("2026-09-17T08:12:00.000Z", "ma-008", px(76_480, 2_432, 102.4), {
        action: "BUY",
        symbol: "SOL",
        allocationPercent: 8,
        confidence: 68,
        reasons: ["SOL breakout is holding above the prior day's range."],
        riskFactors: ["Intraday SOL spikes often fade."],
      }),
      step("2026-09-17T09:42:10.000Z", "ma-009", px(76_550, 2_438.4, 101.2), {
        action: "BUY",
        symbol: "ETH",
        allocationPercent: 6,
        confidence: 78,
        timeHorizon: "SHORT",
        decisionId: "dec_eth_buy",
        featureActivity: true,
        stopLossPercent: 5,
        takeProfitPercent: 10,
        reasons: [
          "ETH has positive 7-day momentum.",
          "Volume is increasing.",
          "MACD remains bullish.",
          "Broader market trend is positive.",
        ],
        riskFactors: ["RSI is elevated."],
      }),
      mark(SAMPLE_MARK_AT, "ma-010", SAMPLE_PRICES),
    ],
  },
];
