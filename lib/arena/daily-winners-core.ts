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
  const rowsByAgent = new Map<string, DailyWinnerEquityRow[]>();

  for (const row of rows) {
    if (!Number.isFinite(row.equity) || !row.timestamp || !agentMeta.has(row.agent_id)) {
      continue;
    }

    const list = rowsByAgent.get(row.agent_id) ?? [];
    list.push(row);
    rowsByAgent.set(row.agent_id, list);
  }

  for (const [agentId, agentRows] of rowsByAgent) {
    const sorted = [...agentRows].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    const days = new Map<string, DayBucket>();
    let lastClose: number | null = null;

    for (const row of sorted) {
      const dayKey = utcDayKeyFromIso(row.timestamp);

      if (!dayKey) {
        continue;
      }

      const existing = days.get(dayKey);

      if (!existing) {
        const openEquity = lastClose ?? row.equity;
        days.set(dayKey, { openEquity, closeEquity: row.equity });
      } else {
        existing.closeEquity = row.equity;
      }

      lastClose = row.equity;
    }

    byAgent.set(agentId, days);
  }

  return byAgent;
}

const MEANINGFUL_PNL_USD = 0.5;
const INTRADAY_SPIKE_RATIO = 1.32;
const MAX_DAILY_GAIN_FRACTION = 0.28;

/** Drops corrupt same-day equity jumps (e.g. bad snapshot after bad fills). */
export function stabilizeIntradayEquitySpikes(rows: readonly DailyWinnerEquityRow[]): DailyWinnerEquityRow[] {
  const groups = new Map<string, DailyWinnerEquityRow[]>();

  for (const row of rows) {
    const dayKey = utcDayKeyFromIso(row.timestamp);

    if (!dayKey) {
      continue;
    }

    const key = `${row.agent_id}:${dayKey}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const stabilized: DailyWinnerEquityRow[] = [];

  for (const group of groups.values()) {
    const sorted = [...group].sort((left, right) => left.timestamp.localeCompare(right.timestamp));

    if (sorted.length <= 1) {
      stabilized.push(...sorted);
      continue;
    }

    const min = Math.min(...sorted.map((row) => row.equity));
    const max = Math.max(...sorted.map((row) => row.equity));

    if (max <= min * INTRADAY_SPIKE_RATIO) {
      stabilized.push(...sorted);
      continue;
    }

    const credible = sorted.filter((row) => row.equity <= min * 1.1);

    if (credible.length > 0) {
      stabilized.push(credible.at(-1)!);
      continue;
    }

    stabilized.push(sorted[0]!);
  }

  return stabilized.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

function isCredibleDailyPnl(entry: DailyWinnerEntry, initialCapital: number): boolean {
  const base = initialCapital > 0 ? initialCapital : 10_000;

  if (entry.dailyPnl > base * MAX_DAILY_GAIN_FRACTION) {
    return false;
  }

  if (entry.dailyPnlPercent > MAX_DAILY_GAIN_FRACTION * 100) {
    return false;
  }

  return true;
}

export function pickDailyWinners(
  byAgent: Map<string, Map<string, DayBucket>>,
  agentMeta: ReadonlyMap<string, { name: string; mark: AgentMark; strategy: string }>,
  initialCapitalByAgent: ReadonlyMap<string, number> = new Map()
): DailyWinnerEntry[] {
  const dayKeys = new Set<string>();

  for (const days of byAgent.values()) {
    for (const dayKey of days.keys()) {
      dayKeys.add(dayKey);
    }
  }

  const winners: DailyWinnerEntry[] = [];

  for (const dayKey of dayKeys) {
    const candidates: DailyWinnerEntry[] = [];

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

      candidates.push({
        dayKey,
        agentId,
        agentName: meta.name,
        strategy: meta.strategy,
        mark: meta.mark,
        openEquity: bucket.openEquity,
        closeEquity: bucket.closeEquity,
        dailyPnl,
        dailyPnlPercent,
      });
    }

    if (candidates.length === 0) {
      continue;
    }

    const hasGain = candidates.some((candidate) => candidate.dailyPnl > MEANINGFUL_PNL_USD);
    const hasLoss = candidates.some((candidate) => candidate.dailyPnl < -MEANINGFUL_PNL_USD);

    let pool = candidates;

    if (!hasGain && hasLoss) {
      pool = candidates.filter((candidate) => candidate.dailyPnl < -MEANINGFUL_PNL_USD);
    }

    const credible = pool.filter((candidate) =>
      isCredibleDailyPnl(candidate, initialCapitalByAgent.get(candidate.agentId) ?? 10_000)
    );

    if (credible.length > 0) {
      pool = credible;
    }

    pool.sort((left, right) => {
      if (right.dailyPnl !== left.dailyPnl) {
        return right.dailyPnl - left.dailyPnl;
      }

      return right.closeEquity - left.closeEquity;
    });

    const best = pool[0];

    if (best) {
      winners.push(best);
    }
  }

  return winners.sort((left, right) => right.dayKey.localeCompare(left.dayKey));
}
