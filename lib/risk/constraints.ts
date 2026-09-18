export const DEFAULT_RISK_CONSTRAINTS = {
  maxPositionPercent: 20,
  maxTradePercent: 15,
  minCashPercent: 10,
  maxDailyLossPercent: 5,
  maxDrawdownPercent: 15,
  maxOpenPositions: 3,
  leverage: false as const,
  shorting: true,
};

export type RiskConstraints = typeof DEFAULT_RISK_CONSTRAINTS;
