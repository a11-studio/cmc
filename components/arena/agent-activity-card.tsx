import { DashboardCard, DashboardCardTitle } from "@/components/arena/dashboard-card";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActivityEvent, ActivityEventType } from "@/types/arena";

const STATUS_LABEL: Record<ActivityEventType, string> = {
  ANALYZING: "ANALYZING",
  SIGNAL: "DECISION",
  NEWS: "ANALYZING",
  DECISION: "DECISION",
  RISK_CHECK: "RISK CHECK",
  TRADE_EXECUTED: "TRADE EXECUTED",
  TRADE_REJECTED: "BLOCKED",
  ERROR: "FAILED",
};

function activityCopy(event: ActivityEvent) {
  if (event.type === "ANALYZING") {
    return "Market analysis complete · BTC / ETH / SOL / BNB / XRP";
  }

  return event.description;
}

const STATUS_TONE: Record<ActivityEventType, string> = {
  ANALYZING: "text-[#8ADF7B]",
  SIGNAL: "text-white",
  NEWS: "text-white/55",
  DECISION: "text-white",
  RISK_CHECK: "text-[#F59E0B]",
  TRADE_EXECUTED: "text-[#8ADF7B]",
  TRADE_REJECTED: "text-[#F87171]",
  ERROR: "text-[#F87171]",
};

export function AgentActivityCard({ events }: { events: ActivityEvent[] }) {
  const recent = [...events].reverse().slice(0, 6);

  return (
    <DashboardCard>
      <DashboardCardTitle>Agent activity</DashboardCardTitle>
      <p className="mt-1 text-[14px] leading-5 font-medium text-white/50">Recent Elon Musk cycles</p>

      {recent.length === 0 ? (
        <p className="mt-10 text-sm text-white/40">No live activity yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-white/6">
          {recent.map((event) => (
            <li key={event.id} className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-[11px] font-medium tracking-[0.14em] text-white/40 uppercase">
                  {event.agentName === "Momentum" || event.agentName === "Momentum Alpha"
                    ? "Elon Musk"
                    : event.agentName}
                </p>
                <p className={cn("mt-1 text-sm font-medium", STATUS_TONE[event.type])}>
                  {STATUS_LABEL[event.type]}
                </p>
                <p className="mt-1 truncate text-[13px] text-white/50">{activityCopy(event)}</p>
              </div>
              <time className="shrink-0 text-[12px] text-white/35" dateTime={event.createdAt}>
                {formatRelativeTime(event.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
