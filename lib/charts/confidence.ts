export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

export function arcPoint(cx: number, cy: number, radius: number, percent: number) {
  const angle = Math.PI * (1 - clampPercent(percent) / 100);

  return {
    x: Number((cx + radius * Math.cos(angle)).toFixed(4)),
    y: Number((cy - radius * Math.sin(angle)).toFixed(4)),
  };
}

export function confidenceTone(percent: number): string {
  const value = clampPercent(percent);

  if (value < 25) {
    return "#EA3943";
  }

  if (value < 50) {
    return "#EA8C00";
  }

  if (value < 75) {
    return "#93D900";
  }

  return "#16C784";
}
