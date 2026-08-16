import { create } from "zustand";

/**
 * Tracks the app's data load in TWO phases so the UI can appear progressively
 * instead of behind one all-or-nothing gate.
 *
 * - `criticalLoadDone` flips once settings/branches/modules are in (the few
 *   pulls the shell itself needs). The boot skeleton is removed here, so the
 *   real shell + route appear fast while Supabase-backed module data continues
 *   hydrating in the background.
 * - `initialLoadDone` flips once the full background pull has populated every
 *   operational store.
 * - `criticalLoadFailed` + `criticalLoadError` surface a recoverable boot error
 *   instead of an infinite spinner when the critical path times out.
 */
interface AppLoadingState {
  criticalLoadDone: boolean;
  initialLoadDone: boolean;
  criticalLoadFailed: boolean;
  criticalLoadError: string | null;
  bootAttempt: number;
  markCriticalLoadDone: () => void;
  markInitialLoadDone: () => void;
  markCriticalLoadFailed: (message: string) => void;
  retryBoot: () => void;
}

export const useAppLoading = create<AppLoadingState>()((set) => ({
  criticalLoadDone: false,
  initialLoadDone: false,
  criticalLoadFailed: false,
  criticalLoadError: null,
  bootAttempt: 0,
  markCriticalLoadDone: () =>
    set({ criticalLoadDone: true, criticalLoadFailed: false, criticalLoadError: null }),
  markInitialLoadDone: () =>
    set({ criticalLoadDone: true, initialLoadDone: true, criticalLoadFailed: false }),
  markCriticalLoadFailed: (message) =>
    set({ criticalLoadFailed: true, criticalLoadError: message, criticalLoadDone: false }),
  retryBoot: () =>
    set((s) => ({
      bootAttempt: s.bootAttempt + 1,
      criticalLoadFailed: false,
      criticalLoadError: null,
      criticalLoadDone: false,
      initialLoadDone: false,
    })),
}));

export function markCriticalLoadDone(): void {
  useAppLoading.getState().markCriticalLoadDone();
}

export function markInitialLoadDone(): void {
  useAppLoading.getState().markInitialLoadDone();
}

export function markCriticalLoadFailed(message: string): void {
  useAppLoading.getState().markCriticalLoadFailed(message);
}

export function retryBootLoad(): void {
  useAppLoading.getState().retryBoot();
}
