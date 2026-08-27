/**
 * Lightweight client-side rate limiter for public surfaces (doc verify, share).
 * Complements backend RLS; does not replace server controls.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function consumePublicRateLimit(
  key: string,
  opts: { limit: number; windowMs: number } = { limit: 60, windowMs: 60_000 },
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
