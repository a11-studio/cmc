"use server";

import { revalidatePath } from "next/cache";
import { MOMENTUM_ALPHA_AGENT } from "@/lib/agent/constants";
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

  const intent = formData.get("intent");
  const agentId = String(formData.get("agentId") ?? "").trim() || MOMENTUM_ALPHA_AGENT.id;
  const nextStatus = intent === "resume" ? "ACTIVE" : "PAUSED";
  const status = await setLiveAgentTradingStatus(agentId, nextStatus);

  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/activity");

  for (const agent of listLiveAgents()) {
    revalidatePath(`/agents/${agent.id}`);
  }

  return {
    ok: true,
    status,
    message: status === "PAUSED" ? "Trading paused. Cycles will not open new trades." : "Trading resumed.",
  };
}
