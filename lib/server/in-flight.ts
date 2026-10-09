const flights = new Map<string, Promise<unknown>>();

/** Coalesce concurrent callers for the same key into one promise. */
export function runInFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = flights.get(key) as Promise<T> | undefined;

  if (existing) {
    return existing;
  }

  const promise = fn().finally(() => {
    flights.delete(key);
  });

  flights.set(key, promise);
  return promise;
}

export function resetInFlightForTests(): void {
  flights.clear();
}
