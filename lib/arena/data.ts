import "server-only";

import { MOMENTUM_ALPHA_AGENT } from "@/lib/agent/constants";
import {
  getAgentStore,
  getMomentumAlphaStore,
  runConfiguredAgentCycle,
  runLiveAgentCycles,
  runMomentumAlphaCycle,
  setAgentTradingStatus,
  setMomentumAlphaTradingStatus,
} from "@/lib/agent/runtime";
import { latestCycleCompletedAt } from "@/lib/agent/scheduler";
import {
  buildAgentView,
  buildMomentumAlphaView,
  cycleToDecisionRecord,
  serializeTriggerResult,
} from "@/lib/agent/view";
import type { MomentumAlphaView } from "@/lib/agent/view";
import { listLiveAgents } from "@/lib/agents/registry";
import { buildAgentRoster } from "@/lib/agents/roster";
import { getPersistenceMode } from "@/lib/env.server";
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
    const stamps = await Promise.all(
      listLiveAgents().map(async (agent) => latestCycleCompletedAt((await getAgentStore(agent.id)).listCycles()))
    );
    const times = stamps
      .filter((value): value is string => Boolean(value))
      .map((value) => Date.parse(value))
      .filter((value) => Number.isFinite(value));

    if (times.length === 0) {
      return null;
    }

    return new Date(Math.max(...times)).toISOString();
  } catch {
    return null;
  }
}

export async function getArenaCycleControl() {
  const books = await getLiveAgentViews();
  const statuses = books.map((book) => book.agent.status);

  return {
    lastCompletedAt: latestCycleCompletedAt(books.flatMap((book) => book.cycles)),
    autoRun: statuses.some((status) => status === "ACTIVE"),
    paused: statuses.length > 0 && statuses.every((status) => status === "PAUSED"),
  };
}

export async function getLiveAgentView(agentId: string): Promise<MomentumAlphaView> {
  return buildAgentView(await getAgentStore(agentId), agentId);
}

export async function getLiveAgentViews(): Promise<MomentumAlphaView[]> {
  return Promise.all(listLiveAgents().map((agent) => getLiveAgentView(agent.id)));
}

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
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)
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
    const cycle = (await getAgentStore(agent.id)).findCycle(id);

    if (cycle) {
      return cycleToDecisionRecord(cycle) ?? undefined;
    }
  }

  return undefined;
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

  return preferred ? serializeTriggerResult(preferred) : { ok: false, enabled: true, message: "No live agents." };
}
