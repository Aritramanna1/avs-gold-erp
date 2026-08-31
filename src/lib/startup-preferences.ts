/**
 * Safe UI startup hints — never authoritative for authorization.
 * Server revalidates membership, subscription, and RLS on every data access.
 */

const PREFIX = "ornexa-startup:";

export interface StartupPreferences {
  lastActiveProduct: string | null;
  lastActiveTenantId: string | null;
  lastActiveBranchId: string | null;
  language: string | null;
  theme: string | null;
  lastRoute: string | null;
  recentRoutes: string[];
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota exceeded — non-critical hints only
  }
}

export function getStartupPreferences(): StartupPreferences {
  return {
    lastActiveProduct: readJson<string | null>("product", null),
    lastActiveTenantId: readJson<string | null>("tenant", null),
    lastActiveBranchId: readJson<string | null>("branch", null),
    language: readJson<string | null>("language", null),
    theme: readJson<string | null>("theme", null),
    lastRoute: readJson<string | null>("lastRoute", null),
    recentRoutes: readJson<string[]>("recentRoutes", []),
  };
}

export function patchStartupPreferences(patch: Partial<StartupPreferences>): void {
  const current = getStartupPreferences();
  if (patch.lastActiveProduct !== undefined) writeJson("product", patch.lastActiveProduct);
  if (patch.lastActiveTenantId !== undefined) writeJson("tenant", patch.lastActiveTenantId);
  if (patch.lastActiveBranchId !== undefined) writeJson("branch", patch.lastActiveBranchId);
  if (patch.language !== undefined) writeJson("language", patch.language);
  if (patch.theme !== undefined) writeJson("theme", patch.theme);
  if (patch.lastRoute !== undefined) writeJson("lastRoute", patch.lastRoute);
  if (patch.recentRoutes !== undefined) writeJson("recentRoutes", patch.recentRoutes);
  void current;
}

export function recordRecentRoute(path: string): void {
  if (!path || path.startsWith("/auth")) return;
  const prefs = getStartupPreferences();
  const next = [path, ...prefs.recentRoutes.filter((r) => r !== path)].slice(0, 8);
  patchStartupPreferences({ lastRoute: path, recentRoutes: next });
}
