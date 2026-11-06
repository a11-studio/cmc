export const DEFAULT_RISK_CONSTRAINTS = {
  maxPositionPercent: 100,
  maxTradePercent: 15,
  minCashPercent: 0,
  maxDailyLossPercent: 5,
  maxDrawdownPercent: 15,
  /**
   * Past maxDrawdownPercent the agent keeps trading in de-risk mode: new exposure is
   * allowed only while gross exposure stays at or below this percent of equity.
   * A hard block never lifts (the peak is all-time), so it froze every strategy
   * for good after its first normal 15% drawdown in the 2025–26 replay. 50% beat
   * 30% on both return and drawdown for the trend followers in that replay.
   */
  drawdownExposureCapPercent: 50 as number,
  /**
   * Gross exposure (sum of |position| as percent of equity) after a new long or
   * short. Longs were already bounded by cash, shorts were not: a short adds cash,
   * so three Turtle shorts reached 116% of equity in the Season 1 replay.
   */
  maxGrossExposurePercent: 100 as number,
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
