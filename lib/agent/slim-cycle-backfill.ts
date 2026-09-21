type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function approximatePayloadBytes(payload: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(payload)).length;
  } catch {
    return 0;
  }
}

export function storedCyclePayloadNeedsSlim(payload: unknown): boolean {
  if (!isRecord(payload)) {
    return false;
  }

  return (
    "snapshot" in payload ||
    "account" in payload ||
    "events" in payload ||
    "trace" in payload ||
    (isRecord(payload.execution) && ("account" in payload.execution || "valuation" in payload.execution))
  );
}

function marketCheckAssetsFromSnapshot(snapshot: unknown): { symbol: string; price: number }[] | undefined {
  if (!isRecord(snapshot) || !Array.isArray(snapshot.assets)) {
    return undefined;
  }

  const assets = snapshot.assets.flatMap((asset) => {
    if (!isRecord(asset) || typeof asset.symbol !== "string") {
      return [];
    }

    const price = asset.price;

    if (typeof price !== "number" || !(price > 0)) {
      return [];
    }

    return [{ symbol: asset.symbol, price }];
  });

  return assets.length > 0 ? assets : undefined;
}

/**
 * Idempotent slimming for legacy agent_cycles.payload rows.
 * Matches lib/agent/persist.ts slimCycleForStorage semantics on stored JSON.
 */
export function slimStoredCyclePayload(payload: unknown): {
  slim: JsonRecord;
  changed: boolean;
  beforeBytes: number;
  afterBytes: number;
} {
  const beforeBytes = approximatePayloadBytes(payload);

  if (!isRecord(payload)) {
    return { slim: {}, changed: false, beforeBytes, afterBytes: beforeBytes };
  }

  if (!storedCyclePayloadNeedsSlim(payload)) {
    return { slim: payload, changed: false, beforeBytes, afterBytes: beforeBytes };
  }

  const slim = cloneJson(payload) as JsonRecord;

  if (!Array.isArray(slim.marketCheckAssets)) {
    const fromSnapshot = marketCheckAssetsFromSnapshot(slim.snapshot);

    if (fromSnapshot) {
      slim.marketCheckAssets = fromSnapshot;
    }
  }

  delete slim.trace;
  delete slim.snapshot;
  delete slim.account;
  delete slim.events;

  if (isRecord(slim.execution)) {
    const execution = { ...slim.execution };
    delete execution.account;
    delete execution.valuation;
    slim.execution = execution;
  }

  const afterBytes = approximatePayloadBytes(slim);

  return { slim, changed: true, beforeBytes, afterBytes };
}
