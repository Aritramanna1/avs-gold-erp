/**
 * MTJ ERP — Job Cards store (Phase 5)
 * Manufacturing spine: Order → Job Card → (Worker Issue) → (Receive Work) → ...
 *
 * Weights in mg (integer), purity per-mille.
 */
import { create } from "zustand";
import type { Priority } from "./orders-store";
import { useWorkerGoldBook } from "./worker-gold-book-store";
import { useSettings } from "./settings-store";
import { supabase } from "@/integrations/supabase/client";
import { createRepository } from "./repositories/base-repository";
import { nextDocumentNumber } from "./document-numbering";

export type JobStatus =
  | "draft"
  | "ready_for_gold_issue"
  | "gold_issued"
  | "in_progress"
  | "work_received"
  | "qc_pending"
  | "ready_for_billing"
  | "rework"
  | "closed";

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: "Draft",
  ready_for_gold_issue: "Ready for Gold Issue",
  gold_issued: "Gold Issued",
  in_progress: "Work In Progress",
  work_received: "Work Received",
  qc_pending: "QC Pending",
  ready_for_billing: "Ready for Billing",
  rework: "Rework",
  closed: "Closed",
};

// Phase 5 supports a sub-set actively
export const JOB_STATUS_ACTIVE: JobStatus[] = [
  "draft",
  "ready_for_gold_issue",
  "in_progress",
  "rework",
  "closed",
];

export interface JobTimelineEvent {
  ts: number;
  label: string;
  note?: string;
}

export interface QAFlags {
  finishOk: boolean;
  weightChecked: boolean;
  stoneChecked: boolean;
  readyForStock: boolean;
}

export interface WorkReceiptRecord {
  id: string;
  slipNo: string;
  ts: number;
  finishedGrossMg: number;
  finishedPurity: number;
  finishedFineMg: number;
  scrapGrossMg: number;
  scrapPurity: number;
  scrapFineMg: number;
  filingsGrossMg: number;
  filingsPurity: number;
  filingsFineMg: number;
  dustFineMg: number;
  expectedWastagePct: number; // 0..100
  expectedLossMg: number;
  actualLossMg: number;
  overlossMg: number;
  qa: QAFlags;
  notes?: string;
  finishedStockId?: string;
  ledgerEntryIds: string[];
}

export interface JobCard {
  id: string;
  jobNo: string;
  createdAt: number;
  updatedAt: number;

  // links
  orderId: string;
  orderNo: string;
  customerId: string;
  customerName: string;
  karigarId?: string;
  karigarName?: string;

  // item target (snapshot from order)
  itemName: string;
  category: string;
  purity: number;
  targetGrossMg: number;
  targetNetMg: number;
  targetFineMg: number;
  expectedWastagePct?: number;

  // workshop
  status: JobStatus;
  priority: Priority;
  expectedDelivery?: string;
  expectedStart?: string;
  expectedCompletion?: string;
  notes?: string;
  branchId?: string;

  // gold movement
  workReceipt?: WorkReceiptRecord;

  timeline: JobTimelineEvent[];
}

interface JobCardsState {
  jobs: JobCard[];
  refresh: () => Promise<void>;
  add: (
    input: Omit<JobCard, "id" | "createdAt" | "updatedAt" | "timeline"> & {
      jobNo?: string;
      timeline?: JobTimelineEvent[];
    },
  ) => Promise<JobCard>;
  update: (id: string, patch: Partial<JobCard>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  appendTimeline: (id: string, ev: JobTimelineEvent) => Promise<void>;
  /** Sets the Job Card's overall status directly — replaces the old per-step-derived status transition. */
  setStatus: (jobId: string, status: JobStatus, notes?: string) => Promise<void>;
  setWorkReceipt: (jobId: string, rec: WorkReceiptRecord) => Promise<void>;
  reset: () => void;
}

export interface KarigarCustodySummary {
  karigarId: string;
  karigarName: string;
  issuedMg: number;
  finishedMg: number;
  scrapMg: number;
  filingsMg: number;
  wastageMg: number;
  overlossMg: number;
  outstandingMg: number;
  jobs: { jobId: string; jobNo: string; outstandingMg: number }[];
}

export function karigarCustodySummaries(jobs: JobCard[]): KarigarCustodySummary[] {
  const map = new Map<string, KarigarCustoryIntermediate>();

  interface KarigarCustoryIntermediate {
    karigarId: string;
    karigarName: string;
    issuedMg: number;
    finishedMg: number;
    scrapMg: number;
    filingsMg: number;
    wastageMg: number;
    overlossMg: number;
    outstandingMg: number;
    jobs: { jobId: string; jobNo: string; outstandingMg: number }[];
  }

  // Get all unique workers who have entries in the Worker Gold Book
  const wStore = useWorkerGoldBook.getState();
  const allEntries = wStore.entries;
  const uniqueWorkerIds = Array.from(new Set(allEntries.map((e) => e.workerId)));

  for (const workerId of uniqueWorkerIds) {
    const workerEntries = allEntries.filter((e) => e.workerId === workerId);
    if (workerEntries.length === 0) continue;

    const workerName = workerEntries[0].workerName;
    const bal = wStore.getWorkerBalance(workerId);

    let finishedMg = 0;
    let scrapMg = 0;
    let filingsMg = 0;
    let wastageMg = 0;

    workerEntries.forEach((e) => {
      if (e.type === "return") {
        if (e.particulars.startsWith("Finished:")) {
          finishedMg += e.fineMg;
        } else if (e.particulars === "Scrap Returned") {
          scrapMg += e.fineMg;
        } else if (e.particulars === "Filings Returned") {
          filingsMg += e.fineMg;
        } else if (
          e.particulars === "Melt Loss / Wastage" ||
          e.particulars === "Dust/Sweepings Returned"
        ) {
          wastageMg += e.fineMg;
        }
      }
    });

    const activeJobsForWorker = jobs.filter((j) => j.karigarId === workerId);
    const workerJobsList = activeJobsForWorker.map((j) => ({
      jobId: j.id,
      jobNo: j.jobNo,
      outstandingMg: 0,
    }));

    map.set(workerId, {
      karigarId: workerId,
      karigarName: workerName,
      issuedMg: bal.totalGivenFine,
      finishedMg,
      scrapMg,
      filingsMg,
      wastageMg,
      overlossMg: 0,
      outstandingMg: bal.pendingFine,
      jobs: workerJobsList,
    });
  }

  return Array.from(map.values()).sort((a, b) => b.outstandingMg - a.outstandingMg);
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `j_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const jobCardRepository = createRepository<JobCard>("job_cards");

async function makeJobNo(): Promise<string> {
  const d = new Date();
  const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const prefix = `JC-${yyyymmdd}-`;
  return nextDocumentNumber(`job_card:${yyyymmdd}`, prefix, 3);
}

export const useJobCards = create<JobCardsState>()((set, get) => ({
  jobs: [],
  refresh: async () => {
    const { currentUserRole, selectedBranchId } = useSettings.getState();
    const GLOBAL_ROLES = ["Super Owner", "Administrator", "CEO (View Only)"];
    const bid =
      !currentUserRole || GLOBAL_ROLES.includes(currentUserRole)
        ? null
        : selectedBranchId || "MAIN";
    let q = supabase.from("job_cards").select("data").limit(10000);
    if (bid) q = q.filter("data->>branchId", "eq", bid) as typeof q;
    const { data, error } = await q;
    if (error) {
      // DB error on refresh — leave existing state
      return;
    }
    const rows = (data ?? [])
      .map((r) => r.data as JobCard | null)
      .filter((j): j is JobCard => !!j && !!j.id && !!j.jobNo);
    set({ jobs: rows });
  },
  add: async (input) => {
    const now = Date.now();
    const job: JobCard = {
      branchId: (input as any).branchId ?? useSettings.getState().selectedBranchId ?? undefined,
      id: makeId(),
      createdAt: now,
      updatedAt: now,
      ...input,
      jobNo: input.jobNo ?? (await makeJobNo()),
      timeline: input.timeline ?? [{ ts: now, label: "Job Card created" }],
    };
    await jobCardRepository.save(job);
    await get().refresh();
    return job;
  },
  update: async (id, patch) => {
    const current = get().jobs.find((j) => j.id === id);
    if (!current) return;
    const updated = { ...current, ...patch, updatedAt: Date.now() };
    await jobCardRepository.save(updated);
    await get().refresh();
  },
  remove: async (id) => {
    await jobCardRepository.delete(id);
    await get().refresh();
  },
  appendTimeline: async (id, ev) => {
    const current = get().jobs.find((j) => j.id === id);
    if (!current) return;
    const updated = {
      ...current,
      timeline: [...current.timeline, ev],
      updatedAt: Date.now(),
    };
    await jobCardRepository.save(updated);
    await get().refresh();
  },
  setStatus: async (jobId, status, notes) => {
    const now = Date.now();
    const current = get().jobs.find((j) => j.id === jobId);
    if (!current) return;
    const updated = {
      ...current,
      status,
      updatedAt: now,
      timeline: [
        ...current.timeline,
        {
          ts: now,
          label: `Status → ${JOB_STATUS_LABELS[status]}`,
          note: notes,
        },
      ],
    };
    await jobCardRepository.save(updated);
    await get().refresh();
  },

  setWorkReceipt: async (jobId, rec) => {
    const current = get().jobs.find((j) => j.id === jobId);
    if (!current) return;
    const updated = {
      ...current,
      workReceipt: rec,
      status: "work_received" as JobStatus,
      updatedAt: Date.now(),
      timeline: [
        ...current.timeline,
        {
          ts: rec.ts,
          label: `Work received · ${rec.slipNo}`,
          note: rec.overlossMg > 0 ? `Overloss ${(rec.overlossMg / 1000).toFixed(3)} g` : undefined,
        },
      ],
    };
    await jobCardRepository.save(updated);
    await get().refresh();
    try {
      const [{ append: appendAudit }, { supabase: sb }] = await Promise.all([
        import("./security/audit-log"),
        import("@/integrations/supabase/client"),
      ]);
      const { data } = await sb.auth.getSession();
      await appendAudit({
        actorId: data.session?.user.id ?? null,
        actorEmail: data.session?.user.email ?? null,
        action: "job_card.work_receipt",
        entityType: "job_cards",
        entityId: jobId,
        before: null,
        after: rec,
        deviceId: null,
      });
    } catch (err) {
      console.error("[JobCards] Failed to audit-log work receipt:", err);
    }
  },
  reset: () => set({ jobs: [] }),
}));
