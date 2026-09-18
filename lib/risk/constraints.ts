export const DEFAULT_RISK_CONSTRAINTS = {
  maxPositionPercent: 100,
  maxTradePercent: 15,
  minCashPercent: 0,
  maxDailyLossPercent: 5,
  maxDrawdownPercent: 15,
  maxOpenPositions: 3,
  leverage: false as const,
  shorting: true,
};

export type RiskConstraints = typeof DEFAULT_RISK_CONSTRAINTS;
