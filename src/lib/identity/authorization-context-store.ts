import { create } from "zustand";
import type { AuthorizationContext, AuthorizedWorkspace } from "@/lib/identity/authorization-types";
import { fetchAuthorizationContext } from "@/lib/identity/authorization-context-service";
import { setActiveTenantContext } from "@/lib/identity/membership-service";
import { resetAllBusinessStores, clearTenantScopedClientState } from "@/lib/session-cleanup";
import { useSettings } from "@/lib/settings-store";
import { syncCurrentUserRoleFromProfile } from "@/lib/role-resolution";
import type { PortalType } from "@/lib/portal/portal-context-service";
import { workspaceHomeRoute } from "@/lib/identity/route-access";
import { clearAllPortalCache } from "@/lib/portal/portal-offline-cache";
import { usePortalScope } from "@/lib/portal/portal-scope-store";
import { beginEgressOperation } from "@/lib/monitoring/supabase-egress-monitor";

type AuthorizationState = {
  ready: boolean;
  loading: boolean;
  context: AuthorizationContext | null;
  error: string | null;
  resolve: () => Promise<AuthorizationContext | null>;
  switchWorkspace: (workspace: AuthorizedWorkspace) => Promise<string>;
  reset: () => void;
};

let resolveInFlight: Promise<AuthorizationContext | null> | null = null;

export const useAuthorizationContext = create<AuthorizationState>()((set, get) => ({
  ready: false,
  loading: false,
  context: null,
  error: null,

  async resolve() {
    if (resolveInFlight) return resolveInFlight;
    const op = beginEgressOperation("auth_resolve");
    resolveInFlight = (async () => {
    set({ loading: true, error: null });
    try {
      const fetchOnce = () =>
        fetchAuthorizationContext().then((context) => ({ ok: true as const, context }));

      const AUTH_RESOLVE_TIMEOUT_MS = 8_000;

      let timed = await Promise.race([
        fetchOnce(),
        new Promise<{ ok: false }>((resolve) => {
          globalThis.setTimeout(() => resolve({ ok: false }), AUTH_RESOLVE_TIMEOUT_MS);
        }),
      ]);

      if (!timed.ok) {
        const { loadErpSessionCache, preferJewellerAuthorization } = await import(
          "@/lib/offline/erp-session-cache"
        );
        const cached = await loadErpSessionCache();
        if (cached?.authorization) {
          const restored = preferJewellerAuthorization(cached.authorization);
          const active = restored.workspaces.find((w) => w.is_active) ?? restored.workspaces[0];
          if (active?.role) {
            useSettings.getState().setCurrentUserRole(active.role);
          }
          set({ ready: true, loading: false, context: restored, error: null });
          void fetchOnce().then(async (live) => {
            if (!live.ok || !live.context) return;
            try {
              const { patchErpSessionCache } = await import("@/lib/offline/erp-session-cache");
              await patchErpSessionCache({
                authUserId: live.context.auth_user_id,
                authorization: live.context,
              });
              set({ context: live.context, error: null });
            } catch {
              /* keep cached context */
            }
          });
          return restored;
        }

        timed = await Promise.race([
          fetchOnce(),
          new Promise<{ ok: false }>((resolve) => {
            globalThis.setTimeout(() => resolve({ ok: false }), AUTH_RESOLVE_TIMEOUT_MS);
          }),
        ]);
      }

      if (!timed.ok) {
set({
          ready: true,
          loading: false,
          error: "Could not reach AVS ERP. Check your connection and retry.",
        });
        return null;
      }
      const context = timed.context;
      if (!context) {
const { loadErpSessionCache, preferJewellerAuthorization } = await import(
          "@/lib/offline/erp-session-cache"
        );
        const cached = await loadErpSessionCache();
        if (cached?.authorization) {
          const restored = preferJewellerAuthorization(cached.authorization);
          const active = restored.workspaces.find((w) => w.is_active) ?? restored.workspaces[0];
          if (active?.role) {
            useSettings.getState().setCurrentUserRole(active.role);
          }
          set({ ready: true, loading: false, context: restored, error: null });
          return restored;
        }
        set({
          ready: true,
          loading: false,
          context: null,
          error: null,
        });
        return null;
      }

      const { patchErpSessionCache } = await import("@/lib/offline/erp-session-cache");
      await patchErpSessionCache({
        authUserId: context.auth_user_id,
        authorization: context,
      });

      const active = context.workspaces.find((w) => w.is_active) ?? context.workspaces[0];
      if (active?.role) {
        useSettings.getState().setCurrentUserRole(active.role);
      } else {
        await syncCurrentUserRoleFromProfile();
      }

      set({ ready: true, loading: false, context, error: null });
      return context;
    } catch (err) {
      const { isAbortLikeError, abortFriendlyMessage } = await import("@/lib/network-abort");
      if (isAbortLikeError(err)) {
try {
          const context = await fetchAuthorizationContext();
          if (context) {
            const { patchErpSessionCache } = await import("@/lib/offline/erp-session-cache");
            await patchErpSessionCache({
              authUserId: context.auth_user_id,
              authorization: context,
            });
            set({ ready: true, loading: false, context, error: null });
            return context;
          }
        } catch {
          /* fall through */
        }
        set({
          ready: true,
          loading: false,
          error: abortFriendlyMessage(),
        });
        return null;
      }
      const { loadErpSessionCache, preferJewellerAuthorization } = await import(
        "@/lib/offline/erp-session-cache"
      );
      const cached = await loadErpSessionCache();
      if (cached?.authorization) {
        const restored = preferJewellerAuthorization(cached.authorization);
        set({ ready: true, loading: false, context: restored, error: null });
        return restored;
      }
      const message = err instanceof Error ? err.message : "Authorization failed";
      set({ ready: true, loading: false, error: message });
      return null;
    }
    })().finally(() => {
      resolveInFlight = null;
    });
    try {
      const result = await resolveInFlight;
      op.finish(!!result || get().ready);
      return result;
    } catch (e) {
      op.finish(false, e instanceof Error ? e.message : "auth_resolve failed");
      throw e;
    }
  },

  async switchWorkspace(workspace) {
    set({ loading: true });
    try {
      if (workspace.workspace_type === "platform") {
        const { error } = await (
          await import("@/lib/providers/data-provider")
        ).dataProvider.rpc("set_platform_workspace" as never);
        if (error) throw new Error(error.message);
      } else if (workspace.organization_id) {
        const portalType: PortalType | "ceo" | null =
          workspace.workspace_type === "erp"
            ? null
            : (workspace.workspace_type as PortalType | "ceo");
        await setActiveTenantContext({
          organizationId: workspace.organization_id,
          portalType,
        });
      }

      await resetAllBusinessStores();
      clearTenantScopedClientState();
      clearAllPortalCache();
      usePortalScope.getState().bump();

      if (workspace.role) {
        useSettings.getState().setCurrentUserRole(workspace.role);
      }

      const refreshed = await fetchAuthorizationContext();
      set({ context: refreshed, loading: false, ready: true });

      if (workspace.organization_id) {
        const { useTenantContext } = await import("./tenant-context-store");
        const portalType =
          workspace.workspace_type === "erp" ||
          workspace.workspace_type === "platform" ||
          workspace.workspace_type === "ceo"
            ? null
            : workspace.workspace_type;
        await useTenantContext.getState().loadMemberships({ portalType: portalType as never });
      }

      // Single forced boot on workspace switch — never pullAll + startCloudSync (duplicate sync).
      const { startCloudSync } = await import("@/lib/data-loader");
      await startCloudSync(true);

      return workspace.route || workspaceHomeRoute(workspace.workspace_type);
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  reset() {
    set({ ready: false, loading: false, context: null, error: null });
  },
}));
