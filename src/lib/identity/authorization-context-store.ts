import { create } from "zustand";
import type { AuthorizationContext, AuthorizedWorkspace } from "@/lib/identity/authorization-types";
import { fetchAuthorizationContext } from "@/lib/identity/authorization-context-service";
import { setActiveTenantContext } from "@/lib/identity/membership-service";
import { resetAllBusinessStores, clearTenantScopedClientState } from "@/lib/session-cleanup";
import { useSettings } from "@/lib/settings-store";
import { syncCurrentUserRoleFromProfile } from "@/lib/role-resolution";
import type { PortalType } from "@/lib/portal/portal-context-service";
import { workspaceHomeRoute } from "@/lib/identity/route-access";

type AuthorizationState = {
  ready: boolean;
  loading: boolean;
  context: AuthorizationContext | null;
  error: string | null;
  resolve: () => Promise<AuthorizationContext | null>;
  switchWorkspace: (workspace: AuthorizedWorkspace) => Promise<string>;
  reset: () => void;
};

export const useAuthorizationContext = create<AuthorizationState>()((set, get) => ({
  ready: false,
  loading: false,
  context: null,
  error: null,

  async resolve() {
    set({ loading: true, error: null });
    try {
      const context = await fetchAuthorizationContext();
      if (!context) {
        set({
          ready: true,
          loading: false,
          context: null,
          error: "Authorization context unavailable.",
        });
        return null;
      }

      const active = context.workspaces.find((w) => w.is_active) ?? context.workspaces[0];
      if (active?.role) {
        useSettings.getState().setCurrentUserRole(active.role);
      } else {
        await syncCurrentUserRoleFromProfile();
      }

      set({ ready: true, loading: false, context, error: null });
      return context;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authorization failed";
      set({ ready: true, loading: false, error: message });
      return null;
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

      if (workspace.role) {
        useSettings.getState().setCurrentUserRole(workspace.role);
      }

      const refreshed = await fetchAuthorizationContext();
      set({ context: refreshed, loading: false, ready: true });

      const { pullAll, startCloudSync } = await import("@/lib/data-loader");
      await pullAll();
      void startCloudSync();

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
