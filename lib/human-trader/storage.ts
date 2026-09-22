import { createPaperAccount } from "@/lib/paper/portfolio";
import type { PaperAccount } from "@/lib/paper/types";
import type { EquityCurvePoint } from "@/types/arena";
import { HUMAN_TRADER_INITIAL_CAPITAL } from "@/lib/human-trader/constants";
import type { HumanTraderPersistedState } from "@/lib/human-trader/types";

export function createInitialHumanTraderState(
  initialCapital = HUMAN_TRADER_INITIAL_CAPITAL
): HumanTraderPersistedState {
  const account = createPaperAccount(initialCapital);
  const at = new Date().toISOString();

  return {
    version: 1,
    account,
    equityHistory: [{ equity: initialCapital, at, label: "Start" }],
  };
}

export function serializeHumanTraderState(state: HumanTraderPersistedState): string {
  return JSON.stringify(state);
}

export function parseHumanTraderState(raw: string | null | undefined): HumanTraderPersistedState | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as HumanTraderPersistedState;

    if (parsed?.version !== 1 || !parsed.account) {
      return null;
    }

    if (!Number.isFinite(parsed.account.initialCapital) || !Array.isArray(parsed.account.positions)) {
      return null;
    }

    return {
      version: 1,
      account: parsed.account,
      equityHistory: Array.isArray(parsed.equityHistory) ? parsed.equityHistory : [],
    };
  } catch {
    return null;
  }
}

export function appendEquityHistoryPoint(
  history: readonly EquityCurvePoint[],
  equity: number,
  at: string
): EquityCurvePoint[] {
  return [...history, { equity, at }];
}

export function resetHumanTraderState(): HumanTraderPersistedState {
  return createInitialHumanTraderState();
}

export function accountAfterTrade(
  state: HumanTraderPersistedState,
  account: PaperAccount,
  equity: number,
  at: string
): HumanTraderPersistedState {
  return {
    version: 1,
    account,
    equityHistory: appendEquityHistoryPoint(state.equityHistory, equity, at),
  };
}
