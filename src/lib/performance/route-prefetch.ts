/**
 * Idle-time route chunk prefetch — role/recent-usage aware, never prefetches entire ERP.
 */
import { router } from "@/router";
import { getStartupPreferences } from "@/lib/startup-preferences";

const PREFETCHED = new Set<string>();

const ROLE_HINTS: Record<string, string[]> = {
  owner: ["/orders", "/billing", "/stock", "/workshop"],
  manager: ["/orders", "/workshop", "/reports"],
  billing: ["/billing", "/people", "/orders"],
  workshop: ["/workshop", "/orders", "/stock"],
  vault: ["/stock", "/workshop"],
  accountant: ["/billing", "/reports", "/ledger"],
  viewer: ["/", "/orders"],
  saas_admin: ["/platform"],
};

function scheduleIdle(fn: () => void): void {
  if (typeof window === "undefined") return;
  const ric = window.requestIdleCallback;
  if (ric) {
    ric(() => fn(), { timeout: 4000 });
  } else {
    window.setTimeout(fn, 1200);
  }
}

export function prefetchLikelyRoutes(role: string | null | undefined): void {
  scheduleIdle(() => {
    const prefs = getStartupPreferences();
    const candidates = new Set<string>();

    for (const r of prefs.recentRoutes.slice(0, 3)) candidates.add(r);

    const hints = ROLE_HINTS[(role ?? "viewer").toLowerCase()] ?? ROLE_HINTS.viewer;
    for (const h of hints) candidates.add(h);

    for (const path of candidates) {
      if (PREFETCHED.has(path)) continue;
      PREFETCHED.add(path);
      try {
        void router.preloadRoute({ to: path as "/" });
      } catch {
        // Route may not exist for this build — ignore
      }
    }
  });
}
