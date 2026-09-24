export type EquityChartPoint = {
  equity: number;
  at?: string;
  label?: string;
};

export function normalizeEquityPoints(points: Array<number | EquityChartPoint>): EquityChartPoint[] {
  return points.map((point) => (typeof point === "number" ? { equity: point } : point));
}

export function nearestEquityIndex(ratio: number, count: number): number {
  if (count <= 1) {
    return 0;
  }

  return Math.round(Math.min(1, Math.max(0, ratio)) * (count - 1));
}

export function equityIndexAtSvgX(
  svgX: number,
  count: number,
  padLeft: number,
  plotWidth: number,
  edgePx = 24,
): number {
  if (count <= 1) {
    return 0;
  }

  if (svgX <= padLeft + edgePx) {
    return 0;
  }

  if (svgX >= padLeft + plotWidth - edgePx) {
    return count - 1;
  }

  return nearestEquityIndex((svgX - padLeft) / plotWidth, count);
}

export function equityChange(current: number, baseline: number) {
  const amount = current - baseline;
  const percent = baseline === 0 ? 0 : (amount / baseline) * 100;

  return { amount, percent };
}

const LIVE_TAIL_STALE_MS = 2 * 60 * 60 * 1000;
const LIVE_TAIL_BRIDGE_STEP_MS = 60 * 60 * 1000;
const LIVE_TAIL_MAX_BRIDGE_STEPS = 12;

/**
 * Chart read model: align the curve end with headline equity.
 * Sparklines plot by point index (not wall-clock time), so a lone "Live" point after a
 * stale snapshot creates a vertical cliff — we bridge with interpolated points when needed.
 */
export function equitySeriesWithLiveTail(
  history: readonly EquityChartPoint[],
  liveEquity: number,
  at = new Date().toISOString()
): EquityChartPoint[] {
  if (history.length === 0) {
    return [];
  }

  const last = history.at(-1)!;

  if (last.label === "Live") {
    return [...history.slice(0, -1), { equity: liveEquity, at, label: "Live" }];
  }

  if (Math.abs(last.equity - liveEquity) < 0.005) {
    return [...history];
  }

  const liveAt = Date.parse(at);
  const lastAt = last.at ? Date.parse(last.at) : Number.NaN;
  const gapMs =
    Number.isFinite(lastAt) && Number.isFinite(liveAt) ? Math.max(0, liveAt - lastAt) : 0;

  if (gapMs <= LIVE_TAIL_STALE_MS) {
    const head = history.slice(0, -1);
    return [...head, { equity: liveEquity, at, label: "Live" }];
  }

  if (!Number.isFinite(lastAt) || gapMs === 0) {
    return [...history, { equity: liveEquity, at, label: "Live" }];
  }

  const bridgeCount = Math.min(
    LIVE_TAIL_MAX_BRIDGE_STEPS,
    Math.max(2, Math.ceil(gapMs / LIVE_TAIL_BRIDGE_STEP_MS))
  );
  const bridge: EquityChartPoint[] = [];

  for (let step = 1; step <= bridgeCount; step++) {
    const ratio = step / (bridgeCount + 1);
    bridge.push({
      equity: last.equity + (liveEquity - last.equity) * ratio,
      at: new Date(lastAt + gapMs * ratio).toISOString(),
    });
  }

  return [...history, ...bridge, { equity: liveEquity, at, label: "Live" }];
}

export function combineEquitySeries(
  books: readonly { equitySeries: readonly EquityChartPoint[] }[]
): EquityChartPoint[] {
  if (books.length === 0) {
    return [];
  }

  const agents = books.map((book) => {
    const start = book.equitySeries[0]?.equity ?? 0;
    const points = book.equitySeries.flatMap((point) => {
      if (!point.at) {
        return [];
      }

      const at = Date.parse(point.at);

      if (!Number.isFinite(at)) {
        return [];
      }

      return [{ at, equity: point.equity }];
    });

    points.sort((left, right) => left.at - right.at);

    return { start, points };
  });

  const startEquity = agents.reduce((sum, agent) => sum + agent.start, 0);
  const times = [...new Set(agents.flatMap((agent) => agent.points.map((point) => point.at)))].sort(
    (left, right) => left - right
  );

  return [
    { equity: startEquity },
    ...times.map((time) => ({
      equity: agents.reduce((sum, agent) => {
        let value = agent.start;

        for (const point of agent.points) {
          if (point.at > time) {
            break;
          }

          value = point.equity;
        }

        return sum + value;
      }, 0),
      at: new Date(time).toISOString(),
    })),
  ];
}
