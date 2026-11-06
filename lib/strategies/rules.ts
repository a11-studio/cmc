import type { DecisionContext } from "@/lib/ai/types";
import { SUPPORTED_SYMBOLS } from "@/lib/market/symbols";
import type { AssetSnapshot, AssetTrend, SupportedSymbol } from "@/lib/market/types";
import type { TimeHorizon, TradeAction, TradeDecision } from "@/lib/paper/types";
import { findSnapshotAsset } from "@/lib/risk/trend";

/**
 * Deterministic strategy cores, one per persona, taken from the 2-year hourly
 * backtest (Nov 2024 – Nov 2026, 0.1% fees). Each rule reads the snapshot's daily
 * trend data and the current book, and proposes at most one trade per cycle:
 * exits first, then trims, then entries and top-ups toward a target size.
 *
 * Rules propose; the Risk Engine still caps and blocks. Sizes are clamped to the
 * headroom the agent receives so a proposal never wastes the cycle.
 */

export type RuleProposal = {
  decision: TradeDecision;
  /** Observable facts behind the proposal, shown to the LLM and stored as reasons. */
  basis: string[];
};

type Candidate = {
  priority: 0 | 1 | 2;
  /** Larger first inside the same priority. */
  strength: number;
  action: Exclude<TradeAction, "HOLD">;
  symbol: SupportedSymbol;
  /** BUY/SHORT: percent of equity. SELL: percent of the open position. */
  allocationPercent: number;
  reason: string;
};

type RuleBook = {
  timeHorizon: TimeHorizon;
  candidates(context: DecisionContext): Candidate[];
};

const MIN_TRADE_PERCENT = 1;
const TOP_UP_GAP_PERCENT = 2;
/**
 * Positions smaller than this are leftovers (for example from the model-only era)
 * and do not count as an open system position that should be topped up.
 */
const DUST_PERCENT = 2;

function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function asset(context: DecisionContext, symbol: SupportedSymbol): AssetSnapshot | undefined {
  const found = findSnapshotAsset(context.snapshot, symbol);
  return found && found.price > 0 ? found : undefined;
}

/** Signed percent of equity held in the symbol (negative for shorts). */
function allocation(context: DecisionContext, symbol: SupportedSymbol): number {
  return context.portfolio.positions.find((position) => position.symbol === symbol)?.allocationPercent ?? 0;
}

function headroomFor(context: DecisionContext, candidate: Candidate): number {
  const entry = context.headroom?.perSymbol.find((row) => row.symbol === candidate.symbol);

  if (!entry) {
    return candidate.allocationPercent;
  }

  if (candidate.action === "BUY") {
    return entry.maxBuyPercentOfEquity;
  }

  if (candidate.action === "SHORT") {
    return entry.maxShortPercentOfEquity;
  }

  return entry.maxSellPercentOfPosition;
}

function exitCandidate(symbol: SupportedSymbol, held: number, reason: string): Candidate {
  return { priority: 0, strength: Math.abs(held), action: "SELL", symbol, allocationPercent: 100, reason };
}

/**
 * Entry or top-up toward a signed target. Returns nothing when the book is already
 * within TOP_UP_GAP_PERCENT of the target or on the other side (the exit rule
 * flattens the opposite side first).
 */
function towardTarget(symbol: SupportedSymbol, held: number, target: number, strength: number, reason: string): Candidate | undefined {
  if (target > 0 && held >= 0 && target - held > TOP_UP_GAP_PERCENT) {
    return { priority: 2, strength, action: "BUY", symbol, allocationPercent: round(target - held), reason };
  }

  if (target < 0 && held <= 0 && held - target > TOP_UP_GAP_PERCENT) {
    return { priority: 2, strength, action: "SHORT", symbol, allocationPercent: round(held - target), reason };
  }

  return undefined;
}

function btcAbove(context: DecisionContext, key: "sma50" | "sma100" | "sma200"): boolean | undefined {
  const btc = asset(context, "BTC");
  const level = btc?.trend?.[key];
  return btc && level ? btc.price > level : undefined;
}

function withTrend(context: DecisionContext): { symbol: SupportedSymbol; price: number; trend: AssetTrend; snapshot: AssetSnapshot }[] {
  return SUPPORTED_SYMBOLS.flatMap((symbol) => {
    const found = asset(context, symbol);
    return found?.trend ? [{ symbol, price: found.price, trend: found.trend, snapshot: found }] : [];
  });
}

type Target = { target: number; reason: string };
type Targets = Partial<Record<SupportedSymbol, Target>>;

/**
 * Turn signed target allocations into one-per-cycle candidates, exactly as the
 * Season 1 research replay did: close positions whose target flipped side or went
 * to zero, trim clear overweights, then enter or top up toward the target.
 */
function fromTargets(context: DecisionContext, targets: Targets): Candidate[] {
  const out: Candidate[] = [];

  for (const symbol of SUPPORTED_SYMBOLS) {
    const held = allocation(context, symbol);
    const wanted = targets[symbol];
    const target = wanted?.target ?? 0;

    if (Math.abs(held) < 0.5 && Math.abs(target) < 0.5) {
      continue;
    }

    if (Math.abs(held) >= 0.5 && (Math.sign(held) !== Math.sign(target) || target === 0)) {
      out.push(exitCandidate(symbol, held, wanted?.reason ?? `${symbol} no longer meets the rule: close the position`));
      continue;
    }

    if (Math.abs(held) > Math.abs(target) + 5) {
      out.push({
        priority: 1,
        strength: Math.abs(held) - Math.abs(target),
        action: "SELL",
        symbol,
        allocationPercent: round(((Math.abs(held) - Math.abs(target)) / Math.abs(held)) * 100),
        reason: wanted?.reason ?? `${symbol} trimmed toward ${round(Math.abs(target))}%`,
      });
      continue;
    }

    const gap = Math.abs(target) - Math.abs(held);

    if (gap > TOP_UP_GAP_PERCENT && wanted) {
      out.push({ priority: 2, strength: gap, action: target > 0 ? "BUY" : "SHORT", symbol, allocationPercent: round(gap), reason: wanted.reason });
    }
  }

  return out;
}

function above(found: AssetSnapshot | undefined, key: "sma50" | "sma100" | "sma200"): boolean {
  const level = found?.trend?.[key];
  return Boolean(found && level && found.price > level);
}

function below(found: AssetSnapshot | undefined, key: "sma50" | "sma100" | "sma200"): boolean {
  const level = found?.trend?.[key];
  return Boolean(found && level && found.price < level);
}

/**
 * Channel breakout in both directions with an opposite-channel exit. Shared by
 * Turtle (20/10, ATR-sized, per-asset SMA50), Donchian (20/10, 25%, BTC SMA100 regime)
 * and Livermore (10/10, 25%, per-asset SMA50).
 */
function channelTargets(
  context: DecisionContext,
  options: {
    entry: "10" | "20";
    size: (trend: AssetTrend) => number | undefined;
    regime: "asset-sma50" | "btc-sma100";
    label: string;
  }
): Targets {
  const targets: Targets = {};
  const btcUp = btcAbove(context, "sma100");

  for (const { symbol, price, trend, snapshot } of withTrend(context)) {
    const size = options.size(trend);

    if (size == null) {
      continue;
    }

    const held = allocation(context, symbol);
    const high = options.entry === "10" ? trend.high10 : trend.high20;
    const low = options.entry === "10" ? trend.low10 : trend.low20;
    const okLong = options.regime === "btc-sma100" ? btcUp === true : above(snapshot, "sma50");
    const okShort = options.regime === "btc-sma100" ? btcUp === false : below(snapshot, "sma50");
    const regimeName = options.regime === "btc-sma100" ? "BTC SMA100" : `${symbol} SMA50`;

    if (held > 0.5) {
      targets[symbol] =
        trend.low10 != null && price < trend.low10
          ? { target: 0, reason: `${symbol} fell below its 10-day low ${trend.low10}: ${options.label} exit` }
          : { target: size, reason: `${symbol} ${options.label} long still on: sizing to ${round(size)}%` };
    } else if (held < -0.5) {
      targets[symbol] =
        trend.high10 != null && price > trend.high10
          ? { target: 0, reason: `${symbol} rose above its 10-day high ${trend.high10}: ${options.label} exit` }
          : { target: -size, reason: `${symbol} ${options.label} short still on: sizing to ${round(size)}%` };
    } else if (high != null && price > high && okLong) {
      targets[symbol] = { target: size, reason: `${symbol} broke its ${options.entry}-day high ${high} with ${regimeName} up` };
    } else if (low != null && price < low && okShort) {
      targets[symbol] = { target: -size, reason: `${symbol} broke its ${options.entry}-day low ${low} with ${regimeName} down` };
    }
  }

  return targets;
}

/** Turtle System 1: 20-day breakout either way, 10-day exit, ~5% equity risk per 2N (max 33%), per-asset SMA50. */
const turtle: RuleBook = {
  timeHorizon: "MEDIUM",
  candidates(context) {
    return fromTargets(
      context,
      channelTargets(context, {
        entry: "20",
        size: (trend) => (trend.atr20Percent ? Math.min(33, (5 / (2 * trend.atr20Percent)) * 100) : undefined),
        regime: "asset-sma50",
        label: "Turtle",
      })
    );
  },
};

/** Donchian: 20-day breakout either way, 10-day exit, 25% equal weight, BTC SMA100 regime. */
const donchian: RuleBook = {
  timeHorizon: "MEDIUM",
  candidates(context) {
    return fromTargets(context, channelTargets(context, { entry: "20", size: () => 25, regime: "btc-sma100", label: "channel" }));
  },
};

/** Livermore: fast 10-day breakouts and breakdowns, 25% per position, only with the asset's SMA50. */
const speculator: RuleBook = {
  timeHorizon: "SHORT",
  candidates(context) {
    return fromTargets(context, channelTargets(context, { entry: "10", size: () => 25, regime: "asset-sma50", label: "speculator" }));
  },
};

function volatilityScaled(snapshot: AssetSnapshot, trend: AssetTrend) {
  const dailyVol = (trend.volatility30dPercent ?? 0) / 100;

  if (!(dailyVol > 0) || snapshot.change24h == null || snapshot.change7d == null || trend.return30dPercent == null) {
    return undefined;
  }

  const z1 = snapshot.change24h / 100 / dailyVol;
  const z7 = snapshot.change7d / 100 / (dailyVol * Math.sqrt(7));
  const z30 = trend.return30dPercent / 100 / (dailyVol * Math.sqrt(30));
  return { dailyVol, z1, z7, z30, score: 0.2 * z1 + 0.4 * z7 + 0.4 * z30 };
}

/** Simons: 1/7/30-day time-series momentum, all horizons agree, long-only, BTC SMA100 gate, 25% vol target. */
const quant: RuleBook = {
  timeHorizon: "SHORT",
  candidates(context) {
    const out: Candidate[] = [];
    const btcUp = btcAbove(context, "sma100");

    for (const { symbol, trend, snapshot } of withTrend(context)) {
      const held = allocation(context, symbol);
      const signal = volatilityScaled(snapshot, trend);

      if (held < 0) {
        out.push(exitCandidate(symbol, held, `${symbol} short is outside the long-only quant mandate`));
        continue;
      }

      if (!signal) {
        continue;
      }

      const z = `z1 ${round(signal.z1)}, z7 ${round(signal.z7)}, z30 ${round(signal.z30)}`;

      // Exits ignore the noisy 1-day leg so a single red day does not flip the book.
      if (held > 0 && (signal.z7 < 0 || signal.z30 < 0 || signal.score < 0 || btcUp === false)) {
        out.push(exitCandidate(symbol, held, `${symbol} momentum no longer agrees (${z}${btcUp === false ? ", BTC under SMA100" : ""})`));
        continue;
      }

      const agrees = signal.z1 > 0 && signal.z7 > 0 && signal.z30 > 0 && signal.score > 0.5 && btcUp === true;

      if (!agrees && held <= DUST_PERCENT) {
        continue;
      }

      const target = Math.min(30, (0.25 / (signal.dailyVol * Math.sqrt(365))) * 100);
      const candidate = towardTarget(symbol, held, target, signal.score, `${symbol} 1/7/30-day momentum agrees (${z}); vol-targeted size ${round(target)}%`);

      if (candidate) {
        out.push(candidate);
      }
    }

    return out;
  },
};

const ROTATION_K = 3;
const ROTATION_SIZE = 25;

/**
 * Elon: rank all five by 7-day risk-adjusted momentum. Long the top 3 that are above
 * their SMA50 and up on the week, short the bottom 3 that are below it and down on the
 * week, 25% each. Holds a position while it stays in the top/bottom 4 on its side.
 */
const rotation: RuleBook = {
  timeHorizon: "SHORT",
  candidates(context) {
    const ranked = SUPPORTED_SYMBOLS.map((symbol) => {
      const found = asset(context, symbol);
      const vol = found?.trend?.volatility30dPercent;
      return { symbol, found, score: found && vol ? (found.change7d ?? 0) / (vol * Math.sqrt(7)) : 0 };
    }).sort((left, right) => right.score - left.score);
    const targets: Targets = {};

    ranked.forEach(({ symbol, found }, rank) => {
      const held = allocation(context, symbol);

      if (held > 0.5 && above(found, "sma50") && rank <= ROTATION_K) {
        targets[symbol] = { target: held, reason: `${symbol} still ranks #${rank + 1} on 7-day momentum above SMA50` };
      }

      if (held < -0.5 && below(found, "sma50") && rank >= ranked.length - ROTATION_K - 1) {
        targets[symbol] = { target: held, reason: `${symbol} still ranks #${rank + 1} on 7-day momentum below SMA50` };
      }
    });

    ranked.slice(0, ROTATION_K).forEach(({ symbol, found, score }, rank) => {
      if (score > 0 && above(found, "sma50") && (found?.change7d ?? 0) > 0) {
        targets[symbol] = { target: ROTATION_SIZE, reason: `${symbol} ranks #${rank + 1} on 7-day risk-adjusted momentum, above SMA50` };
      }
    });

    ranked.slice(-ROTATION_K).forEach(({ symbol, found, score }) => {
      if (score < 0 && below(found, "sma50") && (found?.change7d ?? 0) < 0) {
        const rank = ranked.findIndex((row) => row.symbol === symbol);
        targets[symbol] = { target: -ROTATION_SIZE, reason: `${symbol} ranks #${rank + 1} of ${ranked.length} on 7-day momentum, below SMA50` };
      }
    });

    return fromTargets(context, targets);
  },
};

const REGIME_POSITIONS = 3;
const REGIME_SIZE = 30;

/**
 * Paul Tudor Jones: per-asset regime. Long assets above their SMA50 with a positive
 * 30-day return, short assets below it with a negative one, 30% each in the three
 * furthest from their average. Positions stay on while the asset is on the same side.
 */
const macroRegime: RuleBook = {
  timeHorizon: "MEDIUM",
  candidates(context) {
    const scored = withTrend(context).flatMap(({ symbol, price, trend }) => {
      if (!trend.sma50 || trend.return30dPercent == null) {
        return [];
      }

      const distance = price / trend.sma50 - 1;
      const long = distance > 0 && trend.return30dPercent > 0;
      const short = distance < 0 && trend.return30dPercent < 0;
      return long || short ? [{ symbol, distance, return30d: trend.return30dPercent }] : [];
    });
    const targets: Targets = {};

    for (const row of [...scored].sort((left, right) => Math.abs(right.distance) - Math.abs(left.distance)).slice(0, REGIME_POSITIONS)) {
      const side = row.distance > 0 ? "above" : "below";
      targets[row.symbol] = {
        target: Math.sign(row.distance) * REGIME_SIZE,
        reason: `${row.symbol} is ${round(Math.abs(row.distance) * 100)}% ${side} its 50-day average with a ${round(row.return30d)}% 30-day return`,
      };
    }

    for (const symbol of SUPPORTED_SYMBOLS) {
      const held = allocation(context, symbol);
      const found = asset(context, symbol);

      if (targets[symbol]) {
        continue;
      }

      if (held > 0 && above(found, "sma50")) {
        targets[symbol] = { target: held, reason: `${symbol} long stays on above its 50-day average` };
      } else if (held < 0 && below(found, "sma50")) {
        targets[symbol] = { target: held, reason: `${symbol} short stays on below its 50-day average` };
      }
    }

    return fromTargets(context, targets);
  },
};

const RULE_BOOKS: Record<string, RuleBook> = {
  "richard-dennis": turtle,
  "richard-donchian": donchian,
  "jim-simons": quant,
  "momentum-alpha": rotation,
  "jesse-livermore": speculator,
  "paul-tudor-jones": macroRegime,
};

export function hasRuleCore(agentId: string): boolean {
  return agentId in RULE_BOOKS;
}

function holdProposal(book: RuleBook, basis: string[]): RuleProposal {
  return {
    decision: {
      action: "HOLD",
      symbol: "BTC",
      allocationPercent: 0,
      confidence: 70,
      timeHorizon: book.timeHorizon,
      reasons: basis.slice(0, 5),
      riskFactors: [],
    },
    basis,
  };
}

/** The rule core's proposal for this cycle, or null when the agent has no rule core. */
export function proposeRuleDecision(context: DecisionContext): RuleProposal | null {
  const book = RULE_BOOKS[context.agentId];

  if (!book) {
    return null;
  }

  if (withTrend(context).length === 0) {
    return holdProposal(book, ["Daily trend data is unavailable this cycle: the rule core holds."]);
  }

  const candidates = book
    .candidates(context)
    .sort((left, right) => left.priority - right.priority || right.strength - left.strength);

  for (const candidate of candidates) {
    const allowed = Math.min(candidate.allocationPercent, headroomFor(context, candidate));

    if (allowed < MIN_TRADE_PERCENT) {
      continue;
    }

    const basis = [candidate.reason];
    return {
      decision: {
        action: candidate.action,
        symbol: candidate.symbol,
        allocationPercent: round(allowed),
        confidence: 75,
        timeHorizon: book.timeHorizon,
        reasons: basis,
        riskFactors: [],
      },
      basis,
    };
  }

  return holdProposal(book, [
    candidates.length > 0
      ? "Rule signals exist but the Risk Engine headroom leaves no executable size this cycle."
      : "No rule signal this cycle: no breakout, exit, or rebalance condition is met.",
  ]);
}
