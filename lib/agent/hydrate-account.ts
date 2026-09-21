import "server-only";

import { mapTradeRow, unwrapAccountPayload, type PersistedAgentRow } from "@/lib/agent/persist";
import { MOMENTUM_ALPHA_AGENT } from "@/lib/agent/constants";
import { findAgentDefinition } from "@/lib/agents/registry";
import { createPaperAccount } from "@/lib/paper/portfolio";
import type { PaperAccount } from "@/lib/paper/types";
import type { SupportedSymbol } from "@/lib/market/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type PositionRow = {
  symbol: string;
  quantity: number;
  average_entry_price: number;
};

function initialCapitalFor(agentId: string, fallback: number): number {
  return findAgentDefinition(agentId)?.initialCapital ?? fallback;
}

async function loadTradesAndPositions(
  client: SupabaseClient,
  agentId: string
): Promise<Pick<PaperAccount, "positions" | "trades">> {
  const [positionsResult, tradesResult] = await Promise.all([
    client
      .from("positions")
      .select("symbol, quantity, average_entry_price")
      .eq("agent_id", agentId),
    client
      .from("trades")
      .select("id, symbol, side, quantity, price, notional, realized_pnl, decision_id, created_at")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: true }),
  ]);

  if (positionsResult.error) {
    throw new Error(`hydrate positions: ${positionsResult.error.message}`);
  }

  if (tradesResult.error) {
    throw new Error(`hydrate trades: ${tradesResult.error.message}`);
  }

  const positions = ((positionsResult.data as PositionRow[] | null) ?? []).map((row) => ({
    symbol: row.symbol as SupportedSymbol,
    quantity: row.quantity,
    averageEntryPrice: row.average_entry_price,
  }));

  const trades = ((tradesResult.data as Parameters<typeof mapTradeRow>[0][] | null) ?? []).map(mapTradeRow);

  return { positions, trades };
}

/**
 * Dashboard reads: scalars from account_payload (small after slim writes) plus
 * normalized positions/trades tables instead of embedding trade history in JSONB.
 */
export async function loadPaperAccountForDashboard(
  client: SupabaseClient,
  agentId: string,
  agent: PersistedAgentRow
): Promise<PaperAccount> {
  const unwrapped = unwrapAccountPayload(agent.account_payload);
  const { positions, trades } = await loadTradesAndPositions(client, agentId);

  if (trades.length > 0 || positions.length > 0) {
    return {
      initialCapital: unwrapped.account.initialCapital,
      cash: unwrapped.account.cash,
      peakEquity: unwrapped.account.peakEquity,
      realizedPnl: unwrapped.account.realizedPnl,
      positions,
      trades,
    };
  }

  return unwrapped.account;
}

/** Execution reads: same tables, full trade history required for paper engine correctness. */
export async function loadPaperAccountForExecution(
  client: SupabaseClient,
  agentId: string,
  agent: PersistedAgentRow
): Promise<PaperAccount> {
  const dashboard = await loadPaperAccountForDashboard(client, agentId, agent);
  const legacy = unwrapAccountPayload(agent.account_payload).account;

  if (dashboard.trades.length > 0) {
    return dashboard;
  }

  if (legacy.trades.length > 0) {
    return legacy;
  }

  return {
    ...dashboard,
    initialCapital: dashboard.initialCapital || initialCapitalFor(agentId, MOMENTUM_ALPHA_AGENT.initialCapital),
  };
}
