const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatUsd(value: number, compact = false): string {
  return compact ? usdCompact.format(value) : usd.format(value);
}

export function formatPercent(value: number, signed = false, digits = 1): string {
  const absolute = `${Math.abs(value).toFixed(digits)}%`;

  if (!signed) {
    return value < 0 ? `-${absolute}` : absolute;
  }

  if (value > 0) {
    return `+${absolute}`;
  }

  if (value < 0) {
    return `-${absolute}`;
  }

  return absolute;
}

export function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatClockTime(iso: string, timeZone?: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

export function formatChartTime(iso?: string, timeZone?: string): string {
  if (!iso) {
    return "Start";
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

export function formatRelativeTime(iso?: string, now = new Date()): string {
  if (!iso) {
    return "—";
  }

  const at = Date.parse(iso);

  if (!Number.isFinite(at)) {
    return iso;
  }

  const minutes = Math.max(0, Math.round((now.getTime() - at) / 60_000));

  if (minutes < 1) {
    return "just now";
  }

  if (minutes === 1) {
    return "1 min ago";
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  return formatChartTime(iso);
}
