/**
 * Timeouts, retry-with-backoff, and staged-load phase helpers for boot and data pulls.
 */

export const STAGED_LOAD_THRESHOLDS_MS = {
  slowHint: 10_000,
  retryHint: 20_000,
  fail: 45_000,
} as const;

export type StagedLoadPhase = "idle" | "loading" | "slow" | "retry" | "failed" | "done";

export class AsyncTimeoutError extends Error {
  readonly label: string;
  readonly timeoutMs: number;

  constructor(label: string, timeoutMs: number) {
    super(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`);
    this.name = "AsyncTimeoutError";
    this.label = label;
    this.timeoutMs = timeoutMs;
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timer = setTimeout(() => {
      reject(new AsyncTimeoutError(label, timeoutMs));
    }, timeoutMs);

    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    promise
      .then((value) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        reject(error);
      });
  });
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  signal?: AbortSignal;
  label?: string;
}

export async function withRetryBackoff<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 800;
  const maxDelayMs = options.maxDelayMs ?? 8_000;
  const label = options.label ?? "request";

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (options.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) break;
      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delay);
        options.signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true },
        );
      });
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`${label} failed after ${maxAttempts} attempts`);
}

export function resolveStagedPhase(
  elapsedMs: number,
  failed: boolean,
  done: boolean,
): StagedLoadPhase {
  if (done) return "done";
  if (failed) return "failed";
  if (elapsedMs >= STAGED_LOAD_THRESHOLDS_MS.fail) return "failed";
  if (elapsedMs >= STAGED_LOAD_THRESHOLDS_MS.retryHint) return "retry";
  if (elapsedMs >= STAGED_LOAD_THRESHOLDS_MS.slowHint) return "slow";
  return "loading";
}
