/**
 * MTJ ERP — Bullion Rate Service
 *
 * The single place that knows how to get "today's rate." Every module that
 * needs the CURRENT gold/silver rate (Billing, Orders, Stock, Workshop,
 * Buyback, Reports, Dashboard) should read it through the accessors here —
 * not by reaching into useSettings' goldRatePerGramPaise fields directly —
 * so a future change to how rates are sourced never has to touch a second
 * call site. (Reading a rate a PAST transaction was billed at is a different
 * concern — that value is stored on the invoice/settlement record itself
 * and is correctly read from there, unaffected by this service.)
 *
 * Two rate sources exist and are never mixed silently:
 *   - "manual": staff-entered rate, stored in useSettings (unchanged from
 *     before this service existed) — the ERP's source of truth today.
 *   - "api": a live snapshot fetched from the configured provider (see
 *     bullion-rate/providers/), held here as a SUGGESTION only. It never
 *     overwrites the manual rate on its own — applyFetchedRates() is the
 *     only path that writes into useSettings, and it's only ever called
 *     from an explicit user action ("Apply").
 *
 * Mode ("manual" vs "api") is BranchSettings.goldRateSource, not a field on
 * this store — see bullion-rate/types.ts for why.
 */
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useSettings } from "./settings-store";
import { getBullionRateProvider } from "./bullion-rate/providers/registry";
import type { BullionRateSnapshot } from "./bullion-rate/types";

interface BullionRateState {
  /** Last successful fetch. Kept even after a subsequent failed fetch — the
   *  fallback-to-last-cached-rate behaviour is "don't clear this on error." */
  snapshot: BullionRateSnapshot | null;
  status: "idle" | "fetching" | "error";
  lastError: string | null;
  /** Fetches from the active branch's configured provider. No-ops (resolves
   *  null, no error) when the active branch's goldRateSource is "manual" —
   *  callers don't need to check the mode themselves before calling this. */
  fetchNow: () => Promise<BullionRateSnapshot | null>;
  /** Writes the last-fetched snapshot into useSettings' manual rate fields —
   *  the only place this store is allowed to mutate billing-authoritative
   *  state, and only ever invoked by an explicit user action. */
  applyFetchedRates: () => void;
}

export const useBullionRate = create<BullionRateState>()((set, get) => ({
  snapshot: null,
  status: "idle",
  lastError: null,

  fetchNow: async () => {
    const settings = useSettings.getState();
    const branchId = settings.selectedBranchId || "MAIN";
    const mode = settings.getBranchSettings(branchId).goldRateSource ?? "manual";
    if (mode !== "api") return null;

    const providerConfig = settings.bullionRateProvider;
    const provider = getBullionRateProvider(providerConfig.providerId);
    if (!provider) {
      set({ status: "error", lastError: `Unknown rate provider "${providerConfig.providerId}"` });
      return null;
    }

    set({ status: "fetching", lastError: null });
    try {
      const snapshot = await provider.fetchRates(providerConfig);
      set({ snapshot, status: "idle", lastError: null });
      return snapshot;
    } catch (err: any) {
      // Fallback to last cached rate: snapshot is deliberately left
      // untouched here, so a transient outage doesn't blank out the last
      // known-good live rate — only the error/status fields change.
      set({ status: "error", lastError: err?.message ?? "Failed to fetch bullion rates" });
      return get().snapshot;
    }
  },

  applyFetchedRates: () => {
    const { snapshot } = get();
    if (!snapshot) return;
    const settings = useSettings.getState();
    settings.setGoldRate24K(snapshot.gold24KPerGramPaise);
    settings.setGoldRate(snapshot.gold22KPerGramPaise);
    settings.setGoldRate18K(snapshot.gold18KPerGramPaise);
    if (snapshot.silverPerGramPaise > 0) {
      settings.setSilverRate(snapshot.silverPerGramPaise);
    }
  },
}));

// ── Read accessors — the "single service" every consumer should use ────────
// Thin wrappers over useSettings today (that's still where the applied,
// billing-authoritative rate is persisted/synced — reusing that storage
// rather than duplicating it), but centralized here so every consumer goes
// through one named API instead of five files each poking useSettings'
// rate fields directly.

/** Reactive hook — re-renders the caller when the current 22K/916 reference rate changes. */
export function useCurrentGoldRatePaise(): number {
  return useSettings((s) => s.goldRatePerGramPaise);
}

/** Reactive hook for all four current rates at once. */
export function useCurrentBullionRates(): {
  gold24KPerGramPaise: number;
  gold22KPerGramPaise: number;
  gold18KPerGramPaise: number;
  silverPerGramPaise: number;
} {
  return useSettings(
    useShallow((s) => ({
      gold24KPerGramPaise: s.goldRate24KPerGramPaise,
      gold22KPerGramPaise: s.goldRatePerGramPaise,
      gold18KPerGramPaise: s.goldRate18KPerGramPaise,
      silverPerGramPaise: s.silverRatePerGramPaise,
    })),
  );
}

/** Imperative accessor for non-reactive call sites (mirrors useSettings.getState() usage already common in this codebase). */
export function getCurrentGoldRatePaise(): number {
  return useSettings.getState().goldRatePerGramPaise;
}

// ── Scheduled refresh ──

let schedulerHandle: ReturnType<typeof setInterval> | null = null;

export function startBullionRateScheduler(): () => void {
  if (schedulerHandle) return stopBullionRateScheduler;

  void useBullionRate.getState().fetchNow();
  const intervalMinutes = useSettings.getState().bullionRateProvider.refreshIntervalMinutes || 60;
  schedulerHandle = setInterval(
    () => void useBullionRate.getState().fetchNow(),
    Math.max(5, intervalMinutes) * 60_000,
  );
  return stopBullionRateScheduler;
}

export function stopBullionRateScheduler(): void {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }
}
