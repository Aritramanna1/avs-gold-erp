import { create } from "zustand";
import { fineGoldMg, type Purity } from "./gold";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { createRepository } from "./repositories/base-repository";
import { assertPeriodOpenOnline } from "./financial-lock-store";
import { useSettings } from "./settings-store";
import { useWorkflowEngine } from "./workflow-engine";
import { nextDocumentNumber } from "./document-numbering";

const workerTransactionRepository = createRepository<{ id: string } & Record<string, unknown>>(
  "worker_transactions",
);

export type MaterialPurity = Purity | "none"; // none for non-gold/silver items

/** Materials a structured, order-linked Issue can post (mirrors the vault-category mapping in material-vault-sync.ts's issueMaterialToVaultCategory). */
export const WORKER_ISSUE_MATERIALS = ["Gold", "KDM", "Ball", "Die", "Wire", "Finding", "Other"];

export interface WorkerGoldBookEntry {
  id: string;
  entryNo: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS (exact time with seconds)
  workerId: string;
  workerName: string;
  particulars: string; // e.g. "KDM", "Die", "Ball", "Chain", "Finding", "Wire", "Patti", "Stone", "Other", or returned item info
  grossMg: number;
  lessMg: number;
  netMg: number;
  purity: number; // per-mille, 0 if non-gold or custom material
  fineMg: number; // calculated gold weight
  quantity: number; // pieces/quantity if non-gold
  notes: string;
  givenBy: string; // Given: staff name, Return: worker name
  receivedBy: string; // Given: worker name, Return: staff name
  type: "given" | "return";
  reference?: string; // Optional reference note / order name / design reference
  createdAt: number;

  // ── Order linkage — populated by the structured Issue/Return dialogs
  // (worker-issue-dialog.tsx, worker-return-dialog.tsx); absent on manual
  // entries made from the general Worker Gold Book page. ──────────────────
  orderId?: string;
  orderNo?: string;
  /** Stamps this entry as consumed by a Manufacturing Bill — guards against a later auto-collect pass double-counting it. */
  manufacturingBillId?: string;
}

export interface WorkerMaterialBalance {
  material: string;
  purity: number;
  givenGross: number;
  returnedGross: number;
  pendingGross: number;
  givenFine: number;
  returnedFine: number;
  pendingFine: number;
  givenQty: number;
  returnedQty: number;
  pendingQty: number;
}

export interface WorkerGoldBookState {
  entries: WorkerGoldBookEntry[];
  refresh: () => Promise<void>;
  addEntry: (
    entry: Omit<WorkerGoldBookEntry, "id" | "entryNo" | "createdAt" | "time" | "date"> & {
      date?: string;
      time?: string;
    },
  ) => Promise<WorkerGoldBookEntry>;
  removeEntry: (id: string) => Promise<void>;
  forOrder: (orderId: string) => WorkerGoldBookEntry[];
  /** Stamps this entry as consumed by a Manufacturing Bill — guards against a later auto-collect pass double-counting it. */
  linkToManufacturingBill: (id: string, billId: string) => Promise<void>;
  getWorkerBalance: (workerId: string) => {
    totalGivenFine: number;
    totalReturnedFine: number;
    pendingFine: number;
    totalGivenQty: number;
    totalReturnedQty: number;
    pendingQty: number;
    materialBalances: WorkerMaterialBalance[];
  };
  reset: () => void;
}

function makeId(prefix = "wgb") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const WORKER_GOLD_BOOK_COMPAT_CACHE_LIMIT = 1000;

export const useWorkerGoldBook = create<WorkerGoldBookState>()((set, get) => ({
  entries: [],

  refresh: async () => {
    const { data, error } = await supabase
      .from("worker_transactions")
      .select("data, kind")
      .order("created_at", { ascending: false })
      .limit(WORKER_GOLD_BOOK_COMPAT_CACHE_LIMIT);
    if (error) {
      console.error("Error fetching worker transactions:", error);
      return;
    }
    const entries: WorkerGoldBookEntry[] = [];
    (data ?? []).forEach((r) => {
      const payload = r.data as any;
      if (!payload || !payload.id) return;
      if (r.kind === "gold_book_given" || r.kind === "gold_book_return") {
        entries.push(payload);
      }
    });
    // Sort newest first to match UI expectation
    const sorted = [...entries].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    set({ entries: sorted });
  },

  addEntry: async (input) => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const defaultDate = `${yyyy}-${mm}-${dd}`;

    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    const defaultTime = `${hh}:${min}:${ss}`;

    const date = input.date || defaultDate;
    const time = input.time || defaultTime;

    // Generate auto entry number
    // e.g. WGB-G-20260623-001 or WGB-R-20260623-001
    const cleanDateStr = date.replace(/-/g, "");
    const typePrefix = input.type === "given" ? "G" : "R";
    const prefix = `WGB-${typePrefix}-${cleanDateStr}-`;

    const entryNo = await nextDocumentNumber(
      `worker_gold_book:${input.type}:${cleanDateStr}`,
      prefix,
      3,
    );

    // Ensure netMg is grossMg - lessMg
    const grossMg = input.grossMg || 0;
    const lessMg = input.lessMg || 0;
    const netMg = Math.max(0, grossMg - lessMg);

    // Calculate fineMg if purity is provided (> 0)
    let fineMg = 0;
    if (input.purity && input.purity > 0) {
      fineMg = fineGoldMg(netMg, input.purity);
    }

    const newEntry: WorkerGoldBookEntry = {
      id: makeId(),
      entryNo,
      date,
      time,
      workerId: input.workerId,
      workerName: input.workerName,
      particulars: input.particulars,
      grossMg,
      lessMg,
      netMg,
      purity: input.purity || 0,
      fineMg,
      quantity: input.quantity || 0,
      notes: input.notes || "",
      givenBy: input.givenBy,
      receivedBy: input.receivedBy,
      type: input.type,
      reference: input.reference || "",
      createdAt: Date.now(),
      orderId: input.orderId,
      orderNo: input.orderNo,
    };

    // Financial lock: block postings dated inside a month-end-closed period.
    // Configurable via Settings → Workflow (financialLockEnforcementEnabled).
    if (useWorkflowEngine.getState().config.financialLockEnforcementEnabled) {
      await assertPeriodOpenOnline(useSettings.getState().selectedBranchId || "MAIN", date);
    }

    const kind = input.type === "given" ? "gold_book_given" : "gold_book_return";
    await workerTransactionRepository.save({ ...newEntry, kind });
    await get().refresh();
    // Best-effort audit trail — a logging failure never blocks the posting
    // itself (same pattern as ledger-store.ts's append()/reverse()).
    try {
      const [{ append: appendAudit }, { supabase: sb }] = await Promise.all([
        import("./security/audit-log"),
        import("@/lib/providers/data-provider"),
      ]);
      const { data } = await sb.auth.getSession();
      await appendAudit({
        actorId: data.session?.user.id ?? null,
        actorEmail: data.session?.user.email ?? null,
        action: `worker_gold_book.${kind}`,
        entityType: "worker_gold_book",
        entityId: newEntry.id,
        before: null,
        after: newEntry,
        deviceId: null,
      });
    } catch (err) {
      console.error("[WorkerGoldBook] Failed to audit-log entry:", err);
    }
    return newEntry;
  },

  removeEntry: async (id) => {
    await workerTransactionRepository.delete(id);
    await get().refresh();
  },

  forOrder: (orderId) =>
    get()
      .entries.filter((e) => e.orderId === orderId)
      .sort((a, b) => b.createdAt - a.createdAt),

  linkToManufacturingBill: async (id, billId) => {
    const entry = get().entries.find((e) => e.id === id);
    if (!entry || entry.manufacturingBillId) return;
    const updated: WorkerGoldBookEntry = { ...entry, manufacturingBillId: billId };
    const kind = updated.type === "given" ? "gold_book_given" : "gold_book_return";
    await workerTransactionRepository.save({ ...updated, kind });
    set((s) => ({ entries: s.entries.map((e) => (e.id === id ? updated : e)) }));
  },

  getWorkerBalance: (workerId) => {
    const workerEntries = get().entries.filter((e) => e.workerId === workerId);

    let totalGivenFine = 0;
    let totalReturnedFine = 0;
    let totalGivenQty = 0;
    let totalReturnedQty = 0;

    // Helper maps to track per material/purity
    // Key is materialName + "::" + purity
    const materialMap = new Map<
      string,
      {
        material: string;
        purity: number;
        givenGross: number;
        returnedGross: number;
        givenFine: number;
        returnedFine: number;
        givenQty: number;
        returnedQty: number;
      }
    >();

    for (const e of workerEntries) {
      const matKey = `${e.particulars.toLowerCase().trim()}::${e.purity}`;
      if (!materialMap.has(matKey)) {
        materialMap.set(matKey, {
          material: e.particulars,
          purity: e.purity,
          givenGross: 0,
          returnedGross: 0,
          givenFine: 0,
          returnedFine: 0,
          givenQty: 0,
          returnedQty: 0,
        });
      }

      const stats = materialMap.get(matKey)!;

      if (e.type === "given") {
        totalGivenFine += e.fineMg;
        totalGivenQty += e.quantity;

        stats.givenGross += e.grossMg;
        stats.givenFine += e.fineMg;
        stats.givenQty += e.quantity;
      } else {
        totalReturnedFine += e.fineMg;
        totalReturnedQty += e.quantity;

        stats.returnedGross += e.grossMg;
        stats.returnedFine += e.fineMg;
        stats.returnedQty += e.quantity;
      }
    }

    const materialBalances: WorkerMaterialBalance[] = Array.from(materialMap.values()).map(
      (stats) => {
        return {
          material: stats.material,
          purity: stats.purity,
          givenGross: stats.givenGross,
          returnedGross: stats.returnedGross,
          pendingGross: Math.max(0, stats.givenGross - stats.returnedGross),
          givenFine: stats.givenFine,
          returnedFine: stats.returnedFine,
          pendingFine: Math.max(0, stats.givenFine - stats.returnedFine),
          givenQty: stats.givenQty,
          returnedQty: stats.returnedQty,
          pendingQty: Math.max(0, stats.givenQty - stats.returnedQty),
        };
      },
    );

    return {
      totalGivenFine,
      totalReturnedFine,
      pendingFine: Math.max(0, totalGivenFine - totalReturnedFine),
      totalGivenQty,
      totalReturnedQty,
      pendingQty: Math.max(0, totalGivenQty - totalReturnedQty),
      materialBalances,
    };
  },

  reset: () => set({ entries: [] }),
}));
