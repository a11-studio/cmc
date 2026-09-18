export const AGENT_CYCLE_INTERVAL_MS = 15 * 60 * 1000;

export const MOMENTUM_ALPHA_AGENT = {
  id: "momentum-alpha",
  name: "Elon Musk",
  strategy: "Narrative momentum",
  initialCapital: 10_000,
} as const;

export type MomentumAlphaAgent = typeof MOMENTUM_ALPHA_AGENT;
