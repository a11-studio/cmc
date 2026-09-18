import { MOMENTUM_ALPHA_AGENT } from "@/lib/agent/constants";
import { scoreTradesAgainstNextCheck, type TradeCheck } from "@/lib/agent/trade-outcomes";
import type { AgentCycleResult, AgentCycleStore } from "@/lib/agent/types";
import { findAgentDefinition } from "@/lib/agents/registry";
import { ASSET_CATALOG } from "@/lib/market/symbols";
import type { AssetSnapshot, MarketSnapshot } from "@/lib/market/types";
import { markToMarket } from "@/lib/paper/portfolio";
import type { PaperAccount, PaperValuation, Trade } from "@/lib/paper/types";
import type { RiskVerdict } from "@/lib/risk/types";
import type {
  ActivityEvent,
  DecisionRecord,
  EquityCurvePoint,
  LeaderboardAgent,
  PositionRow,
  TradeRow,
} from "@/types/arena";

function displayFailureMessage(message: string): string {
  const trimmed = message.trim();

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { error?: { message?: string }; message?: string };
      const nested = parsed.error?.message ?? parsed.message;

      if (typeof nested === "string" && nested.trim()) {
        return nested.trim();
      }
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

const AGENT_DESCRIPTION = "Follows short-term trend while respecting position caps";

export type MomentumAlphaView = {
  agent: LeaderboardAgent;
  cash: number;
  cashAllocationPercent: number;
  realizedPnl: number;
  unrealizedPnl: number;
  dayStartEquity: number;
  positions: PositionRow[];
  trades: TradeRow[];
  decisions: DecisionRecord[];
  events: ActivityEvent[];
  cycles: SerializedCycle[];
  equityCurve: number[];
  equitySeries: EquityCurvePoint[];
  latestCycle: SerializedCycle | null;
  hasCycles: boolean;
  tradeChecks: TradeCheck[];
};

export type SerializedCycle = {
  status: AgentCycleResult["status"];
  agentId: string;
  strategy: string;
  cycleId: string;
  startedAt: string;
  completedAt: string;
  snapshotTimestamp: string | null;
  decision: AgentCycleResult["decision"];
  riskVerdict: RiskVerdict | null;
  riskReason: string | null;
  requestedAllocationPercent: number | null;
  allowedAllocationPercent: number | null;
  executionOk: boolean | null;
  executionAction: string | null;
  trade: Trade | null;
  equity: number | null;
  failure: AgentCycleResult["failure"] | null;
  events: ActivityEvent[];
};

function emptySnapshot(): MarketSnapshot {
  return {
    cycleId: "unmarked",
    timestamp: "1970-01-01T00:00:00.000Z",
    assets: [],
    market: {},
  };
}

function winRatePercent(trades: readonly Trade[]): number {
  const closed = trades.filter((trade) => trade.realizedPnl != null);

  if (closed.length === 0) {
    return 0;
  }

  const wins = closed.filter((trade) => (trade.realizedPnl ?? 0) > 0);
  return (wins.length / closed.length) * 100;
}

export function resolveValuation(account: PaperAccount, cycles: readonly AgentCycleResult[]): PaperValuation {
  for (let index = cycles.length - 1; index >= 0; index -= 1) {
    const cycle = cycles[index];

    if (cycle?.valuation) {
      return cycle.valuation;
    }

    if (cycle?.snapshot) {
      try {
        return markToMarket(account, cycle.snapshot);
      } catch {
        continue;
      }
    }
  }

  if (account.positions.length === 0) {
    return markToMarket(account, emptySnapshot());
  }

  return {
    portfolio: {
      cash: account.cash,
      equity: account.cash,
      realizedPnl: account.realizedPnl,
      unrealizedPnl: 0,
      returnPercent:
        account.initialCapital === 0 ? 0 : ((account.cash - account.initialCapital) / account.initialCapital) * 100,
      drawdownPercent: 0,
    },
    positions: [],
  };
}

function assetMarket(snapshot: MarketSnapshot | null, symbol: string): AssetSnapshot | undefined {
  return snapshot?.assets.find((asset) => asset.symbol === symbol);
}

function toMarketQuote(snapshot: MarketSnapshot | null, symbol: DecisionRecord["symbol"], fallbackPrice = 0) {
  const asset = assetMarket(snapshot, symbol);
  const catalog = ASSET_CATALOG[symbol];

  return {
    symbol,
    name: catalog?.name ?? symbol,
    price: asset?.price ?? fallbackPrice,
    change1h: asset?.change1h,
    change24h: asset?.change24h,
    change7d: asset?.change7d,
    volume24h: asset?.volume24h,
    marketCap: asset?.marketCap,
    rsi: asset?.rsi,
    macd: asset?.macd,
    ema20: asset?.ema20,
    ema50: asset?.ema50,
  };
}

function decisionStatus(cycle: AgentCycleResult): DecisionRecord["status"] {
  if (cycle.status === "BLOCKED") {
    return "Blocked";
  }

  if (cycle.status.startsWith("FAILED") || cycle.status === "SKIPPED_DUPLICATE") {
    return "Failed";
  }

  if (cycle.riskResult?.verdict === "CONSTRAINED") {
    return "Constrained";
  }

  if (cycle.decision?.action === "HOLD" || cycle.execution?.action === "HOLD") {
    return "Held";
  }

  if (cycle.execution?.ok) {
    return "Executed";
  }

  return "Failed";
}

export function cycleToActivityEvents(cycle: AgentCycleResult): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const agentId = cycle.agentId;
  const agentName = findAgentDefinition(cycle.agentId)?.displayName ?? cycle.strategy;

  events.push({
    id: `${cycle.cycleId}-analyzing`,
    agentId,
    agentName,
    type: "ANALYZING",
    title: "ANALYZING",
    description: cycle.snapshot
      ? `Market snapshot ${cycle.cycleId} · ${cycle.snapshotTimestamp}`
      : `Cycle ${cycle.cycleId} · waiting for CoinMarketCap`,
    createdAt: cycle.startedAt,
  });

  if (cycle.status === "FAILED_MARKET") {
    events.push({
      id: `${cycle.cycleId}-error`,
      agentId,
      agentName,
      type: "ERROR",
      title: "CYCLE FAILED",
      description: displayFailureMessage(cycle.failure?.message ?? "CoinMarketCap is unavailable"),
      createdAt: cycle.completedAt,
    });
    return events;
  }

  if (cycle.decision) {
    events.push({
      id: `${cycle.cycleId}-decision`,
      agentId,
      agentName,
      type: "DECISION",
      title: "DECISION",
      description: `${cycle.decision.action} ${cycle.decision.symbol} ${cycle.decision.allocationPercent}% · ${cycle.decision.confidence}% confidence`,
      createdAt: cycle.completedAt,
    });
  } else if (cycle.status === "FAILED_DECISION") {
    events.push({
      id: `${cycle.cycleId}-error`,
      agentId,
      agentName,
      type: "ERROR",
      title: "CYCLE FAILED",
      description: displayFailureMessage(cycle.failure?.message ?? "Gemini is unavailable"),
      createdAt: cycle.completedAt,
    });
    return events;
  }

  if (cycle.riskResult) {
    const allowed =
      cycle.riskResult.verdict === "CONSTRAINED" && cycle.riskResult.adjustedAllocationPercent != null
        ? ` · allowed ${cycle.riskResult.adjustedAllocationPercent}%`
        : "";

    events.push({
      id: `${cycle.cycleId}-risk`,
      agentId,
      agentName,
      type: "RISK_CHECK",
      title: "RISK CHECK",
      description: `${cycle.riskResult.verdict}${allowed} · ${cycle.riskResult.reason}`,
      createdAt: cycle.completedAt,
    });
  } else if (cycle.status === "FAILED_RISK") {
    events.push({
      id: `${cycle.cycleId}-error`,
      agentId,
      agentName,
      type: "ERROR",
      title: "CYCLE FAILED",
      description: displayFailureMessage(cycle.failure?.message ?? "Risk Engine failed"),
      createdAt: cycle.completedAt,
    });
    return events;
  }

  if (cycle.status === "BLOCKED") {
    events.push({
      id: `${cycle.cycleId}-blocked`,
      agentId,
      agentName,
      type: "TRADE_REJECTED",
      title: "BLOCKED",
      description: cycle.riskResult?.reason ?? "Risk Engine blocked the decision",
      createdAt: cycle.completedAt,
    });
    return events;
  }

  if (cycle.execution?.ok) {
    const equity = cycle.valuation?.portfolio.equity;
    const fill = cycle.execution.trade
      ? `${cycle.execution.trade.side} ${cycle.execution.trade.symbol} ${cycle.execution.trade.notional}`
      : cycle.execution.action;

    events.push({
      id: `${cycle.cycleId}-executed`,
      agentId,
      agentName,
      type: "TRADE_EXECUTED",
      title: "TRADE EXECUTED",
      description: equity == null ? fill : `${fill} · equity ${equity}`,
      createdAt: cycle.completedAt,
    });
    return events;
  }

  if (cycle.status === "FAILED_EXECUTION" || cycle.failure) {
    events.push({
      id: `${cycle.cycleId}-error`,
      agentId,
      agentName,
      type: "ERROR",
      title: "CYCLE FAILED",
      description: displayFailureMessage(cycle.failure?.message ?? "Paper Engine failed"),
      createdAt: cycle.completedAt,
    });
  }

  return events;
}

export function serializeCycle(cycle: AgentCycleResult): SerializedCycle {
  return {
    status: cycle.status,
    agentId: cycle.agentId,
    strategy: cycle.strategy,
    cycleId: cycle.cycleId,
    startedAt: cycle.startedAt,
    completedAt: cycle.completedAt,
    snapshotTimestamp: cycle.snapshotTimestamp,
    decision: cycle.decision,
    riskVerdict: cycle.riskResult?.verdict ?? null,
    riskReason: cycle.riskResult?.reason ?? (cycle.failure ? displayFailureMessage(cycle.failure.message) : null),
    requestedAllocationPercent: cycle.decision?.allocationPercent ?? null,
    allowedAllocationPercent: cycle.riskResult?.adjustedAllocationPercent ?? cycle.riskResult?.allowedDecision?.allocationPercent ?? null,
    executionOk: cycle.execution ? cycle.execution.ok : null,
    executionAction: cycle.execution?.action ?? null,
    trade: cycle.execution && cycle.execution.ok ? cycle.execution.trade ?? null : null,
    equity: cycle.valuation?.portfolio.equity ?? null,
    failure: cycle.failure
      ? { ...cycle.failure, message: displayFailureMessage(cycle.failure.message) }
      : null,
    events: cycleToActivityEvents(cycle),
  };
}

export function cycleToDecisionRecord(cycle: AgentCycleResult): DecisionRecord | null {
  const decision = cycle.decision;

  if (!decision && !cycle.failure) {
    return null;
  }

  const symbol = decision?.symbol ?? "BTC";
  const trade = cycle.execution && cycle.execution.ok ? cycle.execution.trade : undefined;
  const asset = assetMarket(cycle.snapshot, symbol);
  const resulting = cycle.valuation?.positions.find((position) => position.symbol === symbol);

  const definition = findAgentDefinition(cycle.agentId);

  return {
    id: cycle.cycleId,
    agentId: cycle.agentId,
    agentName: definition?.displayName ?? cycle.strategy,
    strategyName: definition?.strategyName ?? cycle.strategy,
    skillName: definition?.strategyName ?? cycle.strategy,
    action: decision?.action ?? "HOLD",
    symbol,
    notional: trade?.notional ?? 0,
    quantity: trade?.quantity ?? 0,
    price: trade?.price ?? asset?.price ?? 0,
    allocationPercent: decision?.allocationPercent ?? 0,
    confidence: decision?.confidence ?? 0,
    timeHorizon: decision?.timeHorizon ?? "SHORT",
    status: decisionStatus(cycle),
    stopLossPercent: decision?.stopLossPercent,
    takeProfitPercent: decision?.takeProfitPercent,
    reasons: decision?.reasons ?? [],
    riskFactors: decision?.riskFactors ?? [],
    market: toMarketQuote(cycle.snapshot, symbol, trade?.price ?? 0),
    riskCheck: cycle.riskResult?.reason ?? cycle.failure?.message ?? "No risk result",
    createdAt: cycle.completedAt,
    dataSource: "live",
    cycleId: cycle.cycleId,
    cycleStatus: cycle.status,
    riskVerdict: cycle.riskResult?.verdict,
    requestedAllocationPercent: decision?.allocationPercent,
    allowedAllocationPercent: cycle.riskResult?.adjustedAllocationPercent,
    resultingEquity: cycle.valuation?.portfolio.equity,
    resultingQuantity: resulting?.quantity,
    failureMessage: cycle.failure ? displayFailureMessage(cycle.failure.message) : undefined,
  };
}

export function serializeTriggerResult(cycle: AgentCycleResult) {
  return {
    ok: cycle.status === "COMPLETED" || cycle.status === "BLOCKED",
    enabled: true,
    status: cycle.status,
    cycleId: cycle.cycleId,
    riskVerdict: cycle.riskResult?.verdict ?? null,
    message:
      cycle.status === "COMPLETED"
        ? `Cycle ${cycle.cycleId} ${cycle.riskResult?.verdict ?? "COMPLETED"}`
        : cycle.status === "BLOCKED"
          ? `Cycle ${cycle.cycleId} blocked: ${cycle.riskResult?.reason ?? "Risk Engine rejected the trade"}`
          : cycle.status === "SKIPPED_PAUSED"
            ? "Trading is paused. Resume to run a cycle."
        : `Cycle ${cycle.cycleId} failed: ${displayFailureMessage(cycle.failure?.message ?? cycle.status)}`,
    failure: cycle.failure ?? null,
    snapshotTimestamp: cycle.snapshotTimestamp,
    decision: cycle.decision
      ? {
          action: cycle.decision.action,
          symbol: cycle.decision.symbol,
          allocationPercent: cycle.decision.allocationPercent,
          confidence: cycle.decision.confidence,
        }
      : null,
  };
}

export function isManualCycleEnabled(env: { NODE_ENV?: string; MANUAL_CYCLE_ENABLED?: string } = process.env): boolean {
  return env.NODE_ENV !== "production" || env.MANUAL_CYCLE_ENABLED === "true";
}

function agentStatus(storeStatus: LeaderboardAgent["status"], cycles: readonly AgentCycleResult[]): LeaderboardAgent["status"] {
  if (storeStatus === "PAUSED") {
    return "PAUSED";
  }

  const latest = cycles.at(-1);

  if (!latest) {
    return storeStatus;
  }

  if (latest.status.startsWith("FAILED")) {
    return "ERROR";
  }

  return storeStatus;
}

export function buildAgentView(
  store: Pick<AgentCycleStore, "getAccount" | "getAgentStatus" | "listCycles" | "getDayStartEquity">,
  agentId = MOMENTUM_ALPHA_AGENT.id
): MomentumAlphaView {
  const definition = findAgentDefinition(agentId);
  const account = store.getAccount();
  const cycles = store.listCycles();
  const valuation = resolveValuation(account, cycles);
  const { portfolio, positions } = valuation;
  const cashAllocationPercent = portfolio.equity === 0 ? 100 : (portfolio.cash / portfolio.equity) * 100;
  const serialized = cycles.map(serializeCycle);
  const decisions = cycles
    .map(cycleToDecisionRecord)
    .filter((decision): decision is DecisionRecord => decision != null)
    .reverse();
  const events = cycles.flatMap(cycleToActivityEvents);
  const trades: TradeRow[] = [...account.trades]
    .map((trade) => ({
      id: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      notional: trade.notional,
      quantity: trade.quantity,
      price: trade.price,
      createdAt: trade.createdAt,
      decisionId: trade.cycleId,
      realizedPnl: trade.realizedPnl,
    }))
    .reverse();

  const agent: LeaderboardAgent = {
    id: definition?.id ?? MOMENTUM_ALPHA_AGENT.id,
    name: definition?.displayName ?? MOMENTUM_ALPHA_AGENT.name,
    strategy: definition?.strategyName ?? "Narrative momentum",
    description: definition?.description ?? AGENT_DESCRIPTION,
    status: agentStatus(store.getAgentStatus(), cycles),
    mark: definition?.mark ?? "momentum",
    equity: portfolio.equity,
    returnPercent: portfolio.returnPercent,
    drawdownPercent: portfolio.drawdownPercent,
    winRatePercent: winRatePercent(account.trades),
    trades: account.trades.length,
    initialCapital: account.initialCapital,
    dataSource: "live",
    runtimeStatus: "LIVE",
  };

  const equitySeries: EquityCurvePoint[] = [
    { equity: account.initialCapital, label: "Start" },
    ...serialized.flatMap((cycle) =>
      cycle.equity == null
        ? []
        : [
            {
              equity: cycle.equity,
              at: cycle.completedAt,
              label: cycle.decision
                ? `${cycle.decision.action} ${cycle.decision.symbol}`
                : cycle.status.replace(/_/g, " "),
            },
          ]
    ),
  ];
  const equityCurve = equitySeries.map((point) => point.equity);

  return {
    agent,
    cash: portfolio.cash,
    cashAllocationPercent,
    realizedPnl: portfolio.realizedPnl,
    unrealizedPnl: portfolio.unrealizedPnl,
    dayStartEquity: store.getDayStartEquity(new Date()),
    positions: [...positions].sort((left, right) => right.marketValue - left.marketValue),
    trades,
    decisions,
    events,
    cycles: [...serialized].reverse(),
    equityCurve,
    equitySeries,
    latestCycle: serialized.at(-1) ?? null,
    hasCycles: cycles.length > 0,
    tradeChecks: scoreTradesAgainstNextCheck(account.trades, cycles),
  };
}

export function buildMomentumAlphaView(
  store: Pick<AgentCycleStore, "getAccount" | "getAgentStatus" | "listCycles" | "getDayStartEquity">
): MomentumAlphaView {
  return buildAgentView(store, MOMENTUM_ALPHA_AGENT.id);
}

export function serializeMomentumAlphaApi(view: MomentumAlphaView) {
  return {
    agent: view.agent,
    cash: view.cash,
    cashAllocationPercent: view.cashAllocationPercent,
    realizedPnl: view.realizedPnl,
    unrealizedPnl: view.unrealizedPnl,
    dayStartEquity: view.dayStartEquity,
    positions: view.positions,
    trades: view.trades,
    decisions: view.decisions,
    activity: view.events,
    cycles: view.cycles,
    equityCurve: view.equityCurve,
    equitySeries: view.equitySeries,
    latestCycle: view.latestCycle,
    hasCycles: view.hasCycles,
    tradeChecks: view.tradeChecks,
    source: "live" as const,
  };
}
