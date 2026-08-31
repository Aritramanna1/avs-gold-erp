/**
 * Client-side Supabase REST/RPC fetch throttling — reduces request storms from
 * boot pulls, realtime debounces, and dev hot reload. Does not weaken RLS.
 */

import {
  blockedSupabaseResponse,
  shouldBlockSupabaseRequest,
} from "@/lib/supabase-egress-guard";
import {
  isLoginBootInProgress,
  measureEgressResponse,
  recordEgressBlocked,
  recordEgressDeduped,
} from "@/lib/monitoring/supabase-egress-monitor";

/** Owner-opted live dev Supabase — same request budget as production builds. */
function devLiveSupabaseEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_SUPABASE === "1";
}

const relaxedEgress = import.meta.env.PROD || devLiveSupabaseEnabled();
const WINDOW_MS = 10_000;
const MAX_REQUESTS_PER_WINDOW = relaxedEgress ? 80 : 10;
const MAX_REQUESTS_BOOT = relaxedEgress ? 120 : 22;
const MIN_REQUEST_GAP_MS = relaxedEgress ? 0 : 400;
const MIN_REQUEST_GAP_BOOT_MS = relaxedEgress ? 0 : 80;
const AUTH_WINDOW_MS = 10_000;
const MAX_AUTH_REQUESTS_PER_WINDOW = 6;
const MAX_AUTH_REQUESTS_BOOT = 10;

const REST_PATH_RE = /\/rest\/v1\//i;
const AUTH_PATH_RE = /\/auth\/v1\//i;

let windowStart = Date.now();
let windowCount = 0;
let authWindowStart = Date.now();
let authWindowCount = 0;
let lastRequestAt = 0;
const inFlight = new Map<string, Promise<Response>>();

function isAuthRequest(input: RequestInfo | URL): boolean {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return AUTH_PATH_RE.test(url);
}

function isRestRequest(input: RequestInfo | URL): boolean {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return REST_PATH_RE.test(url);
}

function requestKey(input: RequestInfo | URL, init?: RequestInit): string | null {
  const method = (init?.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return null;
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return `${method}:${url}`;
}

function tickWindow(): void {
  const now = Date.now();
  if (now - windowStart >= WINDOW_MS) {
    windowStart = now;
    windowCount = 0;
  }
  if (now - authWindowStart >= AUTH_WINDOW_MS) {
    authWindowStart = now;
    authWindowCount = 0;
  }
}

function throttleLimits(auth: boolean): { max: number; minGapMs: number } {
  const boot = isLoginBootInProgress();
  if (auth) {
    return {
      max: boot ? MAX_AUTH_REQUESTS_BOOT : MAX_AUTH_REQUESTS_PER_WINDOW,
      minGapMs: boot ? MIN_REQUEST_GAP_BOOT_MS : MIN_REQUEST_GAP_MS,
    };
  }
  return {
    max: boot ? MAX_REQUESTS_BOOT : MAX_REQUESTS_PER_WINDOW,
    minGapMs: boot ? MIN_REQUEST_GAP_BOOT_MS : MIN_REQUEST_GAP_MS,
  };
}

async function waitForSlot(auth: boolean): Promise<void> {
  for (;;) {
    tickWindow();
    const { max, minGapMs } = throttleLimits(auth);
    const gapOk = Date.now() - lastRequestAt >= minGapMs;
    const underCap = auth ? authWindowCount < max : windowCount < max;
    if (underCap && gapOk) {
      if (auth) authWindowCount += 1;
      else windowCount += 1;
      lastRequestAt = Date.now();
      return;
    }
    const waitMs = (auth ? AUTH_WINDOW_MS : WINDOW_MS) - (Date.now() - (auth ? authWindowStart : windowStart)) + 50;
    await new Promise((r) => setTimeout(r, Math.min(Math.max(50, waitMs), 2_000)));
  }
}

export function createThrottledFetch(baseFetch: typeof fetch): typeof fetch {
  return async (input, init) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    if (shouldBlockSupabaseRequest(input)) {
      recordEgressBlocked(method, url);
      return blockedSupabaseResponse();
    }

    const auth = isAuthRequest(input);
    if (!auth && !isRestRequest(input)) {
      return baseFetch(input, init);
    }

    const key = requestKey(input, init);
    if (key) {
      const existing = inFlight.get(key);
      if (existing) {
        recordEgressDeduped(method, url);
        return existing.then((res) => res.clone());
      }
    }

    await waitForSlot(auth);

    const started = Date.now();
    const promise = baseFetch(input, init)
      .then((res) => measureEgressResponse(method, url, started, res))
      .finally(() => {
        if (key) inFlight.delete(key);
      });

    if (key) inFlight.set(key, promise);
    return promise;
  };
}
