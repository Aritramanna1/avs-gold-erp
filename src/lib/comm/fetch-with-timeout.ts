/**
 * Shared HTTP helpers for every comm provider (WhatsApp Cloud API/BSP/OpenWA,
 * Resend/SendGrid/Mailgun) — one implementation, not nine copies.
 *
 * fetchWithTimeout: a hung provider endpoint must not block a send()
 * promise indefinitely (no AbortController = effectively no timeout in a
 * browser). Every provider's outbound fetch() should go through this.
 *
 * withRateLimit: a bulk reminder sweep (or any burst of sends) must not
 * fire requests faster than the configured provider realistically accepts
 * — WhatsApp Cloud API and most email relays (SendGrid/Resend/SMTP) start
 * throttling or banning bursts. This is a simple per-channel minimum-
 * interval gate, not a full token-bucket — enough to keep the ERP a good
 * citizen of third-party rate limits without over-engineering it.
 */

const DEFAULT_TIMEOUT_MS = 15_000;

export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error(`Request to ${input} timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Minimum gap (ms) between two sends on the same channel — conservative
// defaults well under every major provider's documented rate limit.
const MIN_INTERVAL_MS: Record<string, number> = {
  whatsapp: 1200,
  email: 300,
  sms: 300,
};

const lastSendAt = new Map<string, number>();

/** Delays the caller (if needed) so consecutive sends on the same channel
 *  never fire faster than MIN_INTERVAL_MS apart. Keyed by channel only
 *  (not per-branch) — deliberately conservative since the underlying
 *  provider's rate limit is usually account-wide, not per-branch. */
export async function withRateLimit<T>(channel: string, fn: () => Promise<T>): Promise<T> {
  const minGap = MIN_INTERVAL_MS[channel] ?? 300;
  const last = lastSendAt.get(channel) ?? 0;
  const wait = last + minGap - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastSendAt.set(channel, Date.now());
  return fn();
}

/**
 * Retries a WasenderAPI upload/send step with exponential backoff. Only
 * retries transient failures (network error, HTTP 429, HTTP 5xx) — a
 * validation failure (bad phone, missing PDF, 4xx other than 429) is not
 * transient and must fail immediately instead of burning 3 attempts.
 */
export interface RetryableResult {
  ok: boolean;
  status?: number;
}

export async function withRetry<T extends RetryableResult>(
  fn: (attempt: number) => Promise<T>,
  opts: { maxRetries?: number; onRetry?: (attempt: number, delayMs: number) => void } = {},
): Promise<T & { retryCount: number }> {
  const maxRetries = opts.maxRetries ?? 3;
  let lastResult: T | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn(attempt);
      if (result.ok) return { ...result, retryCount: attempt };
      const status = result.status ?? 0;
      const transient = status === 429 || status >= 500 || status === 0;
      lastResult = result;
      if (!transient || attempt === maxRetries) return { ...result, retryCount: attempt };
    } catch (err) {
      if (attempt === maxRetries) {
        return { ok: false, status: 0, retryCount: attempt, error: String(err) } as unknown as T & {
          retryCount: number;
        };
      }
    }
    const delayMs = 500 * 2 ** attempt; // 500ms, 1s, 2s
    opts.onRetry?.(attempt + 1, delayMs);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return { ...(lastResult as T), retryCount: maxRetries };
}
