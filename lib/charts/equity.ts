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
