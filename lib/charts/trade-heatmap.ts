import type { TradeCheck } from "@/lib/agent/trade-outcomes";

export type TradeCheckTone = "win" | "loss" | "pending" | "hold" | "blocked";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export const HOURLY_GRID_DAYS = 7;

export function tradeCheckTone(check: Pick<TradeCheck, "kind" | "win">): TradeCheckTone {
  if (check.kind === "hold") {
    return "hold";
  }

  if (check.kind === "blocked") {
    return "blocked";
  }

  if (check.win === true) {
    return "win";
  }

  if (check.win === false) {
    return "loss";
  }

  return "pending";
}

export function tradeCheckMovePercent(fillPrice: number | null, checkPrice: number | null): number | null {
  if (checkPrice == null || fillPrice == null || !(fillPrice > 0)) {
    return null;
  }

  return ((checkPrice - fillPrice) / fillPrice) * 100;
}

export function sortTradeChecks(checks: readonly TradeCheck[]): TradeCheck[] {
  return [...checks].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
}

export type HourlyCheckRow = {
  /** UTC day, YYYY-MM-DD. */
  date: string;
  /** e.g. "Mon 9". */
  label: string;
  /** 24 slots, 00:00–23:00 UTC; null when the agent had no cycle that hour. */
  hours: Array<TradeCheck | null>;
};

export type TradeCheckSummary = {
  trades: number;
  confirmed: number;
  against: number;
  pending: number;
  held: number;
  blocked: number;
  /** Confirmed share of scored trades, null before the first scored trade. */
  hitRatePercent: number | null;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function rowLabel(day: Date): string {
  return `${WEEKDAYS[day.getUTCDay()]} ${day.getUTCDate()}`;
}

/**
 * Day rows × 24 UTC hour columns, one square per hourly cycle, covering the last
 * `days` days that end on the day of the newest check. UTC keeps the server and
 * client render identical.
 */
export function buildHourlyCheckGrid(checks: readonly TradeCheck[], days = HOURLY_GRID_DAYS): HourlyCheckRow[] {
  const byHour = new Map<number, TradeCheck>();

  for (const check of sortTradeChecks(checks)) {
    const hour = Date.parse(check.hourStart);

    if (Number.isFinite(hour)) {
      byHour.set(hour, check);
    }
  }

  if (byHour.size === 0) {
    return [];
  }

  const hours = [...byHour.keys()];
  const lastDay = Math.floor(Math.max(...hours) / DAY_MS) * DAY_MS;
  const firstDay = Math.max(Math.floor(Math.min(...hours) / DAY_MS) * DAY_MS, lastDay - (days - 1) * DAY_MS);
  const rows: HourlyCheckRow[] = [];

  for (let day = firstDay; day <= lastDay; day += DAY_MS) {
    rows.push({
      date: new Date(day).toISOString().slice(0, 10),
      label: rowLabel(new Date(day)),
      hours: Array.from({ length: 24 }, (_, hour) => byHour.get(day + hour * HOUR_MS) ?? null),
    });
  }

  return rows;
}

export function summarizeTradeChecks(checks: readonly TradeCheck[]): TradeCheckSummary {
  const count = (tone: TradeCheckTone) => checks.filter((check) => tradeCheckTone(check) === tone).length;
  const confirmed = count("win");
  const against = count("loss");
  const pending = count("pending");
  const scored = confirmed + against;

  return {
    trades: confirmed + against + pending,
    confirmed,
    against,
    pending,
    held: count("hold"),
    blocked: count("blocked"),
    hitRatePercent: scored > 0 ? (confirmed / scored) * 100 : null,
  };
}
