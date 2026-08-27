/**
 * Rate limiter for public surfaces (doc verify, share).
 * Tries backend RPC consume_public_rate_limit when available; falls back to
 * in-tab Map. Complements RLS — does not replace it.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";

const buckets = new Map<string, { count: number; resetAt: number }>();

function consumeLocal(
  key: string,
  opts: { limit: number; windowMs: number },
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || now >= cur.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (cur.count >= opts.limit) {
    return { allowed: false, retryAfterMs: Math.max(0, cur.resetAt - now) };
  }
  cur.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

export function consumePublicRateLimit(
  key: string,
  opts: { limit: number; windowMs: number } = { limit: 60, windowMs: 60_000 },
): { allowed: boolean; retryAfterMs: number } {
  return consumeLocal(key, opts);
}

/** Prefer server bucket when migration is applied; else local. */
export async function consumePublicRateLimitAsync(
  key: string,
  opts: { limit: number; windowMs: number } = { limit: 40, windowMs: 60_000 },
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  try {
    const { data, error } = await (supabase as any).rpc("consume_public_rate_limit", {
      p_bucket: key,
      p_limit: opts.limit,
      p_window_seconds: Math.max(1, Math.round(opts.windowMs / 1000)),
    });
    if (!error && data && typeof data === "object") {
      const row = data as { allowed?: boolean; retry_after_ms?: number };
      return {
        allowed: row.allowed !== false,
        retryAfterMs: typeof row.retry_after_ms === "number" ? row.retry_after_ms : 0,
      };
    }
  } catch {
    /* RPC missing / network — fall through */
  }
  return consumeLocal(key, opts);
}
