import { MOMENTUM_ALPHA_AGENT } from "@/lib/agent/constants";
import { freezeMarketSnapshot } from "@/lib/agent/snapshot";
import { createInMemoryAgentStore } from "@/lib/agent/store";
import type { AgentCycleResult, AgentCycleStore } from "@/lib/agent/types";
import { cycleToActivityEvents } from "@/lib/agent/view";
import { createPaperAccount } from "@/lib/paper/portfolio";
import type { PaperAccount } from "@/lib/paper/types";
import type { AgentRiskStatus } from "@/lib/risk/types";

export const MOMENTUM_ALPHA_DESCRIPTION = "Follows short-term trend while respecting position caps";

export type PersistedArenaState = {
  agentId: string;
  account: PaperAccount;
  status: AgentRiskStatus;
  dayStartEquity: number;
  lastEquity: number;
  dayKey: string;
  cycles: AgentCycleResult[];
};

export type AgentAccountPayloadV1 = {
  version: 1;
  account: PaperAccount;
  dayKey: string;
};

export type ArenaWriter = {
  upsert(table: string, rows: Record<string, unknown>[], onConflict: string): Promise<void>;
  deleteEq(table: string, column: string, value: string): Promise<void>;
};

export type PersistedAgentRow = {
  account_payload: unknown;
  status: string | null;
  day_start_equity: number | null;
  last_equity: number | null;
  day_key: string | null;
};

export type PersistedCycleRow = {
  payload: unknown;
  status: string | null;
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPaperAccount(value: unknown): value is PaperAccount {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.cash === "number" &&
    typeof value.initialCapital === "number" &&
    Array.isArray(value.positions) &&
    Array.isArray(value.trades)
  );
}

function isAgentRiskStatus(value: unknown): value is AgentRiskStatus {
  return value === "ACTIVE" || value === "PAUSED" || value === "ERROR";
}

export function wrapAccountPayload(account: PaperAccount, dayKey: string): AgentAccountPayloadV1 {
  return {
    version: 1,
    account: cloneJson(account),
    dayKey,
  };
}

export function unwrapAccountPayload(payload: unknown): { account: PaperAccount; dayKey: string | null } {
  if (isRecord(payload) && payload.version === 1 && isPaperAccount(payload.account)) {
    return {
      account: cloneJson(payload.account),
      dayKey: typeof payload.dayKey === "string" ? payload.dayKey : null,
    };
  }

  if (isPaperAccount(payload)) {
    return { account: cloneJson(payload), dayKey: null };
  }

  return { account: createPaperAccount(MOMENTUM_ALPHA_AGENT.initialCapital), dayKey: null };
}

export function reviveCycle(raw: unknown): AgentCycleResult | null {
  if (!isRecord(raw) || typeof raw.cycleId !== "string" || typeof raw.status !== "string") {
    return null;
  }

  const cycle = cloneJson(raw) as AgentCycleResult;

  if (cycle.snapshot?.assets) {
    cycle.snapshot = freezeMarketSnapshot({
      ...cycle.snapshot,
      assets: cycle.snapshot.assets.map((asset) => ({ ...asset })),
      market: { ...cycle.snapshot.market },
      ...(cycle.snapshot.news ? { news: cycle.snapshot.news.map((item) => ({ ...item })) } : {}),
    });
  }

  return cycle;
}

export function snapshotPersistedState(store: AgentCycleStore, now = new Date()): PersistedArenaState {
  const account = store.getAccount();
  const cycles = store.listCycles().flatMap((cycle) => {
    const revived = reviveCycle(cycle);
    return revived ? [revived] : [];
  });
  const lastEquity = store.getLastEquity();

  return {
    agentId: MOMENTUM_ALPHA_AGENT.id,
    account,
    status: store.getAgentStatus(),
    dayStartEquity: store.getDayStartEquity(now),
    lastEquity,
    dayKey: utcDayKey(now),
    cycles,
  };
}

export function createStoreFromPersistedState(state: PersistedArenaState): AgentCycleStore {
  return createInMemoryAgentStore({
    account: state.account ?? createPaperAccount(),
    status: state.status,
    dayStartEquity: state.dayStartEquity,
    lastEquity: state.lastEquity,
    dayKey: state.dayKey,
    cycles: state.cycles.map((cycle) => reviveCycle(cycle)).filter((cycle): cycle is AgentCycleResult => cycle != null),
  });
}

export function persistedStateFromRows(
  agent: PersistedAgentRow | null,
  cycleRows: PersistedCycleRow[],
  now = new Date()
): PersistedArenaState | null {
  if (!agent) {
    return null;
  }

  const unwrapped = unwrapAccountPayload(agent.account_payload);
  const dayKey = agent.day_key ?? unwrapped.dayKey ?? utcDayKey(now);
  const lastEquity = agent.last_equity ?? unwrapped.account.cash;
  const cycles = cycleRows
    .map((row) => reviveCycle(row.payload))
    .filter((cycle): cycle is AgentCycleResult => cycle != null);

  return {
    agentId: MOMENTUM_ALPHA_AGENT.id,
    account: unwrapped.account,
    status: isAgentRiskStatus(agent.status) ? agent.status : "ACTIVE",
    dayStartEquity: agent.day_start_equity ?? lastEquity,
    lastEquity,
    dayKey,
    cycles,
  };
}

export type ArenaWriteRows = {
  agent: Record<string, unknown>;
  cycles: Record<string, unknown>[];
  snapshots: Record<string, unknown>[];
  decisions: Record<string, unknown>[];
  riskChecks: Record<string, unknown>[];
  trades: Record<string, unknown>[];
  positions: Record<string, unknown>[];
  portfolio: Record<string, unknown> | null;
  activity: Record<string, unknown>[];
};

export function toArenaWriteRows(state: PersistedArenaState, now = new Date()): ArenaWriteRows {
  const latest = state.cycles.at(-1);
  const valuation = latest?.valuation;

  return {
    agent: {
      id: MOMENTUM_ALPHA_AGENT.id,
      name: MOMENTUM_ALPHA_AGENT.name,
      description: MOMENTUM_ALPHA_DESCRIPTION,
      strategy: MOMENTUM_ALPHA_AGENT.strategy,
      initial_capital: state.account.initialCapital,
      status: state.status,
      risk_profile: "medium",
      account_payload: wrapAccountPayload(state.account, state.dayKey),
      day_start_equity: state.dayStartEquity,
      last_equity: state.lastEquity,
      day_key: state.dayKey,
      updated_at: now.toISOString(),
    },
    cycles: state.cycles.map((cycle) => ({
      agent_id: MOMENTUM_ALPHA_AGENT.id,
      cycle_id: cycle.cycleId,
      started_at: cycle.startedAt,
      completed_at: cycle.completedAt,
      status: cycle.status,
      error: cycle.failure ?? null,
      payload: cloneJson(cycle),
    })),
    snapshots: state.cycles.flatMap((cycle) =>
      cycle.snapshot
        ? [
            {
              cycle_id: cycle.cycleId,
              timestamp: cycle.snapshot.timestamp,
              payload: cloneJson(cycle.snapshot),
            },
          ]
        : []
    ),
    decisions: state.cycles.flatMap((cycle) =>
      cycle.decision
        ? [
            {
              id: cycle.cycleId,
              agent_id: MOMENTUM_ALPHA_AGENT.id,
              cycle_id: cycle.cycleId,
              action: cycle.decision.action,
              symbol: cycle.decision.symbol,
              allocation_percent: cycle.decision.allocationPercent,
              confidence: cycle.decision.confidence,
              stop_loss_percent: cycle.decision.stopLossPercent ?? null,
              take_profit_percent: cycle.decision.takeProfitPercent ?? null,
              time_horizon: cycle.decision.timeHorizon,
              reasons: cycle.decision.reasons,
              risk_factors: cycle.decision.riskFactors,
              created_at: cycle.completedAt,
            },
          ]
        : []
    ),
    riskChecks: state.cycles.flatMap((cycle) =>
      cycle.riskResult
        ? [
            {
              decision_id: cycle.cycleId,
              approved: cycle.riskResult.approved,
              verdict: cycle.riskResult.verdict,
              reason: cycle.riskResult.reason,
              adjusted_allocation_percent: cycle.riskResult.adjustedAllocationPercent ?? null,
            },
          ]
        : []
    ),
    trades: state.account.trades.map((trade) => ({
      id: trade.id,
      agent_id: MOMENTUM_ALPHA_AGENT.id,
      decision_id: trade.cycleId,
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity,
      price: trade.price,
      notional: trade.notional,
      realized_pnl: trade.realizedPnl ?? null,
      created_at: trade.createdAt,
    })),
    positions: state.account.positions.map((position) => ({
      agent_id: MOMENTUM_ALPHA_AGENT.id,
      symbol: position.symbol,
      quantity: position.quantity,
      average_entry_price: position.averageEntryPrice,
    })),
    portfolio:
      valuation && latest
        ? {
            agent_id: MOMENTUM_ALPHA_AGENT.id,
            cycle_id: latest.cycleId,
            timestamp: latest.completedAt,
            cash: valuation.portfolio.cash,
            equity: valuation.portfolio.equity,
            realized_pnl: valuation.portfolio.realizedPnl,
            unrealized_pnl: valuation.portfolio.unrealizedPnl,
            return_percent: valuation.portfolio.returnPercent,
            drawdown_percent: valuation.portfolio.drawdownPercent,
          }
        : null,
    activity: state.cycles.flatMap((cycle) =>
      cycleToActivityEvents(cycle).map((event) => ({
        id: event.id,
        agent_id: event.agentId,
        cycle_id: cycle.cycleId,
        type: event.type,
        title: event.title,
        description: event.description,
        metadata: { strategy: cycle.strategy },
        created_at: event.createdAt,
      }))
    ),
  };
}

export async function persistArenaState(
  writer: ArenaWriter,
  state: PersistedArenaState,
  now = new Date()
): Promise<void> {
  const rows = toArenaWriteRows(state, now);

  await writer.upsert("agents", [rows.agent], "id");

  if (rows.snapshots.length > 0) {
    await writer.upsert("market_snapshots", rows.snapshots, "cycle_id");
  }

  if (rows.cycles.length > 0) {
    await writer.upsert("agent_cycles", rows.cycles, "agent_id,cycle_id");
  }

  if (rows.decisions.length > 0) {
    await writer.upsert("decisions", rows.decisions, "id");
  }

  if (rows.riskChecks.length > 0) {
    await writer.upsert("risk_checks", rows.riskChecks, "decision_id");
  }

  if (rows.trades.length > 0) {
    await writer.upsert("trades", rows.trades, "id");
  }

  await writer.deleteEq("positions", "agent_id", MOMENTUM_ALPHA_AGENT.id);

  if (rows.positions.length > 0) {
    await writer.upsert("positions", rows.positions, "agent_id,symbol");
  }

  if (rows.portfolio) {
    await writer.upsert("portfolio_snapshots", [rows.portfolio], "agent_id,cycle_id");
  }

  if (rows.activity.length > 0) {
    await writer.upsert("activity_events", rows.activity, "id");
  }
}
