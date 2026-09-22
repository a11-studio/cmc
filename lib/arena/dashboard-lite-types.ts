import { MOMENTUM_ALPHA_AGENT } from "@/lib/agent/constants";
import type { AgentMark, AgentStatus, DataSource, DecisionRecord, EquityCurvePoint, PositionRow, TradeRow } from "@/types/arena";

export const DASHBOARD_LITE_RECENT_FILLS_LIMIT = 32;

export const DASHBOARD_LITE_RISK_AGENT_ID = MOMENTUM_ALPHA_AGENT.id;

export type DashboardLiteAgent = {
  id: string;
  name: string;
  strategy: string;
  description: string;
  mark: AgentMark;
  status: AgentStatus;
  initialCapital: number;
  equity: number;
  returnPercent: number;
  drawdownPercent: number;
  cash: number;
  coinsDeployed: number;
  winRatePercent: number;
  trades: number;
  runtimeStatus: "LIVE";
  dataSource: DataSource;
};

export type DashboardLiteSummary = {
  agentCount: number;
  startingCapital: number;
  totalEquity: number;
  pnl: number;
  returnPercent: number;
};

export type DashboardLiteRiskSlice = {
  agentId: string;
  equity: number;
  dayStartEquity: number;
  positions: PositionRow[];
};

export type DashboardLite = {
  agents: DashboardLiteAgent[];
  positionsByAgent: Record<string, PositionRow[]>;
  summary: DashboardLiteSummary;
  equitySeriesByAgent: Record<string, EquityCurvePoint[]>;
  combinedEquitySeries: EquityCurvePoint[];
  latestDecisions: DecisionRecord[];
  recentFills: Array<
    TradeRow & {
      agentId: string;
      agentName: string;
      mark: AgentMark;
    }
  >;
  risk: DashboardLiteRiskSlice;
  persistenceMode: "memory" | "supabase";
  paused: boolean;
};
