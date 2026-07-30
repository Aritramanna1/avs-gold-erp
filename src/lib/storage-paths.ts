import { dataProvider as supabase } from "@/lib/providers/data-provider";

export type StoragePathContext = { firmId: string; branchId: string };

/** Resolve the authoritative tenant context; never fall back to a shared path. */
export async function resolveStoragePathContext(
  branchId?: string | null,
): Promise<StoragePathContext> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("You must be logged in to access files.");

  const { data, error } = await supabase
    .from("user_profiles" as never)
    .select("firm_id,branch_id")
    .eq("auth_id", authData.user.id)
    .maybeSingle();
  const profile = data as { firm_id: string | null; branch_id: string | null } | null;
  if (error || !profile?.firm_id) throw new Error("Your account is not assigned to a firm.");

  const resolvedBranch = branchId || profile.branch_id;
  if (!resolvedBranch) throw new Error("Your account is not assigned to a branch.");
  return { firmId: String(profile.firm_id), branchId: String(resolvedBranch) };
}

export function buildFirmStoragePath(
  context: StoragePathContext,
  category: string,
  entityId: string,
  fileName: string,
): string {
  const safe = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `firms/${safe(context.firmId)}/branches/${safe(context.branchId)}/${safe(category)}/${safe(entityId)}/${safe(fileName)}`;
}
