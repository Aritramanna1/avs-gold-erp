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

      // Reload tenant-scoped settings and data
      const { pullAll, startCloudSync } = await import("@/lib/data-loader");
      await pullAll();
      startCloudSync();
    } catch (err) {
      set({ switching: false });
      throw err;
    }
  },

  async restoreLastOrSelect() {
    await get().loadMemberships();
    const { memberships } = get();
    if (memberships.length === 0) return false;

    const hint = getStartupPreferences().lastActiveTenantId;
    const hinted = hint ? memberships.find((m) => m.organization_id === hint) : null;
    if (hinted) {
      if (!hinted.is_active) {
        await get().switchBusiness(hinted.organization_id);
      }
      return true;
    }

    if (memberships.length === 1) {
      if (!memberships[0].is_active) {
        await get().switchBusiness(memberships[0].organization_id);
      }
      return true;
    }
    const active = memberships.find((m) => m.is_active);
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
