import type { ReactNode } from "react";
import { isArenaDebugControlsEnabled } from "@/lib/agent/view";
import { AppShell } from "@/components/layout/app-shell";

export default function TerminalLayout({ children }: { children: ReactNode }) {
  return <AppShell showDebugControls={isArenaDebugControlsEnabled()}>{children}</AppShell>;
}
