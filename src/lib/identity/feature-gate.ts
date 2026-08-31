import { notFound } from "@tanstack/react-router";
import { useSubscriptionAccess } from "@/lib/identity/subscription-access-service";

/** Maps UI / saas-entitlements keys to organization_features keys from Supabase. */
const FEATURE_KEY_ALIASES: Record<string, string> = {
  "business.item_masters": "item_masters",
  "business.mtg_shell": "mtg_shell",
  "business.manubook": "manubook",
  "business.document_hosting": "document_hosting",
};

function resolveFeatureKey(key: string): string {
  return FEATURE_KEY_ALIASES[key] ?? key;
}

export function hasOrganizationFeature(key: string): boolean {
  const resolved = resolveFeatureKey(key);
  const features = useSubscriptionAccess.getState().features;
  if (features[resolved]) return true;
  if (resolved !== key && features[key]) return true;
  return false;
}

export function requireOrganizationFeature(key: string): void {
  if (!hasOrganizationFeature(key)) {
    throw notFound();
  }
}
