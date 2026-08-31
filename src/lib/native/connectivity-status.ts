/**
 * Distinguishes device network from AVS ERP backend / auth failures.
 * One failed query must not flip the whole ERP into "Offline Mode".
 */
import { isOnline, probeSupabaseReachable } from "@/lib/native/network";

export type ConnectivityKind =
  | "online"
  | "network_unavailable"
  | "backend_unavailable"
  | "session_expired"
  | "permission_denied"
  | "configuration_error";

export type ConnectivitySnapshot = {
  kind: ConnectivityKind;
  deviceOnline: boolean;
  detail?: string;
  checkedAt: number;
};

let lastSnapshot: ConnectivitySnapshot = {
  kind: "online",
  deviceOnline: true,
  checkedAt: 0,
};

const listeners = new Set<(s: ConnectivitySnapshot) => void>();

function emit(s: ConnectivitySnapshot) {
  lastSnapshot = s;
  listeners.forEach((fn) => fn(s));
}

export function getConnectivitySnapshot(): ConnectivitySnapshot {
  return lastSnapshot;
}

export function subscribeConnectivity(fn: (s: ConnectivitySnapshot) => void): () => void {
  listeners.add(fn);
  fn(lastSnapshot);
  return () => {
    listeners.delete(fn);
  };
}

export function classifyHttpishError(err: unknown): ConnectivityKind | null {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const lower = msg.toLowerCase();
  if (/jwt|session|not authenticated|invalid refresh|login required/i.test(lower)) {
    return "session_expired";
  }
  if (/permission|rls|not authorized|403|42501/i.test(lower)) {
    return "permission_denied";
  }
  if (/not configured|missing vite_supabase|invalid api key/i.test(lower)) {
    return "configuration_error";
  }
  if (/failed to fetch|networkerror|timeout|econn|abort/i.test(lower)) {
    return isOnline() ? "backend_unavailable" : "network_unavailable";
  }
  return null;
}

/** Soft probe — requires consecutive failures before showing backend_unavailable. */
let consecutiveBackendMisses = 0;

export async function refreshConnectivityStatus(): Promise<ConnectivitySnapshot> {
  const deviceOnline = isOnline();
  if (!deviceOnline) {
    consecutiveBackendMisses = 0;
    const snap: ConnectivitySnapshot = {
      kind: "network_unavailable",
      deviceOnline: false,
      detail: "Network unavailable",
      checkedAt: Date.now(),
    };
    emit(snap);
    return snap;
  }

  const reach = await probeSupabaseReachable(5000);
  if (reach.ok) {
    consecutiveBackendMisses = 0;
    const snap: ConnectivitySnapshot = { kind: "online", deviceOnline: true, checkedAt: Date.now() };
    emit(snap);
    return snap;
  }

  consecutiveBackendMisses += 1;
  // A single slow query / probe miss must not look like the database is down.
  if (consecutiveBackendMisses < 2) {
    const snap: ConnectivitySnapshot = {
      kind: lastSnapshot.kind === "backend_unavailable" ? "backend_unavailable" : "online",
      deviceOnline: true,
      detail: lastSnapshot.kind === "backend_unavailable" ? lastSnapshot.detail : undefined,
      checkedAt: Date.now(),
    };
    emit(snap);
    return snap;
  }

  const snap: ConnectivitySnapshot = {
    kind: "backend_unavailable",
    deviceOnline: true,
    detail: reach.detail ?? "Backend temporarily unavailable",
    checkedAt: Date.now(),
  };
  emit(snap);
  return snap;
}

export function connectivityLabel(kind: ConnectivityKind): string {
  switch (kind) {
    case "online":
      return "Online";
    case "network_unavailable":
      return "Network unavailable";
    case "backend_unavailable":
      return "Backend temporarily unavailable";
    case "session_expired":
      return "Session expired";
    case "permission_denied":
      return "Permission denied";
    case "configuration_error":
      return "Configuration error";
  }
}
