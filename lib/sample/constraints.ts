export const SAMPLE_DATA_LABEL = "Sample data";

export const MOMENTUM_ALPHA_CONSTRAINTS = {
  initialCapital: 10_000,
  maxPositionPercent: 20,
  maxTradePercent: 15,
  maxDailyLossPercent: 5,
  maxDrawdownPercent: 15,
  minCashPercent: 10,
  maxOpenPositions: 3,
  leverage: false,
  shorting: false,
} as const;

export type MomentumAlphaConstraints = typeof MOMENTUM_ALPHA_CONSTRAINTS;
