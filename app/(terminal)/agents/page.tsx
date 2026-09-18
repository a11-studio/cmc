import Link from "next/link";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { PageHeader } from "@/components/shared/page-header";
import { getArenaDashboard } from "@/lib/arena/data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Agents",
};

export default async function AgentsPage() {
  const { roster } = await getArenaDashboard();

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Agents"
        title="Trading philosophies"
        description="Each agent has a skill file. Elon, Dennis, Donchian, Livermore, Simons, and Burry are live."
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {roster.map((agent) => {
          const live = agent.runtimeStatus === "LIVE" || agent.dataSource === "live";

          return (
            <Link
              key={agent.id}
              href={`/agents/${agent.id}`}
              className="rounded-[20px] bg-[#101010] p-6 transition-colors hover:bg-[#141414]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <AgentAvatar mark={agent.mark} name={agent.name} />
                  <div>
                    <p className="text-[16px] font-medium">{agent.name}</p>
                    <p className="mt-0.5 text-[13px] text-white/45">{agent.strategy}</p>
                  </div>
                </div>
                <span
                  className={cn(
                    "text-[11px] font-medium tracking-[0.12em]",
                    live ? "text-[#8ADF7B]" : "text-[#00D4CF]"
                  )}
                >
                  {live ? "LIVE" : "READY"}
                </span>
              </div>
              <p className="mt-4 text-[13px] leading-5 text-white/55">{agent.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
