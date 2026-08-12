/**
 * Financial Lock Periods — Month-End Closing controls.
 *
 * Once a (branch, "YYYY-MM") period is locked, no financial or gold-ledger
 * posting dated inside that period may be created, edited, or deleted.
 * Enforcement is a single guard — `assertPeriodOpen()` — that any store's
 * mutation handler can call before writing a dated entry (invoices,
 * payments, ledger entries, gold settlements, daily close, etc.). This is
 * additive: existing stores are not modified to call it as part of this
 * change; it is available for those flows to adopt without further
 * refactoring of this module.
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";
import { append as appendAudit } from "./security/audit-log";

export interface FinancialLockPeriod {
  id: string;
  branchId: string;
  period: string; // "YYYY-MM"
  lockedAt: number;
  lockedBy: string | null;
  lockedByEmail: string | null;
  reason?: string;
}

interface FinancialLockState {
  locks: FinancialLockPeriod[];
  lock: (
    branchId: string,
    period: string,
    actor: { id: string | null; email: string | null },
    reason?: string,
  ) => Promise<FinancialLockPeriod>;
  unlock: (
    branchId: string,
    period: string,
    actor: { id: string | null; email: string | null },
  ) => Promise<void>;
  isLocked: (branchId: string, period: string) => boolean;
  setAll: (locks: FinancialLockPeriod[]) => void;
}

function periodOf(dateIso: string): string {
  return dateIso.slice(0, 7); // "YYYY-MM" from any ISO/date-like string
}

function makeId(branchId: string, period: string) {
  return `lock_${branchId}_${period}`;
}

const lockRepository = createRepository<FinancialLockPeriod>("financial_lock_periods");

export const useFinancialLocks = create<FinancialLockState>()((set, get) => ({
  locks: [],
  setAll: (locks) => set({ locks }),
  lock: async (branchId, period, actor, reason) => {
    const existing = get().locks.find((l) => l.branchId === branchId && l.period === period);
    if (existing) return existing;
    const entry: FinancialLockPeriod = {
      id: makeId(branchId, period),
      branchId,
      period,
      lockedAt: Date.now(),
      lockedBy: actor.id,
      lockedByEmail: actor.email,
      reason,
    };
    set({ locks: [entry, ...get().locks] });
    await lockRepository.save(entry);
    void appendAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "financial_lock_periods.lock",
      entityType: "financial_lock_periods",
      entityId: entry.id,
      before: null,
      after: entry,
    });
    return entry;
  },
  unlock: async (branchId, period, actor) => {
    const existing = get().locks.find((l) => l.branchId === branchId && l.period === period);
    if (!existing) return;
    set({ locks: get().locks.filter((l) => l.id !== existing.id) });
    await lockRepository.delete(existing.id);
    void appendAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "financial_lock_periods.unlock",
      entityType: "financial_lock_periods",
      entityId: existing.id,
      before: existing,
      after: null,
    });
  },
  isLocked: (branchId, period) =>
    get().locks.some((l) => l.branchId === branchId && l.period === period),
}));

export async function loadFinancialLocks(): Promise<void> {
  const all = await lockRepository.readAll();
  useFinancialLocks.getState().setAll(all);
}

let loadedOnce: Promise<void> | null = null;

/**
 * Ensures locks are loaded into memory at least once per session before a
 * caller relies on isLocked()/assertPeriodOpen() — pages that already show a
 * lock-aware banner (Daily Close, Month-End Close) call loadFinancialLocks()
 * themselves on mount, but call sites that only need the enforcement guard
 * (e.g. ledger-store.append()) can await this instead of duplicating that
 * wiring. Cached as a single in-flight/completed promise so repeated calls
 * within a session are free after the first.
 */
export function ensureFinancialLocksLoaded(): Promise<void> {
  if (!loadedOnce) loadedOnce = loadFinancialLocks();
  return loadedOnce;
}

/** Error thrown by assertPeriodOpen() — callers can catch this specifically to show a locked-period message. */
export class PeriodLockedError extends Error {
  constructor(
    public readonly branchId: string,
    public readonly period: string,
  ) {
    super(`Financial period ${period} for branch ${branchId} is locked. Postings are not allowed.`);
    this.name = "PeriodLockedError";
  }
}

/**
 * Throws PeriodLockedError if `dateIso`'s month is locked for `branchId`.
 * Call this from a mutation handler before writing a dated financial/gold
 * posting once that flow adopts month-end lock enforcement.
 */
export function assertPeriodOpen(branchId: string, dateIso: string): void {
  const period = periodOf(dateIso);
  if (useFinancialLocks.getState().isLocked(branchId, period)) {
    throw new PeriodLockedError(branchId, period);
  }
}

export function isPeriodLocked(branchId: string, dateIso: string): boolean {
  return useFinancialLocks.getState().isLocked(branchId, periodOf(dateIso));
}

/**
 * Throws an error if targetDateIso is prior to the system Freeze Date (Section 14/Audit).
 */
export function assertFreezeDateOpen(
  freezeDateIso: string | undefined | null,
  targetDateIso: string,
): void {
  if (!freezeDateIso) return;
  const freezeMs = new Date(freezeDateIso).getTime();
  const targetMs = new Date(targetDateIso).getTime();

  if (targetMs < freezeMs) {
    throw new Error(
      `🔒 TRANSACTION BLOCKED: System transactions before ${freezeDateIso} are frozen. Target date ${targetDateIso} is locked.`,
    );
  }
}

/**
 * Executes a Financial Year Close for a given branch and year.
 *
 * For example, closing FY 2025 (covering April 2025 - March 2026):
 * 1. Computes the final derived Gold Ledger balances for the branch as of March 31, 2026 (23:59:59).
 * 2. Locks all 12 months in that FY (2025-04 to 2026-03).
 * 3. Appends "closing_stock" ledger entries for the closed year.
 * 4. Carries forward these balances to the new FY starting April 1, 2026, by inserting
 *    "opening_vault" (or "opening_stock") ledger entries for the active buckets.
 */
export async function closeFinancialYear(
  branchId: string,
  startYear: number,
  actor: { id: string | null; email: string | null },
): Promise<{ success: boolean; message: string; carriedForward: Record<string, number> }> {
  const { useLedger, computeBalances } = await import("./ledger-store");

  const fyEndIso = `${startYear + 1}-03-31T23:59:59.999Z`;
  const fyNewStartIso = `${startYear + 1}-04-01T00:00:00.000Z`;
  const fyEndMs = new Date(fyEndIso).getTime();

  // 1. Get ledger entries up to FY end date
  const ledgerState = useLedger.getState();
  await ledgerState.refresh();
  const allEntries = ledgerState.entries;

  // Filter entries for this branch up to the FY end date
  const activeEntries = allEntries.filter((e) => {
    const entryBranch = (e as any).branchId || "MAIN";
    return entryBranch === branchId && e.createdAt <= fyEndMs;
  });

  const balances = computeBalances(activeEntries);
  const buckets = balances.buckets;

  // 2. Lock all 12 months of this FY
  const months = ["04", "05", "06", "07", "08", "09", "10", "11", "12", "01", "02", "03"];
  const lockStore = useFinancialLocks.getState();

  for (const m of months) {
    const yr = m === "01" || m === "02" || m === "03" ? startYear + 1 : startYear;
    const period = `${yr}-${m}`;
    await lockStore.lock(
      branchId,
      period,
      actor,
      `Financial Year ${startYear}-${(startYear + 1) % 100} Close`,
    );
  }

  // 3. Post closing stock for old year and opening stock for new year in Gold Ledger
  const bucketKeys: (keyof typeof buckets)[] = [
    "vault",
    "karigar",
    "finished",
    "customer",
    "jeweller",
    "scrap",
  ];
  const carriedForward: Record<string, number> = {};

  for (const bucket of bucketKeys) {
    const balanceFineMg = buckets[bucket];
    if (balanceFineMg !== 0) {
      carriedForward[bucket] = balanceFineMg;

      // Post closing entry for old year
      await ledgerState.append({
        type: "closing_stock",
        netFineMg: -balanceFineMg,
        deltas: { [bucket]: -balanceFineMg },
        notes: `FY ${startYear}-${(startYear + 1) % 100} Close — carry forward closing balance`,
        createdAt: fyEndMs,
        reference: `FY_${startYear}_CLOSE`,
      } as any);

      // Post opening entry for new year
      await ledgerState.append({
        type: "opening_vault",
        netFineMg: balanceFineMg,
        deltas: { [bucket]: balanceFineMg },
        notes: `FY ${startYear + 1}-${(startYear + 2) % 100} Opening — carried forward from previous FY`,
        createdAt: new Date(fyNewStartIso).getTime(),
        reference: `FY_${startYear + 1}_OPEN`,
      } as any);
    }
  }

  return {
    success: true,
    message: `Financial year ${startYear}-${(startYear + 1) % 100} closed successfully. Locked periods and carried forward metal balances.`,
    carriedForward,
  };
}
