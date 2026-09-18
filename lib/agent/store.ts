import { createPaperAccount } from "@/lib/paper/portfolio";
import type { PaperAccount } from "@/lib/paper/types";
import type { AgentRiskStatus } from "@/lib/risk/types";
import { MOMENTUM_ALPHA_AGENT } from "@/lib/agent/constants";
import type { AgentCycleResult, AgentCycleStore } from "@/lib/agent/types";

function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function cloneAccount(account: PaperAccount): PaperAccount {
  return {
    ...account,
    positions: account.positions.map((position) => ({ ...position })),
    trades: account.trades.map((trade) => ({ ...trade })),
  };
}

export function createInMemoryAgentStore(options?: {
  account?: PaperAccount;
  status?: AgentRiskStatus;
  dayStartEquity?: number;
  lastEquity?: number;
  initialCapital?: number;
  cycles?: AgentCycleResult[];
  dayKey?: string;
}): AgentCycleStore {
  let account = cloneAccount(options?.account ?? createPaperAccount(options?.initialCapital ?? MOMENTUM_ALPHA_AGENT.initialCapital));
  let lastEquity = options?.lastEquity ?? options?.dayStartEquity ?? account.cash;
  let dayKey = options?.dayKey ?? "";
  let dayStartEquity = options?.dayStartEquity ?? lastEquity;
  let status: AgentRiskStatus = options?.status ?? "ACTIVE";
  const cycles = new Map((options?.cycles ?? []).map((cycle) => [cycle.cycleId, cycle]));
  const inflight = new Set<string>();

  return {
    getAccount() {
      return cloneAccount(account);
    },
    commitAccount(next, equity) {
      account = cloneAccount(next);
      lastEquity = equity;
    },
    getAgentStatus() {
      return status;
    },
    setAgentStatus(next) {
      status = next;
    },
    getDayStartEquity(now) {
      const key = utcDayKey(now);

      if (dayKey !== key) {
        dayKey = key;
        dayStartEquity = lastEquity;
      }

      return dayStartEquity;
    },
    getLastEquity() {
      return lastEquity;
    },
    findCycle(cycleId) {
      return cycles.get(cycleId);
    },
    listCycles() {
      return [...cycles.values()];
    },
    beginCycle(cycleId) {
      if (cycles.has(cycleId) || inflight.has(cycleId)) {
        return false;
      }

      inflight.add(cycleId);
      return true;
    },
    saveCycle(result) {
      cycles.set(result.cycleId, result);
      inflight.delete(result.cycleId);
    },
    releaseCycle(cycleId) {
      inflight.delete(cycleId);
    },
    forgetCycle(cycleId) {
      cycles.delete(cycleId);
      inflight.delete(cycleId);
    },
  };
}
