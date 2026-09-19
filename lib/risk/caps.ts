import type { RiskConstraints } from "@/lib/risk/constraints";
import type { RiskCheckCode } from "@/lib/risk/types";

/** An upper bound on allocationPercent, plus the check it maps to when it binds. */
export type AllocationCap = {
  code: RiskCheckCode;
  max: number;
  detail: string;
};

export function roundReasonPercent(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * Caps on a BUY or SHORT. Shared by the risk engine and by the headroom the
 * agent is shown before it decides, so both read the same limits.
 */
export function openingAllocationCaps(input: {
  action: "BUY" | "SHORT";
  symbol: string;
  cashPercent: number;
  signedAllocationPercent: number;
  constraints: RiskConstraints;
}): AllocationCap[] {
  const { action, symbol, cashPercent, signedAllocationPercent, constraints } = input;

  const maxByPosition =
    action === "SHORT"
      ? constraints.maxPositionPercent + signedAllocationPercent
      : constraints.maxPositionPercent - signedAllocationPercent;

  const caps: AllocationCap[] = [
    {
      code: "MAX_TRADE_EXCEEDED",
      max: constraints.maxTradePercent,
      detail: `Max trade is ${constraints.maxTradePercent}% of equity`,
    },
    {
      code: "MAX_POSITION_EXCEEDED",
      max: maxByPosition,
      detail: `Remaining position room in ${symbol} is ${roundReasonPercent(Math.max(0, maxByPosition))}%`,
    },
  ];

  if (action === "BUY") {
    if (constraints.minCashPercent > 0) {
      caps.push({
        code: "MIN_CASH_BREACH",
        max: cashPercent - constraints.minCashPercent,
        detail: `Spending more would drop cash below ${constraints.minCashPercent}%`,
      });
    }

    caps.push({
      code: "LEVERAGE_FORBIDDEN",
      max: cashPercent,
      detail: "Spending more than cash would require leverage",
    });
  }

  return caps;
}

/** Caps on a SELL, expressed as a percent of the existing position. */
export function closingAllocationCaps(input: {
  marketValue: number;
  equity: number;
  constraints: RiskConstraints;
}): AllocationCap[] {
  const { marketValue, equity, constraints } = input;
  const maxTradeNotional = (constraints.maxTradePercent / 100) * equity;

  return [
    {
      code: "MAX_TRADE_EXCEEDED",
      max: marketValue <= 0 ? 0 : (maxTradeNotional / marketValue) * 100,
      detail: `Max trade is ${constraints.maxTradePercent}% of equity`,
    },
    {
      code: "SHORTING_FORBIDDEN",
      max: 100,
      detail: "Cannot sell more than 100% of the position",
    },
  ];
}

/** The tightest cap in the list, floored at zero. */
export function tightestCap(caps: readonly AllocationCap[]): number {
  return caps.reduce((limit, cap) => Math.max(0, Math.min(limit, cap.max)), Number.POSITIVE_INFINITY);
}
