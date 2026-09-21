import type { AgentMark } from "@/types/arena";

export type DailyWinnerEntry = {
  dayKey: string;
  agentId: string;
  agentName: string;
  strategy: string;
  mark: AgentMark;
  openEquity: number;
  closeEquity: number;
  dailyPnl: number;
  dailyPnlPercent: number;
};

export type DailyWinnerEquityRow = {
  agent_id: string;
  equity: number;
  timestamp: string;
};

type DayBucket = {
  openEquity: number;
  closeEquity: number;
};

export function utcDayKeyFromIso(iso: string): string {
  const at = Date.parse(iso);

  if (!Number.isFinite(at)) {
    return "";
  }

  return new Date(at).toISOString().slice(0, 10);
}

export function buildDailyPnlByAgent(
  rows: readonly DailyWinnerEquityRow[],
  agentMeta: ReadonlyMap<string, { name: string; mark: AgentMark; strategy: string }>
): Map<string, Map<string, DayBucket>> {
  const byAgent = new Map<string, Map<string, DayBucket>>();

  for (const row of rows) {
    if (!(row.equity > 0) || !row.timestamp || !agentMeta.has(row.agent_id)) {
      continue;
    }

    const dayKey = utcDayKeyFromIso(row.timestamp);

    if (!dayKey) {
      continue;
    }

    let days = byAgent.get(row.agent_id);

    if (!days) {
      days = new Map();
      byAgent.set(row.agent_id, days);
    }

    const existing = days.get(dayKey);

    if (!existing) {
      days.set(dayKey, { openEquity: row.equity, closeEquity: row.equity });
      continue;
    }

    existing.closeEquity = row.equity;
  }

  return byAgent;
}

export function pickDailyWinners(
  byAgent: Map<string, Map<string, DayBucket>>,
  agentMeta: ReadonlyMap<string, { name: string; mark: AgentMark; strategy: string }>
): DailyWinnerEntry[] {
  const dayKeys = new Set<string>();

  for (const days of byAgent.values()) {
    for (const dayKey of days.keys()) {
      dayKeys.add(dayKey);
    }
  }

  const winners: DailyWinnerEntry[] = [];

  for (const dayKey of dayKeys) {
    let best: DailyWinnerEntry | null = null;

    for (const [agentId, days] of byAgent) {
      const bucket = days.get(dayKey);

      if (!bucket) {
        continue;
      }

      const meta = agentMeta.get(agentId);

      if (!meta) {
        continue;
      }

      const dailyPnl = bucket.closeEquity - bucket.openEquity;
      const dailyPnlPercent = bucket.openEquity > 0 ? (dailyPnl / bucket.openEquity) * 100 : 0;
      const candidate: DailyWinnerEntry = {
        dayKey,
        agentId,
        agentName: meta.name,
        strategy: meta.strategy,
        mark: meta.mark,
        openEquity: bucket.openEquity,
        closeEquity: bucket.closeEquity,
        dailyPnl,
        dailyPnlPercent,
      };

      if (
        !best ||
        candidate.dailyPnl > best.dailyPnl ||
        (candidate.dailyPnl === best.dailyPnl && candidate.closeEquity > best.closeEquity)
      ) {
        best = candidate;
      }
    }

    if (best) {
      winners.push(best);
    }
  }

  return winners.sort((left, right) => right.dayKey.localeCompare(left.dayKey));
}
