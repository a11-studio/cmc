import type { TradeCheck } from "@/lib/agent/trade-outcomes";

export const HEATMAP_WEEKS = 53;

export type HeatmapTone = "empty" | "win" | "loss" | "mixed";

export type HeatmapCell = {
  date: string;
  future: boolean;
  wins: number;
  losses: number;
  tone: HeatmapTone;
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
};

export type HeatmapMonth = {
  label: string;
  weekIndex: number;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function heatmapLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) {
    return 0;
  }

  if (count >= 4) {
    return 4;
  }

  return count as 1 | 2 | 3;
}

export function cellTone(wins: number, losses: number): HeatmapTone {
  if (wins === 0 && losses === 0) {
    return "empty";
  }

  if (wins > losses) {
    return "win";
  }

  if (losses > wins) {
    return "loss";
  }

  return "mixed";
}

export function buildTradeHeatmap(
  checks: readonly TradeCheck[],
  now = new Date()
): { weeks: HeatmapCell[][]; months: HeatmapMonth[]; confirmed: number; against: number } {
  const today = startOfLocalDay(now);
  const weekday = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(today.getDate() - ((HEATMAP_WEEKS - 1) * 7 + weekday));

  const byDay = new Map<string, { wins: number; losses: number }>();

  for (const check of checks) {
    const key = localDateKey(new Date(check.createdAt));
    const current = byDay.get(key) ?? { wins: 0, losses: 0 };

    if (check.win) {
      current.wins += 1;
    } else {
      current.losses += 1;
    }

    byDay.set(key, current);
  }

  const weeks: HeatmapCell[][] = Array.from({ length: HEATMAP_WEEKS }, () => []);
  const months: HeatmapMonth[] = [];
  let lastMonth = "";
  const todayKey = localDateKey(today);

  for (let index = 0; index < HEATMAP_WEEKS * 7; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = localDateKey(date);
    const stats = byDay.get(key) ?? { wins: 0, losses: 0 };
    const weekIndex = Math.floor(index / 7);
    const month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
    const future = key > todayKey;

    if (index === 0 || (date.getDate() === 1 && month !== lastMonth)) {
      months.push({ label: month, weekIndex });
      lastMonth = month;
    }

    weeks[weekIndex]?.push({
      date: key,
      future,
      wins: future ? 0 : stats.wins,
      losses: future ? 0 : stats.losses,
      tone: future ? "empty" : cellTone(stats.wins, stats.losses),
      level: future ? 0 : heatmapLevel(stats.wins + stats.losses),
      label: new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(date),
    });
  }

  return {
    weeks,
    months,
    confirmed: checks.filter((check) => check.win).length,
    against: checks.filter((check) => !check.win).length,
  };
}
