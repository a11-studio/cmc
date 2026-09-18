"use server";

import { revalidatePath } from "next/cache";
import { setLiveTradingStatus } from "@/lib/arena/data";

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
  const nextStatus = intent === "resume" ? "ACTIVE" : "PAUSED";
  const status = await setLiveTradingStatus(nextStatus);

  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/activity");
  revalidatePath("/agents/momentum-alpha");

  return {
    ok: true,
    status,
    message: status === "PAUSED" ? "Trading paused. Cycles will not open new trades." : "Trading resumed.",
  };
}
