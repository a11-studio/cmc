import "server-only";

import { createGeminiDecisionEngine } from "@/lib/ai/provider";
import { runAgentCycle } from "@/lib/agent/cycle";
import { MOMENTUM_ALPHA_AGENT } from "@/lib/agent/constants";
import {
  claimMomentumAlphaCycle,
  hydrateMomentumAlphaStore,
  persistMomentumAlphaStore,
  skippedDuplicateFromStore,
} from "@/lib/agent/durable";
import { cycleIdForSlot } from "@/lib/agent/scheduler";
import { createInMemoryAgentStore } from "@/lib/agent/store";
import type { AgentCycleDependencies, AgentCycleResult, AgentCycleStore } from "@/lib/agent/types";
import { getAgentDefinition } from "@/lib/agents/registry";
import { isSupabasePersistenceConfigured } from "@/lib/env.server";
import { createMarketDataProvider } from "@/lib/market/provider";
import { executePaperDecision } from "@/lib/paper/engine";
import { createPaperAccount } from "@/lib/paper/portfolio";
import { evaluateRisk } from "@/lib/risk/evaluate";

const memoryStore = createInMemoryAgentStore();
const evaluationStores = new Map<string, AgentCycleStore>();

async function resolveStore(): Promise<AgentCycleStore> {
  if (!isSupabasePersistenceConfigured()) {
    return memoryStore;
  }

  return hydrateMomentumAlphaStore();
}

function cycleDependencies(store: AgentCycleStore): AgentCycleDependencies {
  return {
    async getMarketSnapshot(symbols) {
      return createMarketDataProvider().getMarketSnapshot(symbols);
    },
    async generateTradeDecision(context) {
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

export async function getMomentumAlphaStore(): Promise<AgentCycleStore> {
  return resolveStore();
}

export async function setMomentumAlphaTradingStatus(status: "ACTIVE" | "PAUSED") {
  const store = await resolveStore();
  store.setAgentStatus(status);

  try {
    await persistMomentumAlphaStore(store);
  } catch (error) {
    console.error("Failed to persist Elon Musk trading status", error);
  }

  return store.getAgentStatus();
}

export async function runMomentumAlphaCycle(options?: { cycleId?: string }): Promise<AgentCycleResult> {
  const now = new Date();
  const cycleId = options?.cycleId ?? cycleIdForSlot(now);
  const store = await resolveStore();

  if (!(await claimMomentumAlphaCycle(cycleId, now))) {
    return skippedDuplicateFromStore(store, cycleId, now);
  }

  const result = await runAgentCycle({
    agent: MOMENTUM_ALPHA_AGENT,
    cycleId,
    deps: cycleDependencies(store),
  });

  try {
    await persistMomentumAlphaStore(store);
  } catch (error) {
    console.error("Failed to persist Elon Musk cycle", error);
  }

  return result;
}

export async function runConfiguredAgentCycle(
  agentId: string,
  options?: { cycleId?: string }
): Promise<AgentCycleResult> {
  const definition = getAgentDefinition(agentId);

  if (definition.id === MOMENTUM_ALPHA_AGENT.id) {
    return runMomentumAlphaCycle(options);
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
