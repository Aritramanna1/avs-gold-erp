/**
 * Portal scope — shop chunk portal-scope-store-DhzdlTx4.js:
 * membership RPC helpers + version bump for party-scoped refetch.
 */
import { create } from "zustand";
import {
  fetchMyMemberships,
  setActiveTenantContext,
} from "@/lib/identity/membership-service";

type PortalScopeState = {
  version: number;
  bump: () => void;
};

export const usePortalScope = create<PortalScopeState>()((set) => ({
  version: 0,
  bump: () => set((state) => ({ version: state.version + 1 })),
}));

export { fetchMyMemberships, setActiveTenantContext };
