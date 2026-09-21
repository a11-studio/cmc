"use server";

import { revalidatePath } from "next/cache";
import { isArenaDebugControlsEnabled } from "@/lib/agent/view";
import { listLiveAgents } from "@/lib/agents/registry";
import { setLiveAgentTradingStatus } from "@/lib/arena/data";

export type TradingControlState = {
  ok: boolean;
  status: "ACTIVE" | "PAUSED";
  message: string;
};

export async function setMomentumAlphaTradingAction(
  previousState: TradingControlState | null,
  formData: FormData
): Promise<TradingControlState> {
  void previousState;

  if (!isArenaDebugControlsEnabled()) {
    return {
      ok: false,
      status: "ACTIVE",
      message: "Trading controls are not available in production.",
    };
  }

  const intent = formData.get("intent");
  const agentId = String(formData.get("agentId") ?? "").trim();
  const nextStatus = intent === "resume" ? "ACTIVE" : "PAUSED";
  const targets = agentId ? [agentId] : listLiveAgents().map((agent) => agent.id);

  for (const id of targets) {
    await setLiveAgentTradingStatus(id, nextStatus);
  }

  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/activity");

  for (const agent of listLiveAgents()) {
    revalidatePath(`/agents/${agent.id}`);
  }

  return {
    ok: true,
    status: nextStatus,
    message: nextStatus === "PAUSED" ? "Trading paused. Cycles will not open new trades." : "Trading resumed.",
  };
}
