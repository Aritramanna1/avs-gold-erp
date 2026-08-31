/**
 * In-flight dedupe for data-loader pulls — prevents boot + realtime + route refresh
 * from issuing duplicate REST queries for the same table in parallel.
 */

const inFlight = new Map<string, Promise<void>>();

export function dedupedPull(key: string, fn: () => Promise<void>): Promise<void> {
  const existing = inFlight.get(key);
  if (existing) return existing;
  const promise = fn().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

/** Test-only reset. */
export function resetPullDedupeForTests(): void {
  inFlight.clear();
}
