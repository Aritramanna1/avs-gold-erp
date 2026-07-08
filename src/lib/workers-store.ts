/**
 * MTJ ERP — Workers / Attendance / Settlement store
 *
 * Persistent registry of every worker-related event:
 *   attendance, salary rules, withdrawals, loans, salary advances,
 *   gold advances, wastage gold returns, and home-going settlements.
 *
 * Money is stored as integer **paise**. Gold weights as integer **mg**.
 * Workers themselves live in People/KYC store (Phase 2); we only reference
 * them by id here.
 */
import { create } from "zustand";
import type { Purity } from "./gold";
import { supabase } from "@/integrations/supabase/client";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { useSettings } from "./settings-store";
import { createRepository } from "./repositories/base-repository";

export type AttendanceStatus = "present" | "absent" | "half_day" | "leave";

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  half_day: "Half Day",
  leave: "Leave",
};

/**
 * Stay-period model: workers arrive from their home state, stay for weeks/months,
 * then go back. No daily in-out required. Salary accrues for entire stay duration.
 */
export interface WorkerStay {
  id: string;
  workerId: string;
  arrivedAt: number; // epoch ms
  departedAt?: number; // epoch ms — undefined = still here
  notes?: string;
  createdAt: number;
}

export type WorkerStatus = "not_arrived" | "working" | "gone_home";

export interface AttendanceEntry {
  id: string;
  workerId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  arrivedAt?: number; // epoch ms — time worker arrived
  leftAt?: number; // epoch ms — time worker left
  overtimeHours?: number;
  notes?: string;
  createdAt: number;
}

export type SalaryRuleType =
  "fixed_monthly" | "per_day" | "work_based" | "making_charge" | "wastage_basis" | "custom";

export const SALARY_RULE_LABELS: Record<SalaryRuleType, string> = {
  fixed_monthly: "Fixed Monthly Salary",
  per_day: "Per-Day Wage",
  work_based: "Work-Based Wage",
  making_charge: "Making-Charge Based",
  wastage_basis: "Wastage-Basis Worker",
  custom: "Custom Rule",
};

export interface SalaryRule {
  id: string;
  workerId: string;
  type: SalaryRuleType;
  monthlySalaryPaise?: number;
  perDayPaise?: number;
  makingRatePaise?: number; // ₹/g of finished work
  wastageNotes?: string;
  effectiveDate: string; // YYYY-MM-DD
  active: boolean;
  notes?: string;
  createdAt: number;
}

export type PayMode = "cash" | "upi" | "bank";
export const PAY_MODE_LABELS: Record<PayMode, string> = {
  cash: "Cash",
  upi: "UPI",
  bank: "Bank",
};

export interface Withdrawal {
  id: string;
  workerId: string;
  date: string;
  amountPaise: number;
  mode: PayMode;
  reason?: string;
  notes?: string;
  createdAt: number;
}

export interface Loan {
  id: string;
  workerId: string;
  date: string;
  amountPaise: number;
  reason?: string;
  notes?: string;
  createdAt: number;
}

export interface SalaryAdvance {
  id: string;
  workerId: string;
  date: string;
  amountPaise: number;
  mode: PayMode;
  notes?: string;
  createdAt: number;
}

export interface GoldAdvance {
  id: string;
  workerId: string;
  date: string;
  grossMg: number;
  purity: Purity;
  fineMg: number;
  reason?: string;
  notes?: string;
  ledgerEntryId?: string;
  createdAt: number;
}

export interface WastageGoldReturn {
  id: string;
  workerId: string;
  date: string;
  grossMg: number;
  purity: Purity;
  fineMg: number;
  notes?: string;
  ledgerEntryId?: string;
  createdAt: number;
}

export interface Settlement {
  id: string;
  workerId: string;
  fromDate: string;
  toDate: string;
  // attendance
  presentDays: number;
  halfDays: number;
  absentDays: number;
  leaveDays: number;
  payableDays: number;
  // cash
  salaryEarnedPaise: number;
  withdrawalsTotalPaise: number;
  loanDeductionPaise: number;
  advanceDeductionPaise: number;
  finalCashPayablePaise: number; // can be negative → worker owes shop
  // per-loan / per-advance breakdown
  loanDeductions: Record<string, number>; // loanId → paise applied
  advanceDeductions: Record<string, number>;
  // gold
  goldAdvanceFineMg: number;
  wastageReturnedFineMg: number;
  netGoldMg: number; // positive → worker owes gold
  notes?: string;
  createdAt: number;
}

interface WorkersState {
  attendance: AttendanceEntry[];
  stays: WorkerStay[];
  rules: SalaryRule[];
  withdrawals: Withdrawal[];
  loans: Loan[];
  advances: SalaryAdvance[];
  goldAdvances: GoldAdvance[];
  wastageReturns: WastageGoldReturn[];
  settlements: Settlement[];

  refresh: () => Promise<void>;

  markArrived: (workerId: string, notes?: string) => Promise<WorkerStay>;
  markGoneHome: (workerId: string, notes?: string) => Promise<void>;

  upsertAttendance: (
    e: Omit<AttendanceEntry, "id" | "createdAt"> & { id?: string },
  ) => Promise<AttendanceEntry>;
  removeAttendance: (id: string) => Promise<void>;

  setSalaryRule: (r: Omit<SalaryRule, "id" | "createdAt"> & { id?: string }) => Promise<SalaryRule>;

  addWithdrawal: (w: Omit<Withdrawal, "id" | "createdAt"> & { id?: string }) => Promise<Withdrawal>;
  addLoan: (l: Omit<Loan, "id" | "createdAt"> & { id?: string }) => Promise<Loan>;
  addAdvance: (
    a: Omit<SalaryAdvance, "id" | "createdAt"> & { id?: string },
  ) => Promise<SalaryAdvance>;
  addGoldAdvance: (
    g: Omit<GoldAdvance, "id" | "createdAt"> & { id?: string },
  ) => Promise<GoldAdvance>;
  addWastageReturn: (
    w: Omit<WastageGoldReturn, "id" | "createdAt"> & { id?: string },
  ) => Promise<WastageGoldReturn>;

  addSettlement: (s: Omit<Settlement, "id" | "createdAt"> & { id?: string }) => Promise<Settlement>;

  reset: () => void;
}

function makeId(prefix = "w") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const attendanceRepository = createRepository<AttendanceEntry>("attendance");
const salaryRuleRepository = createRepository<SalaryRule>("salary_rules");
const settlementRepository = createRepository<Settlement>("worker_settlements");
// worker_transactions holds several kind-tagged shapes (stay, withdrawal,
// loan, salary_advance, gold_advance, wastage_return) spread with an extra
// `kind` field at each call site — a permissive repository here avoids
// forcing a synthetic union type just for this pass-through wrapper.
const workerTransactionRepository = createRepository<{ id: string } & Record<string, unknown>>(
  "worker_transactions",
);

export const useWorkers = create<WorkersState>()((set, get) => ({
  attendance: [],
  stays: [],
  rules: [],
  withdrawals: [],
  loans: [],
  advances: [],
  goldAdvances: [],
  wastageReturns: [],
  settlements: [],

  refresh: async () => {
    const { currentUserRole, selectedBranchId } = useSettings.getState();
    const GLOBAL_ROLES = ["Super Owner", "Administrator", "CEO (View Only)"];
    const bid =
      !currentUserRole || GLOBAL_ROLES.includes(currentUserRole)
        ? null
        : selectedBranchId || "MAIN";

    let attQ = supabase.from("attendance").select("data").limit(10000);
    if (bid) attQ = attQ.filter("data->>branchId", "eq", bid) as typeof attQ;

    let txQ = supabase.from("worker_transactions").select("data, kind").limit(20000);
    if (bid) txQ = txQ.filter("data->>branchId", "eq", bid) as typeof txQ;

    let setQ = supabase.from("worker_settlements").select("data").limit(10000);
    if (bid) setQ = setQ.filter("data->>branchId", "eq", bid) as typeof setQ;

    const [attRes, rulesRes, txRes, setRes] = await Promise.all([
      attQ,
      supabase.from("salary_rules").select("data").limit(10000),
      txQ,
      setQ,
    ]);

    if (attRes.error) {
      console.error("Error fetching attendance:", attRes.error);
      return;
    }
    if (rulesRes.error) {
      console.error("Error fetching salary rules:", rulesRes.error);
      return;
    }
    if (txRes.error) {
      console.error("Error fetching worker transactions:", txRes.error);
      return;
    }
    if (setRes.error) {
      console.error("Error fetching settlements:", setRes.error);
      return;
    }

    const attendance = (attRes.data ?? [])
      .map((r) => r.data as AttendanceEntry | null)
      .filter((a): a is AttendanceEntry => !!a && !!a.id);

    const rules = (rulesRes.data ?? [])
      .map((r) => r.data as SalaryRule | null)
      .filter((r): r is SalaryRule => !!r && !!r.id);

    const withdrawals: Withdrawal[] = [];
    const loans: Loan[] = [];
    const advances: SalaryAdvance[] = [];
    const goldAdvances: GoldAdvance[] = [];
    const wastageReturns: WastageGoldReturn[] = [];
    const goldBookEntries: any[] = [];
    const stays: WorkerStay[] = [];

    (txRes.data ?? []).forEach((r) => {
      const payload = r.data as any;
      if (!payload || !payload.id) return;
      if (r.kind === "withdrawal") withdrawals.push(payload);
      else if (r.kind === "loan") loans.push(payload);
      else if (r.kind === "salary_advance") advances.push(payload);
      else if (r.kind === "gold_advance") goldAdvances.push(payload);
      else if (r.kind === "wastage_return") wastageReturns.push(payload);
      else if (r.kind === "worker_stay") stays.push(payload);
      else if (r.kind === "gold_book_given" || r.kind === "gold_book_return") {
        goldBookEntries.push(payload);
      }
    });

    const settlements = (setRes.data ?? [])
      .map((r) => r.data as Settlement | null)
      .filter((s): s is Settlement => !!s && !!s.id);

    set({
      attendance,
      stays,
      rules,
      withdrawals,
      loans,
      advances,
      goldAdvances,
      wastageReturns,
      settlements,
    });

    // Keep useWorkerGoldBook sync'd as they are built from same table
    const sortedGoldBook = [...goldBookEntries].sort(
      (a, b) => (a.createdAt || 0) - (b.createdAt || 0),
    );
    useWorkerGoldBook.setState({ entries: sortedGoldBook });
  },

  markArrived: async (workerId, notes) => {
    const stay: WorkerStay = {
      id: makeId("ws"),
      workerId,
      arrivedAt: Date.now(),
      notes,
      createdAt: Date.now(),
    };
    await workerTransactionRepository.save({ ...stay, kind: "worker_stay" });
    await get().refresh();
    return stay;
  },

  markGoneHome: async (workerId, notes) => {
    // Find the most recent open stay (no departedAt) for this worker
    const openStay = [...get().stays]
      .filter((s) => s.workerId === workerId && !s.departedAt)
      .sort((a, b) => b.arrivedAt - a.arrivedAt)[0];
    if (!openStay) return;
    const closed: WorkerStay = {
      ...openStay,
      departedAt: Date.now(),
      notes: notes ?? openStay.notes,
    };
    await workerTransactionRepository.save({ ...closed, kind: "worker_stay" });
    await get().refresh();
  },

  upsertAttendance: async (input) => {
    // unique per (worker, date)
    const existing = get().attendance.find(
      (a) => a.workerId === input.workerId && a.date === input.date,
    );
    const entry: AttendanceEntry = {
      id: input.id ?? existing?.id ?? makeId("a"),
      createdAt: existing?.createdAt ?? Date.now(),
      workerId: input.workerId,
      date: input.date,
      status: input.status,
      overtimeHours: input.overtimeHours,
      notes: input.notes,
    };
    await attendanceRepository.save(entry);
    await get().refresh();
    return entry;
  },
  removeAttendance: async (id) => {
    await attendanceRepository.delete(id);
    await get().refresh();
  },

  setSalaryRule: async (input) => {
    // deactivate any other active rule for the worker
    const others = get().rules.map((r) =>
      r.workerId === input.workerId && r.active ? { ...r, active: false } : r,
    );
    const rule: SalaryRule = {
      id: input.id ?? makeId("r"),
      createdAt: Date.now(),
      ...input,
    };

    // Save all deactivated rules and the new rule
    for (const r of others) {
      if (r.workerId === input.workerId && !r.active) {
        await salaryRuleRepository.save(r);
      }
    }
    await salaryRuleRepository.save(rule);
    await get().refresh();
    return rule;
  },

  addWithdrawal: async (input) => {
    const w: Withdrawal = { id: input.id ?? makeId("wd"), createdAt: Date.now(), ...input };
    await workerTransactionRepository.save({ ...w, kind: "withdrawal" });
    await get().refresh();
    return w;
  },
  addLoan: async (input) => {
    const l: Loan = { id: input.id ?? makeId("ln"), createdAt: Date.now(), ...input };
    await workerTransactionRepository.save({ ...l, kind: "loan" });
    await get().refresh();
    return l;
  },
  addAdvance: async (input) => {
    const a: SalaryAdvance = { id: input.id ?? makeId("sa"), createdAt: Date.now(), ...input };
    await workerTransactionRepository.save({ ...a, kind: "salary_advance" });
    await get().refresh();
    return a;
  },
  addGoldAdvance: async (input) => {
    const g: GoldAdvance = { id: input.id ?? makeId("ga"), createdAt: Date.now(), ...input };
    await workerTransactionRepository.save({ ...g, kind: "gold_advance" });
    await get().refresh();
    return g;
  },
  addWastageReturn: async (input) => {
    const w: WastageGoldReturn = {
      id: input.id ?? makeId("wr"),
      createdAt: Date.now(),
      ...input,
    };
    await workerTransactionRepository.save({ ...w, kind: "wastage_return" });
    await get().refresh();
    return w;
  },

  addSettlement: async (input) => {
    const s: Settlement = { id: input.id ?? makeId("st"), createdAt: Date.now(), ...input };
    await settlementRepository.save(s);
    await get().refresh();
    return s;
  },

  reset: () =>
    set({
      attendance: [],
      stays: [],
      rules: [],
      withdrawals: [],
      loans: [],
      advances: [],
      goldAdvances: [],
      wastageReturns: [],
      settlements: [],
    }),
}));

/* ----------------- Helpers ----------------- */

export interface AttendanceSummary {
  present: number;
  halfDay: number;
  absent: number;
  leave: number;
  payable: number; // present + 0.5 * halfDay
  overtimeHours: number;
}

export function summarizeAttendance(
  entries: AttendanceEntry[],
  filter?: { workerId?: string; fromDate?: string; toDate?: string },
): AttendanceSummary {
  let p = 0,
    h = 0,
    a = 0,
    l = 0,
    ot = 0;
  for (const e of entries) {
    if (filter?.workerId && e.workerId !== filter.workerId) continue;
    if (filter?.fromDate && e.date < filter.fromDate) continue;
    if (filter?.toDate && e.date > filter.toDate) continue;
    if (e.status === "present") p++;
    else if (e.status === "half_day") h++;
    else if (e.status === "absent") a++;
    else if (e.status === "leave") l++;
    ot += e.overtimeHours ?? 0;
  }
  return { present: p, halfDay: h, absent: a, leave: l, payable: p + h * 0.5, overtimeHours: ot };
}

export function activeRuleFor(rules: SalaryRule[], workerId: string): SalaryRule | undefined {
  return rules.find((r) => r.workerId === workerId && r.active);
}

/** Salary earned for a period given a rule + attendance summary. */
export function salaryEarnedPaise(
  rule: SalaryRule | undefined,
  summary: AttendanceSummary,
): number {
  if (!rule) return 0;
  if (rule.type === "fixed_monthly") return rule.monthlySalaryPaise ?? 0;
  if (rule.type === "per_day") return Math.round((rule.perDayPaise ?? 0) * summary.payable);
  // work_based / making_charge / wastage_basis / custom: manual at settlement time
  return 0;
}

/** Compute outstanding loan balance for a worker by subtracting prior settlement deductions. */
export function loanOutstandingPaise(loan: Loan, settlements: Settlement[]): number {
  let deducted = 0;
  for (const s of settlements) {
    deducted += s.loanDeductions[loan.id] ?? 0;
  }
  return Math.max(0, loan.amountPaise - deducted);
}

export function advanceOutstandingPaise(adv: SalaryAdvance, settlements: Settlement[]): number {
  let deducted = 0;
  for (const s of settlements) {
    deducted += s.advanceDeductions[adv.id] ?? 0;
  }
  return Math.max(0, adv.amountPaise - deducted);
}

export function rupeesToPaise(input: string | number): number {
  if (typeof input === "number") return Math.round(input * 100);
  const s = String(input).trim();
  if (!s) return 0;
  if (!/^\d+(\.\d{0,2})?$/.test(s)) throw new Error("Enter rupees with up to 2 decimals");
  const [whole, frac = ""] = s.split(".");
  const fp = (frac + "00").slice(0, 2);
  return Number(whole) * 100 + Number(fp);
}

export function paiseToRupees(paise: number, opts: { sign?: boolean } = {}): string {
  const neg = paise < 0;
  const abs = Math.abs(paise);
  const whole = Math.floor(abs / 100);
  const frac = (abs % 100).toString().padStart(2, "0");
  // add Indian-style commas to whole part
  const wholeStr = whole.toLocaleString("en-IN");
  const body = `${wholeStr}.${frac}`;
  if (opts.sign && !neg && paise > 0) return `+₹${body}`;
  return neg ? `-₹${body}` : `₹${body}`;
}

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function monthKey(date: string): string {
  return date.slice(0, 7); // YYYY-MM
}

/* ---- Stay-Period Helpers ---- */

/** Current status derived from the worker's stay history. */
export function workerStatus(workerId: string, stays: WorkerStay[]): WorkerStatus {
  const ws = stays.filter((s) => s.workerId === workerId).sort((a, b) => b.arrivedAt - a.arrivedAt);
  if (ws.length === 0) return "not_arrived";
  return ws[0].departedAt ? "gone_home" : "working";
}

/** Total calendar days a worker has spent on-site across all stays. */
export function stayDaysForWorker(workerId: string, stays: WorkerStay[]): number {
  return stays
    .filter((s) => s.workerId === workerId)
    .reduce((total, stay) => {
      const end = stay.departedAt ?? Date.now();
      const ms = Math.max(0, end - stay.arrivedAt);
      return total + ms / 86_400_000;
    }, 0);
}

/** Salary earned (paise) based on stay days and salary rule. */
export function stayEarnedPaise(rule: SalaryRule | undefined, totalDays: number): number {
  if (!rule) return 0;
  if (rule.type === "fixed_monthly") {
    const perDay = (rule.monthlySalaryPaise ?? 0) / 30;
    return Math.round(perDay * totalDays);
  }
  if (rule.type === "per_day") {
    return Math.round((rule.perDayPaise ?? 0) * totalDays);
  }
  return 0;
}

/** Latest open stay for a worker (no departedAt). */
export function openStayFor(workerId: string, stays: WorkerStay[]): WorkerStay | undefined {
  return stays
    .filter((s) => s.workerId === workerId && !s.departedAt)
    .sort((a, b) => b.arrivedAt - a.arrivedAt)[0];
}
