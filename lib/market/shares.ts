export type RankedShare = {
  id: string;
  label: string;
  value: number;
  percent: number;
  color: string;
};

const TEAL = ["#00D4CF", "#008D8A", "#006967", "#0C3E3D", "#1A2E2E"] as const;

export function rankShares(
  items: Array<{ name: string; value: number }>,
  colors: readonly string[] = TEAL,
  limit = 4
): RankedShare[] {
  const positive = items.filter((item) => Number.isFinite(item.value) && item.value > 0);
  const total = positive.reduce((sum, item) => sum + item.value, 0);

  if (!(total > 0)) {
    return [];
  }

  const sorted = [...positive].sort((left, right) => right.value - left.value);
  const head = sorted.slice(0, limit);
  const restValue = sorted.slice(limit).reduce((sum, item) => sum + item.value, 0);
  const slices = restValue > 0 ? [...head, { name: "Others", value: restValue }] : head;

  return slices.map((item, index) => ({
    id: `${item.name}-${index}`,
    label: item.name,
    value: item.value,
    percent: (item.value / total) * 100,
    color: colors[index] ?? colors[colors.length - 1] ?? "#1A2E2E",
  }));
}
