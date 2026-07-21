import { create } from "zustand";

/**
 * Tracks the app's data load in TWO phases so the UI can appear progressively
 * instead of behind one all-or-nothing gate:
 *
 * - `criticalLoadDone` flips once settings/branches/modules are in (the few
 *   pulls the shell itself needs). The boot skeleton is removed here, so the
 *   real shell + route appear fast — within a few local reads in Offline mode.
 * - `initialLoadDone` flips once the full background pull has populated every
 *   operational store. Individual modules can still show their own per-store
 *   skeletons between the two, so data fills in as it arrives rather than the
 *   whole app waiting on the slowest table.
 *
 * Both flip exactly once per app session — never re-shown on later navigation.
 */
interface AppLoadingState {
  criticalLoadDone: boolean;
  initialLoadDone: boolean;
  markCriticalLoadDone: () => void;
  markInitialLoadDone: () => void;
}

export const useAppLoading = create<AppLoadingState>()((set) => ({
  criticalLoadDone: false,
  initialLoadDone: false,
  markCriticalLoadDone: () => set({ criticalLoadDone: true }),
  // Background done implies critical done — a late/failed critical signal must
  // never leave the shell stuck behind the boot skeleton once data has landed.
  markInitialLoadDone: () => set({ criticalLoadDone: true, initialLoadDone: true }),
}));

export function markCriticalLoadDone(): void {
  useAppLoading.getState().markCriticalLoadDone();
}

export function markInitialLoadDone(): void {
  useAppLoading.getState().markInitialLoadDone();
}
