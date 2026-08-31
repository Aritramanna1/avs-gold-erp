/** Persists cloud boot completion across full page reloads within one browser session. */

const BOOT_KEY_PREFIX = "ornexa.boot.complete";
const BOOT_TTL_MS = 30 * 60 * 1000;

function storageKey(userId: string, firmId: string): string {
  return `${BOOT_KEY_PREFIX}:${userId}:${firmId}`;
}

export function readBootSessionCache(userId: string | null, firmId: string | null): boolean {
  if (typeof sessionStorage === "undefined" || !userId || !firmId) return false;
  try {
    const raw = sessionStorage.getItem(storageKey(userId, firmId));
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { at?: number };
    if (!parsed.at || Date.now() - parsed.at > BOOT_TTL_MS) {
      sessionStorage.removeItem(storageKey(userId, firmId));
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function writeBootSessionCache(userId: string | null, firmId: string | null): void {
  if (typeof sessionStorage === "undefined" || !userId || !firmId) return;
  try {
    sessionStorage.setItem(storageKey(userId, firmId), JSON.stringify({ at: Date.now() }));
  } catch {
    /* quota / private mode */
  }
}

export function clearBootSessionCache(userId?: string | null, firmId?: string | null): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (userId && firmId) {
      sessionStorage.removeItem(storageKey(userId, firmId));
      return;
    }
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(BOOT_KEY_PREFIX)) sessionStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}
