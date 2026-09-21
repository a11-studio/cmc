import Link from "next/link";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { formatPercent, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DailyWinnerEntry } from "@/lib/arena/daily-winners";

function formatDayLabel(dayKey: string) {
  const at = Date.parse(`${dayKey}T12:00:00.000Z`);

  if (!Number.isFinite(at)) {
    return dayKey;
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(at);
}

function CrownGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={cn("size-4 text-[#FFD60A]", className)}>
      <path
        fill="currentColor"
        d="M2 16h16v1.5H2V16Zm1.5-1.5h13l-1.2-5.2 2.4-3.1-2.1-.6L12 9.2 10 4.5 8 9.2 5.4 5.6 3.3 6.2l2.4 3.1L4.5 15Z"
      />
    </svg>
  );
}

export function DailyWinnerGrid({ winners }: { winners: readonly DailyWinnerEntry[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {winners.map((winner) => {
        const positive = winner.dailyPnl >= 0;

        return (
          <li key={winner.dayKey}>
            <Link
              href={`/agents/${winner.agentId}`}
              className="group block rounded-[20px] border border-white/8 bg-[#1C1C1E] p-5 transition-colors hover:border-white/14 hover:bg-[#222224]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium tracking-[0.12em] text-white/40 uppercase">
                    {formatDayLabel(winner.dayKey)}
                  </p>
                  <p className="mt-1 text-[13px] text-white/35">{winner.dayKey} UTC</p>
                </div>
                <CrownGlyph className="shrink-0 opacity-90" />
              </div>

              <div className="mt-5 flex items-center gap-3">
                <AgentAvatar mark={winner.mark} name={winner.agentName} size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-[17px] font-semibold tracking-[-0.02em] text-[#F5F5F7] group-hover:text-white">
                    {winner.agentName}
                  </p>
                  <p className="line-clamp-2 text-[13px] leading-5 text-white/45">{winner.strategy}</p>
                </div>
              </div>

              <div className="mt-5 flex items-end justify-between gap-3 border-t border-white/8 pt-4">
                <div>
                  <p className="text-[11px] font-medium text-white/40">Day P&amp;L</p>
                  <p
                    className={cn(
                      "mt-0.5 text-[22px] font-semibold tracking-[-0.03em]",
                      positive ? "text-positive" : "text-negative"
                    )}
                  >
                    {positive ? "+" : ""}
                    {formatUsd(winner.dailyPnl)}
                  </p>
                </div>
                <p className={cn("text-[15px] font-medium", positive ? "text-positive" : "text-negative")}>
                  {formatPercent(winner.dailyPnlPercent, true)}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
