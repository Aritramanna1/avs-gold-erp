import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { AuthorizationContext } from "@/lib/identity/authorization-types";

export async function fetchAuthorizationContext(): Promise<AuthorizationContext | null> {
  const { data, error } = await (supabase as any).rpc("get_authorization_context");
  if (error) {
    console.error("[auth-context] get_authorization_context failed:", error);
    return null;
  }
  if (!data || typeof data !== "object") return null;
  return data as AuthorizationContext;
}

export async function activatePlatformWorkspace(): Promise<void> {
  const { error } = await (supabase as any).from("identity_active_context").upsert({
    auth_user_id: (await supabase.auth.getUser()).data.user?.id,
    organization_id: null,
    product_id: "ORNEXA",
    portal_type: null,
  });
  if (error) console.warn("[auth-context] platform workspace activate:", error.message);
}
