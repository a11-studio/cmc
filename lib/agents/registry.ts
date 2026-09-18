import { SUPPORTED_SYMBOLS } from "@/lib/market/symbols";
import type { ArenaAgentDefinition } from "@/lib/agents/types";
import { UnknownAgentError } from "@/lib/agents/types";

const INITIAL_CAPITAL = 10_000;

export const ARENA_AGENTS: readonly ArenaAgentDefinition[] = [
  {
    id: "momentum-alpha",
    displayName: "Elon Musk",
    strategyName: "Narrative momentum",
    description: "Follows short-term trend while respecting position caps",
    skillPath: "skills/momentum-alpha.md",
    mark: "momentum",
    riskProfile: "medium",
    preferredAssets: SUPPORTED_SYMBOLS,
    timeHorizon: "SHORT",
    status: "LIVE",
    initialCapital: INITIAL_CAPITAL,
  },
  {
    id: "richard-dennis",
    displayName: "Richard Dennis",
    strategyName: "The Turtle",
    description: "Systematic trend following inspired by Turtle breakout principles",
    skillPath: "skills/richard-dennis-turtle.md",
    mark: "turtle",
    riskProfile: "medium",
    preferredAssets: SUPPORTED_SYMBOLS,
    timeHorizon: "MEDIUM / LONG",
    status: "LIVE",
    initialCapital: INITIAL_CAPITAL,
  },
  {
    id: "richard-donchian",
    displayName: "Richard Donchian",
    strategyName: "The Trend",
    description: "Low-discretion breakout and channel-style trend following",
    skillPath: "skills/richard-donchian-trend.md",
    mark: "trend",
    riskProfile: "medium",
    preferredAssets: SUPPORTED_SYMBOLS,
    timeHorizon: "MEDIUM",
    status: "LIVE",
    initialCapital: INITIAL_CAPITAL,
  },
  {
    id: "jesse-livermore",
    displayName: "Jesse Livermore",
    strategyName: "The Speculator",
    description: "Price-action speculator that trades confirmed momentum, not stories",
    skillPath: "skills/jesse-livermore-speculator.md",
    mark: "speculator",
    riskProfile: "aggressive",
    preferredAssets: SUPPORTED_SYMBOLS,
    timeHorizon: "SHORT / MEDIUM",
    status: "LIVE",
    initialCapital: INITIAL_CAPITAL,
  },
  // {
  //   id: "paul-tudor-jones",
  //   displayName: "Paul Tudor Jones",
  //   strategyName: "The Macro Trader",
  //   description: "Capital-first macro regime and momentum trader",
  //   skillPath: "skills/paul-tudor-jones-macro.md",
  //   mark: "jones",
  //   riskProfile: "medium",
  //   preferredAssets: SUPPORTED_SYMBOLS,
  //   timeHorizon: "MEDIUM",
  //   status: "READY",
  //   initialCapital: INITIAL_CAPITAL,
  // },
  {
    id: "jim-simons",
    displayName: "Jim Simons",
    strategyName: "The Quant",
    description: "Systematic multi-signal decisions from observable snapshot features only",
    skillPath: "skills/jim-simons-quant.md",
    mark: "quant",
    riskProfile: "medium",
    preferredAssets: SUPPORTED_SYMBOLS,
    timeHorizon: "SHORT / MEDIUM",
    status: "LIVE",
    initialCapital: INITIAL_CAPITAL,
  },
  {
    id: "michael-burry",
    displayName: "Michael Burry",
    strategyName: "The Contrarian",
    description: "Patient contrarian that fades excess, not strong unexhausted trends",
    skillPath: "skills/michael-burry-contrarian.md",
    mark: "burry",
    riskProfile: "conservative",
    preferredAssets: SUPPORTED_SYMBOLS,
    timeHorizon: "MEDIUM / LONG",
    status: "LIVE",
    initialCapital: INITIAL_CAPITAL,
  },
  // {
  //   id: "arthur-hayes",
  //   displayName: "Arthur Hayes",
  //   strategyName: "The Macro + Crypto Liquidity",
  //   description: "Crypto-native macro trader that only uses snapshot liquidity and regime fields",
  //   skillPath: "skills/arthur-hayes-crypto-macro.md",
  //   mark: "hayes",
  //   riskProfile: "aggressive",
  //   preferredAssets: SUPPORTED_SYMBOLS,
  //   timeHorizon: "MEDIUM / LONG",
  //   status: "READY",
  //   initialCapital: INITIAL_CAPITAL,
  // },
];

export function listArenaAgents(): readonly ArenaAgentDefinition[] {
  return ARENA_AGENTS;
}

export function listLiveAgents(): readonly ArenaAgentDefinition[] {
  return ARENA_AGENTS.filter((agent) => agent.status === "LIVE");
}

export function findAgentDefinition(id: string): ArenaAgentDefinition | undefined {
  return ARENA_AGENTS.find((agent) => agent.id === id);
}

export function getAgentDefinition(id: string): ArenaAgentDefinition {
  const agent = findAgentDefinition(id);

  if (!agent) {
    throw new UnknownAgentError(id);
  }

  return agent;
}

export function toAgentIdentity(agent: ArenaAgentDefinition) {
  return {
    id: agent.id,
    name: agent.displayName,
    strategy: agent.strategyName,
    initialCapital: agent.initialCapital,
  };
}
