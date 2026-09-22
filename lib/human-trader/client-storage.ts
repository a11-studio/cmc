"use client";

import { HUMAN_TRADER_STORAGE_KEY } from "@/lib/human-trader/constants";
import {
  createInitialHumanTraderState,
  parseHumanTraderState,
  serializeHumanTraderState,
} from "@/lib/human-trader/storage";
import type { HumanTraderPersistedState } from "@/lib/human-trader/types";

export function loadHumanTraderStateFromBrowser(): HumanTraderPersistedState {
  if (typeof window === "undefined") {
    return createInitialHumanTraderState();
  }

  const stored = parseHumanTraderState(window.localStorage.getItem(HUMAN_TRADER_STORAGE_KEY));

  return stored ?? createInitialHumanTraderState();
}

export function saveHumanTraderStateToBrowser(state: HumanTraderPersistedState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(HUMAN_TRADER_STORAGE_KEY, serializeHumanTraderState(state));
}

export function clearHumanTraderStateInBrowser(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(HUMAN_TRADER_STORAGE_KEY);
}
