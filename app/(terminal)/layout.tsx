import type { ReactNode } from "react";
import { isArenaDebugControlsEnabled } from "@/lib/agent/view";
import { AppShell } from "@/components/layout/app-shell";
import { isArenaHumanTraderEnabled } from "@/lib/human-trader/flags";

export default function TerminalLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      showDebugControls={isArenaDebugControlsEnabled()}
      showHumanTrader={isArenaHumanTraderEnabled()}
    >
      {children}
    </AppShell>
  );
}
