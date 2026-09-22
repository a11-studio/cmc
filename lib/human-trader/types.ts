import type { PaperAccount } from "@/lib/paper/types";
import type { EquityCurvePoint } from "@/types/arena";

export type HumanTraderPersistedState = {
  version: 1;
  account: PaperAccount;
  equityHistory: EquityCurvePoint[];
};
