import type { DecisionContext } from "@/lib/ai/types";
import type { TradeDecision } from "@/lib/paper/types";
import { proposeRuleDecision, type RuleProposal } from "@/lib/strategies/rules";

/**
 * How a rule-core proposal ended up: executed as proposed (with or without the
 * LLM's own wording), or vetoed by the LLM. Stored in reasons so vetoes can be
 * counted later from the decisions table.
 */
export type RuleReviewOutcome = "RULE_ONLY" | "CONFIRMED" | "VETOED" | "LLM_UNAVAILABLE" | "LLM_DEVIATED";

export const RULE_CORE_REASON_PREFIX = "Rule core";

export type RuleCoreResult = {
  decision: TradeDecision;
  proposal: RuleProposal;
  outcome: RuleReviewOutcome;
};

const VETO_INSTRUCTION =
  "The strategy rule core proposes the trade in ruleProposal.decision. Return exactly that action, symbol, and allocationPercent to confirm it, " +
  "with reasons and riskFactors in your own voice from the snapshot. Return HOLD (allocationPercent 0) only to veto, and only for a concrete, " +
  "observable contradiction in this snapshot (for example a price or trend field that looks wrong, or a move in the last hour that already " +
  "invalidates the setup). Do not veto because you would size differently or prefer another asset. Any other answer executes the rule proposal.";

function label(outcome: RuleReviewOutcome): string {
  switch (outcome) {
    case "CONFIRMED":
      return `${RULE_CORE_REASON_PREFIX}: proposal confirmed`;
    case "VETOED":
      return `${RULE_CORE_REASON_PREFIX}: proposal vetoed`;
    case "LLM_UNAVAILABLE":
      return `${RULE_CORE_REASON_PREFIX}: executed without review (model unavailable)`;
    case "LLM_DEVIATED":
      return `${RULE_CORE_REASON_PREFIX}: executed as proposed (review did not confirm or veto)`;
    default:
      return `${RULE_CORE_REASON_PREFIX}: no trade signal`;
  }
}

function withLabel(reasons: readonly string[], outcome: RuleReviewOutcome): string[] {
  return [label(outcome), ...reasons].slice(0, 5);
}

function matchesProposal(review: TradeDecision, proposal: TradeDecision): boolean {
  return review.action === proposal.action && review.symbol === proposal.symbol;
}

/**
 * Decide with the persona's rule core when it has one.
 *
 * - No rule core: the LLM decides alone (Livermore).
 * - Rule says HOLD: no model call; the rule's basis is the reason.
 * - Rule proposes a trade: the LLM reviews it. It may confirm (its wording is kept,
 *   the rule's size is executed) or veto entries with HOLD. Exits and trims cannot be
 *   vetoed because they only reduce risk. Errors or other answers execute the rule.
 */
export async function decideWithRuleCore(
  context: DecisionContext,
  review: (context: DecisionContext) => Promise<TradeDecision>
): Promise<RuleCoreResult | null> {
  const proposal = proposeRuleDecision(context);

  if (!proposal) {
    return null;
  }

  const proposed = proposal.decision;

  if (proposed.action === "HOLD") {
    return { proposal, outcome: "RULE_ONLY", decision: { ...proposed, reasons: withLabel(proposal.basis, "RULE_ONLY") } };
  }

  const riskReducing = proposed.action === "SELL";
  let reviewed: TradeDecision;

  try {
    reviewed = await review({
      ...context,
      ruleProposal: { decision: proposed, basis: proposal.basis, instruction: VETO_INSTRUCTION, vetoAllowed: !riskReducing },
    });
  } catch {
    return {
      proposal,
      outcome: "LLM_UNAVAILABLE",
      decision: { ...proposed, reasons: withLabel(proposal.basis, "LLM_UNAVAILABLE") },
    };
  }

  if (reviewed.action === "HOLD" && !riskReducing) {
    return {
      proposal,
      outcome: "VETOED",
      decision: {
        ...reviewed,
        allocationPercent: 0,
        reasons: withLabel([`Vetoed: ${proposed.action} ${proposed.symbol} ${proposed.allocationPercent}%`, ...reviewed.reasons], "VETOED"),
      },
    };
  }

  if (matchesProposal(reviewed, proposed)) {
    return {
      proposal,
      outcome: "CONFIRMED",
      decision: {
        ...proposed,
        confidence: reviewed.confidence,
        timeHorizon: reviewed.timeHorizon,
        reasons: withLabel(reviewed.reasons.length > 0 ? reviewed.reasons : proposal.basis, "CONFIRMED"),
        riskFactors: reviewed.riskFactors,
        ...(reviewed.stopLossPercent != null ? { stopLossPercent: reviewed.stopLossPercent } : {}),
        ...(reviewed.takeProfitPercent != null ? { takeProfitPercent: reviewed.takeProfitPercent } : {}),
      },
    };
  }

  return {
    proposal,
    outcome: "LLM_DEVIATED",
    decision: { ...proposed, reasons: withLabel(proposal.basis, "LLM_DEVIATED") },
  };
}

const OUTCOME_BY_LABEL = new Map<string, RuleReviewOutcome>(
  (["RULE_ONLY", "CONFIRMED", "VETOED", "LLM_UNAVAILABLE", "LLM_DEVIATED"] as const).map((outcome) => [label(outcome), outcome])
);

/** Reads the outcome label that decideWithRuleCore writes as the first reason; null for model-only decisions. */
export function parseRuleCoreOutcome(reasons: readonly string[] | null | undefined): RuleReviewOutcome | null {
  const first = reasons?.[0];
  return first ? OUTCOME_BY_LABEL.get(first) ?? null : null;
}

export type VetoedProposal = { action: "BUY" | "SHORT"; symbol: string; allocationPercent: number };

/** Reads the "Vetoed: BUY SOL 15%" reason written for a vetoed entry. */
export function parseVetoedProposal(reasons: readonly string[] | null | undefined): VetoedProposal | null {
  const match = reasons?.[1]?.match(/^Vetoed: (BUY|SHORT) ([A-Z]+) ([\d.]+)%$/);
  return match ? { action: match[1] as VetoedProposal["action"], symbol: match[2], allocationPercent: Number(match[3]) } : null;
}
