/**
 * Daily Material Slip — the consolidated hand-to-worker document.
 *
 * We do NOT print one receipt per material transaction. Instead every Issue /
 * Return a worker has on a given date is rolled into ONE Daily Material Slip
 * with a single Slip Number (MTS-YYYYMMDD-NNN). Every transaction on that day
 * carries that same number, so any ledger row — Worker Gold Book, Manufacturing
 * Books, Reports, search — can be traced back to the exact printed slip.
 *
 * Pure/derived: the slip number is a deterministic function of (worker, date),
 * so no extra persistence or migration is needed — historical entries get their
 * number automatically, and every surface that shows an entry can compute the
 * same number with `slipNumberForEntry`.
 *
 * MATERIAL-TYPE READY: today this reads the gold Worker Gold Book only. The
 * `material` field and the `MATERIAL_PREFIX` map are the seam for Silver /
 * Platinum / Diamond / Gemstone / Consumable books later — a new material is a
 * new prefix + a new source, not a redesign here.
 */
import { useWorkerGoldBook, type WorkerGoldBookEntry } from "./worker-gold-book-store";
import { usePeople, type Person } from "./people-store";
import { dailySlipNumber, type SlipMaterial } from "./daily-material-slip-number";

export {
  dailySlipNumber,
  slipNumberForEntry,
  type SlipMaterial,
} from "./daily-material-slip-number";

export interface DailyMaterialSlip {
  slipNumber: string;
  material: SlipMaterial;
  date: string; // YYYY-MM-DD
  worker: Person | null;
  workerId: string;
  workerName: string;
  issues: WorkerGoldBookEntry[];
  returns: WorkerGoldBookEntry[];
  transactionCount: number;
  totalIssuedFineMg: number;
  totalReturnedFineMg: number;
  /** Worker custody balance AFTER this day = cumulative issued − returned through this date. Auto — never manual. */
  custodyBalanceAfterMg: number;
  /** Custody balance BEFORE this day (opening for the slip). */
  custodyBalanceBeforeMg: number;
  lastActivityTs: number;
}

/** All of a worker's entries, oldest first (stable running-balance order). */
function workerEntriesChrono(workerId: string): WorkerGoldBookEntry[] {
  return useWorkerGoldBook
    .getState()
    .entries.filter((e) => e.workerId === workerId)
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));
}

/**
 * Compile every Daily Material Slip for a worker (newest day first). Running
 * custody balance is carried across days so each slip shows a correct opening
 * and closing balance.
 */
export function compileWorkerDailySlips(workerId: string): DailyMaterialSlip[] {
  const worker = usePeople.getState().people.find((p) => p.id === workerId) ?? null;
  const chrono = workerEntriesChrono(workerId);
  if (chrono.length === 0) return [];

  // Group by date in chronological order so we can accumulate custody balance.
  const byDate = new Map<string, WorkerGoldBookEntry[]>();
  for (const e of chrono) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }

  let running = 0;
  const slips: DailyMaterialSlip[] = [];
  for (const [date, list] of byDate) {
    const issues = list.filter((e) => e.type === "given");
    const returns = list.filter((e) => e.type === "return");
    const totalIssuedFineMg = issues.reduce((s, e) => s + e.fineMg, 0);
    const totalReturnedFineMg = returns.reduce((s, e) => s + e.fineMg, 0);
    const before = running;
    running += totalIssuedFineMg - totalReturnedFineMg;
    slips.push({
      slipNumber: dailySlipNumber(date),
      material: "gold",
      date,
      worker,
      workerId,
      workerName: worker?.fullName ?? list[0]?.workerName ?? workerId,
      issues,
      returns,
      transactionCount: list.length,
      totalIssuedFineMg,
      totalReturnedFineMg,
      custodyBalanceBeforeMg: before,
      custodyBalanceAfterMg: running,
      lastActivityTs: Math.max(...list.map((e) => e.createdAt)),
    });
  }

  // Newest day first for display.
  return slips.reverse();
}

/** Every daily slip across all workers, newest first — the "Daily Slips" index. */
export function compileAllDailySlips(): DailyMaterialSlip[] {
  const workerIds = new Set(useWorkerGoldBook.getState().entries.map((e) => e.workerId));
  return Array.from(workerIds)
    .flatMap((id) => compileWorkerDailySlips(id))
    .sort((a, b) => b.lastActivityTs - a.lastActivityTs);
}

/** One slip by (worker, date) — the reprint path from a Worker Gold Book row. */
export function findWorkerSlip(workerId: string, date: string): DailyMaterialSlip | null {
  return compileWorkerDailySlips(workerId).find((s) => s.date === date) ?? null;
}

/** Reprint by Slip Number. Slip numbers repeat across workers (per-worker-per-day), so pass workerId to disambiguate. */
export function findSlipByNumber(slipNumber: string, workerId?: string): DailyMaterialSlip | null {
  const pool = workerId ? compileWorkerDailySlips(workerId) : compileAllDailySlips();
  return pool.find((s) => s.slipNumber === slipNumber) ?? null;
}
