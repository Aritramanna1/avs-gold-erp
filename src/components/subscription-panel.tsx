/**
 * Tenant subscription & billing panel — routes to unified Billing Centre.
 */
import { useEffect } from "react";
import { resolveSubscriptionAccess } from "@/lib/identity/subscription-access-service";
import { TenantBillingCentre } from "@/components/billing/TenantBillingCentre";

export function SubscriptionPanel() {
  useEffect(() => {
    void resolveSubscriptionAccess();
  }, []);

  return <TenantBillingCentre />;
}
