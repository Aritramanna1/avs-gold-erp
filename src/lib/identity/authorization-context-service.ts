import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type {
  AuthorizationContext,
  AuthorizedWorkspace,
  WorkspaceType,
} from "@/lib/identity/authorization-types";
import { workspaceHomeRoute } from "@/lib/identity/route-access";

type MembershipRow = {
  membership_id?: string;
  organization_id?: string;
  organization_name?: string;
  organization_slug?: string;
  membership_kind?: string;
  portal_type?: string | null;
  role?: string | null;
  branch_ids?: string[] | null;
  is_active?: boolean;
};

function workspaceTypeFromMembership(row: MembershipRow): WorkspaceType {
  const portal = String(row.portal_type ?? "").toLowerCase();
  if (portal === "customer") return "customer";
  if (portal === "supplier") return "supplier";
  if (portal === "karigar") return "karigar";
  const role = String(row.role ?? "").toLowerCase();
  if (role === "ceo") return "ceo";
  return "erp";
}

function mapMembershipToWorkspace(row: MembershipRow): AuthorizedWorkspace | null {
  if (!row.organization_id || !row.organization_name) return null;
  const workspace_type = workspaceTypeFromMembership(row);
  return {
    workspace_key: `${row.organization_id}:${workspace_type}`,
    workspace_type,
    organization_id: row.organization_id,
    organization_name: row.organization_name,
    membership_id: row.membership_id ?? null,
    membership_kind: row.membership_kind ?? null,
    portal_type: row.portal_type ?? null,
    role: row.role ?? null,
    branch_ids: row.branch_ids ?? null,
    route: workspaceHomeRoute(workspace_type),
    is_active: row.is_active === true,
  };
}

const PLATFORM_OPERATOR_ROLES = new Set([
  "saas_admin",
  "SaaS Admin",
  "platform_owner",
  "Platform Owner",
]);

async function detectPlatformOperator(userId: string): Promise<boolean> {
  const { data, error } = await (supabase as any)
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) return false;
  return (data ?? []).some((row: { role?: string }) =>
    PLATFORM_OPERATOR_ROLES.has(String(row.role ?? "")),
  );
}

/** Fallback when get_authorization_context RPC fails (e.g. read-only rate-limit bug). */
export async function fetchAuthorizationContextFromMemberships(
  authUserId: string,
): Promise<AuthorizationContext | null> {
  const { data, error } = await (supabase as any).rpc("get_my_memberships", {
    p_product_id: "ORNEXA",
    p_portal_type: null,
  });
  if (error) {
    console.error("[auth-context] get_my_memberships fallback failed:", error);
    return null;
  }
  const rows = (Array.isArray(data) ? data : []) as MembershipRow[];
  const workspaces = rows
    .map(mapMembershipToWorkspace)
    .filter((w): w is AuthorizedWorkspace => w != null);
  if (workspaces.length === 0) return null;

  const isPlatformOwner = await detectPlatformOperator(authUserId);
  if (isPlatformOwner) {
    workspaces.push({
      workspace_key: "platform:platform",
      workspace_type: "platform",
      organization_id: null,
      organization_name: "Platform Owner",
      membership_kind: "platform",
      portal_type: null,
      role: "saas_admin",
      route: "/platform",
      is_active: true,
    });
    return {
      is_platform_owner: true,
      workspaces,
      active_workspace: {
        workspace_key: "platform:platform",
        workspace_type: "platform",
        organization_id: null,
        portal_type: null,
        membership_id: null,
        branch_id: null,
      },
      default_route: "/platform",
      auth_user_id: authUserId,
    };
  }

  const active = workspaces.find((w) => w.is_active) ?? workspaces[0];
  return {
    is_platform_owner: false,
    workspaces,
    active_workspace: {
      workspace_key: active.workspace_key,
      workspace_type: active.workspace_type,
      organization_id: active.organization_id,
      portal_type: active.portal_type ?? null,
      membership_id: active.membership_id ?? null,
      branch_id: active.branch_ids?.[0] ?? null,
    },
    default_route: active.route,
    auth_user_id: authUserId,
  };
}

export async function fetchAuthorizationContext(): Promise<AuthorizationContext | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const authUserId = sessionData.session?.user?.id;
  if (!authUserId) return null;

  const { data, error } = await (supabase as any).rpc("get_authorization_context");
  if (!error && data && typeof data === "object") {
    return data as AuthorizationContext;
  }

  if (error) {
    console.error("[auth-context] get_authorization_context failed:", error);
  }

  return fetchAuthorizationContextFromMemberships(authUserId);
}

export async function activatePlatformWorkspace(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const authUserId = sessionData.session?.user?.id;
  const { error } = await (supabase as any).from("identity_active_context").upsert({
    auth_user_id: authUserId,
    organization_id: null,
    product_id: "ORNEXA",
    portal_type: null,
  });
  if (error) console.warn("[auth-context] platform workspace activate:", error.message);
}
