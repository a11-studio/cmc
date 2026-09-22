import "server-only";

import { cache } from "react";
import { createGeminiDecisionEngine } from "@/lib/ai/provider";
import {
  isBtcLiquidationSignalAgent,
  tradeDecisionFromBtcLiquidationSignal,
} from "@/lib/agent/btc-liquidation-decision";
import { runAgentCycle } from "@/lib/agent/cycle";
import { MOMENTUM_ALPHA_AGENT } from "@/lib/agent/constants";
import {
  claimAgentCycle,
  hydrateAgentStore,
  persistAgentStore,
  skippedDuplicateFromStore,
} from "@/lib/agent/durable";
import { cycleIdForSlot } from "@/lib/agent/scheduler";
import { createInMemoryAgentStore } from "@/lib/agent/store";
import type { AgentCycleDependencies, AgentCycleResult, AgentCycleStore } from "@/lib/agent/types";
import { getAgentDefinition, listLiveAgents, toAgentIdentity } from "@/lib/agents/registry";
import { isSupabasePersistenceConfigured } from "@/lib/env.server";
import { createMarketDataProvider } from "@/lib/market/provider";
import { executePaperDecision } from "@/lib/paper/engine";
import { createPaperAccount } from "@/lib/paper/portfolio";
import { evaluateRisk } from "@/lib/risk/evaluate";

const memoryStores = new Map<string, AgentCycleStore>();
const evaluationStores = new Map<string, AgentCycleStore>();

function memoryStoreFor(agentId: string): AgentCycleStore {
  const existing = memoryStores.get(agentId);

  if (existing) {
    return existing;
  }

  const store = createInMemoryAgentStore({
    initialCapital: getAgentDefinition(agentId).initialCapital,
  });
  memoryStores.set(agentId, store);
  return store;
}

async function resolveDashboardStore(agentId: string): Promise<AgentCycleStore> {
  if (!isSupabasePersistenceConfigured()) {
    return memoryStoreFor(agentId);
  }

  return hydrateAgentStore(agentId, "dashboard");
}

async function resolveExecutionStore(agentId: string): Promise<AgentCycleStore> {
  if (!isSupabasePersistenceConfigured()) {
    return memoryStoreFor(agentId);
  }

  return hydrateAgentStore(agentId, "execution");
}

function cycleDependencies(store: AgentCycleStore): AgentCycleDependencies {
  return {
    async getMarketSnapshot(symbols) {
      return createMarketDataProvider().getMarketSnapshot(symbols);
    },
    async loadFloorChatForAgent(agentId) {
      const { floorChatForAgent } = await import("@/lib/chat/floor");
      const { listArenaChatMessages } = await import("@/lib/chat/store");
      const recent = await listArenaChatMessages(25);
      return floorChatForAgent(agentId, recent);
    },
    async generateTradeDecision(context) {
      if (isBtcLiquidationSignalAgent(context.agentId)) {
        return tradeDecisionFromBtcLiquidationSignal(context);
      }

      return createGeminiDecisionEngine().generateTradeDecision(context);
    },
    evaluateRisk,
    executePaperDecision,
    store,
  };
}

function evaluationStoreFor(agentId: string, initialCapital: number): AgentCycleStore {
  const existing = evaluationStores.get(agentId);

  if (existing) {
    return existing;
  }

  const store = createInMemoryAgentStore({ account: createPaperAccount(initialCapital) });
  evaluationStores.set(agentId, store);
  return store;
}

export const getAgentStore = cache(async (agentId: string): Promise<AgentCycleStore> => {
  return resolveDashboardStore(agentId);
});

export async function getMomentumAlphaStore(): Promise<AgentCycleStore> {
  return getAgentStore(MOMENTUM_ALPHA_AGENT.id);
}

export async function setAgentTradingStatus(agentId: string, status: "ACTIVE" | "PAUSED") {
  const store = await getAgentStore(agentId);
  store.setAgentStatus(status);

  try {
    await persistAgentStore(agentId, store);
  } catch (error) {
    console.error(`Failed to persist ${agentId} trading status`, error);
  }

  return store.getAgentStatus();
}

export async function setMomentumAlphaTradingStatus(status: "ACTIVE" | "PAUSED") {
  return setAgentTradingStatus(MOMENTUM_ALPHA_AGENT.id, status);
}

export async function runLiveAgentCycle(
  agentId: string,
  options?: { cycleId?: string }
): Promise<AgentCycleResult> {
  const definition = getAgentDefinition(agentId);
  const agent = toAgentIdentity(definition);
  const now = new Date();
  const cycleId = options?.cycleId ?? cycleIdForSlot(now, definition.id);
  const store = await resolveExecutionStore(definition.id);

  if (!(await claimAgentCycle(definition.id, cycleId, now))) {
    return skippedDuplicateFromStore(store, cycleId, now, definition.id);
  }

  const result = await runAgentCycle({
    agent,
    cycleId,
    deps: cycleDependencies(store),
  });

  try {
    await persistAgentStore(definition.id, store);
  } catch (error) {
    console.error(`Failed to persist ${definition.displayName} cycle`, error);
  }

  try {
    const { maybePostArenaChat } = await import("@/lib/chat/run");
    await maybePostArenaChat(result);
  } catch (error) {
    console.error(`Failed to post ${definition.displayName} floor chat`, error);
  }

  return result;
}

export async function runMomentumAlphaCycle(options?: { cycleId?: string }): Promise<AgentCycleResult> {
  return runLiveAgentCycle(MOMENTUM_ALPHA_AGENT.id, options);
}

export async function runLiveAgentCycles(options?: { cycleId?: string }): Promise<AgentCycleResult[]> {
  const results: AgentCycleResult[] = [];

  for (const agent of listLiveAgents()) {
    // One agent throwing used to abandon everyone after it in the list, which
    // is why whole hours landed with only three or four agents.
    try {
      results.push(await runLiveAgentCycle(agent.id, options));
    } catch (error) {
      console.error(`Agent cycle threw for ${agent.id}`, error);
    }
  }

  return results;
}

export async function runConfiguredAgentCycle(
  agentId: string,
  options?: { cycleId?: string }
): Promise<AgentCycleResult> {
  const definition = getAgentDefinition(agentId);

  if (definition.status === "LIVE") {
    return runLiveAgentCycle(definition.id, options);
  }

  const now = new Date();
  const cycleId = options?.cycleId ?? cycleIdForSlot(now, definition.id);
  const store = evaluationStoreFor(definition.id, definition.initialCapital);

  return runAgentCycle({
    agentId: definition.id,
    cycleId,
    deps: cycleDependencies(store),
  });
}
