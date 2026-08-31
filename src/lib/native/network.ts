/**
 * Network awareness for mobile — online/offline + Capacitor App state.
 * Also probes Supabase reachability so "no internet" is not a silent failure.
 */
import { isNativeApp } from "@/lib/native/platform";
import { isSupabaseConfigured } from "@/lib/providers/data-provider";

export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

export function subscribeNetworkStatus(onChange: (online: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const up = () => onChange(true);
  const down = () => onChange(false);
  window.addEventListener("online", up);
  window.addEventListener("offline", down);
  return () => {
    window.removeEventListener("online", up);
    window.removeEventListener("offline", down);
  };
}

/** When app returns from background, caller can refresh critical queries. */
export async function subscribeAppResume(onResume: () => void): Promise<() => void> {
  if (!isNativeApp()) return () => {};
  try {
    const { App } = await import(/* @vite-ignore */ "@capacitor/app");
    const handle = await App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) onResume();
    });
    return () => {
      void handle.remove();
    };
  } catch {
    return () => {};
  }
}

/**
 * Lightweight reachability check against the baked Supabase project.
 * Returns false when the device truly cannot talk to staging.
 */
export async function probeSupabaseReachable(timeoutMs = 8000): Promise<{
  ok: boolean;
  detail?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { ok: false, detail: "Supabase is not configured in this APK build." };
  }
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
  if (!url) return { ok: false, detail: "Missing VITE_SUPABASE_URL." };

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), timeoutMs);
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller?.signal,
    });
    // 2xx/4xx both prove TCP/TLS/DNS worked; only network errors mean offline.
    if (res.status >= 500) {
      return { ok: false, detail: `Supabase health returned HTTP ${res.status}.` };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network request failed";
    return {
      ok: false,
      detail: isOnline()
        ? `Cannot reach AVS ERP cloud (${msg}). Check Wi‑Fi/mobile data.`
        : "Device reports offline. Turn on Wi‑Fi or mobile data.",
    };
  } finally {
    clearTimeout(timer);
  }
}
