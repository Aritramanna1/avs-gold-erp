/**
 * Server-derived portal authorization context.
 * NEVER trust tenant_id, party_id, or document IDs from browser params alone.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export type PortalType = "customer" | "karigar" | "supplier" | "external";

export interface PortalPartyLink {
  party_id: string;
  link_role: "primary" | "secondary" | "viewer";
  allowed_branch_ids?: string[] | null;
}

export interface PortalContext {
  identity_id: string;
  firm_id: string;
  portal_type: PortalType;
  branch_id?: string | null;
  party_links: PortalPartyLink[];
}

export async function fetchMyPortalContext(portalType?: PortalType): Promise<PortalContext | null> {
  const { data, error } = await (supabase as any).rpc("get_my_portal_context", {
    p_portal_type: portalType ?? null,
  });
  if (error || !data) return null;
  return data as PortalContext;
}

export async function assertCommunicationScope(input: {
  firmId: string;
  partyId?: string;
  referenceType?: string;
  referenceId?: string;
}): Promise<boolean> {
  const { error } = await (supabase as any).rpc("assert_communication_scope", {
    p_firm_id: input.firmId,
    p_party_id: input.partyId ?? null,
    p_reference_type: input.referenceType ?? null,
    p_reference_id: input.referenceId ?? null,
  });
  if (error) {
    throw new Error(error.message || "Communication scope validation failed");
  }
  return true;
}
