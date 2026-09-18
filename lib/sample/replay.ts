import { createPaperAccount, executePaperDecision, markToMarket } from "@/lib/paper";
import type { PaperAccount, PaperValuation, Trade, TradeDecision } from "@/lib/paper";
import type { SupportedSymbol, TimeHorizon, TradeAction } from "@/types/arena";
import { formatUsd } from "@/lib/format";
import {
  MOMENTUM_ALPHA_CONSTRAINTS,
} from "@/lib/sample/constraints";
import { SUPPORTED_SYMBOLS } from "@/lib/market/symbols";
import { sampleQuoteAt, sampleSnapshot, type SamplePrices } from "@/lib/sample/market";
import type {
  ActivityEvent,
  DecisionRecord,
  EquityCurvePoint,
  LeaderboardAgent,
  PositionRow,
  TradeRow,
} from "@/types/arena";

export type SampleStep = {
  at: string;
  cycleId: string;
  prices: SamplePrices;
  action: TradeAction;
  symbol: SupportedSymbol;
  allocationPercent?: number;
  confidence?: number;
  timeHorizon?: TimeHorizon;
  reasons?: string[];
  riskFactors?: string[];
  stopLossPercent?: number;
  takeProfitPercent?: number;
  decisionId?: string;
  featureActivity?: boolean;
};

export type SampleReplayTrace = {
  at: string;
  action: TradeAction;
  symbol: SupportedSymbol;
  preEquity: number;
  postEquity: number;
  cash: number;
  trade?: Trade;
  allocationPercent?: number;
  tradePercentOfEquity?: number;
  valuation: PaperValuation;
};

export type AgentSampleBook = {
  agent: LeaderboardAgent;
  cash: number;
  cashAllocationPercent: number;
  positions: PositionRow[];
  trades: TradeRow[];
  decisions: DecisionRecord[];
  events: ActivityEvent[];
  equityCurve: number[];
  equitySeries: EquityCurvePoint[];
  peakEquity: number;
  traces: SampleReplayTrace[];
};

export type SampleAgentDefinition = {
  id: string;
  name: string;
  strategy: string;
  description: string;
  status: LeaderboardAgent["status"];
  mark: LeaderboardAgent["mark"];
  steps: SampleStep[];
};

const PERCENT_EPSILON = 1e-6;

function utcDay(iso: string) {
  return iso.slice(0, 10);
}

function assertWithinLimit(actual: number, max: number, label: string) {
  if (actual > max + PERCENT_EPSILON) {
    throw new Error(`${label}: ${actual.toFixed(6)} exceeds ${max}`);
  }
}

function assertMin(actual: number, min: number, label: string) {
  if (actual + PERCENT_EPSILON < min) {
    throw new Error(`${label}: ${actual.toFixed(6)} is below ${min}`);
  }
}

function enforceConstraints(trace: SampleReplayTrace, traces: SampleReplayTrace[]) {
  const { valuation, trade, tradePercentOfEquity } = trace;
  const { portfolio, positions } = valuation;
  const constraints = MOMENTUM_ALPHA_CONSTRAINTS;

  if (portfolio.cash < -PERCENT_EPSILON) {
    throw new Error("Cash went negative — leverage is not allowed");
  }

  if (positions.some((position) => position.quantity < -PERCENT_EPSILON)) {
    throw new Error("Short quantity is not allowed");
  }

  if (positions.length > constraints.maxOpenPositions) {
    throw new Error(`Open positions ${positions.length} exceed max ${constraints.maxOpenPositions}`);
  }

  for (const position of positions) {
    assertWithinLimit(
      position.allocationPercent,
      constraints.maxPositionPercent,
      `${position.symbol} position allocation`
    );
  }

  const cashPercent = portfolio.equity === 0 ? 100 : (portfolio.cash / portfolio.equity) * 100;
  assertMin(cashPercent, constraints.minCashPercent, "Cash allocation");
  assertWithinLimit(portfolio.drawdownPercent, constraints.maxDrawdownPercent, "Drawdown");

  if (trade && tradePercentOfEquity != null) {
    assertWithinLimit(tradePercentOfEquity, constraints.maxTradePercent, `${trade.side} ${trade.symbol} trade size`);
  }

  const day = utcDay(trace.at);
  const sameDay = traces.filter((item) => utcDay(item.at) === day);
  const dayStartEquity = sameDay[0]?.preEquity ?? trace.preEquity;
  const dailyLossPercent =
    dayStartEquity <= 0 ? 0 : ((dayStartEquity - portfolio.equity) / dayStartEquity) * 100;

  if (dailyLossPercent > constraints.maxDailyLossPercent + PERCENT_EPSILON) {
    throw new Error(
      `Daily loss ${dailyLossPercent.toFixed(6)}% exceeds ${constraints.maxDailyLossPercent}% on ${day}`
    );
  }
}

function winRatePercent(trades: Trade[]) {
  const closed = trades.filter((trade) => trade.realizedPnl != null);

  if (closed.length === 0) {
    return 0;
  }

  const wins = closed.filter((trade) => (trade.realizedPnl ?? 0) > 0);
  return (wins.length / closed.length) * 100;
}

function describeTrade(trade: Trade) {
  const verb = trade.side === "BUY" ? "Bought" : trade.side === "SHORT" ? "Shorted" : "Sold";
  return `${verb} ${formatUsd(trade.notional)} ${trade.symbol} @ ${formatUsd(trade.price)}`;
}

function buildActivity(agent: Pick<LeaderboardAgent, "id" | "name">, step: SampleStep, trade: Trade, riskCheck: string): ActivityEvent[] {
  const executed = Date.parse(step.at);
  const offset = (seconds: number) => new Date(executed - seconds * 1000).toISOString();

  return [
    {
      id: `evt_${step.cycleId}_analyzing`,
      agentId: agent.id,
      agentName: agent.name,
      type: "ANALYZING",
      title: "ANALYZING",
      description: `Scanning ${SUPPORTED_SYMBOLS.join(", ")}`,
      createdAt: offset(12),
    },
    {
      id: `evt_${step.cycleId}_signal`,
      agentId: agent.id,
      agentName: agent.name,
      type: "SIGNAL",
      title: "SIGNAL",
      description: `${step.symbol} momentum increasing`,
      createdAt: offset(9),
    },
    {
      id: `evt_${step.cycleId}_news`,
      agentId: agent.id,
      agentName: agent.name,
      type: "NEWS",
      title: "NEWS",
      description: `Positive ${step.symbol} sentiment detected`,
      createdAt: offset(6),
    },
    {
      id: `evt_${step.cycleId}_decision`,
      agentId: agent.id,
      agentName: agent.name,
      type: "DECISION",
      title: "DECISION",
      description: `${step.action} ${step.symbol} · ${step.confidence ?? 70}% confidence`,
      createdAt: offset(3),
    },
    {
      id: `evt_${step.cycleId}_risk`,
      agentId: agent.id,
      agentName: agent.name,
      type: "RISK_CHECK",
      title: "RISK CHECK",
      description: riskCheck,
      createdAt: offset(1),
    },
    {
      id: `evt_${step.cycleId}_trade`,
      agentId: agent.id,
      agentName: agent.name,
      type: "TRADE_EXECUTED",
      title: "TRADE EXECUTED",
      description: describeTrade(trade),
      createdAt: step.at,
    },
  ];
}

export function replaySampleAgent(definition: SampleAgentDefinition): AgentSampleBook {
  let account: PaperAccount = createPaperAccount(MOMENTUM_ALPHA_CONSTRAINTS.initialCapital);
  const traces: SampleReplayTrace[] = [];
  const decisions: DecisionRecord[] = [];
  const tradeRows: TradeRow[] = [];
  let events: ActivityEvent[] = [];
  const equitySeries: EquityCurvePoint[] = [{ equity: account.cash, label: "Start" }];
  let previousPrices: SamplePrices | undefined;

  for (const [index, step] of definition.steps.entries()) {
    const snapshot = sampleSnapshot(step.prices, step.cycleId, step.at);
    const preTrade = markToMarket(account, snapshot);
    const allocationPercent = step.action === "HOLD" ? 0 : step.allocationPercent;

    if (step.action !== "HOLD" && (allocationPercent == null || allocationPercent <= 0)) {
      throw new Error(`${definition.name} step ${step.cycleId} is missing allocationPercent`);
    }

    const decision: TradeDecision = {
      action: step.action,
      symbol: step.symbol,
      allocationPercent: allocationPercent ?? 0,
      confidence: step.confidence ?? 70,
      timeHorizon: step.timeHorizon ?? "SHORT",
      reasons: step.reasons ?? [`Manual sample ${step.action} for ${step.symbol}.`],
      riskFactors: step.riskFactors ?? [],
      stopLossPercent: step.stopLossPercent,
      takeProfitPercent: step.takeProfitPercent,
    };

    const result = executePaperDecision(account, decision, snapshot, {
      now: () => new Date(step.at),
      createTradeId: () => `trd_${definition.id}_${step.cycleId}`,
    });

    if (!result.ok) {
      throw new Error(`${definition.name} step ${step.cycleId} failed: ${result.reason}`);
    }

    account = result.account;
    const tradePercentOfEquity =
      result.trade && preTrade.portfolio.equity > 0
        ? (result.trade.notional / preTrade.portfolio.equity) * 100
        : undefined;

    const trace: SampleReplayTrace = {
      at: step.at,
      action: step.action,
      symbol: step.symbol,
      preEquity: preTrade.portfolio.equity,
      postEquity: result.valuation.portfolio.equity,
      cash: result.account.cash,
      trade: result.trade,
      allocationPercent: step.allocationPercent,
      tradePercentOfEquity,
      valuation: result.valuation,
    };

    traces.push(trace);
    enforceConstraints(trace, traces);
    equitySeries.push({
      equity: result.valuation.portfolio.equity,
      at: step.at,
      label: step.action === "HOLD" ? "Mark" : `${step.action} ${step.symbol}`,
    });

    if (result.trade) {
      const resulting = result.valuation.positions.find((position) => position.symbol === step.symbol);
      const riskCheck = resulting
        ? `Position size approved (${step.allocationPercent}%). Resulting ${step.symbol} allocation ${resulting.allocationPercent.toFixed(1)}%.`
        : `Position size approved (${step.allocationPercent}%). ${step.symbol} position closed.`;

      tradeRows.push({
        id: result.trade.id,
        symbol: result.trade.symbol,
        side: result.trade.side,
        notional: result.trade.notional,
        quantity: result.trade.quantity,
        price: result.trade.price,
        createdAt: result.trade.createdAt,
        decisionId: step.decisionId ?? `dec_${definition.id}_${step.cycleId}`,
        realizedPnl: result.trade.realizedPnl,
      });

      decisions.push({
        id: step.decisionId ?? `dec_${definition.id}_${step.cycleId}`,
        agentId: definition.id,
        agentName: definition.name,
        action: step.action,
        symbol: step.symbol,
        notional: result.trade.notional,
        quantity: result.trade.quantity,
        price: result.trade.price,
        allocationPercent: step.allocationPercent ?? 0,
        confidence: decision.confidence,
        timeHorizon: decision.timeHorizon,
        status: "Executed",
        stopLossPercent: step.stopLossPercent ?? 5,
        takeProfitPercent: step.takeProfitPercent ?? 10,
        reasons: decision.reasons,
        riskFactors: decision.riskFactors,
        market: sampleQuoteAt(step.symbol, step.prices[step.symbol], previousPrices?.[step.symbol]),
        riskCheck,
        createdAt: step.at,
        dataSource: "sample",
      });

      if (step.featureActivity) {
        events = buildActivity(
          { id: definition.id, name: definition.name },
          step,
          result.trade,
          riskCheck
        );
      }
    }

    previousPrices = step.prices;

    if (index === definition.steps.length - 1 && step.action !== "HOLD") {
      throw new Error(`${definition.name} must end on a HOLD mark-to-market at current sample prices`);
    }
  }

  const last = traces.at(-1);

  if (!last) {
    throw new Error(`${definition.name} replay produced no traces`);
  }

  const positions = [...last.valuation.positions].sort((a, b) => b.marketValue - a.marketValue);
  const cashAllocationPercent =
    last.valuation.portfolio.equity === 0
      ? 100
      : (account.cash / last.valuation.portfolio.equity) * 100;

  const agent: LeaderboardAgent = {
    id: definition.id,
    name: definition.name,
    strategy: definition.strategy,
    description: definition.description,
    status: definition.status,
    mark: definition.mark,
    equity: last.valuation.portfolio.equity,
    returnPercent: last.valuation.portfolio.returnPercent,
    drawdownPercent: last.valuation.portfolio.drawdownPercent,
    winRatePercent: winRatePercent(account.trades.slice()),
    trades: account.trades.length,
    initialCapital: account.initialCapital,
    cash: account.cash,
    coins: positions.reduce((sum, position) => sum + Math.abs(position.marketValue), 0),
    dataSource: "sample",
  };

  return {
    agent,
    cash: account.cash,
    cashAllocationPercent,
    positions,
    trades: [...tradeRows].reverse(),
    decisions: [...decisions].reverse(),
    events,
    equityCurve: equitySeries.map((point) => point.equity),
    equitySeries,
    peakEquity: account.peakEquity,
    traces,
  };
}
