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
const ROTATION_REBALANCE_HOURS = 6;
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

/** Turtle System 2: 55-day breakout, 20-day exit, ~5% equity risk per 2N, per-asset SMA100 regime. */
const turtle: RuleBook = {
  timeHorizon: "MEDIUM",
  candidates(context) {
    const out: Candidate[] = [];

    for (const { symbol, price, trend } of withTrend(context)) {
      const held = allocation(context, symbol);
      const { high55, low55, high20, low20, sma100, atr20Percent } = trend;

      if (held > 0 && low20 && price < low20) {
        out.push(exitCandidate(symbol, held, `${symbol} closed below its 20-day low ${low20}: Turtle exit`));
        continue;
      }

      if (held < 0 && high20 && price > high20) {
        out.push(exitCandidate(symbol, held, `${symbol} closed above its 20-day high ${high20}: Turtle exit`));
        continue;
      }

      if (!sma100 || !atr20Percent) {
        continue;
      }

      const size = Math.min(40, (5 / (2 * atr20Percent)) * 100);
      const breakoutUp = high55 != null && price > high55 && price > sma100;
      const breakoutDown = low55 != null && price < low55 && price < sma100;
      const target = held > DUST_PERCENT || breakoutUp ? size : held < -DUST_PERCENT || breakoutDown ? -size : 0;

      if (target === 0) {
        continue;
      }

      const why = breakoutUp
        ? `${symbol} broke its 55-day high ${high55} above SMA100`
        : breakoutDown
          ? `${symbol} broke its 55-day low ${low55} below SMA100`
          : `${symbol} Turtle position still on: sizing to ${round(Math.abs(target))}% (2N risk 5%)`;
      const candidate = towardTarget(symbol, held, target, breakoutUp || breakoutDown ? 10 : 1, why);

      if (candidate) {
        out.push(candidate);
      }
    }

    return out;
  },
};

/** Donchian: 30-day breakout, 10-day opposite-channel exit, 20% equal weight, BTC SMA100 regime. */
const donchian: RuleBook = {
  timeHorizon: "MEDIUM",
  candidates(context) {
    const out: Candidate[] = [];
    const btcUp = btcAbove(context, "sma100");

    for (const { symbol, price, trend } of withTrend(context)) {
      const held = allocation(context, symbol);
      const { high30, low30, high10, low10 } = trend;

      if (held > 0 && low10 && price < low10) {
        out.push(exitCandidate(symbol, held, `${symbol} below its 10-day low ${low10}: channel exit`));
        continue;
      }

      if (held < 0 && high10 && price > high10) {
        out.push(exitCandidate(symbol, held, `${symbol} above its 10-day high ${high10}: channel exit`));
        continue;
      }

      const breakoutUp = btcUp === true && high30 != null && price > high30;
      const breakoutDown = btcUp === false && low30 != null && price < low30;
      const target = held > DUST_PERCENT || breakoutUp ? 20 : held < -DUST_PERCENT || breakoutDown ? -20 : 0;

      if (target === 0) {
        continue;
      }

      const why = breakoutUp
        ? `${symbol} above its 30-day high ${high30} with BTC over SMA100`
        : breakoutDown
          ? `${symbol} below its 30-day low ${low30} with BTC under SMA100`
          : `${symbol} channel position on: equal weight 20%`;
      const candidate = towardTarget(symbol, held, target, breakoutUp || breakoutDown ? 10 : 1, why);

      if (candidate) {
        out.push(candidate);
      }
    }

    return out;
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

/** Elon: cross-sectional 7-day momentum. BTC over SMA50: long the top 2; under it: short the bottom 2 at half size. */
const rotation: RuleBook = {
  timeHorizon: "SHORT",
  candidates(context) {
    const ranked = withTrend(context)
      .flatMap(({ symbol, trend, snapshot }) => {
        const vol = trend.volatility30dPercent;
        return snapshot.change7d != null && vol && vol > 0 ? [{ symbol, score: snapshot.change7d / (vol * Math.sqrt(7)) }] : [];
      })
      .sort((left, right) => right.score - left.score);
    const btcUp = btcAbove(context, "sma50");

    if (ranked.length < 3 || btcUp == null) {
      return [];
    }

    const rankOf = (symbol: SupportedSymbol) => ranked.findIndex((row) => row.symbol === symbol);
    const out: Candidate[] = [];

    for (const symbol of SUPPORTED_SYMBOLS) {
      const held = allocation(context, symbol);
      const rank = rankOf(symbol);
      const score = rank >= 0 ? ranked[rank].score : 0;

      // Hysteresis: hold while still top-3 (longs) / bottom-3 (shorts), enter only top-2 / bottom-2.
      if (held > 0 && (!btcUp || rank < 0 || rank > 2 || score <= 0)) {
        out.push(exitCandidate(symbol, held, `${symbol} left the momentum leaders${btcUp ? "" : " (BTC under SMA50)"}`));
      } else if (held < 0 && (btcUp || rank < 0 || rank < ranked.length - 3 || score >= 0)) {
        out.push(exitCandidate(symbol, held, `${symbol} left the momentum laggards${btcUp ? " (BTC over SMA50)" : ""}`));
      }
    }

    // Rebalance once a day like the backtest: new entries and top-ups only in the first
    // UTC hours (several cycles, since one trade is capped at 15% of equity). Exits above
    // run every hour. Hourly rotation traded ~2,800 times in 17 months for no gain.
    const hour = new Date(context.snapshot.timestamp).getUTCHours();

    if (!(hour < ROTATION_REBALANCE_HOURS)) {
      return out;
    }

    const targets = btcUp
      ? ranked.slice(0, 2).filter((row) => row.score > 0).map((row) => ({ ...row, target: 50 }))
      : ranked.slice(-2).filter((row) => row.score < 0).map((row) => ({ ...row, target: -25 }));

    for (const row of targets) {
      const held = allocation(context, row.symbol);
      const candidate = towardTarget(
        row.symbol,
        held,
        row.target,
        Math.abs(row.score),
        btcUp
          ? `${row.symbol} ranks #${rankOf(row.symbol) + 1} on 7-day risk-adjusted momentum with BTC over SMA50`
          : `${row.symbol} ranks last-${ranked.length - rankOf(row.symbol)} on 7-day momentum with BTC under SMA50`
      );

      if (candidate) {
        out.push(candidate);
      }
    }

    return out;
  },
};

const BUFFETT_CORE: Record<SupportedSymbol, number> = { BTC: 60, ETH: 25, SOL: 5, BNB: 5, XRP: 5 };

/** Buffett: long-only core 60/25/5/5/5; under an asset's SMA200 the core shrinks to 30% (Risk Engine trims). */
const valueCore: RuleBook = {
  timeHorizon: "LONG",
  candidates(context) {
    const out: Candidate[] = [];

    for (const { symbol, price, trend } of withTrend(context)) {
      const held = allocation(context, symbol);

      if (held < 0) {
        out.push(exitCandidate(symbol, held, `${symbol} short is outside the long-only mandate`));
        continue;
      }

      if (!trend.sma200) {
        continue;
      }

      const above = price > trend.sma200;
      const target = above ? BUFFETT_CORE[symbol] : Math.min(BUFFETT_CORE[symbol], 30);

      // Turnover is a cost: trim only clear overweights, top up only clear gaps.
      if (held > target + 15) {
        out.push({
          priority: 1,
          strength: held - target,
          action: "SELL",
          symbol,
          allocationPercent: round(((held - target) / held) * 100),
          reason: `${symbol} is ${round(held)}% of the book against a ${target}% core weight`,
        });
        continue;
      }

      if (above) {
        const candidate = towardTarget(symbol, held, target, target - held, `${symbol} above its 200-day average: top up toward the ${target}% core`);

        if (candidate) {
          out.push(candidate);
        }
      }
    }

    return out;
  },
};

const RULE_BOOKS: Record<string, RuleBook> = {
  "richard-dennis": turtle,
  "richard-donchian": donchian,
  "jim-simons": quant,
  "momentum-alpha": rotation,
  "warren-buffett": valueCore,
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
