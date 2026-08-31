import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { PortalType } from "@/lib/portal/portal-context-service";

export type StoragePathContext = { firmId: string; branchId: string; partyId?: string };

/** Resolve the authoritative tenant context; never fall back to a shared path. */
export async function resolveStoragePathContext(
  branchId?: string | null,
  portalType?: PortalType | null,
): Promise<StoragePathContext> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("You must be logged in to access files.");

  const { data, error } = await supabase
    .from("user_profiles" as never)
    .select("firm_id,branch_id")
    .eq("auth_id", authData.user.id)
    .maybeSingle();
  const profile = data as { firm_id: string | null; branch_id: string | null } | null;
  if (!error && profile?.firm_id) {
    const resolvedBranch = branchId || profile.branch_id;
    if (!resolvedBranch) throw new Error("Your account is not assigned to a branch.");
    return { firmId: String(profile.firm_id), branchId: String(resolvedBranch) };
  }

  const { fetchMyPortalContext } = await import("@/lib/portal/portal-context-service");
  const portal = await fetchMyPortalContext(portalType ?? undefined);
  const partyId =
    portal?.party_links.find((l) => l.link_role === "primary")?.party_id ??
    portal?.party_links[0]?.party_id;
  if (portal?.firm_id && partyId) {
    return {
      firmId: String(portal.firm_id),
      branchId: String(portal.branch_id || "MAIN"),
      partyId,
    };
  }

  throw new Error("Your account is not assigned to a firm.");
}

export function buildFirmStoragePath(
  context: StoragePathContext,
  category: string,
  entityId: string,
  fileName: string,
): string {
  const safe = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (context.partyId) {
    return `firms/${safe(context.firmId)}/parties/${safe(context.partyId)}/${safe(category)}/${safe(entityId)}/${safe(fileName)}`;
  }
  return `firms/${safe(context.firmId)}/branches/${safe(context.branchId)}/${safe(category)}/${safe(entityId)}/${safe(fileName)}`;
}
