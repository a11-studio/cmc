import { MOMENTUM_ALPHA_CONSTRAINTS } from "@/lib/sample/constraints";
import { SAMPLE_PRICES } from "@/lib/sample/market";
import type { AgentSampleBook, SampleReplayTrace } from "@/lib/sample/replay";

const MONEY_DIGITS = 6;
const PERCENT_DIGITS = 6;

export function assertClose(actual: number, expected: number, digits = MONEY_DIGITS, label = "value") {
  const tolerance = 10 ** -digits;

  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

export function assertPortfolioIdentity(book: AgentSampleBook) {
  const marketValue = book.positions.reduce((sum, position) => sum + position.marketValue, 0);
  assertClose(book.cash + marketValue, book.agent.equity, MONEY_DIGITS, `${book.agent.name} equity identity`);
}

export function assertPositionIdentity(book: AgentSampleBook) {
  for (const position of book.positions) {
    assertClose(
      position.quantity * position.currentPrice,
      position.marketValue,
      MONEY_DIGITS,
      `${book.agent.name} ${position.symbol} market value`
    );
    assertClose(
      (position.currentPrice - position.averageEntryPrice) * position.quantity,
      position.unrealizedPnl,
      MONEY_DIGITS,
      `${book.agent.name} ${position.symbol} unrealized P&L`
    );
    const expectedAllocation =
      book.agent.equity === 0 ? 0 : (position.marketValue / book.agent.equity) * 100;
    assertClose(
      position.allocationPercent,
      expectedAllocation,
      PERCENT_DIGITS,
      `${book.agent.name} ${position.symbol} allocation`
    );
    if (position.currentPrice !== SAMPLE_PRICES[position.symbol]) {
      throw new Error(
        `${book.agent.name} ${position.symbol} current price ${position.currentPrice} does not match sample mark ${SAMPLE_PRICES[position.symbol]}`
      );
    }
  }
}

export function assertReturnIdentity(book: AgentSampleBook) {
  const expected =
    ((book.agent.equity - book.agent.initialCapital) / book.agent.initialCapital) * 100;
  assertClose(book.agent.returnPercent, expected, PERCENT_DIGITS, `${book.agent.name} return`);
}

export function assertDrawdownIdentity(book: AgentSampleBook) {
  const expected =
    book.peakEquity === 0 ? 0 : ((book.peakEquity - book.agent.equity) / book.peakEquity) * 100;
  assertClose(book.agent.drawdownPercent, expected, PERCENT_DIGITS, `${book.agent.name} drawdown`);

  const curvePeak = Math.max(...book.equityCurve);
  if (curvePeak - book.peakEquity > 1e-6) {
    throw new Error(`${book.agent.name} equity curve peak ${curvePeak} exceeds stored peak ${book.peakEquity}`);
  }
}

export function assertTradeIdentity(book: AgentSampleBook) {
  if (book.agent.trades !== book.trades.length) {
    throw new Error(`${book.agent.name} trade count ${book.agent.trades} != ledger ${book.trades.length}`);
  }

  for (const trade of book.trades) {
    assertClose(trade.quantity * trade.price, trade.notional, MONEY_DIGITS, `${trade.id} notional`);
    if (trade.quantity <= 0 || trade.price <= 0 || trade.notional <= 0) {
      throw new Error(`${trade.id} is not a valid long paper trade`);
    }
  }
}

export function assertConstraintCompliance(book: AgentSampleBook) {
  const { agent, positions, cash, traces } = book;
  const constraints = MOMENTUM_ALPHA_CONSTRAINTS;

  if (agent.initialCapital !== constraints.initialCapital) {
    throw new Error(`${agent.name} initial capital must be ${constraints.initialCapital}`);
  }

  if (positions.length > constraints.maxOpenPositions) {
    throw new Error(`${agent.name} has ${positions.length} open positions`);
  }

  if (cash < 0) {
    throw new Error(`${agent.name} cash is negative`);
  }

  const cashPercent = agent.equity === 0 ? 100 : (cash / agent.equity) * 100;
  if (cashPercent + 1e-6 < constraints.minCashPercent) {
    throw new Error(`${agent.name} cash ${cashPercent.toFixed(2)}% is below minimum`);
  }

  for (const position of positions) {
    if (position.quantity < 0) {
      throw new Error(`${agent.name} short ${position.symbol} is not allowed`);
    }
    if (position.allocationPercent > constraints.maxPositionPercent + 1e-6) {
      throw new Error(`${agent.name} ${position.symbol} allocation exceeds max position`);
    }
  }

  if (agent.drawdownPercent > constraints.maxDrawdownPercent + 1e-6) {
    throw new Error(`${agent.name} drawdown exceeds max`);
  }

  assertTradeSizeHistory(agent.name, traces);
  assertDailyLossHistory(agent.name, traces);
}

function assertTradeSizeHistory(agentName: string, traces: SampleReplayTrace[]) {
  for (const trace of traces) {
    if (trace.trade && trace.tradePercentOfEquity != null) {
      if (trace.tradePercentOfEquity > MOMENTUM_ALPHA_CONSTRAINTS.maxTradePercent + 1e-6) {
        throw new Error(
          `${agentName} ${trace.trade.side} ${trace.trade.symbol} at ${trace.at} is ${trace.tradePercentOfEquity.toFixed(2)}% of equity`
        );
      }
    }
  }
}

function assertDailyLossHistory(agentName: string, traces: SampleReplayTrace[]) {
  const byDay = new Map<string, SampleReplayTrace[]>();

  for (const trace of traces) {
    const day = trace.at.slice(0, 10);
    const bucket = byDay.get(day) ?? [];
    bucket.push(trace);
    byDay.set(day, bucket);
  }

  for (const [day, dayTraces] of byDay) {
    const start = dayTraces[0]?.preEquity ?? 0;
    const trough = Math.min(...dayTraces.map((trace) => trace.postEquity));
    const loss = start <= 0 ? 0 : ((start - trough) / start) * 100;

    if (loss > MOMENTUM_ALPHA_CONSTRAINTS.maxDailyLossPercent + 1e-6) {
      throw new Error(`${agentName} daily loss on ${day} is ${loss.toFixed(2)}%`);
    }
  }
}

export function assertFeaturedDecisionAgreesWithBook(book: AgentSampleBook) {
  const featured = book.decisions.find((decision) => decision.id === "dec_eth_buy");

  if (book.agent.id !== "momentum-alpha") {
    return;
  }

  if (!featured) {
    throw new Error("Momentum Alpha is missing the featured ETH decision");
  }

  const trade = book.trades.find((item) => item.decisionId === featured.id);

  if (!trade) {
    throw new Error("Featured ETH decision has no matching trade");
  }

  assertClose(trade.price, featured.price, MONEY_DIGITS, "featured ETH execution price");
  assertClose(trade.notional, featured.notional, MONEY_DIGITS, "featured ETH notional");
  assertClose(trade.quantity, featured.quantity, MONEY_DIGITS, "featured ETH quantity");

  const eth = book.positions.find((position) => position.symbol === "ETH");

  if (!eth) {
    throw new Error("Featured ETH buy left no ETH position");
  }

  if (eth.allocationPercent > MOMENTUM_ALPHA_CONSTRAINTS.maxPositionPercent + 1e-6) {
    throw new Error("Featured ETH buy violated max position");
  }

  if (!featured.riskCheck.includes(`${featured.allocationPercent}%`)) {
    throw new Error("Risk check does not mention the approved trade size");
  }

  if (!featured.riskCheck.includes(eth.allocationPercent.toFixed(1))) {
    throw new Error("Risk check does not mention the resulting ETH allocation");
  }

  const executed = book.events.find((event) => event.type === "TRADE_EXECUTED");
  const risk = book.events.find((event) => event.type === "RISK_CHECK");

  if (!executed?.description.includes("ETH") || !executed.description.includes("$2,438.40")) {
    throw new Error("Activity trade event is not coherent with the ETH execution price");
  }

  if (risk?.description !== featured.riskCheck) {
    throw new Error("Activity risk check does not match the decision risk check");
  }
}

export function assertArenaTotals(books: AgentSampleBook[], totalEquity: number) {
  const sum = books.reduce((value, book) => value + book.agent.equity, 0);
  assertClose(sum, totalEquity, MONEY_DIGITS, "arena total equity");
}
