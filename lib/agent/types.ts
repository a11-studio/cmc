import type { DecisionContext } from "@/lib/ai/types";
import type { MarketSnapshot } from "@/lib/market/types";
import type {
  PaperAccount,
  PaperExecution,
  PaperValuation,
  TradeDecision,
} from "@/lib/paper/types";
import type { AgentRiskStatus, RiskInput, RiskResult } from "@/lib/risk/types";

export type AgentCycleStatus =
  | "COMPLETED"
  | "BLOCKED"
  | "FAILED_MARKET"
  | "FAILED_DECISION"
  | "FAILED_RISK"
  | "FAILED_EXECUTION"
  | "SKIPPED_DUPLICATE"
  | "SKIPPED_PAUSED";

export function isRetryableCycleStatus(status: AgentCycleStatus): boolean {
  return (
    status === "FAILED_MARKET" ||
    status === "FAILED_DECISION" ||
    status === "FAILED_RISK" ||
    status === "FAILED_EXECUTION"
  );
}

export type AgentCycleEventType =
  | "CYCLE_STARTED"
  | "MARKET_SNAPSHOT"
  | "ANALYZING"
  | "DECISION"
  | "RISK_CHECK"
  | "TRADE_EXECUTED"
  | "TRADE_BLOCKED"
  | "CYCLE_COMPLETED"
  | "CYCLE_FAILED"
  | "CYCLE_SKIPPED";

export type AgentCycleEvent = {
  at: string;
  type: AgentCycleEventType;
  detail: string;
};

export type AgentCycleFailure = {
  stage: "MARKET" | "DECISION" | "RISK" | "EXECUTION";
  code: string;
  message: string;
};

export type AgentIdentity = {
  id: string;
  name: string;
  strategy: string;
  initialCapital: number;
};

export type AgentCycleTrace = {
  agentId: string;
  strategy: string;
  cycleId: string;
  snapshotTimestamp: string | null;
  decision: TradeDecision | null;
  riskResult: RiskResult | null;
  execution: PaperExecution | null;
};

export type AgentCycleResult = {
  status: AgentCycleStatus;
  agentId: string;
  strategy: string;
  cycleId: string;
  snapshotTimestamp: string | null;
  snapshot: MarketSnapshot | null;
  decision: TradeDecision | null;
  riskResult: RiskResult | null;
  execution: PaperExecution | null;
  valuation: PaperValuation | null;
  account: PaperAccount;
  events: AgentCycleEvent[];
  startedAt: string;
  completedAt: string;
  failure?: AgentCycleFailure;
  trace: AgentCycleTrace;
};

export type AgentCycleStore = {
  getAccount(): PaperAccount;
  commitAccount(account: PaperAccount, equity: number): void;
  getAgentStatus(): AgentRiskStatus;
  setAgentStatus(status: AgentRiskStatus): void;
  getDayStartEquity(now: Date): number;
  getLastEquity(): number;
  findCycle(cycleId: string): AgentCycleResult | undefined;
  listCycles(): AgentCycleResult[];
  beginCycle(cycleId: string): boolean;
  saveCycle(result: AgentCycleResult): void;
  releaseCycle(cycleId: string): void;
  forgetCycle(cycleId: string): void;
};

export type AgentCycleDependencies = {
  getMarketSnapshot: (symbols: string[]) => Promise<MarketSnapshot>;
  loadFloorChatForAgent?: (agentId: string) => Promise<DecisionContext["floorChat"]>;
  generateTradeDecision: (context: DecisionContext) => Promise<TradeDecision>;
  evaluateRisk: (input: RiskInput) => RiskResult;
  executePaperDecision: (
    account: PaperAccount,
    decision: TradeDecision,
    snapshot: MarketSnapshot
  ) => PaperExecution;
  store: AgentCycleStore;
  now?: () => Date;
  createCycleId?: (now: Date) => string;
};

export type RunAgentCycleInput = {
  deps: AgentCycleDependencies;
  agent?: AgentIdentity;
  agentId?: string;
  cycleId?: string;
};
