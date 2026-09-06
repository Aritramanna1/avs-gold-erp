/**
 * Supabase Auth storage adapter — uses official persisted session mechanism.
 * Default: localStorage (survives browser restart). Optional session-only mode
 * when user unchecks "Keep me signed in".
 *
 * Never stores passwords or privileged Supabase keys — only session tokens.
 */

export const REMEMBER_DEVICE_KEY = "ornexa-remember-device";

const memoryStorage: Storage = {
  length: 0,
  clear: () => {},
  getItem: () => null,
  key: () => null,
  removeItem: () => {},
  setItem: () => {},
};

function getLocalStorage(): Storage {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  if (typeof globalThis !== "undefined" && (globalThis as any).localStorage)
    return (globalThis as any).localStorage;
  return memoryStorage;
}

function getSessionStorage(): Storage {
  if (typeof window !== "undefined" && window.sessionStorage) return window.sessionStorage;
  if (typeof globalThis !== "undefined" && (globalThis as any).sessionStorage)
    return (globalThis as any).sessionStorage;
  return memoryStorage;
}

/** Default true: trusted browsers restore session without re-login. */
export function isRememberDeviceEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return getLocalStorage().getItem(REMEMBER_DEVICE_KEY) !== "false";
}

export function setRememberDevice(enabled: boolean): void {
  if (typeof window === "undefined") return;
  getLocalStorage().setItem(REMEMBER_DEVICE_KEY, enabled ? "true" : "false");
}

function activeStorage(): Storage {
  return isRememberDeviceEnabled() ? getLocalStorage() : getSessionStorage();
}

function inactiveStorage(): Storage {
  return isRememberDeviceEnabled() ? getSessionStorage() : getLocalStorage();
}

/** Scan both storages for Supabase auth token key (used by rbac fast-hydration). */
export function findSupabaseAuthTokenKey(): string | null {
  if (typeof window === "undefined") return null;
  for (const store of [getLocalStorage(), getSessionStorage()]) {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) return key;
    }
  }
  return null;
}

export function readSupabaseAuthTokenRaw(): string | null {
  const key = findSupabaseAuthTokenKey();
  if (!key) return null;
  return getLocalStorage().getItem(key) ?? getSessionStorage().getItem(key);
}

/**
 * Supabase-compatible storage — routes reads/writes to the active preference
 * and clears the inactive store to avoid split-brain sessions.
 */
export const supabaseAuthStorage = {
  getItem(key: string): string | null {
    const primary = activeStorage().getItem(key);
    if (primary != null) return primary;
    return inactiveStorage().getItem(key);
  },
  setItem(key: string, value: string): void {
    activeStorage().setItem(key, value);
    inactiveStorage().removeItem(key);
  },
  removeItem(key: string): void {
    getLocalStorage().removeItem(key);
    getSessionStorage().removeItem(key);
  },
};
