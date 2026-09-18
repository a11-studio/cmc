import "server-only";

import { MOMENTUM_ALPHA_AGENT } from "@/lib/agent/constants";
import { getMomentumAlphaStore, runConfiguredAgentCycle, runMomentumAlphaCycle, setMomentumAlphaTradingStatus } from "@/lib/agent/runtime";
import { latestCycleCompletedAt } from "@/lib/agent/scheduler";
import { buildMomentumAlphaView, cycleToDecisionRecord, serializeTriggerResult } from "@/lib/agent/view";
import type { MomentumAlphaView } from "@/lib/agent/view";
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

export async function getLastCycleCompletedAt(): Promise<string | null> {
  try {
    const store = await getMomentumAlphaStore();
    return latestCycleCompletedAt(store.listCycles());
  } catch {
    return null;
  }
}

export async function getMomentumAlphaView(): Promise<MomentumAlphaView> {
  return buildMomentumAlphaView(await getMomentumAlphaStore());
}

export async function getArenaAgents(): Promise<LeaderboardAgent[]> {
  return [(await getMomentumAlphaView()).agent];
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

export async function getArenaDashboard() {
  const live = await getMomentumAlphaView();
  const agents = [live.agent];

  return {
    agents,
    roster: buildAgentRoster(live.agent),
    live,
    summary: getArenaSummary(agents),
    persistenceMode: getPersistenceMode(),
  };
}

export async function getLiveOrSampleBook(id: string) {
  if (id === MOMENTUM_ALPHA_AGENT.id) {
    return getMomentumAlphaView();
  }

  return undefined;
}

export async function getLiveOrSampleDecision(id: string): Promise<DecisionRecord | undefined> {
  const live = (await getMomentumAlphaStore()).findCycle(id);

  return live ? cycleToDecisionRecord(live) ?? undefined : undefined;
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
