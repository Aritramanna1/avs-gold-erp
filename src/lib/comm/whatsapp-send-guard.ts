/**
 * Lightweight duplicate-send guard — blocks identical API sends within a short window.
 */
const RECENT_SENDS = new Map<string, number>();
const DEDUP_WINDOW_MS = 8_000;

export function buildSendDedupKey(parts: {
  branchId?: string;
  phone?: string;
  message?: string;
  documentUrl?: string;
}): string {
  return [
    parts.branchId ?? "MAIN",
    parts.phone ?? "",
    parts.message ?? "",
    parts.documentUrl ?? "",
  ].join("|");
}

export function shouldBlockDuplicateSend(key: string): boolean {
  const last = RECENT_SENDS.get(key);
  const now = Date.now();
  if (last != null && now - last < DEDUP_WINDOW_MS) return true;
  RECENT_SENDS.set(key, now);
  if (RECENT_SENDS.size > 200) {
    for (const [k, ts] of RECENT_SENDS) {
      if (now - ts > DEDUP_WINDOW_MS) RECENT_SENDS.delete(k);
    }
  }
  return false;
}
