import { describe, expect, it, vi } from "vitest";
import { createDecisionContext, generateTradeDecision, validateTradeDecision } from "@/lib/ai/decision";
import { MOMENTUM_ALPHA_STRATEGY, MOMENTUM_ALPHA_SYSTEM_PROMPT, TRADE_DECISION_JSON_SCHEMA, buildDecisionSystemPrompt } from "@/lib/ai/prompts";
import { runAgentCycle } from "@/lib/agent/cycle";
import { MOMENTUM_ALPHA_AGENT } from "@/lib/agent/constants";
import { createInMemoryAgentStore } from "@/lib/agent/store";
import type { AgentCycleDependencies } from "@/lib/agent/types";
import {
  ARENA_AGENTS,
  buildAgentRoster,
  extractSkillSection,
  findAgentDefinition,
  getAgentDefinition,
  getAgentStory,
  isSkillPath,
  listArenaAgents,
  loadAgentSkill,
  loadAgentSkillFor,
} from "@/lib/agents";
import { UnknownAgentError } from "@/lib/agents/types";
import { executePaperDecision } from "@/lib/paper/engine";
import type { TradeDecision } from "@/lib/paper/types";
import { evaluateRisk } from "@/lib/risk/evaluate";
import type { MarketSnapshot } from "@/lib/market/types";
import type { LeaderboardAgent } from "@/types/arena";

const REQUIRED_SKILL_HEADINGS = [
  "## Identity",
  "## Personality",
  "## Philosophy",
  "## Strategy",
  "## Market Conditions",
  "## Signals",
  "## Entry",
  "## Exit",
  "## Position Behavior",
  "## Risk Philosophy",
  "## Time Horizon",
  "## Goal",
  "## Preferred Assets",
  "## Avoid",
  "## Decision Style",
  "## Hard Rules",
];

function snapshot(): MarketSnapshot {
  return {
    cycleId: "cycle-skill",
    timestamp: "2026-09-17T11:00:00.000Z",
    assets: [
      { symbol: "BTC", price: 50_000, change24h: 1.2 },
      { symbol: "ETH", price: 2_500, change24h: 0.8 },
      { symbol: "SOL", price: 100, change24h: 2.1 },
      { symbol: "BNB", price: 600, change24h: 0.4 },
      { symbol: "XRP", price: 2.2, change24h: 0.6 },
    ],
    market: { btcDominance: 54 },
  };
}

function liveAgent(): LeaderboardAgent {
  return {
    id: "momentum-alpha",
    name: "Elon Musk",
    strategy: "Narrative momentum",
    description: "Follows short-term trend while respecting position caps",
    status: "ACTIVE",
    mark: "momentum",
    equity: 10_042,
    returnPercent: 0.42,
    drawdownPercent: 0,
    winRatePercent: 50,
    trades: 2,
    initialCapital: 10_000,
    cash: 8_000,
    coins: 2_042,
    dataSource: "live",
    runtimeStatus: "LIVE",
  };
}

describe("agent skill registry", () => {
  it("registers every named strategy agent with valid configuration", () => {
    const ids = listArenaAgents().map((agent) => agent.id);

    expect(ids).toEqual([
      "momentum-alpha",
      "richard-dennis",
      "richard-donchian",
      "jesse-livermore",
      "jim-simons",
      "warren-buffett",
    ]);

    for (const agent of ARENA_AGENTS) {
      expect(agent.displayName.trim()).not.toBe("");
      expect(agent.strategyName.trim()).not.toBe("");
      expect(agent.description.trim()).not.toBe("");
      expect(isSkillPath(agent.skillPath)).toBe(true);
      expect([...agent.preferredAssets]).toEqual(["BTC", "ETH", "SOL", "BNB", "XRP"]);
      expect(agent.initialCapital).toBe(MOMENTUM_ALPHA_STRATEGY.initialCapital);
      expect(["LIVE", "READY", "SIMULATION"]).toContain(agent.status);
      const story = getAgentStory(agent.id);
      expect(story?.strategy.length).toBeGreaterThan(0);
      expect(story?.history.length).toBeGreaterThan(0);
    }
  });

  it("resolves every agent to a loadable skill file", () => {
    for (const agent of listArenaAgents()) {
      const skill = loadAgentSkillFor(agent);
      expect(skill.length).toBeGreaterThan(80);
      expect(skill).toContain(agent.displayName.split("—")[0]!.trim().split(" ")[0]!);

      for (const heading of REQUIRED_SKILL_HEADINGS) {
        expect(skill).toContain(heading);
      }

      expect(skill).toContain("BTC / ETH / SOL / BNB / XRP");
      expect(skill).toContain("SHORT is allowed");
      expect(extractSkillSection(skill, "Goal").length).toBeGreaterThan(40);
      expect(extractSkillSection(skill, "Personality").length).toBeGreaterThan(40);
      expect(extractSkillSection(skill, "Time Horizon").length).toBeGreaterThan(0);
    }

    const elonGoal = extractSkillSection(loadAgentSkillFor("momentum-alpha"), "Goal");
    const dennisGoal = extractSkillSection(loadAgentSkillFor("richard-dennis"), "Goal");
    expect(elonGoal).toMatch(/15-minute|1h/i);
    expect(dennisGoal).toMatch(/days to weeks/i);
    expect(elonGoal).not.toBe(dennisGoal);

    const elonPersonality = extractSkillSection(loadAgentSkillFor("momentum-alpha"), "Personality");
    const dennisPersonality = extractSkillSection(loadAgentSkillFor("richard-dennis"), "Personality");
    expect(elonPersonality).toMatch(/impatient|conviction/i);
    expect(dennisPersonality).toMatch(/rule|system/i);
    expect(elonPersonality).not.toBe(dennisPersonality);
  });

  it("keeps six named strategies LIVE", () => {
    const live = listArenaAgents().filter((agent) => agent.status === "LIVE");
    expect(live.map((agent) => agent.id)).toEqual([
      "momentum-alpha",
      "richard-dennis",
      "richard-donchian",
      "jesse-livermore",
      "jim-simons",
      "warren-buffett",
    ]);
    expect(getAgentDefinition("jim-simons").strategyName).toBe("The Quant");
    expect(getAgentDefinition("warren-buffett").strategyName).toBe("The Value Compounder");
  });

  it("does not mark sample or ready agents as LIVE", () => {
    const roster = buildAgentRoster(liveAgent());
    const liveIds = [
      "momentum-alpha",
      "richard-dennis",
      "richard-donchian",
      "jesse-livermore",
      "jim-simons",
      "warren-buffett",
    ];

    expect(roster.filter((agent) => agent.runtimeStatus === "LIVE").map((agent) => agent.id)).toEqual(liveIds);
    expect(roster.some((agent) => agent.dataSource === "sample")).toBe(false);
    expect(roster.filter((agent) => agent.dataSource === "live").map((agent) => agent.id)).toEqual(liveIds);
    expect(roster.filter((agent) => agent.runtimeStatus === "READY")).toEqual([]);
  });

  it("fails safely on invalid agent IDs", () => {
    expect(findAgentDefinition("news-hunter")).toBeUndefined();
    expect(() => getAgentDefinition("not-real")).toThrow(UnknownAgentError);
    expect(() => loadAgentSkill("../secrets.md")).toThrow(/Invalid skill path/);
    expect(() => loadAgentSkill("skills/missing.md")).toThrow();
  });
});

describe("Gemini skill injection", () => {
  it("includes the agent skill in the Gemini decision context", async () => {
    const skill = loadAgentSkill("skills/richard-dennis-turtle.md");
    const context = createDecisionContext({
      agentId: "richard-dennis",
      snapshot: snapshot(),
      portfolio: { cash: 10_000, equity: 10_000, positions: [] },
    });

    expect(context.agentName).toBe("Richard Dennis");
    expect(context.strategyName).toBe("The Turtle");
    expect(context.skill).toBe(skill);

    let systemInstruction = "";
    let contents = "";

    await generateTradeDecision(context, {
      generateContent: async (request) => {
        systemInstruction = request.systemInstruction;
        contents = request.contents;
        return {
          text: JSON.stringify({
            action: "HOLD",
            symbol: "BTC",
            allocationPercent: 0,
            confidence: 55,
            timeHorizon: "MEDIUM",
            reasons: ["Breakout lookback is not in the snapshot."],
            riskFactors: ["Insufficient channel data."],
          } satisfies TradeDecision),
        };
      },
    });

    expect(contents).toContain("The Turtle");
    expect(contents).toContain("Do not invent historical OHLC");
    expect(systemInstruction).toContain(skill);
    expect(systemInstruction).toContain("You cannot bypass the Risk Engine");
    expect(systemInstruction).toContain("Never invent data");
    expect(systemInstruction).toBe(
      buildDecisionSystemPrompt({
        agentName: "Richard Dennis",
        strategyName: "The Turtle",
        skill,
      })
    );
  });

  it("keeps Momentum Alpha prompt behavior on the shared TradeDecision schema", async () => {
    const context = createDecisionContext({
      agentId: "momentum-alpha",
      snapshot: snapshot(),
      portfolio: { cash: 10_000, equity: 10_000, positions: [] },
    });

    await generateTradeDecision(context, {
      generateContent: async (request) => {
        expect(request.systemInstruction).toBe(MOMENTUM_ALPHA_SYSTEM_PROMPT);
        expect(request.responseJsonSchema).toBe(TRADE_DECISION_JSON_SCHEMA);
        expect(request.systemInstruction).toContain("BUY: allocationPercent is the percent of current portfolio equity");
        expect(request.systemInstruction).toContain("You do not execute trades");
        expect(request.contents).toContain("momentum-alpha");
        expect(request.systemInstruction).toContain("Narrative momentum");
        return {
          text: JSON.stringify({
            action: "HOLD",
            symbol: "ETH",
            allocationPercent: 0,
            confidence: 60,
            timeHorizon: "SHORT",
            reasons: ["Evidence is mixed."],
            riskFactors: ["RSI is not supplied."],
          } satisfies TradeDecision),
        };
      },
    });
  });

  it("accepts SHORT on the shared TradeDecision schema", () => {
    expect(TRADE_DECISION_JSON_SCHEMA.required).toEqual([
      "action",
      "symbol",
      "allocationPercent",
      "confidence",
      "timeHorizon",
      "reasons",
      "riskFactors",
    ]);
    expect(TRADE_DECISION_JSON_SCHEMA.properties.action.enum).toEqual(["BUY", "SELL", "SHORT", "HOLD"]);
    expect(validateTradeDecision({
      action: "HOLD",
      symbol: "BTC",
      allocationPercent: 0,
      confidence: 50,
      timeHorizon: "SHORT",
      reasons: ["Hold"],
      riskFactors: ["Missing data"],
    })).toMatchObject({ action: "HOLD", allocationPercent: 0 });
  });
});

function paperDecision(overrides: Partial<TradeDecision> = {}): TradeDecision {
  return {
    action: "HOLD",
    symbol: "BTC",
    allocationPercent: 0,
    confidence: 70,
    timeHorizon: "MEDIUM",
    reasons: ["Test"],
    riskFactors: ["Test"],
    ...overrides,
  };
}

describe("multi-agent cycle abstraction", () => {
  const NOW = new Date("2026-09-17T11:00:00.000Z");

  function deps(overrides: Partial<AgentCycleDependencies> = {}): AgentCycleDependencies {
    return {
      getMarketSnapshot: vi.fn(async () => snapshot()),
      generateTradeDecision: vi.fn(async () => paperDecision({ action: "BUY", allocationPercent: 10 })),
      evaluateRisk,
      executePaperDecision,
      store: createInMemoryAgentStore(),
      now: () => NOW,
      ...overrides,
    };
  }

  it("routes a strategy agent through Gemini → Risk → Paper and never lets it execute directly", async () => {
    const execute = vi.fn(executePaperDecision);
    const evaluate = vi.fn(evaluateRisk);
    const generate = vi.fn(async (context) => {
      expect(context.agentId).toBe("richard-dennis");
      expect(context.strategyName).toBe("The Turtle");
      expect(context.skill).toContain("Turtle Trading");
      return {
        action: "BUY" as const,
        symbol: "BTC" as const,
        allocationPercent: 10,
        confidence: 70,
        timeHorizon: "MEDIUM" as const,
        reasons: ["BTC 24h is positive."],
        riskFactors: ["No breakout window is supplied."],
      };
    });

    const result = await runAgentCycle({
      agentId: "richard-dennis",
      cycleId: "turtle-1",
      deps: deps({ generateTradeDecision: generate, evaluateRisk: evaluate, executePaperDecision: execute }),
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.agentId).toBe("richard-dennis");
    expect(result.strategy).toBe("The Turtle");
    expect(generate).toHaveBeenCalledOnce();
    expect(evaluate).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.invocationCallOrder[0]).toBeGreaterThan(evaluate.mock.invocationCallOrder[0]);
    expect(evaluate.mock.invocationCallOrder[0]).toBeGreaterThan(generate.mock.invocationCallOrder[0]);
  });

  it("still blocks a strategy agent when Risk Engine rejects the decision", async () => {
    const execute = vi.fn(executePaperDecision);
    const result = await runAgentCycle({
      agentId: "warren-buffett",
      cycleId: "buffett-block",
      deps: deps({
        generateTradeDecision: vi.fn(async () =>
          paperDecision({
            action: "SELL",
            symbol: "ETH",
            allocationPercent: 50,
            confidence: 80,
            timeHorizon: "LONG",
            reasons: ["Fade"],
            riskFactors: ["Trend may continue"],
          })
        ),
        executePaperDecision: execute,
      }),
    });

    expect(result.status).toBe("BLOCKED");
    expect(result.riskResult?.verdict).toBe("BLOCKED");
    expect(execute).not.toHaveBeenCalled();
    expect(result.account.trades).toEqual([]);
  });

  it("does not fabricate unavailable indicators in the decision payload", async () => {
    const generate = vi.fn(async (context) => {
      expect(JSON.stringify(context.snapshot.assets)).not.toContain("donchian");
      expect(JSON.stringify(context.snapshot.market)).not.toContain("atr");
      expect(context.skill.toLowerCase()).toContain("do not fabricate");
      return {
        action: "HOLD" as const,
        symbol: "BTC" as const,
        allocationPercent: 0,
        confidence: 40,
        timeHorizon: "MEDIUM" as const,
        reasons: ["Required channel data is unavailable."],
        riskFactors: ["No invented lookback."],
      };
    });

    const result = await runAgentCycle({
      agentId: "richard-donchian",
      cycleId: "channel-hold",
      deps: deps({ generateTradeDecision: generate }),
    });

    expect(result.decision?.action).toBe("HOLD");
    expect(result.decision?.reasons[0]).toMatch(/unavailable/i);
  });

  it("keeps Momentum Alpha identity unchanged when no agentId is passed", async () => {
    const result = await runAgentCycle({
      cycleId: "ma-default",
      deps: deps({
        generateTradeDecision: vi.fn(async () =>
          paperDecision({
            action: "HOLD",
            allocationPercent: 0,
            confidence: 60,
            timeHorizon: "SHORT",
            reasons: ["Baseline"],
            riskFactors: ["None"],
          })
        ),
      }),
    });

    expect(result.agentId).toBe(MOMENTUM_ALPHA_AGENT.id);
    expect(result.strategy).toBe(MOMENTUM_ALPHA_AGENT.strategy);
  });

  it("rejects unknown agent IDs before Gemini or Paper run", async () => {
    const generate = vi.fn();
    const execute = vi.fn();

    await expect(
      runAgentCycle({
        agentId: "news-hunter",
        deps: deps({ generateTradeDecision: generate, executePaperDecision: execute }),
      })
    ).rejects.toBeInstanceOf(UnknownAgentError);

    expect(generate).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });
});
