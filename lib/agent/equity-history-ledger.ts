import "server-only";

import {
  anchorsFromPortfolioSnapshotRows,
  equityCurveFromTradeLedger,
  parseMarketSnapshotPayload,
  type PortfolioSnapshotAnchorRow,
} from "@/lib/agent/equity-from-ledger";
import { filterAgentPortfolioEquityHistoryForDisplay } from "@/lib/agent/portfolio-equity-display";
import { mapTradeRow } from "@/lib/agent/persist";
import type { MarketSnapshot } from "@/lib/market/types";
import type { Trade } from "@/lib/paper/types";
import type { EquityCurvePoint } from "@/types/arena";
import type { SupabaseClient } from "@supabase/supabase-js";

type LedgerAgentConfig = {
  id: string;
  initialCapital: number;
};

type TradeRowDb = Parameters<typeof mapTradeRow>[0] & { agent_id: string };

const MARKET_SNAPSHOT_CHUNK_SIZE = 80;
/** Cap JSONB payload fetches per request (Supabase statement timeout). */
const MARKET_SNAPSHOT_FETCH_CAP = 200;

function cycleNumberFromId(cycleId: string): number {
  const suffix = cycleId.split("-").pop() ?? "";
  const parsed = Number.parseInt(suffix, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}
const marketSnapshotCache = new Map<string, MarketSnapshot>();

function rememberMarketSnapshots(snapshots: Map<string, MarketSnapshot>) {
  for (const [cycleId, snapshot] of snapshots) {
    marketSnapshotCache.set(cycleId, snapshot);
  }

  while (marketSnapshotCache.size > 4_000) {
    const oldest = marketSnapshotCache.keys().next().value;

    if (oldest === undefined) {
      break;
    }

    marketSnapshotCache.delete(oldest);
  }
}

export function groupLedgerTradesByAgent(rows: readonly TradeRowDb[]): Map<string, Trade[]> {
  const grouped = new Map<string, Trade[]>();

  for (const row of rows) {
    const trade = mapTradeRow(row);
    const list = grouped.get(row.agent_id) ?? [];
    list.push(trade);
    grouped.set(row.agent_id, list);
  }

  for (const list of grouped.values()) {
    list.sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  }

  return grouped;
}

async function fetchMarketSnapshotsByCycleId(
  client: SupabaseClient,
  cycleIds: readonly string[]
): Promise<Map<string, MarketSnapshot>> {
  const unique = [...new Set(cycleIds.filter((id) => id.length > 0))];

  if (unique.length === 0) {
    return new Map();
  }

  const map = new Map<string, MarketSnapshot>();
  const missing: string[] = [];

  for (const cycleId of unique) {
    const cached = marketSnapshotCache.get(cycleId);

    if (cached) {
      map.set(cycleId, cached);
    } else {
      missing.push(cycleId);
    }
  }

  for (let offset = 0; offset < missing.length; offset += MARKET_SNAPSHOT_CHUNK_SIZE) {
    const chunk = missing.slice(offset, offset + MARKET_SNAPSHOT_CHUNK_SIZE);
    const { data, error } = await client
      .from("market_snapshots")
      .select("cycle_id, payload")
      .in("cycle_id", chunk);

    if (error) {
      console.warn(`equity ledger market snapshots chunk failed: ${error.message}`);
      continue;
    }

    for (const row of data ?? []) {
      const cycleId = typeof row.cycle_id === "string" ? row.cycle_id : "";

      if (!cycleId) {
        continue;
      }

      const parsed = parseMarketSnapshotPayload(cycleId, row.payload);

      if (parsed) {
        map.set(cycleId, parsed);
      }
    }
  }

  rememberMarketSnapshots(map);
  return map;
}

export async function fetchEquitySeriesFromLedgerByAgent(
  client: SupabaseClient,
  agents: readonly LedgerAgentConfig[],
  limit: number,
  tradesByAgent?: Map<string, Trade[]>
): Promise<Record<string, EquityCurvePoint[]>> {
  const agentIds = agents.map((agent) => agent.id);
  const initialCapitalByAgent = new Map(agents.map((agent) => [agent.id, agent.initialCapital]));
  const result: Record<string, EquityCurvePoint[]> = Object.fromEntries(
    agentIds.map((agentId) => [agentId, [] as EquityCurvePoint[]])
  );

  if (agentIds.length === 0) {
    return result;
  }

  let trades = tradesByAgent;

  if (!trades) {
    const { data, error } = await client
      .from("trades")
      .select(
        "id, agent_id, symbol, side, quantity, price, notional, realized_pnl, decision_id, created_at"
      )
      .in("agent_id", agentIds)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`equity ledger trades: ${error.message}`);
    }

    trades = groupLedgerTradesByAgent((data as TradeRowDb[] | null) ?? []);
  }

  const snapshotRowsByAgent = await Promise.all(
    agentIds.map(async (agentId) => {
      const { data, error } = await client
        .from("portfolio_snapshots")
        .select("timestamp, cycle_id")
        .eq("agent_id", agentId)
        .order("timestamp", { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`equity ledger portfolio snapshots: ${error.message}`);
      }

      return { agentId, rows: (data as PortfolioSnapshotAnchorRow[] | null) ?? [] };
    })
  );

  const allCycleIds = [
    ...new Set(
      snapshotRowsByAgent.flatMap(({ rows }) =>
        anchorsFromPortfolioSnapshotRows(rows, limit).map((anchor) => anchor.cycleId)
      )
    ),
  ]
    .sort((left, right) => cycleNumberFromId(right) - cycleNumberFromId(left))
    .slice(0, MARKET_SNAPSHOT_FETCH_CAP);
  const snapshotByCycleId = await fetchMarketSnapshotsByCycleId(client, allCycleIds);

  for (const { agentId, rows } of snapshotRowsByAgent) {
    const agentTrades = trades.get(agentId) ?? [];

    if (agentTrades.length === 0) {
      continue;
    }

    const anchors = anchorsFromPortfolioSnapshotRows(rows, limit);
    const initialCapital = initialCapitalByAgent.get(agentId) ?? 10_000;
    const points = equityCurveFromTradeLedger(
      initialCapital,
      agentTrades,
      anchors,
      snapshotByCycleId
    );

    result[agentId] = filterAgentPortfolioEquityHistoryForDisplay(agentId, points);
  }

  return result;
}

export async function fetchAgentEquityHistoryFromLedger(
  client: SupabaseClient,
  agentId: string,
  initialCapital: number,
  limit: number
): Promise<EquityCurvePoint[]> {
  const series = await fetchEquitySeriesFromLedgerByAgent(client, [{ id: agentId, initialCapital }], limit);
  return series[agentId] ?? [];
}
