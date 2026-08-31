import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { useAuthorizationContext } from "@/lib/identity/authorization-context-store";
import { pickDefaultRoute, workspaceHomeRoute } from "@/lib/identity/route-access";
import type { WorkspaceType } from "@/lib/identity/authorization-types";

export type PortalAudience = "customer" | "karigar" | "supplier";

export function portalLoginSearch(audience?: PortalAudience) {
  return {
    redirect: "",
    error: "",
    audience: audience as PortalAudience | undefined,
  };
}

export async function loadActivePortalHome(userId: string): Promise<string | null> {
  const { data, error } = await (supabase as any)
    .from("portal_identities")
    .select("portal_type")
    .eq("auth_user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error || !data?.length) return null;
  const portalType = String(data[0]?.portal_type ?? "") as WorkspaceType;
  if (!portalType) return null;
  return workspaceHomeRoute(portalType);
}

export async function hasPendingPortalInvite(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  const { data, error } = await (supabase as any)
    .from("portal_invitations")
    .select("id")
    .ilike("recipient_email", normalized)
    .in("status", ["PENDING", "ACCEPTED", "SENT"])
    .limit(1);
  return !error && Boolean(data?.length);
}

/** Resolve post-login home for ERP staff and all portal types. */
export async function resolveAuthenticatedLandingRoute(fallback = "/app"): Promise<string> {
  const ctx = await useAuthorizationContext.getState().resolve();
  if (ctx && ctx.workspaces.length > 0) return pickDefaultRoute(ctx);

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (userId) {
    const portalHome = await loadActivePortalHome(userId);
    if (portalHome) return portalHome;
  }

  return fallback;
}

export type PostLoginResolutionKind = "portal" | "invite" | "access";

/** Portal users with no workspace rows must not enter self-signup flows. */
export async function resolvePortalOrTrialRoute(
  userId: string,
  email: string,
): Promise<{ route: string; kind: PostLoginResolutionKind }> {
  const portalHome = await loadActivePortalHome(userId);
  if (portalHome) {
    const ctx = await useAuthorizationContext.getState().resolve();
    if (ctx && ctx.workspaces.length > 0) {
      return { route: pickDefaultRoute(ctx), kind: "portal" };
    }
    return { route: portalHome, kind: "portal" };
  }
  if (await hasPendingPortalInvite(email)) {
    return { route: "/invite/accept", kind: "invite" };
  }
  return { route: "/request-access", kind: "access" };
}
