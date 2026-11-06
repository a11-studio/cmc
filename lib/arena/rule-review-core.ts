import { parseRuleCoreOutcome, parseVetoedProposal, type RuleReviewOutcome } from "@/lib/strategies/rule-core";

export type RuleDecisionRow = {
  id: string;
  agent_id: string;
  cycle_id: string;
  reasons: string[] | null;
  created_at: string;
};

export type ProtectiveExitRow = {
  id: string;
  agent_id: string;
  title: string;
  description: string;
  created_at: string;
};

/** Price of the vetoed symbol when the veto happened and at the later check point. */
export type VetoPriceCheck = {
  entryPrice: number;
  laterPrice: number;
  laterAt: string;
};

export type RuleReviewAgent = {
  id: string;
  name: string;
  hasRuleCore: boolean;
};

export type AgentRuleSummary = {
  agentId: string;
  name: string;
  hasRuleCore: boolean;
  ruleHolds: number;
  confirmed: number;
  vetoed: number;
  /** Executed without a usable review: model unavailable or answer did not confirm or veto. */
  unreviewed: number;
  stopExits: number;
  trendExits: number;
  /**
   * Average move of vetoed trades in their own direction since the veto, in percent.
   * Positive means the vetoed trades would have made money (the veto cost); negative
   * means the veto avoided a loss.
   */
  vetoMovePercent: number | null;
};

export type VetoRecord = {
  decisionId: string;
  agentId: string;
  agentName: string;
  at: string;
  action: "BUY" | "SHORT";
  symbol: string;
  allocationPercent: number;
  reason: string;
  check: (VetoPriceCheck & { hours: number; movePercent: number }) | null;
};

export type ExitRecord = {
  id: string;
  agentId: string;
  agentName: string;
  at: string;
  kind: "STOP" | "TREND";
  description: string;
};

export type RuleReviewSummary = {
  agents: AgentRuleSummary[];
  vetoes: VetoRecord[];
  exits: ExitRecord[];
  /** Rule-core decisions in the window; 0 means no rule cycle has run yet. */
  ruleDecisions: number;
};

export const STOP_EXIT_TITLE = "STOP-LOSS EXIT";
export const TREND_EXIT_TITLE = "TREND EXIT";

function countOutcome(counts: Map<RuleReviewOutcome, number>, outcome: RuleReviewOutcome) {
  counts.set(outcome, (counts.get(outcome) ?? 0) + 1);
}

function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function vetoMovePercent(action: "BUY" | "SHORT", check: VetoPriceCheck): number {
  const direction = action === "BUY" ? 1 : -1;
  return round(direction * (check.laterPrice / check.entryPrice - 1) * 100);
}

export function summarizeRuleReview(input: {
  agents: readonly RuleReviewAgent[];
  decisions: readonly RuleDecisionRow[];
  exits: readonly ProtectiveExitRow[];
  vetoChecks: ReadonlyMap<string, VetoPriceCheck>;
}): RuleReviewSummary {
  const names = new Map(input.agents.map((agent) => [agent.id, agent.name]));
  const outcomes = new Map<string, Map<RuleReviewOutcome, number>>();
  const vetoes: VetoRecord[] = [];
  let ruleDecisions = 0;

  for (const row of input.decisions) {
    const outcome = parseRuleCoreOutcome(row.reasons);

    if (!outcome) {
      continue;
    }

    ruleDecisions += 1;
    const counts = outcomes.get(row.agent_id) ?? new Map<RuleReviewOutcome, number>();
    countOutcome(counts, outcome);
    outcomes.set(row.agent_id, counts);

    if (outcome !== "VETOED") {
      continue;
    }

    const proposal = parseVetoedProposal(row.reasons);

    if (!proposal) {
      continue;
    }

    const check = input.vetoChecks.get(row.id);
    vetoes.push({
      decisionId: row.id,
      agentId: row.agent_id,
      agentName: names.get(row.agent_id) ?? row.agent_id,
      at: row.created_at,
      action: proposal.action,
      symbol: proposal.symbol,
      allocationPercent: proposal.allocationPercent,
      reason: row.reasons?.slice(2).join(" ") || "No reason given",
      check: check
        ? {
            ...check,
            hours: round((Date.parse(check.laterAt) - Date.parse(row.created_at)) / 3_600_000, 1),
            movePercent: vetoMovePercent(proposal.action, check),
          }
        : null,
    });
  }

  const exits: ExitRecord[] = input.exits.flatMap((row) => {
    const kind = row.title === STOP_EXIT_TITLE ? "STOP" : row.title === TREND_EXIT_TITLE ? "TREND" : null;
    return kind
      ? [{ id: row.id, agentId: row.agent_id, agentName: names.get(row.agent_id) ?? row.agent_id, at: row.created_at, kind, description: row.description }]
      : [];
  });

  const agents = input.agents.map((agent): AgentRuleSummary => {
    const counts = outcomes.get(agent.id) ?? new Map<RuleReviewOutcome, number>();
    const checked = vetoes.filter((veto) => veto.agentId === agent.id && veto.check);
    const agentExits = exits.filter((exit) => exit.agentId === agent.id);

    return {
      agentId: agent.id,
      name: agent.name,
      hasRuleCore: agent.hasRuleCore,
      ruleHolds: counts.get("RULE_ONLY") ?? 0,
      confirmed: counts.get("CONFIRMED") ?? 0,
      vetoed: counts.get("VETOED") ?? 0,
      unreviewed: (counts.get("LLM_UNAVAILABLE") ?? 0) + (counts.get("LLM_DEVIATED") ?? 0),
      stopExits: agentExits.filter((exit) => exit.kind === "STOP").length,
      trendExits: agentExits.filter((exit) => exit.kind === "TREND").length,
      vetoMovePercent:
        checked.length > 0
          ? round(checked.reduce((sum, veto) => sum + (veto.check?.movePercent ?? 0), 0) / checked.length)
          : null,
    };
  });

  const byTimeDesc = <T extends { at: string }>(left: T, right: T) => Date.parse(right.at) - Date.parse(left.at);

  return { agents, vetoes: vetoes.sort(byTimeDesc), exits: exits.sort(byTimeDesc), ruleDecisions };
}
