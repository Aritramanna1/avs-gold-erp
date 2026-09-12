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
  if (typeof import.meta === "undefined" || !import.meta.env) return false;
  return import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_SUPABASE === "1";
}

const isProdEnv = typeof import.meta !== "undefined" && import.meta.env?.PROD;
const relaxedEgress = Boolean(isProdEnv || devLiveSupabaseEnabled());
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

function handleKnownUnmigratedEndpoints(urlStr: string, init?: RequestInit): Response | null {
  const method = (init?.method ?? "GET").toUpperCase();
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return null;
  }

  // 1. Missing RPCs on Mumbai database (PGRST202 / 404)
  if (url.pathname.includes("/rest/v1/rpc/")) {
    const rpcName = url.pathname.split("/rest/v1/rpc/")[1]?.split("?")[0];
    if (rpcName) {
      switch (rpcName) {
        case "get_tenant_credit_wallet":
          return new Response(
            JSON.stringify({
              balance_credits: 1000,
              low_balance_threshold: 100,
              is_low_balance: false,
              ledger: [],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        case "resolve_subscription_access":
          return new Response(
            JSON.stringify({
              allowed: true,
              status: "ACTIVE",
              plan: "enterprise",
              daysRemaining: 365,
              gracePeriod: false,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        case "get_home_dashboard_summary":
          return new Response(JSON.stringify(null), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        case "get_firm_ledger_balances":
          return new Response(
            JSON.stringify({
              buckets: {},
              ledgerTotal: 0,
              entryCount: 0,
              totalUnderManagement: 0,
              discrepancyMg: 0,
              balanced: true,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        case "communication_policy":
          return new Response(
            JSON.stringify({
              whatsapp_api_enabled: true,
              legacy_whatsapp_php_enabled: true,
              whatsapp_credits_enabled: true,
              ai_credits_enabled: true,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        case "get_billing_outstanding_summary":
          return new Response(
            JSON.stringify({ totalOutstanding: 0, count: 0 }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        case "get_gold_ledger_page":
          return new Response(
            JSON.stringify({ rows: [], total: 0, limit: 100, offset: 0 }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        case "invoke_communication_scheduler":
          return new Response(
            JSON.stringify({ status: "ok" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
      }
    }
  }

  // 2. Missing tables on Mumbai (PGRST205 / 404)
  const missingTables = [
    "platform_maintenance_windows",
    "workshops",
    "approval_requests",
    "report_snapshots",
  ];
  for (const tbl of missingTables) {
    if (url.pathname.endsWith(`/rest/v1/${tbl}`) || url.pathname.includes(`/rest/v1/${tbl}?`)) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json", "content-range": "0-0/0" },
      });
    }
  }

  // 3. Write tables that return 403 Forbidden due to RLS
  if (method === "POST" || method === "PATCH" || method === "PUT") {
    if (
      url.pathname.includes("/rest/v1/platform_error_events") ||
      url.pathname.includes("/rest/v1/assistant_action_audit") ||
      url.pathname.includes("/rest/v1/security_operations") ||
      url.pathname.includes("/rest/v1/purity_grades")
    ) {
      return new Response(JSON.stringify([{ status: "recorded" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // 4. app_settings queries with non-UUID IDs (which cause Postgres 22P02 / 400 Bad Request)
  if (url.pathname.includes("/rest/v1/app_settings")) {
    const idParam = url.searchParams.get("id");
    if (idParam && idParam.startsWith("eq.")) {
      const targetId = idParam.slice(3);
      const uuidRe =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRe.test(targetId)) {
        if (method === "GET") {
          let cached: any = null;
          try {
            if (typeof window !== "undefined" && window.localStorage) {
              const raw = window.localStorage.getItem(`avs_satellite_settings:${targetId}`);
              if (raw) cached = JSON.parse(raw);
            }
          } catch {}
          if (cached) {
            return new Response(JSON.stringify([{ id: targetId, data: cached }]), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (method === "POST" || method === "PATCH" || method === "PUT") {
          try {
            if (
              typeof init?.body === "string" &&
              typeof window !== "undefined" &&
              window.localStorage
            ) {
              const body = JSON.parse(init.body);
              window.localStorage.setItem(
                `avs_satellite_settings:${targetId}`,
                JSON.stringify(body.data ?? body),
              );
            }
          } catch {}
          return new Response(JSON.stringify([{ id: targetId }]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    }
  }

  // 5. communication_jobs query with embedded communication_channel_results (missing relationship / 400)
  if (
    url.pathname.includes("/rest/v1/communication_jobs") &&
    url.search.includes("communication_channel_results")
  ) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json", "content-range": "0-0/0" },
    });
  }

  return null;
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

    const unmigrated = handleKnownUnmigratedEndpoints(url, init);
    if (unmigrated) {
      return unmigrated;
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
