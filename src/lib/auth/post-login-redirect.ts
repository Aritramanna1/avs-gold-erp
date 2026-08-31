import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { useAuthorizationContext } from "@/lib/identity/authorization-context-store";
import { pickDefaultRoute, workspaceHomeRoute } from "@/lib/identity/route-access";
import type { PortalType } from "@/lib/portal/portal-context-service";

const MARKETING_REDIRECT_PREFIXES = ["/pricing", "/blog", "/website"];

async function resolvePortalHomeForUser(userId: string): Promise<string | null> {
  // Table may be ahead of generated Database types in this handoff; keep runtime query.
  const client = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => {
              limit: (
                n: number,
              ) => Promise<{ data: Array<{ portal_type?: string }> | null; error: unknown }>;
            };
          };
        };
      };
    };
  };

  const { data, error } = await client
    .from("portal_identities")
    .select("portal_type")
    .eq("auth_user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error || !data?.length) return null;

  const portalType = String(data[0]?.portal_type ?? "") as PortalType;
  if (!portalType) return null;
  return workspaceHomeRoute(portalType as never);
}

/** Resolve the landing route after password or OAuth login (shop baseline behavior). */
export async function resolvePostLoginRoute(fallback = "/app"): Promise<string> {
  const context = await useAuthorizationContext.getState().resolve();
  if (context && context.workspaces.length > 0) {
    return pickDefaultRoute(context);
  }

  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (userId) {
    const portalRoute = await resolvePortalHomeForUser(userId);
    if (portalRoute) return portalRoute;
  }

  return fallback;
}

export function sanitizeLoginRedirect(
  redirect: string | undefined,
  defaultRoute: string,
): string {
  if (
    !redirect ||
    redirect === "/" ||
    MARKETING_REDIRECT_PREFIXES.some((prefix) => redirect.startsWith(prefix))
  ) {
    return defaultRoute;
  }
  return redirect.startsWith("/") ? redirect : `/${redirect}`;
}
