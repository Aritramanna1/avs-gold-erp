/**
 * AVS ERP — Centralized Entitlements & Feature-Access Engine
 *
 * Provides authoritative entitlement checks across the ERP:
 * - Feature access validation (`hasFeature`)
 * - Quota & capacity limit verification (`checkLimit`)
 * - Active subscription operational guard
 * - Zero scattered ad-hoc subscription checks
 */

import { useSubscriptionStore, type PlanLimits, type PlanTier, type PlanStatus } from "./subscription-store";

export type FeatureKey =
  | "business.core"
  | "business.orders"
  | "business.workshop"
  | "business.workshop_full"
  | "business.ledger"
  | "business.billing_basic"
  | "business.billing_full"
  | "business.billing_gst_einv"
  | "business.barcode"
  | "business.barcode_tagging"
  | "business.gst"
  | "business.item_masters"
  | "business.inventory"
  | "business.customer_portal"
  | "business.karigar_portal"
  | "business.supplier_portal"
  | "business.document_hosting"
  | "business.api_webhooks"
  | "business.multi_branch"
  | "business.analytics"
  | "business.custom_integrations";

export interface LimitCheckResult {
  allowed: boolean;
  max: number;
  current: number;
  percentage: number;
  isNearLimit: boolean; // >= 80%
  isAtLimit: boolean; // >= 100%
}

/**
 * Checks whether the current subscription includes a specific feature.
 */
export function hasFeature(featureKey: FeatureKey | string): boolean {
  const { subscription } = useSubscriptionStore.getState();

  // Suspended or Expired plans restrict advanced features
  if (subscription.status === "suspended" || subscription.status === "expired") {
    // Only core features remain accessible in grace/restricted mode
    return featureKey === "business.core" || featureKey === "business.ledger";
  }

  return (
    subscription.features?.includes(featureKey) ||
    subscription.features?.includes("business.all") ||
    false
  );
}

/**
 * Validates whether current entity count is within allowed plan limits.
 */
export function checkLimit(limitKey: keyof PlanLimits, currentCount: number): LimitCheckResult {
  const { subscription } = useSubscriptionStore.getState();
  const max = Number(subscription.limits?.[limitKey] ?? 1);

  if (typeof max !== "number" || isNaN(max) || max <= 0) {
    return {
      allowed: true,
      max: Infinity,
      current: currentCount,
      percentage: 0,
      isNearLimit: false,
      isAtLimit: false,
    };
  }

  const percentage = Math.min(100, Math.round((currentCount / max) * 100));
  const isAtLimit = currentCount >= max;
  const isNearLimit = percentage >= 80;

  return {
    allowed: !isAtLimit,
    max,
    current: currentCount,
    percentage,
    isNearLimit,
    isAtLimit,
  };
}

/**
 * Computes general operational status and days until renewal/expiration.
 */
export function getSubscriptionStatusInfo(): {
  tier: PlanTier;
  planName: string;
  status: PlanStatus;
  isOperational: boolean;
  daysRemaining: number;
  badgeVariant: "success" | "warning" | "error" | "info";
} {
  const { subscription } = useSubscriptionStore.getState();
  const now = Date.now();
  const renewalTs = new Date(subscription.renewalDate).getTime();
  const daysRemaining = Math.max(0, Math.ceil((renewalTs - now) / 86400000));

  let badgeVariant: "success" | "warning" | "error" | "info" = "success";
  let isOperational = true;

  switch (subscription.status) {
    case "active":
      badgeVariant = "success";
      isOperational = true;
      break;
    case "trial":
      badgeVariant = "info";
      isOperational = true;
      break;
    case "past_due":
      badgeVariant = "warning";
      isOperational = true;
      break;
    case "suspended":
    case "cancelled":
    case "expired":
      badgeVariant = "error";
      isOperational = false;
      break;
  }

  return {
    tier: subscription.planTier,
    planName: subscription.planName,
    status: subscription.status,
    isOperational,
    daysRemaining,
    badgeVariant,
  };
}
