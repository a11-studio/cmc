import { isSupportedSymbol, normalizeSymbol, supportedSymbolsList } from "@/lib/market/symbols";
import type { MarketSnapshot } from "@/lib/market/types";
import { isClosedQuantity } from "@/lib/paper/portfolio";
import type { TradeAction, TradeDecision } from "@/lib/paper/types";
import { DEFAULT_RISK_CONSTRAINTS, type RiskConstraints } from "@/lib/risk/constraints";
import type {
  AgentRiskStatus,
  RiskCheck,
  RiskCheckCode,
  RiskInput,
  RiskPosition,
  RiskResult,
} from "@/lib/risk/types";

const ACTIONS: readonly TradeAction[] = ["BUY", "SELL", "HOLD", "SHORT"];
const PERCENT_EPSILON = 1e-8;

function roundReasonPercent(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function passed(code: RiskCheckCode, detail: string): RiskCheck {
  return { code, passed: true, detail };
}

function failed(code: RiskCheckCode, detail: string): RiskCheck {
  return { code, passed: false, detail };
}

function mergeConstraints(overrides?: Partial<RiskConstraints>): RiskConstraints {
  return { ...DEFAULT_RISK_CONSTRAINTS, ...overrides };
}

function cloneDecision(decision: TradeDecision, allocationPercent: number): TradeDecision {
  return { ...decision, allocationPercent };
}

function blocked(
  decision: TradeDecision,
  code: RiskCheckCode,
  reason: string,
  checks: RiskCheck[]
): RiskResult {
  return {
    verdict: "BLOCKED",
    approved: false,
    executable: false,
    code,
    reason,
    decision,
    checks,
  };
}

function findPosition(positions: readonly RiskPosition[], symbol: string): RiskPosition | undefined {
  return positions.find((position) => position.symbol === symbol);
}

function openPositionCount(positions: readonly RiskPosition[]): number {
  return positions.filter((position) => !isClosedQuantity(position.quantity)).length;
}

function signedAllocationPercent(existing: RiskPosition | undefined): number {
  if (!existing || isClosedQuantity(existing.quantity)) {
    return 0;
  }

  return existing.allocationPercent;
}

function dailyLossPercent(portfolio: RiskInput["portfolio"]): number {
  if (!(portfolio.dayStartEquity > 0)) {
    return 0;
  }

  return Math.max(0, ((portfolio.dayStartEquity - portfolio.equity) / portfolio.dayStartEquity) * 100);
}

function isPaused(status: AgentRiskStatus | undefined): boolean {
  return status === "PAUSED" || status === "ERROR";
}

function isRiskIncreasing(action: TradeAction, signedAlloc: number, requested: number): boolean {
  if (action === "BUY") {
    return signedAlloc >= -PERCENT_EPSILON || requested > Math.abs(signedAlloc) + PERCENT_EPSILON;
  }

  if (action === "SHORT") {
    return signedAlloc <= PERCENT_EPSILON || requested > signedAlloc + PERCENT_EPSILON;
  }

  return false;
}

function snapshotPriceMap(snapshot: MarketSnapshot): Map<string, number> | undefined {
  if (!snapshot || !Array.isArray(snapshot.assets)) {
    return undefined;
  }

  const prices = new Map<string, number>();

  for (const asset of snapshot.assets) {
    const symbol = normalizeSymbol(asset.symbol);

    if (!isSupportedSymbol(symbol) || !Number.isFinite(asset.price) || asset.price <= 0) {
      continue;
    }

    prices.set(symbol, asset.price);
  }

  return prices;
}

export function evaluateRisk(input: RiskInput): RiskResult {
  const { decision, snapshot, portfolio } = input;
  const constraints = mergeConstraints(input.constraints);
  const checks: RiskCheck[] = [];

  if (!snapshot || !Array.isArray(snapshot.assets)) {
    checks.push(failed("INVALID_SNAPSHOT", "Market snapshot is invalid"));
    return blocked(decision, "INVALID_SNAPSHOT", "Rejected: market snapshot is invalid", checks);
  }

  const action = ACTIONS.find((item) => item === decision.action);

  if (!action) {
    checks.push(failed("INVALID_ACTION", `Invalid action: ${String(decision.action)}`));
    return blocked(decision, "INVALID_ACTION", "Rejected: action is not BUY, SELL, SHORT, or HOLD", checks);
  }

  checks.push(passed("INVALID_ACTION", `${action} is a valid action`));

  const symbol = typeof decision.symbol === "string" ? normalizeSymbol(decision.symbol) : "";

  if (!isSupportedSymbol(symbol)) {
    checks.push(failed("UNSUPPORTED_SYMBOL", `Unsupported symbol: ${String(decision.symbol)}`));
    return blocked(decision, "UNSUPPORTED_SYMBOL", `Rejected: symbol is not ${supportedSymbolsList()}`, checks);
  }

  checks.push(passed("UNSUPPORTED_SYMBOL", `${symbol} is supported`));

  const prices = snapshotPriceMap(snapshot);

  if (!prices) {
    checks.push(failed("INVALID_SNAPSHOT", "Market snapshot is invalid"));
    return blocked(decision, "INVALID_SNAPSHOT", "Rejected: market snapshot is invalid", checks);
  }

  for (const position of portfolio.positions) {
    if (!isClosedQuantity(position.quantity) && prices.get(position.symbol) == null) {
      checks.push(failed("MISSING_PRICE", `Missing mark price for open ${position.symbol} position`));
      return blocked(decision, "MISSING_PRICE", `Rejected: missing price for ${position.symbol}`, checks);
    }
  }

  if (action === "HOLD") {
    checks.push(passed("APPROVED", "HOLD does not change positions"));
    return {
      verdict: "APPROVED",
      approved: true,
      executable: true,
      code: "APPROVED",
      reason: "HOLD approved",
      decision,
      allowedDecision: cloneDecision(decision, 0),
      adjustedAllocationPercent: 0,
      checks,
    };
  }

  if (isPaused(input.agentStatus)) {
    checks.push(failed("AGENT_PAUSED", `Agent status ${input.agentStatus} cannot trade`));
    return blocked(decision, "AGENT_PAUSED", "Rejected: agent is paused", checks);
  }

  checks.push(passed("AGENT_PAUSED", "Agent is active"));

  if (!Number.isFinite(portfolio.equity) || portfolio.equity <= 0) {
    checks.push(failed("INVALID_ALLOCATION", "Equity must be positive"));
    return blocked(decision, "INVALID_ALLOCATION", "Rejected: portfolio equity is not positive", checks);
  }

  if (!Number.isFinite(decision.allocationPercent) || decision.allocationPercent <= 0 || decision.allocationPercent > 100) {
    checks.push(failed("INVALID_ALLOCATION", "allocationPercent must be greater than 0 and at most 100"));
    return blocked(
      decision,
      "INVALID_ALLOCATION",
      "Rejected: allocationPercent must be greater than 0 and at most 100",
      checks
    );
  }

  const price = prices.get(symbol);

  if (price == null) {
    checks.push(failed("MISSING_PRICE", `Market snapshot has no price for ${symbol}`));
    return blocked(decision, "MISSING_PRICE", `Rejected: missing price for ${symbol}`, checks);
  }

  checks.push(passed("MISSING_PRICE", `${symbol} price is present`));

  if (action === "SHORT" && !constraints.shorting) {
    checks.push(failed("SHORTING_FORBIDDEN", "Shorting is not allowed"));
    return blocked(decision, "SHORTING_FORBIDDEN", "Rejected: shorting is not allowed", checks);
  }

  if (action === "SHORT") {
    checks.push(passed("SHORTING_FORBIDDEN", "Shorting is allowed"));
  }

  const existing = findPosition(portfolio.positions, symbol);
  const signedAlloc = signedAllocationPercent(existing);
  const requested = decision.allocationPercent;
  const lossToday = dailyLossPercent(portfolio);
  const riskIncreasing = isRiskIncreasing(action, signedAlloc, requested);

  if (riskIncreasing && lossToday >= constraints.maxDailyLossPercent - PERCENT_EPSILON) {
    checks.push(
      failed("DAILY_LOSS_LIMIT", `Daily loss ${lossToday.toFixed(2)}% has reached ${constraints.maxDailyLossPercent}%`)
    );
    return blocked(decision, "DAILY_LOSS_LIMIT", "Rejected: maximum daily loss reached", checks);
  }

  checks.push(passed("DAILY_LOSS_LIMIT", `Daily loss ${lossToday.toFixed(2)}% is inside the limit`));

  if (riskIncreasing && portfolio.drawdownPercent >= constraints.maxDrawdownPercent - PERCENT_EPSILON) {
    checks.push(
      failed(
        "DRAWDOWN_LIMIT",
        `Drawdown ${portfolio.drawdownPercent.toFixed(2)}% has reached ${constraints.maxDrawdownPercent}%`
      )
    );
    return blocked(decision, "DRAWDOWN_LIMIT", "Rejected: maximum drawdown reached", checks);
  }

  checks.push(passed("DRAWDOWN_LIMIT", `Drawdown ${portfolio.drawdownPercent.toFixed(2)}% is inside the limit`));

  if (action === "SELL") {
    if (!existing || existing.quantity <= PERCENT_EPSILON) {
      checks.push(failed("INSUFFICIENT_POSITION", `No ${symbol} position to sell`));
      return blocked(decision, "INSUFFICIENT_POSITION", "Rejected: no position to sell", checks);
    }

    checks.push(passed("INSUFFICIENT_POSITION", `${symbol} position is available to sell`));
    checks.push(passed("SHORTING_FORBIDDEN", "Sell stays within the long position"));
  }

  if (action === "BUY" || action === "SHORT") {
    const openingNew = !existing || isClosedQuantity(existing.quantity);

    if (openingNew && openPositionCount(portfolio.positions) >= constraints.maxOpenPositions) {
      checks.push(
        failed("MAX_OPEN_POSITIONS", `Already has ${constraints.maxOpenPositions} open positions`)
      );
      return blocked(decision, "MAX_OPEN_POSITIONS", "Rejected: maximum open positions reached", checks);
    }

    checks.push(passed("MAX_OPEN_POSITIONS", "Open position count is inside the limit"));
  }

  let allowed = requested;
  let limiting: RiskCheckCode = "APPROVED";
  let limitingDetail = `Requested ${roundReasonPercent(requested)}%`;

  if (action === "BUY" || action === "SHORT") {
    const cashPercent = (portfolio.cash / portfolio.equity) * 100;
    const maxByCashReserve = cashPercent - constraints.minCashPercent;
    const maxByNoLeverage = cashPercent;
    const maxByPosition =
      action === "SHORT"
        ? constraints.maxPositionPercent + signedAlloc
        : constraints.maxPositionPercent - signedAlloc;

    const caps: { code: RiskCheckCode; max: number; detail: string }[] = [
      {
        code: "MAX_TRADE_EXCEEDED",
        max: constraints.maxTradePercent,
        detail: `Max trade is ${constraints.maxTradePercent}% of equity`,
      },
      {
        code: "MAX_POSITION_EXCEEDED",
        max: maxByPosition,
        detail: `Remaining position room in ${symbol} is ${roundReasonPercent(Math.max(0, maxByPosition))}%`,
      },
    ];

    if (action === "BUY") {
      if (constraints.minCashPercent > PERCENT_EPSILON) {
        caps.push({
          code: "MIN_CASH_BREACH",
          max: maxByCashReserve,
          detail: `Spending more would drop cash below ${constraints.minCashPercent}%`,
        });
      }
      caps.push({
        code: "LEVERAGE_FORBIDDEN",
        max: maxByNoLeverage,
        detail: "Spending more than cash would require leverage",
      });
    }

    for (const cap of caps) {
      if (cap.max + PERCENT_EPSILON < allowed) {
        allowed = Math.max(0, cap.max);
        limiting = cap.code;
        limitingDetail = cap.detail;
        checks.push(failed(cap.code, cap.detail));
      } else {
        checks.push(passed(cap.code, cap.detail));
      }
    }
  } else {
    const marketValue = existing?.marketValue ?? 0;
    const maxTradeNotional = (constraints.maxTradePercent / 100) * portfolio.equity;
    const maxByTradeOfPosition = marketValue <= 0 ? 0 : (maxTradeNotional / marketValue) * 100;
    const maxByNoShort = 100;

    const caps: { code: RiskCheckCode; max: number; detail: string }[] = [
      {
        code: "MAX_TRADE_EXCEEDED",
        max: maxByTradeOfPosition,
        detail: `Max trade is ${constraints.maxTradePercent}% of equity`,
      },
      {
        code: "SHORTING_FORBIDDEN",
        max: maxByNoShort,
        detail: "Cannot sell more than 100% of the position",
      },
    ];

    for (const cap of caps) {
      if (cap.max + PERCENT_EPSILON < allowed) {
        allowed = Math.max(0, cap.max);
        limiting = cap.code;
        limitingDetail = cap.detail;
        checks.push(failed(cap.code, cap.detail));
      } else {
        checks.push(passed(cap.code, cap.detail));
      }
    }
  }

  if (allowed <= PERCENT_EPSILON) {
    const reason =
      limiting === "MAX_POSITION_EXCEEDED"
        ? "Rejected: maximum position size exceeded"
        : limiting === "MIN_CASH_BREACH"
          ? "Rejected: minimum cash would be breached"
          : limiting === "MAX_TRADE_EXCEEDED"
            ? "Rejected: maximum trade size exceeded"
            : limiting === "LEVERAGE_FORBIDDEN"
              ? "Rejected: leverage is not allowed"
              : `Rejected: ${limitingDetail}`;

    return blocked(decision, limiting, reason, checks);
  }

  if (allowed + PERCENT_EPSILON < requested) {
    const allowedDecision = cloneDecision(decision, allowed);
    return {
      verdict: "CONSTRAINED",
      approved: false,
      executable: true,
      code: "ALLOCATION_CONSTRAINED",
      reason: `Constrained: ${action.toLowerCase()} reduced from ${roundReasonPercent(requested)}% to ${roundReasonPercent(allowed)}%. ${limitingDetail}`,
      decision,
      allowedDecision,
      adjustedAllocationPercent: allowed,
      checks,
    };
  }

  checks.push(passed("APPROVED", `${action} ${symbol} at ${roundReasonPercent(requested)}%`));

  return {
    verdict: "APPROVED",
    approved: true,
    executable: true,
    code: "APPROVED",
    reason: `Position size approved (${roundReasonPercent(requested)}%)`,
    decision,
    allowedDecision: cloneDecision(decision, requested),
    adjustedAllocationPercent: requested,
    checks,
  };
}
