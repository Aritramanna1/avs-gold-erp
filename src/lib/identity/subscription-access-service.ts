/**
 * Central Subscription & Entitlement Access Engine.
 * Replaces legacy licence-key verification for runtime access decisions.
 *
 * Flow: Auth → Membership → Active Tenant → Subscription → Plan → Entitlements → Access
 */
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { DEFAULT_AVS_PRODUCT, type AvsProductId } from "@/lib/comm/platform/communication-events";

export type SubscriptionAccessStatus =
  | "checking"
  | "TRIAL_ACTIVE"
  | "TRIAL_EXPIRING"
  | "TRIAL_EXPIRED"
  | "ACTIVE"
  | "GRACE_PERIOD"
  | "PAST_DUE"
  | "PAYMENT_PENDING"
  | "EXPIRED"
  | "SUSPENDED"
  | "CANCELLED"
  | "NO_SUBSCRIPTION"
  | "NO_MEMBERSHIP"
  | "NO_TENANT"
  | "PLATFORM_OWNER";

export type SubscriptionAccessLevel =
  "granted" | "granted_limited" | "billing_only" | "subscription_required" | "denied";

export interface SubscriptionAccessSnapshot {
  access: SubscriptionAccessLevel;
  status: SubscriptionAccessStatus;
  valid: boolean;
  message: string | null;
  organizationId: string | null;
  productId: string;
  trialEndsAt: number | null;
  expiry: number | null;
  daysRemaining: number | null;
  edition: string | null;
  planCode: string | null;
  planName: string | null;
  features: Record<string, boolean>;
  limits: Record<string, unknown>;
  lastCheckedAt: number | null;
}

interface SubscriptionAccessState extends SubscriptionAccessSnapshot {
  checking: boolean;
  refresh: (organizationId?: string | null) => Promise<SubscriptionAccessSnapshot>;
  reset: () => void;
}

const INITIAL: SubscriptionAccessSnapshot = {
  access: "denied",
  status: "checking",
  valid: false,
  message: null,
  organizationId: null,
  productId: DEFAULT_AVS_PRODUCT,
  trialEndsAt: null,
  expiry: null,
  daysRemaining: null,
  edition: null,
  planCode: null,
  planName: null,
  features: {},
  limits: {},
  lastCheckedAt: null,
};

function mapPayload(raw: Record<string, unknown>): SubscriptionAccessSnapshot {
  return {
    access: (raw.access as SubscriptionAccessLevel) ?? "denied",
    status: (raw.status as SubscriptionAccessStatus) ?? "EXPIRED",
    valid: Boolean(raw.valid),
    message: (raw.message as string) ?? null,
    organizationId: (raw.organization_id as string) ?? null,
    productId: (raw.product_id as string) ?? DEFAULT_AVS_PRODUCT,
    trialEndsAt: raw.trialEndsAt != null ? Number(raw.trialEndsAt) : null,
    expiry: raw.expiry != null ? Number(raw.expiry) : null,
    daysRemaining: raw.daysRemaining != null ? Number(raw.daysRemaining) : null,
    edition: (raw.edition as string) ?? null,
    planCode: (raw.planCode as string) ?? null,
    planName: (raw.planName as string) ?? null,
    features: (raw.features as Record<string, boolean>) ?? {},
    limits: (raw.limits as Record<string, unknown>) ?? {},
    lastCheckedAt: Date.now(),
  };
}

export const useSubscriptionAccess = create<SubscriptionAccessState>()((set, get) => ({
  ...INITIAL,
  checking: true,
  async refresh(organizationId) {
    set({ checking: true, status: "checking" });
    try {
      const { data, error } = await (supabase as any).rpc("resolve_subscription_access", {
        p_organization_id: organizationId ?? null,
        p_product_id: DEFAULT_AVS_PRODUCT,
      });
      if (error) throw error;
      const snapshot = mapPayload((data ?? {}) as Record<string, unknown>);
      set({ ...snapshot, checking: false });
      return snapshot;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Subscription check failed";
      const fallback: SubscriptionAccessSnapshot = {
        ...INITIAL,
        status: "EXPIRED",
        message,
        lastCheckedAt: Date.now(),
      };
      set({ ...fallback, checking: false });
      return fallback;
    }
  },
  reset() {
    set({ ...INITIAL, checking: true });
  },
}));

export async function resolveSubscriptionAccess(opts?: {
  organizationId?: string | null;
  productId?: AvsProductId;
}): Promise<SubscriptionAccessSnapshot> {
  return useSubscriptionAccess.getState().refresh(opts?.organizationId ?? null);
}

export function isSubscriptionAccessGranted(snapshot: SubscriptionAccessSnapshot): boolean {
  return (
    snapshot.valid ||
    snapshot.access === "granted" ||
    snapshot.access === "granted_limited" ||
    snapshot.status === "PLATFORM_OWNER" ||
    String(snapshot.status).toLowerCase() === "platform_owner"
  );
}
