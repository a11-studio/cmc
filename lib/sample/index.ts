import { SAMPLE_DATA_LABEL, MOMENTUM_ALPHA_CONSTRAINTS } from "@/lib/sample/constraints";
import { replaySampleAgent, type AgentSampleBook } from "@/lib/sample/replay";
import { sampleAgentDefinitions } from "@/lib/sample/scripts";

export { SAMPLE_DATA_LABEL, MOMENTUM_ALPHA_CONSTRAINTS };
export { marketQuotes, getQuote, SAMPLE_PRICES, SAMPLE_MARK_AT } from "@/lib/sample/market";
export type { AgentSampleBook } from "@/lib/sample/replay";

export const agentBooks: AgentSampleBook[] = sampleAgentDefinitions.map(replaySampleAgent);

export const agents = agentBooks.map((book) => book.agent);

export const arenaSummary = {
  activeAgents: agents.filter((agent) => agent.status === "ACTIVE").length,
  totalEquity: agents.reduce((sum, agent) => sum + agent.equity, 0),
  bestReturn: Math.max(...agents.map((agent) => agent.returnPercent)),
};

const momentum = requiredBook("momentum-alpha");

export const momentumEquityCurve = momentum.equityCurve;
export const momentumPositions = momentum.positions;
export const momentumCash = momentum.cash;
export const momentumTrades = momentum.trades;
export const activityEvents = momentum.events;
export const sampleDecisions = agentBooks.flatMap((book) => book.decisions);

const featuredDecision = sampleDecisions.find((decision) => decision.id === "dec_eth_buy");

if (!featuredDecision) {
  throw new Error("Sample demo book is missing the featured ETH decision");
}

export const sampleDecision = featuredDecision;

export function getAgent(id: string) {
  return agents.find((agent) => agent.id === id);
}

export function getAgentBook(id: string) {
  return agentBooks.find((book) => book.agent.id === id);
}

export function getDecision(id: string) {
  return sampleDecisions.find((decision) => decision.id === id);
}

function requiredBook(id: string) {
  const book = agentBooks.find((item) => item.agent.id === id);

  if (!book) {
    throw new Error(`Sample book missing for ${id}`);
  }

  return book;
}
