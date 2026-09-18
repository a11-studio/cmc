import { AGENT_CYCLE_INTERVAL_MS } from "@/lib/agent/constants";
import type { DecisionRecord, TradeAction } from "@/types/arena";

const ACTION_ORDER: readonly TradeAction[] = ["BUY", "SHORT", "SELL", "HOLD"];

export type DecisionBatch = {
  decisions: DecisionRecord[];
  averageConfidence: number;
  actionCounts: Array<{ action: TradeAction; count: number }>;
  blockedCount: number;
  latestAt: string | null;
};

const EMPTY: DecisionBatch = {
  decisions: [],
  averageConfidence: 0,
  actionCounts: [],
  blockedCount: 0,
  latestAt: null,
};

function timestamp(decision: DecisionRecord): number {
  return decision.createdAt ? Date.parse(decision.createdAt) : Number.NaN;
}

/**
 * Collapses every live agent's newest decision into one round. Agents run on
 * the same 15-minute schedule but not the same instant, so the round is a
 * window back from the newest decision rather than a shared cycle id.
 */
export function latestDecisionBatch(decisions: readonly DecisionRecord[]): DecisionBatch {
  const sorted = decisions
    .filter((decision) => Number.isFinite(timestamp(decision)))
    .sort((left, right) => timestamp(right) - timestamp(left));

  const newest = sorted[0];

  if (!newest) {
    return EMPTY;
  }

  const newestAt = timestamp(newest);
  const perAgent = new Map<string, DecisionRecord>();

  for (const decision of sorted) {
    if (newestAt - timestamp(decision) > AGENT_CYCLE_INTERVAL_MS) {
      break;
    }

    if (!perAgent.has(decision.agentId)) {
      perAgent.set(decision.agentId, decision);
    }
  }

  const batch = [...perAgent.values()].sort((left, right) => right.confidence - left.confidence);
  const totalConfidence = batch.reduce((sum, decision) => sum + decision.confidence, 0);

  const actionCounts = ACTION_ORDER.map((action) => ({
    action,
    count: batch.filter((decision) => decision.action === action).length,
  })).filter((entry) => entry.count > 0);

  return {
    decisions: batch,
    averageConfidence: totalConfidence / batch.length,
    actionCounts,
    blockedCount: batch.filter((decision) => decision.riskVerdict === "BLOCKED").length,
    latestAt: newest.createdAt ?? null,
  };
}
