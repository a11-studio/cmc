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
