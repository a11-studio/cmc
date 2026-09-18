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
