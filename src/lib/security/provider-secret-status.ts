/**
 * Non-revealing provider secret status checks (vault presence only).
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export async function isProviderSecretConfigured(
  branchId: string,
  providerType: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc(
    "provider_secret_is_configured" as never,
    {
      p_branch_id: branchId,
      p_provider_type: providerType,
    } as never,
  );
  if (error) {
    console.warn("[provider-secret-status]", error.message);
    return false;
  }
  return Boolean(data);
}
