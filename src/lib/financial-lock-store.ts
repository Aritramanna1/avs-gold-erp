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
