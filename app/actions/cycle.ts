"use server";

import { revalidatePath } from "next/cache";
import { executeMomentumAlphaCycle } from "@/lib/arena/data";
import { isManualCycleEnabled } from "@/lib/agent/view";

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

export async function runMomentumAlphaCycleAction(
  previousState: ManualCycleState | null,
  formData: FormData
): Promise<ManualCycleState> {
  void previousState;
  void formData;

  if (!isManualCycleEnabled()) {
    return disabledState;
  }

  const result = await executeMomentumAlphaCycle();

  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/activity");
  revalidatePath("/agents/momentum-alpha");
  if (result.cycleId) {
    revalidatePath(`/decisions/${result.cycleId}`);
  }

  return { ...result, enabled: true };
}
