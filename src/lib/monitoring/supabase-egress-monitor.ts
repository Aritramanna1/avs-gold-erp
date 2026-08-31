/**
 * Client-side Supabase egress instrumentation — counts requests and estimated
 * response bytes. No tokens, passwords, or response bodies are logged.
 */

export type EgressTrafficClass = "rest" | "auth" | "storage" | "functions" | "realtime" | "other";

export interface EgressMonitorEntry {
  at: number;
  class: EgressTrafficClass;
  method: string;
  path: string;
  status: number;
  bytes: number;
  durationMs: number;
  deduped: boolean;
  blocked: boolean;
}

export interface EgressMonitorTopPath {
  path: string;
  class: EgressTrafficClass;
  count: number;
  bytes: number;
}

export interface EgressLoginBootSummary {
  startedAt: number | null;
  completedAt: number | null;
  durationMs: number | null;
  totalRequests: number;
  authRequests: number;
  restRequests: number;
  storageRequests: number;
  realtimeEvents: number;
  dedupedRequests: number;
  blockedRequests: number;
  totalBytes: number;
}

export interface EgressMonitorSnapshot {
  startedAt: number;
  totalRequests: number;
  blockedRequests: number;
  dedupedRequests: number;
  totalBytes: number;
  byClass: Record<EgressTrafficClass, { count: number; bytes: number }>;
  topPaths: EgressMonitorTopPath[];
  recent: EgressMonitorEntry[];
  operations: EgressOperationRecord[];
  loginBoot: EgressLoginBootSummary;
}

export interface EgressOperationRecord {
  at: number;
  operation:
    | "login_boot"
    | "auth_resolve"
    | "cloud_sync"
    | "dashboard_summary"
    | "gold_ledger_page"
    | "customer_context"
    | "realtime_connect";
  durationMs: number;
  ok: boolean;
  detail?: string;
  requestCountAtStart: number;
  requestCountAtEnd: number;
  bytesAtStart: number;
  bytesAtEnd: number;
}

const MAX_RECENT = 200;
const MAX_TOP = 40;

const startedAt = Date.now();
let totalRequests = 0;
let blockedRequests = 0;
let dedupedRequests = 0;
let totalBytes = 0;

const byClass: Record<EgressTrafficClass, { count: number; bytes: number }> = {
  rest: { count: 0, bytes: 0 },
  auth: { count: 0, bytes: 0 },
  storage: { count: 0, bytes: 0 },
  functions: { count: 0, bytes: 0 },
  realtime: { count: 0, bytes: 0 },
  other: { count: 0, bytes: 0 },
};

const pathStats = new Map<string, EgressMonitorTopPath>();
const recent: EgressMonitorEntry[] = [];
const operations: EgressOperationRecord[] = [];
const MAX_OPERATIONS = 50;

let loginBootStartedAt: number | null = null;
let loginBootCompletedAt: number | null = null;
let loginBootReq0 = 0;
let loginBootBytes0 = 0;
let loginBootDeduped0 = 0;
let loginBootBlocked0 = 0;
let loginBootAuth0 = 0;
let loginBootRest0 = 0;
let loginBootStorage0 = 0;
let loginBootRealtime0 = 0;

function classifyUrl(url: string): EgressTrafficClass {
  if (/\/rest\/v1\//i.test(url)) return "rest";
  if (/\/auth\/v1\//i.test(url)) return "auth";
  if (/\/storage\/v1\//i.test(url)) return "storage";
  if (/\/functions\/v1\//i.test(url)) return "functions";
  if (/\/realtime\/v1\//i.test(url)) return "realtime";
  return "other";
}

/** Strip query string and collapse UUIDs for grouping. */
export function sanitizeEgressPath(url: string): string {
  try {
    const u = new URL(url);
    let p = u.pathname
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
      .replace(/\/\d+(?=\/|$)/g, "/:n");
    return p;
  } catch {
    return url.split("?")[0] ?? url;
  }
}

export function recordEgressBlocked(method: string, url: string): void {
  blockedRequests += 1;
  pushEntry({
    at: Date.now(),
    class: classifyUrl(url),
    method,
    path: sanitizeEgressPath(url),
    status: 503,
    bytes: 0,
    durationMs: 0,
    deduped: false,
    blocked: true,
  });
}

export function recordEgressDeduped(method: string, url: string): void {
  dedupedRequests += 1;
  pushEntry({
    at: Date.now(),
    class: classifyUrl(url),
    method,
    path: sanitizeEgressPath(url),
    status: 0,
    bytes: 0,
    durationMs: 0,
    deduped: true,
    blocked: false,
  });
}

export async function measureEgressResponse(
  method: string,
  url: string,
  started: number,
  response: Response,
): Promise<Response> {
  const clone = response.clone();
  let bytes = 0;
  try {
    const buf = await clone.arrayBuffer();
    bytes = buf.byteLength;
  } catch {
    bytes = Number(response.headers.get("content-length") ?? 0) || 0;
  }
  recordEgressSuccess(method, url, response.status, bytes, Date.now() - started);
  return response;
}

export function recordEgressSuccess(
  method: string,
  url: string,
  status: number,
  bytes: number,
  durationMs: number,
): void {
  totalRequests += 1;
  totalBytes += bytes;
  const cls = classifyUrl(url);
  byClass[cls].count += 1;
  byClass[cls].bytes += bytes;

  const path = sanitizeEgressPath(url);
  const key = `${cls}:${method}:${path}`;
  const prev = pathStats.get(key) ?? { path, class: cls, count: 0, bytes: 0 };
  prev.count += 1;
  prev.bytes += bytes;
  pathStats.set(key, prev);

  pushEntry({
    at: Date.now(),
    class: cls,
    method,
    path,
    status,
    bytes,
    durationMs,
    deduped: false,
    blocked: false,
  });
}

function pushEntry(entry: EgressMonitorEntry): void {
  recent.push(entry);
  if (recent.length > MAX_RECENT) recent.shift();
}

export function recordRealtimeConnection(event: "connect" | "disconnect" | "reconnect"): void {
  totalRequests += 1;
  byClass.realtime.count += 1;
  pushEntry({
    at: Date.now(),
    class: "realtime",
    method: event.toUpperCase(),
    path: "/realtime/v1/websocket",
    status: event === "disconnect" ? 0 : 101,
    bytes: 0,
    durationMs: 0,
    deduped: false,
    blocked: false,
  });
}

export function beginEgressOperation(
  operation: EgressOperationRecord["operation"],
): { finish: (ok: boolean, detail?: string) => void } {
  const started = Date.now();
  const req0 = totalRequests;
  const bytes0 = totalBytes;
  return {
    finish(ok, detail) {
      const record: EgressOperationRecord = {
        at: started,
        operation,
        durationMs: Date.now() - started,
        ok,
        detail,
        requestCountAtStart: req0,
        requestCountAtEnd: totalRequests,
        bytesAtStart: bytes0,
        bytesAtEnd: totalBytes,
      };
      operations.push(record);
      if (operations.length > MAX_OPERATIONS) operations.shift();
      if (import.meta.env.DEV) {
        const deltaReq = record.requestCountAtEnd - record.requestCountAtStart;
        const deltaBytes = record.bytesAtEnd - record.bytesAtStart;
        console.info(
          `[egress-op] ${operation} ${ok ? "ok" : "fail"} ${record.durationMs}ms +${deltaReq} req +${Math.round(deltaBytes / 1024)}KB${detail ? ` (${detail})` : ""}`,
        );
      }
    },
  };
}

function buildLoginBootSummary(): EgressLoginBootSummary {
  const base = {
    startedAt: loginBootStartedAt,
    completedAt: loginBootCompletedAt,
    durationMs:
      loginBootStartedAt != null
        ? (loginBootCompletedAt ?? Date.now()) - loginBootStartedAt
        : null,
    totalRequests: loginBootStartedAt != null ? totalRequests - loginBootReq0 : 0,
    authRequests: loginBootStartedAt != null ? byClass.auth.count - loginBootAuth0 : 0,
    restRequests: loginBootStartedAt != null ? byClass.rest.count - loginBootRest0 : 0,
    storageRequests: loginBootStartedAt != null ? byClass.storage.count - loginBootStorage0 : 0,
    realtimeEvents: loginBootStartedAt != null ? byClass.realtime.count - loginBootRealtime0 : 0,
    dedupedRequests: loginBootStartedAt != null ? dedupedRequests - loginBootDeduped0 : 0,
    blockedRequests: loginBootStartedAt != null ? blockedRequests - loginBootBlocked0 : 0,
    totalBytes: loginBootStartedAt != null ? totalBytes - loginBootBytes0 : 0,
  };
  return base;
}

/** True while a login boot window is open (SIGNED_IN → initialLoadDone or platform-owner resolve). */
export function isLoginBootInProgress(): boolean {
  return loginBootStartedAt != null && loginBootCompletedAt == null;
}

/** Call at SIGNED_IN / fresh session bootstrap — resets counters for per-login measurement. */
export function markLoginBootStart(): void {
  resetEgressCountersOnly();
  loginBootStartedAt = Date.now();
  loginBootCompletedAt = null;
  loginBootReq0 = 0;
  loginBootBytes0 = 0;
  loginBootDeduped0 = 0;
  loginBootBlocked0 = 0;
  loginBootAuth0 = 0;
  loginBootRest0 = 0;
  loginBootStorage0 = 0;
  loginBootRealtime0 = 0;
  if (import.meta.env.DEV) {
    console.info("[egress] login boot measurement started");
  }
}

/** Call when background boot pull completes — freezes per-login totals. */
export function markLoginBootComplete(): void {
  if (loginBootStartedAt == null || loginBootCompletedAt != null) return;
  loginBootCompletedAt = Date.now();
  const summary = buildLoginBootSummary();
  operations.push({
    at: loginBootStartedAt,
    operation: "login_boot",
    durationMs: summary.durationMs ?? 0,
    ok: true,
    detail: `req=${summary.totalRequests} auth=${summary.authRequests} rest=${summary.restRequests}`,
    requestCountAtStart: loginBootReq0,
    requestCountAtEnd: totalRequests,
    bytesAtStart: loginBootBytes0,
    bytesAtEnd: totalBytes,
  });
  if (operations.length > MAX_OPERATIONS) operations.shift();
  if (import.meta.env.DEV) {
    console.info(
      `[egress] login boot complete ${summary.durationMs}ms ` +
        `req=${summary.totalRequests} auth=${summary.authRequests} rest=${summary.restRequests} ` +
        `realtime=${summary.realtimeEvents} deduped=${summary.dedupedRequests} blocked=${summary.blockedRequests} ` +
        `bytes=${Math.round(summary.totalBytes / 1024)}KB`,
    );
  }
}

export function getEgressMonitorSnapshot(): EgressMonitorSnapshot {
  const topPaths = [...pathStats.values()]
    .sort((a, b) => b.bytes - a.bytes || b.count - a.count)
    .slice(0, MAX_TOP);
  return {
    startedAt,
    totalRequests,
    blockedRequests,
    dedupedRequests,
    totalBytes,
    byClass: {
      rest: { ...byClass.rest },
      auth: { ...byClass.auth },
      storage: { ...byClass.storage },
      functions: { ...byClass.functions },
      realtime: { ...byClass.realtime },
      other: { ...byClass.other },
    },
    topPaths,
    recent: [...recent],
    operations: [...operations],
    loginBoot: buildLoginBootSummary(),
  };
}

/** Reset all traffic counters (does not clear an in-progress login boot window). */
export function resetEgressMonitor(): void {
  totalRequests = 0;
  blockedRequests = 0;
  dedupedRequests = 0;
  totalBytes = 0;
  pathStats.clear();
  recent.length = 0;
  operations.length = 0;
  for (const k of Object.keys(byClass) as EgressTrafficClass[]) {
    byClass[k] = { count: 0, bytes: 0 };
  }
}

function resetEgressCountersOnly(): void {
  resetEgressMonitor();
}

if (typeof window !== "undefined") {
  (
    window as unknown as {
      __ORNEXA_EGRESS__?: {
        snapshot: () => EgressMonitorSnapshot;
        reset: () => void;
        markLoginBootStart: () => void;
        markLoginBootComplete: () => void;
        loginSummary: () => EgressLoginBootSummary;
      };
    }
  ).__ORNEXA_EGRESS__ = {
    snapshot: getEgressMonitorSnapshot,
    reset: resetEgressMonitor,
    markLoginBootStart,
    markLoginBootComplete,
    loginSummary: buildLoginBootSummary,
  };
}
