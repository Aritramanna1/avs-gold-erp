/**
 * Active tenant/business context — server-authoritative switch with full cache clear.
 */
import { create } from "zustand";
import { QueryClient } from "@tanstack/react-query";
import {
  fetchMyMemberships,
  setActiveTenantContext,
  type TenantMembership,
} from "./membership-service";
import { resolveSubscriptionAccess, useSubscriptionAccess } from "./subscription-access-service";
import { resetAllBusinessStores, clearTenantScopedClientState } from "@/lib/session-cleanup";
import { usePortalScope } from "@/lib/portal/portal-scope-store";
import { clearAllPortalCache } from "@/lib/portal/portal-offline-cache";
import { useBranch } from "@/lib/branch-store";
import { DEFAULT_AVS_PRODUCT } from "@/lib/comm/platform/communication-events";
import type { PortalType } from "@/lib/portal/portal-context-service";
import { getStartupPreferences, patchStartupPreferences } from "@/lib/startup-preferences";
import { markStartup, recordStartupMetric } from "@/lib/performance/startup-metrics";

let queryClientRef: QueryClient | null = null;

export function registerTenantQueryClient(client: QueryClient) {
  queryClientRef = client;
}

interface TenantContextState {
  memberships: TenantMembership[];
  activeOrganizationId: string | null;
  activeOrganizationName: string | null;
  loading: boolean;
  switching: boolean;
  needsSelection: boolean;
  portalType: PortalType | "ceo" | null;
  loadMemberships: (opts?: { portalType?: PortalType | "ceo" | null }) => Promise<void>;
  switchBusiness: (organizationId: string) => Promise<void>;
  restoreLastOrSelect: () => Promise<boolean>;
  reset: () => void;
}

export const useTenantContext = create<TenantContextState>()((set, get) => ({
  memberships: [],
  activeOrganizationId: null,
  activeOrganizationName: null,
  loading: true,
  switching: false,
  needsSelection: false,
  portalType: null,

  async loadMemberships(opts) {
    set({ loading: true, portalType: opts?.portalType ?? null });
    try {
      const memberships = await fetchMyMemberships({
        productId: DEFAULT_AVS_PRODUCT,
        portalType: opts?.portalType ?? undefined,
      });
      const active = memberships.find((m) => m.is_active) ?? null;
      set({
        memberships,
        activeOrganizationId: active?.organization_id ?? null,
        activeOrganizationName: active?.organization_name ?? null,
        needsSelection: memberships.length > 1 && !active,
        loading: false,
      });
      const { patchErpSessionCache } = await import("@/lib/offline/erp-session-cache");
      void patchErpSessionCache({ memberships }).catch(() => undefined);
    } catch (err) {
      const { loadErpSessionCache } = await import("@/lib/offline/erp-session-cache");
      const cached = await loadErpSessionCache();
      if (cached?.memberships?.length) {
        const active =
          cached.memberships.find((m) => m.is_active) ?? cached.memberships[0] ?? null;
        set({
          memberships: cached.memberships,
          activeOrganizationId: active?.organization_id ?? null,
          activeOrganizationName: active?.organization_name ?? null,
          needsSelection: false,
          loading: false,
        });
        return;
      }
      set({ memberships: [], loading: false });
      throw err;
    }
  },

  async switchBusiness(organizationId) {
    const { portalType } = get();
    markStartup("tenant_switch");
    set({ switching: true });
    try {
      await setActiveTenantContext({
        organizationId,
        portalType,
      });

      if (queryClientRef) {
        queryClientRef.cancelQueries();
        queryClientRef.clear();
      }

      await resetAllBusinessStores();
      clearTenantScopedClientState();
      clearAllPortalCache();
      usePortalScope.getState().bump();

      try {
        const { useAuthorizationContext } = await import("./authorization-context-store");
        await useAuthorizationContext.getState().resolve();
      } catch {
        /* portal switch still valid when auth context refresh fails transiently */
      }

      const branchState = useBranch.getState();
      if (branchState.accessibleBranchIds.length > 0) {
        branchState.setCurrent(branchState.accessibleBranchIds[0]);
      }

      await get().loadMemberships({ portalType });
      await resolveSubscriptionAccess({ organizationId });

      const membership = get().memberships.find((m) => m.organization_id === organizationId);
      set({
        activeOrganizationId: organizationId,
        activeOrganizationName: membership?.organization_name ?? null,
        needsSelection: false,
        switching: false,
      });

      patchStartupPreferences({
        lastActiveTenantId: organizationId,
        lastActiveProduct: DEFAULT_AVS_PRODUCT,
      });

      recordStartupMetric("tenant_switch", organizationId, "tenant_switch");

      // Single forced boot — pullAll() + startCloudSync() was doubling every table/RPC pull.
      const { startCloudSync } = await import("@/lib/data-loader");
      await startCloudSync(true);
    } catch (err) {
      set({ switching: false });
      throw err;
    }
  },

  async restoreLastOrSelect() {
    const { memberships, loading } = get();
    if (loading || memberships.length === 0) {
      await get().loadMemberships();
    }
    const { memberships: loaded } = get();
    if (loaded.length === 0) return false;

    const hint = getStartupPreferences().lastActiveTenantId;
    const hinted = hint ? loaded.find((m) => m.organization_id === hint) : null;
    if (hinted) {
      if (!hinted.is_active) {
        try {
          await get().switchBusiness(hinted.organization_id);
        } catch {
          set({
            activeOrganizationId: hinted.organization_id,
            activeOrganizationName: hinted.organization_name,
            needsSelection: false,
          });
        }
      }
      return true;
    }

    if (loaded.length === 1) {
      if (!loaded[0].is_active) {
        try {
          await get().switchBusiness(loaded[0].organization_id);
        } catch {
          set({
            activeOrganizationId: loaded[0].organization_id,
            activeOrganizationName: loaded[0].organization_name,
            needsSelection: false,
          });
        }
      }
      return true;
    }
    const active = loaded.find((m) => m.is_active);
    if (active) return true;
    set({ needsSelection: true });
    return false;
  },

  reset() {
    set({
      memberships: [],
      activeOrganizationId: null,
      activeOrganizationName: null,
      loading: true,
      switching: false,
      needsSelection: false,
    });
    useSubscriptionAccess.getState().reset();
  },
}));
