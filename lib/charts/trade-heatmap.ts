import type { TradeCheck } from "@/lib/agent/trade-outcomes";

export type TradeCheckTone = "win" | "loss" | "pending" | "hold" | "blocked";

export type TradeCheckGroup = {
  date: string;
  label: string;
  checks: TradeCheck[];
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

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

export type TradeCheckDayCell = {
  date: string;
  checks: TradeCheck[];
};

export type TradeCheckWeekColumn = {
  weekStart: string;
  days: TradeCheckDayCell[];
};

export type TradeCheckContributionGrid = {
  columns: TradeCheckWeekColumn[];
  monthLabels: Array<{ columnIndex: number; label: string }>;
};

function startOfWeekSunday(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

function dateFromKey(key: string): Date {
  const [year, month, day] = key.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(year, month - 1, day);
}

/** GitHub-style grid: week columns × Sun–Sat rows, multiple checks stack inside a day cell. */
export function buildTradeCheckContributionGrid(
  checks: readonly TradeCheck[]
): TradeCheckContributionGrid {
  const sorted = sortTradeChecks(checks);

  if (sorted.length === 0) {
    return { columns: [], monthLabels: [] };
  }

  const checksByDay = new Map<string, TradeCheck[]>();

  for (const check of sorted) {
    const key = localDateKey(new Date(check.createdAt));
    const list = checksByDay.get(key) ?? [];
    list.push(check);
    checksByDay.set(key, list);
  }

  const dayKeys = [...checksByDay.keys()].sort();
  const rangeStart = startOfWeekSunday(dateFromKey(dayKeys[0]!));
  const rangeEnd = startOfWeekSunday(dateFromKey(dayKeys.at(-1)!));

  const columns: TradeCheckWeekColumn[] = [];
  const monthLabels: Array<{ columnIndex: number; label: string }> = [];
  let cursor = rangeStart;
  let columnIndex = 0;

  while (cursor.getTime() <= rangeEnd.getTime()) {
    const weekStartKey = localDateKey(cursor);
    const days: TradeCheckDayCell[] = [];

    for (let offset = 0; offset < 7; offset += 1) {
      const day = addDays(cursor, offset);
      const date = localDateKey(day);
      const dayChecks = checksByDay.get(date) ?? [];

      days.push({ date, checks: dayChecks });

      if (day.getDate() === 1) {
        const label = new Intl.DateTimeFormat("en-US", { month: "short" }).format(day);

        if (!monthLabels.some((entry) => entry.columnIndex === columnIndex && entry.label === label)) {
          monthLabels.push({ columnIndex, label });
        }
      }
    }

    columns.push({ weekStart: weekStartKey, days });
    cursor = addDays(cursor, 7);
    columnIndex += 1;
  }

  return { columns, monthLabels };
}

export function groupTradeChecksByDay(checks: readonly TradeCheck[]): TradeCheckGroup[] {
  const groups: TradeCheckGroup[] = [];

  for (const check of sortTradeChecks(checks)) {
    const date = localDateKey(new Date(check.createdAt));
    const current = groups.at(-1);

    if (!current || current.date !== date) {
      groups.push({
        date,
        label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
          new Date(check.createdAt)
        ),
        checks: [check],
      });
      continue;
    }

    current.checks.push(check);
  }

  return groups;
}
