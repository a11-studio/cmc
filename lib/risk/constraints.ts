export const DEFAULT_RISK_CONSTRAINTS = {
  maxPositionPercent: 100,
  maxTradePercent: 15,
  minCashPercent: 0,
  maxDailyLossPercent: 5,
  maxDrawdownPercent: 15,
  maxOpenPositions: 3,
  leverage: false as const,
  shorting: true,
  /**
   * Daily SMA length used as the trend filter (50, 100 or 200); 0 disables it.
   * No new long below it, no new short above it, and open positions on the wrong
   * side are closed before the agent decides.
   */
  trendFilterSma: 50 as number,
  /**
   * Largest allocation (percent of equity) a position may keep while it is on the
   * wrong side of the trend filter; 0 closes it fully. Trimming is idempotent: a
   * position already at or below this size is left alone.
   */
  trendExitMaxAllocationPercent: 0 as number,
  /** Protective stop distance from average entry, in multiples of daily ATR20; 0 disables it. */
  protectiveStopAtr: 2.5 as number,
};

export type RiskConstraints = typeof DEFAULT_RISK_CONSTRAINTS;
