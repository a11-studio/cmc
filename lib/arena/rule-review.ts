import "server-only";

import { ARENA_SEASON_START } from "@/lib/agent/season";
import { listLiveAgents } from "@/lib/agents/registry";
import {
  STOP_EXIT_TITLE,
  summarizeRuleReview,
  TREND_EXIT_TITLE,
  type ProtectiveExitRow,
  type RuleDecisionRow,
  type RuleReviewSummary,
  type VetoPriceCheck,
} from "@/lib/arena/rule-review-core";
import { isSupabasePersistenceConfigured } from "@/lib/env.server";
import { normalizeSymbol } from "@/lib/market/symbols";
import { parseRuleCoreOutcome, parseVetoedProposal } from "@/lib/strategies/rule-core";
import { hasRuleCore } from "@/lib/strategies/rules";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { RuleReviewSummary } from "@/lib/arena/rule-review-core";

export const RULE_REVIEW_WINDOW_DAYS = 14;
/** How long after a veto its counterfactual is measured. */
export const VETO_CHECK_HOURS = 24;
const MAX_VETO_CHECKS = 30;

type AssetPriceRow = { timestamp: string; assets: { symbol: string; price: number }[] | null };

function priceOf(row: AssetPriceRow | null, symbol: string): number | undefined {
  const asset = row?.assets?.find((entry) => normalizeSymbol(entry.symbol) === symbol);
  return asset && asset.price > 0 ? asset.price : undefined;
}

async function vetoCheck(
  client: SupabaseClient,
  decision: RuleDecisionRow,
  symbol: string
): Promise<VetoPriceCheck | null> {
  const checkAt = new Date(Date.parse(decision.created_at) + VETO_CHECK_HOURS * 3_600_000).toISOString();
  const columns = "timestamp, assets:payload->assets";

  const [entryResult, laterResult, latestResult] = await Promise.all([
    client.from("market_snapshots").select(columns).eq("cycle_id", decision.cycle_id).maybeSingle(),
    client.from("market_snapshots").select(columns).gte("timestamp", checkAt).order("timestamp", { ascending: true }).limit(1),
    client.from("market_snapshots").select(columns).order("timestamp", { ascending: false }).limit(1),
  ]);

  if (entryResult.error || laterResult.error || latestResult.error) {
    return null;
  }

  // Before 24 hours have passed, measure against the newest snapshot so far.
  const later = ((laterResult.data as AssetPriceRow[] | null)?.[0] ?? (latestResult.data as AssetPriceRow[] | null)?.[0]) ?? null;
  const entryPrice = priceOf(entryResult.data as AssetPriceRow | null, symbol);
  const laterPrice = priceOf(later, symbol);

  if (!later || entryPrice == null || laterPrice == null || Date.parse(later.timestamp) <= Date.parse(decision.created_at)) {
    return null;
  }

  return { entryPrice, laterPrice, laterAt: later.timestamp };
}

/**
 * How the rule cores behaved over the last two weeks: rule holds, model confirmations
 * and vetoes, executions without review, protective exits, and what each veto cost
 * or saved 24 hours later.
 */
export async function fetchRuleReview(now = new Date()): Promise<RuleReviewSummary | null> {
  if (!isSupabasePersistenceConfigured()) {
    return null;
  }

  const client = createSupabaseAdminClient();

  if (!client) {
    return null;
  }

  const live = listLiveAgents();
  const agents = live.map((agent) => ({ id: agent.id, name: agent.displayName, hasRuleCore: hasRuleCore(agent.id) }));
  const agentIds = agents.map((agent) => agent.id);
  const windowStart = now.getTime() - RULE_REVIEW_WINDOW_DAYS * 86_400_000;
  const since = new Date(Math.max(windowStart, Date.parse(ARENA_SEASON_START))).toISOString();

  const [decisionsResult, exitsResult] = await Promise.all([
    client
      .from("decisions")
      .select("id, agent_id, cycle_id, reasons, created_at")
      .in("agent_id", agents.filter((agent) => agent.hasRuleCore).map((agent) => agent.id))
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2_000),
    client
      .from("activity_events")
      .select("id, agent_id, title, description, created_at")
      .in("agent_id", agentIds)
      .in("title", [STOP_EXIT_TITLE, TREND_EXIT_TITLE])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  if (decisionsResult.error) {
    throw new Error(`rule review decisions: ${decisionsResult.error.message}`);
  }

  if (exitsResult.error) {
    throw new Error(`rule review exits: ${exitsResult.error.message}`);
  }

  const decisions = (decisionsResult.data ?? []) as RuleDecisionRow[];
  const vetoed = decisions
    .filter((row) => parseRuleCoreOutcome(row.reasons) === "VETOED")
    .slice(0, MAX_VETO_CHECKS)
    .flatMap((row) => {
      const proposal = parseVetoedProposal(row.reasons);
      return proposal ? [{ row, symbol: normalizeSymbol(proposal.symbol) }] : [];
    });

  const checks = await Promise.all(vetoed.map(async ({ row, symbol }) => [row.id, await vetoCheck(client, row, symbol)] as const));
  const vetoChecks = new Map(checks.flatMap(([id, check]) => (check ? [[id, check] as const] : [])));

  return summarizeRuleReview({
    agents,
    decisions,
    exits: (exitsResult.data ?? []) as ProtectiveExitRow[],
    vetoChecks,
  });
}
