/**
 * Portal offline cache — previously synced portal snapshots for Customer/Supplier/Karigar.
 * Read-only when offline; mutations still go through the offline queue / require network
 * according to their safety classification. Never a second accounting ledger.
 */
import { isNativeApp } from "@/lib/native/platform";

const PREFIX = "ornexa.portal.cache.v1";

export type PortalCacheKind = "customer" | "supplier" | "karigar";

export interface PortalCacheEnvelope<T = unknown> {
  kind: PortalCacheKind;
  firmId: string;
  partyId: string;
  savedAt: string;
  payload: T;
}

function storageKey(kind: PortalCacheKind, firmId: string, partyId: string): string {
  return `${PREFIX}:${kind}:${firmId}:${partyId}`;
}

export function savePortalCache<T>(
  kind: PortalCacheKind,
  firmId: string,
  partyId: string,
  payload: T,
): void {
  if (typeof localStorage === "undefined") return;
  try {
    const envelope: PortalCacheEnvelope<T> = {
      kind,
      firmId,
      partyId,
      savedAt: new Date().toISOString(),
      payload,
    };
    localStorage.setItem(storageKey(kind, firmId, partyId), JSON.stringify(envelope));
  } catch {
    // Quota / private mode — ignore; live fetch remains source of truth when online.
  }
}

export function loadPortalCache<T>(
  kind: PortalCacheKind,
  firmId: string,
  partyId: string,
): PortalCacheEnvelope<T> | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(kind, firmId, partyId));
    if (!raw) return null;
    return JSON.parse(raw) as PortalCacheEnvelope<T>;
  } catch {
    return null;
  }
}

export function portalOfflineHint(): string {
  return isNativeApp()
    ? "You are offline. Showing the last synced portal data. Actions that need the server stay queued until you reconnect."
    : "You are offline. Showing the last synced portal data.";
}

/** Drop all cached portal snapshots (required on firm switch / sign-out). */
export function clearAllPortalCache(): void {
  if (typeof localStorage === "undefined") return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(`${PREFIX}:`)) keysToRemove.push(key);
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}
