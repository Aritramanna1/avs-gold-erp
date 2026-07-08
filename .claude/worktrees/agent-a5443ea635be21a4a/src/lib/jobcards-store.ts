/**
 * MTJ ERP — Job Cards store (Phase 5)
 * Manufacturing spine: Order → Job Card → (Issue Gold) → (Receive Work) → ...
 *
 * Weights in mg (integer), purity per-mille.
 */
import { create } from "zustand";
import type { Priority } from "./orders-store";
import { useWorkerGoldBook } from "./worker-gold-book-store";
import { useSettings } from "./settings-store";
import { supabase } from "@/integrations/supabase/client";
import { createRepository } from "./repositories/base-repository";

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

export type ProcessTemplateKey = "handmade_basic" | "ring_basic" | "repair_basic";

export interface ProcessTemplate {
  key: ProcessTemplateKey;
  name: string;
  description: string;
  steps: string[];
}

export const PROCESS_TEMPLATES: Record<ProcessTemplateKey, ProcessTemplate> = {
  handmade_basic: {
    key: "handmade_basic",
    name: "Handmade Basic",
    description: "Default flow for handmade / filigree pieces.",
    steps: ["Melting", "Wire Drawing", "Handmade / Filigree", "Filing", "Polishing", "QC"],
  },
  ring_basic: {
    key: "ring_basic",
    name: "Ring Basic",
    description: "Standard handmade ring flow.",
    steps: ["Metal Preparation", "Shaping", "Filing", "Polishing", "QC"],
  },
  repair_basic: {
    key: "repair_basic",
    name: "Repair Basic",
    description: "Inspection-led repair flow.",
    steps: ["Inspection", "Repair Work", "Polishing", "Final Check"],
  },
};

export type StepStatus = "pending" | "in_progress" | "done" | "skipped" | "rework";

export const STEP_STATUS_LABELS: Record<StepStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  done: "Done",
  skipped: "Skipped",
  rework: "Rework",
};

export interface ProcessStep {
  id: string;
  name: string;
  status: StepStatus;
  notes?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface JobTimelineEvent {
  ts: number;
  label: string;
  note?: string;
}

export interface GoldIssueRecord {
  id: string;
  slipNo: string;
  ts: number;
  source: "vault";
  grossMg: number;
  purity: number;
  fineMg: number;
  issuedBy?: string;
  notes?: string;
  ledgerEntryId: string;
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
  templateKey: ProcessTemplateKey;
  steps: ProcessStep[];
  status: JobStatus;
  priority: Priority;
  expectedDelivery?: string;
  expectedStart?: string;
  expectedCompletion?: string;
  notes?: string;
  branchId?: string;

  // gold movement
  goldIssue?: GoldIssueRecord;
  workReceipt?: WorkReceiptRecord;

  timeline: JobTimelineEvent[];
}

interface JobCardsState {
  jobs: JobCard[];
  refresh: () => Promise<void>;
  add: (
    input: Omit<JobCard, "id" | "createdAt" | "updatedAt" | "steps" | "timeline"> & {
      jobNo?: string;
      steps?: ProcessStep[];
      timeline?: JobTimelineEvent[];
    },
  ) => Promise<JobCard>;
  update: (id: string, patch: Partial<JobCard>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  appendTimeline: (id: string, ev: JobTimelineEvent) => Promise<void>;
  setStepStatus: (
    jobId: string,
    stepId: string,
    status: StepStatus,
    notes?: string,
  ) => Promise<void>;
  setGoldIssue: (jobId: string, rec: GoldIssueRecord) => Promise<void>;
  setWorkReceipt: (jobId: string, rec: WorkReceiptRecord) => Promise<void>;
  reset: () => void;
}

/** Compute current outstanding karigar custody (mg fine) for a job. */
export function jobKarigarCustodyMg(j: JobCard): number {
  if (!j.goldIssue) return 0;
  const issued = j.goldIssue.fineMg;
  const r = j.workReceipt;
  if (!r) return issued;
  return (
    issued - r.finishedFineMg - r.scrapFineMg - r.filingsFineMg - r.dustFineMg - r.actualLossMg
  );
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
    const workerJobsList = activeJobsForWorker
      .map((j) => ({
        jobId: j.id,
        jobNo: j.jobNo,
        outstandingMg: jobKarigarCustodyMg(j),
      }))
      .filter((item) => item.outstandingMg > 0);

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

function makeJobNo(existing: JobCard[]): string {
  const d = new Date();
  const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const prefix = `JC-${yyyymmdd}-`;
  const todays = existing.filter((j) => j.jobNo.startsWith(prefix));
  const seq = String(todays.length + 1).padStart(3, "0");
  return `${prefix}${seq}`;
}

export function stepsFromTemplate(key: ProcessTemplateKey): ProcessStep[] {
  const steps = (key && PROCESS_TEMPLATES[key]?.steps) || PROCESS_TEMPLATES.handmade_basic.steps;
  return steps.map((name) => ({
    id: makeId(),
    name,
    status: "pending" as StepStatus,
  }));
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
      jobNo: input.jobNo ?? makeJobNo(get().jobs),
      steps: input.steps ?? stepsFromTemplate(input.templateKey),
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
  setStepStatus: async (jobId, stepId, status, notes) => {
    const now = Date.now();
    const current = get().jobs.find((j) => j.id === jobId);
    if (!current) return;
    const steps = current.steps.map((s) => {
      if (s.id !== stepId) return s;
      return {
        ...s,
        status,
        notes: notes ?? s.notes,
        startedAt: status === "in_progress" && !s.startedAt ? now : s.startedAt,
        completedAt: status === "done" ? now : s.completedAt,
      };
    });
    // derive job status from steps
    let jobStatus: JobStatus = current.status;
    if (status === "rework") jobStatus = "rework";
    else if (steps.every((s) => s.status === "done" || s.status === "skipped")) {
      // all steps complete — advance to qc_pending unless already further downstream
      const downstream: JobStatus[] = [
        "qc_pending",
        "work_received",
        "ready_for_billing",
        "closed",
      ];
      jobStatus = downstream.includes(current.status) ? current.status : "qc_pending";
    } else if (steps.some((s) => s.status === "in_progress" || s.status === "done")) {
      if (current.status === "draft" || current.status === "ready_for_gold_issue") {
        jobStatus = "in_progress";
      } else if (current.status === "rework") {
        jobStatus = "in_progress";
      }
    }
    const updated = {
      ...current,
      steps,
      status: jobStatus,
      updatedAt: now,
      timeline: [
        ...current.timeline,
        {
          ts: now,
          label: `Step "${current.steps.find((s) => s.id === stepId)?.name}" → ${STEP_STATUS_LABELS[status]}`,
          note: notes,
        },
      ],
    };
    await jobCardRepository.save(updated);
    await get().refresh();
  },
  setGoldIssue: async (jobId, rec) => {
    const current = get().jobs.find((j) => j.id === jobId);
    if (!current) return;
    const updated = {
      ...current,
      goldIssue: rec,
      status: "gold_issued" as JobStatus,
      updatedAt: Date.now(),
      timeline: [
        ...current.timeline,
        {
          ts: rec.ts,
          label: `Gold issued · ${rec.slipNo}`,
          note: `${(rec.fineMg / 1000).toFixed(3)} g fine`,
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
  },
  reset: () => set({ jobs: [] }),
}));
