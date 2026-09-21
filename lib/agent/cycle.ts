import { createDecisionContext } from "@/lib/ai/decision";
import { isAiDecisionError } from "@/lib/ai/errors";
import { toDecisionPortfolio, toRiskPortfolio } from "@/lib/agent/context";
import { MOMENTUM_ALPHA_AGENT } from "@/lib/agent/constants";
import { cycleIdForSlot } from "@/lib/agent/scheduler";
import { isUsableSnapshot, stampImmutableSnapshot } from "@/lib/agent/snapshot";
import {
  isRetryableCycleStatus,
  type AgentCycleEvent,
  type AgentCycleEventType,
  type AgentCycleFailure,
  type AgentCycleResult,
  type AgentCycleStatus,
  type AgentCycleTrace,
  type RunAgentCycleInput,
} from "@/lib/agent/types";
import { getAgentDefinition, toAgentIdentity } from "@/lib/agents/registry";
import { loadAgentSkill } from "@/lib/agents/skills";
import { isMarketDataError } from "@/lib/market/errors";
import { SUPPORTED_SYMBOLS } from "@/lib/market/symbols";
import type { MarketSnapshot } from "@/lib/market/types";
import { markToMarket } from "@/lib/paper/portfolio";
import { isPaperTradingError } from "@/lib/paper/errors";
import type { PaperAccount, PaperExecution, PaperValuation, TradeDecision } from "@/lib/paper/types";
import type { RiskResult } from "@/lib/risk/types";

function cloneAccount(account: PaperAccount): PaperAccount {
  return {
    ...account,
    positions: account.positions.map((position) => ({ ...position })),
    trades: account.trades.map((trade) => ({ ...trade })),
  };
}

function failureFrom(error: unknown, stage: AgentCycleFailure["stage"]): AgentCycleFailure {
  if (isMarketDataError(error) || isAiDecisionError(error) || isPaperTradingError(error)) {
    return { stage, code: error.code, message: error.message };
  }

  if (error instanceof Error) {
    return { stage, code: "UNKNOWN", message: error.message };
  }

  return { stage, code: "UNKNOWN", message: "Unknown cycle failure" };
}

function traceOf(parts: {
  agentId: string;
  strategy: string;
  cycleId: string;
  snapshotTimestamp: string | null;
  decision: TradeDecision | null;
  riskResult: RiskResult | null;
  execution: PaperExecution | null;
}): AgentCycleTrace {
  return { ...parts };
}

function safeValuation(account: PaperAccount, snapshot: MarketSnapshot | null): PaperValuation | null {
  if (!snapshot) {
    return null;
  }

  try {
    return markToMarket(account, snapshot);
  } catch {
    return null;
  }
}

function resolveDefinition(input: RunAgentCycleInput) {
  return getAgentDefinition(input.agentId ?? input.agent?.id ?? MOMENTUM_ALPHA_AGENT.id);
}

export async function runAgentCycle(input: RunAgentCycleInput): Promise<AgentCycleResult> {
  const definition = resolveDefinition(input);
  const agent = toAgentIdentity(definition);
  const skill = loadAgentSkill(definition.skillPath);
  const { deps } = input;
  const now = deps.now ?? (() => new Date());
  const startedAtDate = now();
  const startedAt = startedAtDate.toISOString();
  const cycleId = input.cycleId ?? deps.createCycleId?.(startedAtDate) ?? cycleIdForSlot(startedAtDate, agent.id);
  const events: AgentCycleEvent[] = [];

  const push = (type: AgentCycleEventType, detail: string) => {
    events.push({ at: now().toISOString(), type, detail });
  };

  const skipped = (detail: string, prior?: AgentCycleResult): AgentCycleResult => {
    const account = cloneAccount(deps.store.getAccount());
    const snapshotTimestamp = prior?.snapshotTimestamp ?? null;

    return {
      status: "SKIPPED_DUPLICATE",
      agentId: prior?.agentId ?? agent.id,
      strategy: prior?.strategy ?? agent.strategy,
      cycleId,
      snapshotTimestamp,
      snapshot: prior?.snapshot ?? null,
      decision: prior?.decision ?? null,
      riskResult: prior?.riskResult ?? null,
      execution: prior?.execution ?? null,
      valuation: prior?.valuation ?? null,
      account,
      events: [
        ...(prior?.events ?? []),
        { at: startedAt, type: "CYCLE_SKIPPED", detail },
      ],
      startedAt: prior?.startedAt ?? startedAt,
      completedAt: now().toISOString(),
      trace: traceOf({
        agentId: prior?.agentId ?? agent.id,
        strategy: prior?.strategy ?? agent.strategy,
        cycleId,
        snapshotTimestamp,
        decision: prior?.decision ?? null,
        riskResult: prior?.riskResult ?? null,
        execution: prior?.execution ?? null,
      }),
    };
  };

  if (deps.store.getAgentStatus() === "PAUSED") {
    const account = cloneAccount(deps.store.getAccount());
    push("CYCLE_SKIPPED", "Trading is paused");

    return {
      status: "SKIPPED_PAUSED",
      agentId: agent.id,
      strategy: agent.strategy,
      cycleId,
      snapshotTimestamp: null,
      snapshot: null,
      decision: null,
      riskResult: null,
      execution: null,
      valuation: null,
      account,
      events,
      startedAt,
      completedAt: now().toISOString(),
      trace: traceOf({
        agentId: agent.id,
        strategy: agent.strategy,
        cycleId,
        snapshotTimestamp: null,
        decision: null,
        riskResult: null,
        execution: null,
      }),
    };
  }

  const existing = deps.store.findCycle(cycleId);

  if (existing && !isRetryableCycleStatus(existing.status)) {
    return skipped(`Cycle ${cycleId} already completed`, existing);
  }

  if (existing) {
    deps.store.forgetCycle(cycleId);
  }

  if (!deps.store.beginCycle(cycleId)) {
    return skipped(`Cycle ${cycleId} is already in progress`, deps.store.findCycle(cycleId));
  }

  const previousAccount = cloneAccount(deps.store.getAccount());
  push("CYCLE_STARTED", `${agent.strategy} cycle ${cycleId}`);

  let snapshot: MarketSnapshot | null = null;
  let decision: TradeDecision | null = null;
  let riskResult: RiskResult | null = null;
  let execution: PaperExecution | null = null;
  let valuation: PaperValuation | null = null;
  let status: AgentCycleStatus = "FAILED_MARKET";
  let failure: AgentCycleFailure | undefined;

  try {
    let rawSnapshot: MarketSnapshot;

    try {
      rawSnapshot = await deps.getMarketSnapshot([...SUPPORTED_SYMBOLS]);
    } catch (error) {
      status = "FAILED_MARKET";
      failure = failureFrom(error, "MARKET");
      push("CYCLE_FAILED", failure.message);
      return finish();
    }

    if (!isUsableSnapshot(rawSnapshot)) {
      status = "FAILED_MARKET";
      failure = {
        stage: "MARKET",
        code: "INVALID_SNAPSHOT",
        message: "Market snapshot is missing timestamp or assets",
      };
      push("CYCLE_FAILED", failure.message);
      return finish();
    }

    snapshot = stampImmutableSnapshot(rawSnapshot, cycleId);
    push("MARKET_SNAPSHOT", `Immutable snapshot ${snapshot.timestamp}`);

    try {
      valuation = markToMarket(previousAccount, snapshot);
    } catch (error) {
      status = "FAILED_MARKET";
      failure = failureFrom(error, "MARKET");
      push("CYCLE_FAILED", failure.message);
      return finish();
    }

    const floorChat = deps.loadFloorChatForAgent ? await deps.loadFloorChatForAgent(agent.id) : undefined;

    const decisionContext = createDecisionContext({
      agentId: agent.id,
      agentName: definition.displayName,
      strategyName: definition.strategyName,
      skill,
      snapshot,
      portfolio: toDecisionPortfolio(valuation),
      floorChat,
    });

    push("ANALYZING", "Requesting TradeDecision from Gemini");

    try {
      decision = await deps.generateTradeDecision(decisionContext);
    } catch (error) {
      status = "FAILED_DECISION";
      failure = failureFrom(error, "DECISION");
      push("CYCLE_FAILED", failure.message);
      return finish();
    }

    push("DECISION", `${decision.action} ${decision.symbol} ${decision.allocationPercent}%`);

    try {
      riskResult = deps.evaluateRisk({
        decision,
        snapshot,
        portfolio: toRiskPortfolio(valuation, deps.store.getDayStartEquity(startedAtDate)),
        agentStatus: deps.store.getAgentStatus(),
      });
    } catch (error) {
      status = "FAILED_RISK";
      failure = failureFrom(error, "RISK");
      push("CYCLE_FAILED", failure.message);
      return finish();
    }

    push("RISK_CHECK", `${riskResult.verdict}: ${riskResult.reason}`);

    if (!riskResult.executable) {
      status = "BLOCKED";
      valuation = safeValuation(previousAccount, snapshot);
      push("TRADE_BLOCKED", riskResult.reason);
      push("CYCLE_COMPLETED", "No paper execution");
      return finish();
    }

    const executableDecision = riskResult.allowedDecision ?? decision;

    try {
      execution = deps.executePaperDecision(previousAccount, executableDecision, snapshot);
    } catch (error) {
      status = "FAILED_EXECUTION";
      failure = failureFrom(error, "EXECUTION");
      push("CYCLE_FAILED", failure.message);
      return finish();
    }

    if (!execution.ok) {
      status = "FAILED_EXECUTION";
      failure = {
        stage: "EXECUTION",
        code: execution.code,
        message: execution.reason,
      };
      valuation = safeValuation(previousAccount, snapshot);
      push("CYCLE_FAILED", execution.reason);
      return finish();
    }

    valuation = execution.valuation;
    deps.store.commitAccount(cloneAccount(execution.account), valuation.portfolio.equity);
    status = "COMPLETED";
    push(
      "TRADE_EXECUTED",
      execution.trade
        ? `${execution.action} ${execution.trade.symbol} ${execution.trade.notional}`
        : `${execution.action} with no fill`
    );
    push("CYCLE_COMPLETED", `Risk ${riskResult.verdict}`);
    return finish();
  } finally {
    deps.store.releaseCycle(cycleId);
  }

  function finish(): AgentCycleResult {
    valuation = valuation ?? safeValuation(previousAccount, snapshot);
    const completedAt = now().toISOString();
    const result: AgentCycleResult = {
      status,
      agentId: agent.id,
      strategy: agent.strategy,
      cycleId,
      snapshotTimestamp: snapshot?.timestamp ?? null,
      snapshot,
      decision,
      riskResult,
      execution,
      valuation,
      account: cloneAccount(deps.store.getAccount()),
      events,
      startedAt,
      completedAt,
      ...(failure ? { failure } : {}),
      trace: traceOf({
        agentId: agent.id,
        strategy: agent.strategy,
        cycleId,
        snapshotTimestamp: snapshot?.timestamp ?? null,
        decision,
        riskResult,
        execution,
      }),
    };

    if (!deps.store.findCycle(cycleId)) {
      deps.store.saveCycle(result);
    }

    return result;
  }
}
