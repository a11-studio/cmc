import "server-only";

import { cache } from "react";
import { MOMENTUM_ALPHA_AGENT } from "@/lib/agent/constants";
import { fetchPersistedCycle } from "@/lib/agent/durable";
import {
  getAgentStore,
  getMomentumAlphaStore,
  runConfiguredAgentCycle,
  runLiveAgentCycles,
  runMomentumAlphaCycle,
  setAgentTradingStatus,
  setMomentumAlphaTradingStatus,
} from "@/lib/agent/runtime";
import { getArenaCycleControlState } from "@/lib/agent/cycle-control";
import { fetchAgentPortfolioEquityHistory } from "@/lib/agent/equity-history";
import { loadTradeCheckCycles } from "@/lib/agent/trade-check-cycles";
import {
  buildAgentView,
  buildMomentumAlphaView,
  cycleToDecisionRecord,
  serializeTriggerResult,
} from "@/lib/agent/view";
import type { MomentumAlphaView } from "@/lib/agent/view";
import { listLiveAgents } from "@/lib/agents/registry";
import { buildAgentRoster } from "@/lib/agents/roster";
import { getPersistenceMode, isSupabasePersistenceConfigured } from "@/lib/env.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DecisionRecord, LeaderboardAgent } from "@/types/arena";

export async function getLiveTradingStatus() {
  try {
    return (await getMomentumAlphaStore()).getAgentStatus();
  } catch {
    return "ACTIVE" as const;
  }
}

export async function setLiveTradingStatus(status: "ACTIVE" | "PAUSED") {
  return setMomentumAlphaTradingStatus(status);
}

export async function setLiveAgentTradingStatus(agentId: string, status: "ACTIVE" | "PAUSED") {
  return setAgentTradingStatus(agentId, status);
}

export async function getLastCycleCompletedAt(): Promise<string | null> {
  try {
    return (await getArenaCycleControl()).lastCompletedAt;
  } catch {
    return null;
  }
}

export const getArenaCycleControl = cache(async () => {
  try {
    return await getArenaCycleControlState();
  } catch {
    return {
      lastCompletedAt: null,
      autoRun: false,
      paused: false,
      cycleInProgress: false,
    };
  }
});

export const getLiveAgentView = cache(async (agentId: string): Promise<MomentumAlphaView> => {
  const [store, portfolioEquityHistory] = await Promise.all([
    getAgentStore(agentId),
    fetchAgentPortfolioEquityHistory(agentId),
  ]);

  let tradeCheckCycles: Awaited<ReturnType<typeof loadTradeCheckCycles>> | undefined;

  if (isSupabasePersistenceConfigured()) {
    const client = createSupabaseAdminClient();

    if (client) {
      try {
        tradeCheckCycles = await loadTradeCheckCycles(client, agentId, store.getAccount().trades);
      } catch (error) {
        console.error(`Trade check cycle load failed for ${agentId}`, error);
      }
    }
  }

  return buildAgentView(store, agentId, { portfolioEquityHistory, tradeCheckCycles });
});

export const getLiveAgentViews = cache(async (): Promise<MomentumAlphaView[]> => {
  return Promise.all(listLiveAgents().map((agent) => getLiveAgentView(agent.id)));
});

export async function getMomentumAlphaView(): Promise<MomentumAlphaView> {
  return buildMomentumAlphaView(await getMomentumAlphaStore());
}

export async function getArenaAgents(): Promise<LeaderboardAgent[]> {
  return (await getLiveAgentViews()).map((book) => book.agent);
}

export function getArenaSummary(leaderboard: LeaderboardAgent[]) {
  const startingCapital = leaderboard.reduce((sum, agent) => sum + agent.initialCapital, 0);
  const totalEquity = leaderboard.reduce((sum, agent) => sum + agent.equity, 0);
  const pnl = totalEquity - startingCapital;

  return {
    activeAgents: leaderboard.filter((agent) => agent.status === "ACTIVE").length,
    agentCount: leaderboard.length,
    startingCapital,
    totalEquity,
    pnl,
    returnPercent: startingCapital === 0 ? 0 : (pnl / startingCapital) * 100,
    bestReturn: Math.max(...leaderboard.map((agent) => agent.returnPercent)),
  };
}

function sortEvents<T extends { createdAt: string }>(events: T[]): T[] {
  return [...events].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
}

export async function getArenaDashboard() {
  const books = await getLiveAgentViews();
  const agents = books.map((book) => book.agent);
  const live = books.find((book) => book.agent.id === MOMENTUM_ALPHA_AGENT.id) ?? books[0]!;
  const decisions = [...books.flatMap((book) => book.decisions)].sort(
    (left, right) => Date.parse(right.createdAt ?? "") - Date.parse(left.createdAt ?? "")
  );

  return {
    agents,
    books,
    roster: buildAgentRoster(agents),
    live: {
      ...live,
      decisions,
      events: sortEvents(books.flatMap((book) => book.events)),
    },
    summary: getArenaSummary(agents),
    persistenceMode: getPersistenceMode(),
    paused: books.length > 0 && books.every((book) => book.agent.status === "PAUSED"),
  };
}

export async function getLiveOrSampleBook(id: string) {
  if (listLiveAgents().some((agent) => agent.id === id)) {
    return getLiveAgentView(id);
  }

  return undefined;
}

export async function getLiveOrSampleDecision(id: string): Promise<DecisionRecord | undefined> {
  for (const agent of listLiveAgents()) {
    const cycle =
      (await getAgentStore(agent.id)).findCycle(id) ?? (await fetchPersistedCycle(agent.id, id));

    if (cycle) {
      return cycleToDecisionRecord(cycle) ?? undefined;
    }
  }

  const { getDecision } = await import("@/lib/sample");
  return getDecision(id);
}

export function getArenaPersistenceMode() {
  return getPersistenceMode();
}

export async function executeMomentumAlphaCycle(options?: { cycleId?: string }) {
  const result = await runMomentumAlphaCycle(options);
  return serializeTriggerResult(result);
}

export async function executeConfiguredAgentCycle(agentId: string, options?: { cycleId?: string }) {
  const result = await runConfiguredAgentCycle(agentId, options);
  return serializeTriggerResult(result);
}

export async function executeLiveAgentCycles() {
  const results = await runLiveAgentCycles();
  const preferred =
    results.find((result) => result.status === "COMPLETED" || result.status === "BLOCKED") ??
    results.find((result) => result.status.startsWith("FAILED")) ??
    results.at(-1);

  return preferred
    ? serializeTriggerResult(preferred)
    : { ok: false, enabled: true, message: "No live agents.", cycleId: undefined };
}
