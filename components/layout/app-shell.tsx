import type { ReactNode } from "react";
import { ArenaBrand } from "@/components/layout/arena-brand";
import { IconRail } from "@/components/layout/icon-rail";
import { LiveRefresh } from "@/components/arena/live-refresh";
import { ShellChrome } from "@/components/layout/shell-chrome";

export function AppShell({
  children,
  showDebugControls = false,
  showHumanTrader = false,
}: {
  children: ReactNode;
  showDebugControls?: boolean;
  showHumanTrader?: boolean;
}) {
  return (
    <div className="min-h-dvh bg-background">
      <div className="lg:grid lg:grid-cols-[104px_minmax(0,1fr)]">
        <div className="hidden lg:flex lg:flex-col">
          <div className="flex h-[72px] items-center justify-center">
            <ArenaBrand showWordmark={false} />
          </div>
          <IconRail showDebugControls={showDebugControls} showHumanTrader={showHumanTrader} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <ShellChrome showDebugControls={showDebugControls} showHumanTrader={showHumanTrader} />
          <main className="min-w-0 flex-1 px-3 pb-3">{children}</main>
        </div>
      </div>
      <LiveRefresh />
    </div>
  );
}
