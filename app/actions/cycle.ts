"use server";

import { revalidatePath } from "next/cache";
import { executeConfiguredAgentCycle, executeLiveAgentCycles } from "@/lib/arena/data";
import { isManualCycleEnabled } from "@/lib/agent/view";
import { listLiveAgents } from "@/lib/agents/registry";

export type ManualCycleState = {
  ok: boolean;
  enabled: boolean;
  message: string;
  status?: string;
  cycleId?: string;
  riskVerdict?: string | null;
  failure?: { stage: string; code: string; message: string } | null;
  snapshotTimestamp?: string | null;
  decision?: { action: string; symbol: string; allocationPercent: number; confidence: number } | null;
};

const disabledState: ManualCycleState = {
  ok: false,
  enabled: false,
  message: "Manual Run Cycle is disabled in production.",
};

function revalidateArena(agentId?: string) {
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/activity");

  for (const agent of listLiveAgents()) {
    revalidatePath(`/agents/${agent.id}`);
  }

  if (agentId) {
    revalidatePath(`/agents/${agentId}`);
  }
}

export async function runMomentumAlphaCycleAction(
  previousState: ManualCycleState | null,
  formData: FormData
): Promise<ManualCycleState> {
  void previousState;

  if (!isManualCycleEnabled()) {
    return disabledState;
  }

  const agentId = String(formData.get("agentId") ?? "").trim();
  const result = agentId ? await executeConfiguredAgentCycle(agentId) : await executeLiveAgentCycles();

  revalidateArena(agentId || undefined);
  if (result.cycleId) {
    revalidatePath(`/decisions/${result.cycleId}`);
  }

  return { ...result, enabled: true };
}
