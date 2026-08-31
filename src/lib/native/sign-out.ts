/**
 * Shared sign-out for web + native.
 * Clears business caches, signs out of Supabase, then leaves to a safe destination
 * (never the public marketing homepage inside the Android shell).
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { resetAllBusinessStores } from "@/lib/session-cleanup";
import { invalidateRolesCache } from "@/lib/rbac";

export function postSignOutPath(): string {
  return "/login";
}

/** Safe destination after successful auth (never the public marketing homepage). */
export function postAuthLandingPath(fallback = "/app"): string {
  if (fallback === "/" || fallback === "") return "/app";
  return fallback;
}

export async function signOutAndLeave(options?: {
  scope?: "local" | "global" | "others";
  /** Skip pending-queue warning (already confirmed by UI) */
  force?: boolean;
}): Promise<void> {
  try {
    const { processOfflineQueue, countPendingOps } = await import("@/lib/offline");
    const pending = await countPendingOps();
    if (pending > 0 && isOnlineSafe()) {
      await processOfflineQueue({ manual: true });
    }
  } catch {
    /* never block sign-out on sync */
  }
  try {
    const { assistantTts } = await import("@/lib/assistant/assistant-tts");
    await assistantTts.dispose();
  } catch {
    /* never block sign-out on TTS */
  }
  try {
    await resetAllBusinessStores();
  } catch {
    /* never block sign-out on cache clear */
  }
  try {
    const { clearErpSessionCache } = await import("@/lib/offline/erp-session-cache");
    const { clearErpReadCache } = await import("@/lib/offline/erp-read-cache");
    await Promise.all([clearErpSessionCache(), clearErpReadCache()]);
  } catch {
    /* never block sign-out on offline cache clear */
  }
  try {
    invalidateRolesCache();
  } catch {
    /* ignore */
  }
  try {
    if (options?.scope) {
      await supabase.auth.signOut({ scope: options.scope });
    } else {
      await supabase.auth.signOut();
    }
    try {
      const { clearCachedFirmId } = await import("@/lib/firm-scoped-app-settings");
      clearCachedFirmId();
    } catch {
      /* ignore */
    }
  } catch {
    /* local session clear still happens via hard redirect */
  }
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
  window.location.href = postSignOutPath();
}

function isOnlineSafe(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}
