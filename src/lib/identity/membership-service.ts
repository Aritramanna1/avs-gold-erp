/**
 * Multi-tenant membership resolution — one auth identity, many businesses.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { DEFAULT_AVS_PRODUCT, type AvsProductId } from "@/lib/comm/platform/communication-events";
import type { PortalType } from "@/lib/portal/portal-context-service";

export interface TenantMembership {
  membership_id: string;
  organization_id: string;
  organization_name: string;
  organization_slug?: string;
  product_id: string;
  membership_kind: "internal" | "portal";
  portal_type?: PortalType | "ceo" | null;
  role?: string | null;
  status: string;
  branch_ids?: string[] | null;
  is_active: boolean;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  renews_at?: string | null;
}

export async function fetchMyMemberships(opts?: {
  productId?: AvsProductId;
  portalType?: PortalType | "ceo" | null;
}): Promise<TenantMembership[]> {
  const { data, error } = await (supabase as any).rpc("get_my_memberships", {
    p_product_id: opts?.productId ?? DEFAULT_AVS_PRODUCT,
    p_portal_type: opts?.portalType ?? null,
  });
  if (error) {
    console.error("[membership] get_my_memberships failed:", error);
    return [];
  }
  return (data ?? []) as TenantMembership[];
}

export async function setActiveTenantContext(opts: {
  organizationId: string;
  productId?: AvsProductId;
  portalType?: PortalType | "ceo" | null;
  branchId?: string | null;
}): Promise<{ organization_id: string; role?: string } | null> {
  const { data, error } = await (supabase as any).rpc("set_active_tenant_context", {
    p_organization_id: opts.organizationId,
    p_product_id: opts.productId ?? DEFAULT_AVS_PRODUCT,
    p_portal_type: opts.portalType ?? null,
    p_branch_id: opts.branchId ?? null,
  });
  if (error) {
    throw new Error(error.message || "Failed to switch business");
  }
  return data as { organization_id: string; role?: string };
}
