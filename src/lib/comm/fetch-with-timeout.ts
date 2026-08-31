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
