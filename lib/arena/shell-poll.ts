import { shouldPollArenaShellForCycle } from "@/lib/agent/scheduler";

export const SHELL_POLL_INTERVAL_MS = 5_000;

export function isDocumentVisible(): boolean {
  if (typeof document === "undefined") {
    return true;
  }

  return document.visibilityState === "visible";
}

export function shouldPollShellNow(
  payload: { cycleInProgress?: boolean } | null,
  now: Date,
  visible = isDocumentVisible()
): boolean {
  if (!visible) {
    return false;
  }

  return Boolean(payload?.cycleInProgress) || shouldPollArenaShellForCycle(now);
}
