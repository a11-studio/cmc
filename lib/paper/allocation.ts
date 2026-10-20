/** Gross market exposure (long and short legs count as deployed notional). */
export function grossDeployedNotional(positions: readonly { marketValue: number }[]): number {
  return positions.reduce((sum, position) => sum + Math.abs(position.marketValue), 0);
}

/** Equity not backing open positions — never exceeds equity (unlike ledger cash with shorts). */
export function unallocatedCashFromEquity(
  equity: number,
  positions: readonly { marketValue: number }[]
): number {
  if (!(equity > 0)) {
    return Math.max(0, equity);
  }

  return Math.max(0, equity - grossDeployedNotional(positions));
}

export function cashAllocationPercent(
  equity: number,
  positions: readonly { marketValue: number }[]
): number {
  if (!(equity > 0)) {
    return 100;
  }

  return (unallocatedCashFromEquity(equity, positions) / equity) * 100;
}
