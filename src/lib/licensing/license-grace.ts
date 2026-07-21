/** Pure offline rules for a previously verified, server-signed entitlement. */
export type LicenseStatus = "checking" | "trial" | "active" | "expired" | "suspended" | "lifetime";

export interface LicenseCache {
  status: Exclude<LicenseStatus, "checking">;
  expiry: number | null;
  trialStartedAt: number | null;
  trialEndsAt: number | null;
  seats: number | null;
  edition?: string | null;
  features?: string[];
  customerStatus?: string | null;
  lastVerifiedAt: number;
  offlineValidUntil?: number | null;
}

export const DAY_MS = 86_400_000;

export function evaluateOffline(
  cache: LicenseCache | null,
  graceDays: number,
  now: number,
): Exclude<LicenseStatus, "checking"> {
  if (!cache) return "expired";
  if (cache.status === "lifetime") return "lifetime"; // never expires, no grace check
  if (cache.status === "suspended") return "suspended";
  if (cache.status === "expired") return "expired";
  if (cache.status === "trial") {
    return cache.trialEndsAt !== null && now <= cache.trialEndsAt ? "trial" : "expired";
  }
  if (cache.expiry !== null && now > cache.expiry) return "expired";
  const offlineLimit =
    cache.offlineValidUntil ?? cache.lastVerifiedAt + Math.max(0, graceDays) * DAY_MS;
  if (now > offlineLimit) return "expired";
  return "active";
}
