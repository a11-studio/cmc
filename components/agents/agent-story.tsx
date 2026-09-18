import { getAgentStory } from "@/lib/agents/stories";
import type { AgentRiskProfile, AgentRosterStatus } from "@/lib/agents/types";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<AgentRosterStatus, string> = {
  LIVE: "text-[#8ADF7B]",
  READY: "text-[#00D4CF]",
  SIMULATION: "text-white/45",
};

function Widget({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-[148px] rounded-[16px] bg-[#101010] px-4 py-3">
      <p className="text-[11px] font-medium tracking-[0.14em] text-white/40 uppercase">{label}</p>
      <p className={cn("mt-1.5 text-[15px] font-medium", valueClassName)}>{value}</p>
    </div>
  );
}

export function AgentStatusWidgets({
  status,
  riskProfile,
}: {
  status: AgentRosterStatus;
  riskProfile: AgentRiskProfile;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <Widget label="Status" value={status} valueClassName={STATUS_TONE[status]} />
      <Widget label="Risk profile" value={riskProfile} valueClassName="capitalize" />
    </div>
  );
}

export function AgentStorySections({ agentId }: { agentId: string }) {
  const story = getAgentStory(agentId);

  if (!story) {
    return null;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <h2 className="text-[19px] font-medium tracking-tight">Strategy</h2>
        <div className="mt-4 space-y-4 text-[15px] leading-7 text-white/60">
          {story.strategy.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-[19px] font-medium tracking-tight">How it worked</h2>
        <div className="mt-4 space-y-4 text-[15px] leading-7 text-white/60">
          {story.history.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </section>
    </div>
  );
}
