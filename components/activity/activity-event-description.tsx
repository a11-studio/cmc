import { AssetTicker, TextWithAssetTickers } from "@/components/market/asset-icon";
import { SideBadge } from "@/components/shared/side-badge";
import type { RiskVerdict } from "@/lib/risk/types";
import { cn } from "@/lib/utils";
import type { ActivityEvent, TradeAction } from "@/types/arena";
import type { SupportedSymbol } from "@/lib/market/types";

const TRADE_ACTIONS = new Set<TradeAction>(["BUY", "SELL", "SHORT", "HOLD"]);

function isTradeAction(value: string): value is TradeAction {
  return TRADE_ACTIONS.has(value as TradeAction);
}

function parseLeadingActionSymbol(description: string): {
  action?: TradeAction;
  symbol?: SupportedSymbol;
  rest: string;
} {
  const match = description.match(/^(BUY|SELL|SHORT|HOLD)\s+([A-Z][A-Z0-9]*)\s*(.*)$/);
  if (!match) {
    return { rest: description };
  }

  const [, actionRaw, symbol, rest] = match;
  return {
    action: isTradeAction(actionRaw) ? actionRaw : undefined,
    symbol: symbol as SupportedSymbol,
    rest: rest.trim(),
  };
}

function resolveTradeParts(event: ActivityEvent) {
  const parsed = parseLeadingActionSymbol(event.description);
  const action = event.action ?? parsed.action;
  const symbol = event.symbol ?? parsed.symbol;
  const detail =
    event.action || event.symbol ? event.description : parsed.rest || event.description;

  return { action, symbol, detail };
}

function resolveRiskVerdict(event: ActivityEvent): RiskVerdict | undefined {
  if (event.riskVerdict) {
    return event.riskVerdict;
  }

  if (event.description.startsWith("APPROVED")) {
    return "APPROVED";
  }
  if (event.description.startsWith("CONSTRAINED")) {
    return "CONSTRAINED";
  }
  if (event.description.startsWith("BLOCKED")) {
    return "BLOCKED";
  }

  return undefined;
}

function riskDetailText(event: ActivityEvent, verdict?: RiskVerdict) {
  let detail = event.description;
  if (verdict && detail.startsWith(verdict)) {
    detail = detail.slice(verdict.length).replace(/^\s*·\s*/, "").trim();
  }
  return detail;
}

const riskVerdictStyles: Record<RiskVerdict, string> = {
  APPROVED: "bg-positive-muted text-positive",
  CONSTRAINED: "bg-warning-muted text-warning",
  BLOCKED: "bg-negative-muted text-negative",
};

export function RiskVerdictBadge({ verdict }: { verdict: RiskVerdict }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium",
        riskVerdictStyles[verdict]
      )}
    >
      {verdict}
    </span>
  );
}

/** Execution column — symbol and amounts, no action badge. */
export function ActivityEventExecutionContent({ event }: { event: ActivityEvent }) {
  if (event.type === "RISK_CHECK" || event.type === "TRADE_REJECTED") {
    const verdict = resolveRiskVerdict(event);
    const detail = riskDetailText(event, verdict);

    if (!detail) {
      return null;
    }

    return (
      <span className="text-sm leading-relaxed text-white/70">
        <TextWithAssetTickers text={detail} size="xs" />
      </span>
    );
  }

  if (event.type === "DECISION" || event.type === "TRADE_EXECUTED") {
    const { symbol, detail } = resolveTradeParts(event);

    return (
      <span className="inline-flex flex-wrap items-center gap-2.5 text-sm leading-relaxed text-foreground">
        {symbol ? <AssetTicker symbol={symbol} size="sm" className="font-medium" /> : null}
        {detail ? (
          <span className="text-white/70">
            <TextWithAssetTickers text={detail} size="xs" />
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span className="text-sm text-foreground">
      <TextWithAssetTickers text={event.description} size="xs" />
    </span>
  );
}

/** Confidence column — BUY / SHORT / risk verdict, right-aligned in feed layout. */
export function ActivityEventActionBadge({ event }: { event: ActivityEvent }) {
  if (event.type === "RISK_CHECK" || event.type === "TRADE_REJECTED") {
    const verdict = resolveRiskVerdict(event);
    return verdict ? <RiskVerdictBadge verdict={verdict} /> : null;
  }

  if (event.type === "DECISION" || event.type === "TRADE_EXECUTED") {
    const { action } = resolveTradeParts(event);
    return action ? <SideBadge action={action} /> : null;
  }

  return null;
}

/** Default inline layout (agent pages, compact timeline). */
export function ActivityEventDescription({ event }: { event: ActivityEvent }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2.5 text-sm leading-relaxed text-foreground">
      <ActivityEventActionBadge event={event} />
      <ActivityEventExecutionContent event={event} />
    </span>
  );
}
