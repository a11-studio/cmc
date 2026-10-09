import { latestEquityHistoryRows } from "@/lib/agent/equity-history-rows";
import { filterAgentPortfolioEquityHistoryForDisplay } from "@/lib/agent/portfolio-equity-display";
import type { EquityCurvePoint } from "@/types/arena";

export type DashboardEquityRow = {
  agent_id: string;
  equity: number;
  timestamp: string;
  cycle_id: string | null;
};

export type DashboardTradeAgentRow = {
  agent_id: string;
};

/** Same per-agent limits and display filters as the previous per-agent queries. */
export function buildEquitySeriesByAgent(
  rows: readonly DashboardEquityRow[],
  agentIds: readonly string[],
  limit: number
): Record<string, EquityCurvePoint[]> {
  const allowed = new Set(agentIds);
  const grouped = new Map<string, DashboardEquityRow[]>();

  for (const row of rows) {
    if (!allowed.has(row.agent_id)) {
      continue;
    }

    const list = grouped.get(row.agent_id) ?? [];
    list.push(row);
    grouped.set(row.agent_id, list);
  }

  const result: Record<string, EquityCurvePoint[]> = {};

  for (const agentId of agentIds) {
    const points = latestEquityHistoryRows(grouped.get(agentId) ?? [], limit).flatMap((row) => {
      if (typeof row.equity !== "number" || typeof row.timestamp !== "string") {
        return [];
      }

      return [
        {
          equity: row.equity,
          at: row.timestamp,
          label: typeof row.cycle_id === "string" ? row.cycle_id : undefined,
        },
      ];
    });

    result[agentId] = filterAgentPortfolioEquityHistoryForDisplay(agentId, points);
  }

  return result;
}

export function buildTradeCountsByAgent(
  rows: readonly DashboardTradeAgentRow[],
  agentIds: readonly string[]
): Map<string, number> {
  const counts = new Map(agentIds.map((agentId) => [agentId, 0]));

  for (const row of rows) {
    if (!counts.has(row.agent_id)) {
      continue;
    }

    counts.set(row.agent_id, (counts.get(row.agent_id) ?? 0) + 1);
  }

  return counts;
}
