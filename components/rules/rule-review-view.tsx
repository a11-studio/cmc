import Link from "next/link";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { DashboardCard, DashboardCardSubtitle, DashboardCardTitle } from "@/components/arena/dashboard-card";
import { findAgentDefinition } from "@/lib/agents/registry";
import type { AgentRuleSummary, RuleReviewSummary, VetoRecord } from "@/lib/arena/rule-review-core";
import { formatChartTime, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const cell = "border-t border-white/6 py-2.5 pr-4";
const head = "pb-3 pr-4 font-medium";

function utc(iso: string) {
  return `${formatChartTime(iso, "UTC")} UTC`;
}

function AgentCell({ agentId, name }: { agentId: string; name: string }) {
  const mark = findAgentDefinition(agentId)?.mark;

  return (
    <Link href={`/agents/${agentId}`} className="flex items-center gap-2.5 font-medium hover:underline">
      {mark ? <AgentAvatar mark={mark} name={name} size="sm" /> : null}
      <span>{name}</span>
    </Link>
  );
}

/** A positive move means the vetoed trade would have made money, so the veto cost that much. */
function VetoResult({ movePercent }: { movePercent: number | null | undefined }) {
  if (movePercent == null) {
    return <span className="text-white/40">—</span>;
  }

  if (Math.abs(movePercent) < 0.05) {
    return <span className="text-white/55">flat</span>;
  }

  const saved = movePercent < 0;

  return (
    <span className={cn("tabular-nums", saved ? "text-[#8ADF7B]" : "text-[#F87171]")}>
      {saved ? "saved" : "cost"} {formatPercent(Math.abs(movePercent), false, 1)}
    </span>
  );
}

function Count({ value }: { value: number }) {
  return <span className={cn("tabular-nums", value === 0 && "text-white/30")}>{value}</span>;
}

function AgentsCard({ agents }: { agents: AgentRuleSummary[] }) {
  return (
    <DashboardCard>
      <DashboardCardTitle>Decisions by agent</DashboardCardTitle>
      <DashboardCardSubtitle>
        Each cycle the rule proposes one trade or holds. Gemini can confirm an entry or veto it; exits cannot be vetoed.
      </DashboardCardSubtitle>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-[12px] text-white/40">
              <th className={head}>Agent</th>
              <th className={head}>Mode</th>
              <th className={cn(head, "text-right")}>Rule holds</th>
              <th className={cn(head, "text-right")}>Confirmed</th>
              <th className={cn(head, "text-right")}>Vetoed</th>
              <th className={cn(head, "text-right")}>Unreviewed</th>
              <th className={cn(head, "text-right")}>Stop exits</th>
              <th className={cn(head, "text-right")}>Trend exits</th>
              <th className="pb-3 text-right font-medium">Veto result</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.agentId}>
                <td className={cell}>
                  <AgentCell agentId={agent.agentId} name={agent.name} />
                </td>
                <td className={cn(cell, "text-[12px] font-medium tracking-[0.12em]", agent.hasRuleCore ? "text-[#00D4CF]" : "text-white/40")}>
                  {agent.hasRuleCore ? "RULE CORE" : "MODEL ONLY"}
                </td>
                <td className={cn(cell, "text-right")}>{agent.hasRuleCore ? <Count value={agent.ruleHolds} /> : "—"}</td>
                <td className={cn(cell, "text-right")}>{agent.hasRuleCore ? <Count value={agent.confirmed} /> : "—"}</td>
                <td className={cn(cell, "text-right")}>{agent.hasRuleCore ? <Count value={agent.vetoed} /> : "—"}</td>
                <td className={cn(cell, "text-right")}>{agent.hasRuleCore ? <Count value={agent.unreviewed} /> : "—"}</td>
                <td className={cn(cell, "text-right")}>
                  <Count value={agent.stopExits} />
                </td>
                <td className={cn(cell, "text-right")}>
                  <Count value={agent.trendExits} />
                </td>
                <td className="border-t border-white/6 py-2.5 text-right">
                  {agent.hasRuleCore ? <VetoResult movePercent={agent.vetoMovePercent} /> : <span className="text-white/40">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-[12px] leading-5 text-white/40">
        Unreviewed: the rule traded without a usable review (model unavailable, or its answer neither confirmed nor vetoed).
        Veto result: average move of vetoed trades in their own direction 24 hours later. Stop and trend exits apply to every agent.
      </p>
    </DashboardCard>
  );
}

function VetoesCard({ vetoes }: { vetoes: VetoRecord[] }) {
  return (
    <DashboardCard>
      <DashboardCardTitle>Vetoes {vetoes.length}</DashboardCardTitle>
      <DashboardCardSubtitle>Entries the rule proposed and Gemini blocked, with what the trade did afterwards.</DashboardCardSubtitle>

      {vetoes.length === 0 ? (
        <p className="mt-6 text-sm text-white/40">No vetoes in the last 14 days.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[820px] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-[12px] text-white/40">
                <th className={head}>Time</th>
                <th className={head}>Agent</th>
                <th className={head}>Proposal</th>
                <th className={head}>Gemini&apos;s reason</th>
                <th className={cn(head, "text-right")}>Checked after</th>
                <th className="pb-3 text-right font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {vetoes.map((veto) => (
                <tr key={veto.decisionId} className="align-top">
                  <td className={cn(cell, "whitespace-nowrap text-white/55 tabular-nums")}>
                    <Link href={`/decisions/${veto.decisionId}`} className="hover:underline">
                      {utc(veto.at)}
                    </Link>
                  </td>
                  <td className={cell}>
                    <AgentCell agentId={veto.agentId} name={veto.agentName} />
                  </td>
                  <td className={cn(cell, "whitespace-nowrap tabular-nums")}>
                    {veto.action} {veto.symbol} {formatPercent(veto.allocationPercent, false, 1)}
                  </td>
                  <td className={cn(cell, "max-w-[340px] text-white/70")}>{veto.reason}</td>
                  <td className={cn(cell, "text-right tabular-nums text-white/55")}>{veto.check ? `${veto.check.hours} h` : "—"}</td>
                  <td className="border-t border-white/6 py-2.5 text-right">
                    <VetoResult movePercent={veto.check?.movePercent} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardCard>
  );
}

function ExitsCard({ exits }: { exits: RuleReviewSummary["exits"] }) {
  return (
    <DashboardCard>
      <DashboardCardTitle>Protective exits {exits.length}</DashboardCardTitle>
      <DashboardCardSubtitle>
        Positions the risk engine closed before the agent decided: an ATR stop from entry, or a position on the wrong side of the trend.
      </DashboardCardSubtitle>

      {exits.length === 0 ? (
        <p className="mt-6 text-sm text-white/40">No protective exits in the last 14 days.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-[12px] text-white/40">
                <th className={head}>Time</th>
                <th className={head}>Agent</th>
                <th className={head}>Exit</th>
                <th className="pb-3 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {exits.map((exit) => (
                <tr key={exit.id} className="align-top">
                  <td className={cn(cell, "whitespace-nowrap text-white/55 tabular-nums")}>{utc(exit.at)}</td>
                  <td className={cell}>
                    <AgentCell agentId={exit.agentId} name={exit.agentName} />
                  </td>
                  <td className={cn(cell, "whitespace-nowrap text-[12px] font-medium tracking-[0.12em]", exit.kind === "STOP" ? "text-[#F87171]" : "text-[#F59E0B]")}>
                    {exit.kind === "STOP" ? "STOP" : "TREND"}
                  </td>
                  <td className="border-t border-white/6 py-2.5 text-white/70">{exit.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardCard>
  );
}

export function RuleReviewView({ summary }: { summary: RuleReviewSummary }) {
  return (
    <div className="space-y-6">
      {summary.ruleDecisions === 0 ? (
        <p className="rounded-[20px] bg-[#101010] px-5 py-4 text-[13px] leading-5 text-white/55">
          No rule-core cycle has run yet. Counts fill in from the next hourly cycle.
        </p>
      ) : null}
      <AgentsCard agents={summary.agents} />
      <VetoesCard vetoes={summary.vetoes} />
      <ExitsCard exits={summary.exits} />
    </div>
  );
}
