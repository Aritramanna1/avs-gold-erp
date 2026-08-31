/**
 * AVS ERP — Job Cards store (Phase 5)
 * Manufacturing spine: Order → Job Card → (Worker Issue) → (Receive Work) → ...
 *
 * Weights in mg (integer), purity per-mille.
 */
import { create } from "zustand";
import type { Priority } from "./orders-store";
import { useWorkerGoldBook } from "./worker-gold-book-store";
import { useSettings } from "./settings-store";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { createRepository } from "./repositories/base-repository";
import { nextDocumentNumber } from "./document-numbering";
import { isAdminLikeRole } from "@/lib/role-resolution";
import { resolveOperationalBranchId } from "@/lib/branch-scope";
import { resolveFirmIdForQuery, withFirmScope } from "@/lib/firm-scoped-query";

/**
 * The Job Card's life, as a workshop actually lives it.
 *
 * Each status answers one question — WHERE IS THE GOLD, AND WHOSE HANDS IS THE
 * PIECE IN? That is the only thing a manufacturer needs a job status to tell
 * them, and it's what makes each of these worth a distinct state:
 *
 *   awaiting_gold_issue → card written, karigar assigned, gold still in the vault
 *   gold_issued         → gold is out of the vault and in the karigar's custody
 *   in_progress         → the karigar has started making the piece
 *   work_received       → piece is back with us and is being checked (weight, finish, stones) — QC_PENDING
 *   rework              → QC failed (weight/finish/stone discrepancy); sent back to the bench
 *   hallmark_pending     → QC passed; piece is ours, waiting on HUID hallmarking before it can bill
 *   ready_for_billing   → hallmarked (or hallmarking not required); can be invoiced
 *   closed              → done
 *
 * `hallmark_pending` restores the master ledger's QC_PENDING → HALLMARK_PENDING →
 * COMPLETED chain: a job cannot reach `ready_for_billing` silently — either it
 * passed through hallmark_pending with a recorded HUID (see `hallmarkRecord`),
 * or the card explicitly skipped hallmarking (see `skipHallmark`), so there is
 * always a traceable answer to "was this piece hallmarked?".
 *
 * Two statuses were removed as meaningless:
 *  - `draft`: cards are now created deliberately, with a karigar chosen. A card
 *    that exists is real work; there is nothing to draft.
 *  - `qc_pending`: identical in practice to `work_received` — the piece is back
 *    and being checked. Two names for one state is how two people give you two
 *    different answers about the same job.
 *
 * `ready_for_gold_issue` is renamed to `awaiting_gold_issue` (clearer: it is
 * WAITING on us, not "ready" in the sense of finished).
 *
 * Old values still exist in saved records, so they remain in the type as legacy
 * and are folded into the live ones by `normalizeJobStatus()` on read. Nothing
 * writes them any more.
 */
export type JobStatus =
  | "awaiting_gold_issue"
  | "gold_issued"
  | "in_progress"
  | "outside_processing"
  | "work_received"
  | "rework"
  | "hallmark_pending"
  | "ready_for_billing"
  | "closed"
  // ── Legacy, read-only. Normalized away on read; never written. ──
  | "draft"
  | "ready_for_gold_issue"
  | "qc_pending";

/** The live workflow, in order. Anything not here is legacy. */
export const JOB_STATUS_FLOW: JobStatus[] = [
  "awaiting_gold_issue",
  "gold_issued",
  "in_progress",
  "outside_processing",
  "work_received",
  "rework",
  "hallmark_pending",
  "ready_for_billing",
  "closed",
];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  awaiting_gold_issue: "Awaiting Gold Issue",
  gold_issued: "Gold Issued",
  in_progress: "Work In Progress",
  outside_processing: "Outside Processing",
  work_received: "Work Received (Checking)",
  rework: "Rework",
  hallmark_pending: "Hallmark Pending",
  ready_for_billing: "Ready for Billing",
  closed: "Closed",

  // Legacy — labelled as their live equivalent so an old record never displays
  // a status the workflow no longer has.
  draft: "Awaiting Gold Issue",
  ready_for_gold_issue: "Awaiting Gold Issue",
  qc_pending: "Work Received (Checking)",
};

/** WIP custody lane while status is outside_processing (Outside / Polishing / Meena). */
export type JobCustodyKind = "outside" | "polishing" | "meena";

/** Human label: Outside / Polishing / Meena / awaiting return — without redesigning job cards. */
export function jobCustodyDisplayLabel(
  job: Pick<JobCard, "status" | "custodyKind">,
): string {
  const status = normalizeJobStatus(job.status);
  if (status !== "outside_processing") return JOB_STATUS_LABELS[status];
  switch (job.custodyKind) {
    case "polishing":
      return "Polishing — awaiting return";
    case "meena":
      return "Meena — awaiting return";
    case "outside":
      return "Outside processing — awaiting return";
    default:
      return "Outside processing — awaiting return";
  }
}

/**
 * Folds a stored status onto the live workflow. Every read of a Job Card's
 * status must go through this — a card saved months ago as `qc_pending` should
 * show up in today's "Work Received" bucket, not vanish from every filter.
 */
export function normalizeJobStatus(status: JobStatus): JobStatus {
  switch (status) {
    case "draft":
    case "ready_for_gold_issue":
      return "awaiting_gold_issue";
    case "qc_pending":
      return "work_received";
    default:
      return status;
  }
}

/** @deprecated Use JOB_STATUS_FLOW. */
export const JOB_STATUS_ACTIVE: JobStatus[] = JOB_STATUS_FLOW;

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

export interface HallmarkRecord {
  huid: string;
  hallmarkedAt: number;
  centre?: string;
  notes?: string;
  /** True when the card explicitly skipped hallmarking (e.g. hallmark-exempt item) rather than recording a HUID. */
  skipped?: boolean;
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
  /**
   * Which line of the order this card is for. An order holds several pieces and
   * each one is an independent bench job, so the card must know its line — both
   * to pull that line's reference photos and so re-confirming an order doesn't
   * duplicate cards for lines that already have one.
   */
  lineId?: string;
  itemName: string;
  category: string;
  /** Category-specific dimensions (ring size, chain length) — snapshot of the order line's. */
  attributes?: Record<string, string>;
  /** Pieces to make on THIS card. Target weights below are for all of them. */
  quantity?: number;
  /** Expected weight of one piece; targetGrossMg is the total for `quantity` pieces. */
  perPieceGrossMg?: number;
  purity: number;
  targetGrossMg: number;
  targetNetMg: number;
  targetFineMg: number;
  expectedWastagePct?: number;

  // workshop
  status: JobStatus;
  /**
   * When status is `outside_processing`, which WIP custody lane holds the piece.
   * Cleared when the job returns to `in_progress`. Not a second inventory authority.
   */
  custodyKind?: JobCustodyKind;
  priority: Priority;
  expectedDelivery?: string;
  expectedStart?: string;
  expectedCompletion?: string;
  notes?: string;
  branchId?: string;

  // gold movement
  workReceipt?: WorkReceiptRecord;
  /** HUID hallmarking record — set when the card passes through `hallmark_pending`. */
  hallmarkRecord?: HallmarkRecord;

  timeline: JobTimelineEvent[];
}

interface JobCardsState {
  jobs: JobCard[];
  refresh: () => Promise<void>;
  add: (
    input: Omit<JobCard, "id" | "createdAt" | "updatedAt" | "timeline" | "jobNo"> & {
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
  /** QC pass: work_received → hallmark_pending. Physical check done; awaiting HUID hallmarking. */
  passQc: (jobId: string) => Promise<void>;
  /** Records the HUID (or an explicit skip) and moves hallmark_pending → ready_for_billing. */
  setHallmark: (jobId: string, rec: Omit<HallmarkRecord, "hallmarkedAt">) => Promise<void>;
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
  /** Days since the oldest still-outstanding issue to this karigar; undefined if nothing outstanding. */
  oldestIssueAgeDays?: number;
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
    oldestIssueAgeDays?: number;
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
    let overlossMg = 0;
    const workerJobsList = activeJobsForWorker.map((j) => {
      const jobEntries = workerEntries.filter((e) => e.orderId === j.orderId);
      const givenFine = jobEntries
        .filter((e) => e.type === "given")
        .reduce((sum, e) => sum + e.fineMg, 0);
      const returnedFine = jobEntries
        .filter((e) => e.type === "return")
        .reduce((sum, e) => sum + e.fineMg, 0);
      overlossMg += j.workReceipt?.overlossMg ?? 0;
      return {
        jobId: j.id,
        jobNo: j.jobNo,
        outstandingMg: Math.max(0, givenFine - returnedFine),
      };
    });

    const oldestOutstandingGiven =
      bal.pendingFine > 0
        ? workerEntries
            .filter((e) => e.type === "given")
            .reduce<number | undefined>(
              (oldest, e) => (oldest === undefined || e.createdAt < oldest ? e.createdAt : oldest),
              undefined,
            )
        : undefined;

    map.set(workerId, {
      karigarId: workerId,
      karigarName: workerName,
      issuedMg: bal.totalGivenFine,
      finishedMg,
      scrapMg,
      filingsMg,
      wastageMg,
      overlossMg,
      outstandingMg: bal.pendingFine,
      oldestIssueAgeDays:
        oldestOutstandingGiven !== undefined
          ? Math.max(0, Math.floor((Date.now() - oldestOutstandingGiven) / 86_400_000))
          : undefined,
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
const JOB_CARD_COMPAT_CACHE_LIMIT = 200;

async function makeJobNo(): Promise<string> {
  const d = new Date();
  const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const prefix = `JC-${yyyymmdd}-`;
  return nextDocumentNumber(`job_card:${yyyymmdd}`, prefix, 3);
}

export const useJobCards = create<JobCardsState>()((set, get) => ({
  jobs: [],
  refresh: async () => {
    const firmId = await resolveFirmIdForQuery();
    if (!firmId) {
      set({ jobs: [] });
      return;
    }
    const { currentUserRole, selectedBranchId } = useSettings.getState();
    const bid =
      !currentUserRole || isAdminLikeRole(currentUserRole)
        ? null
        : resolveOperationalBranchId(selectedBranchId);
    // Compatibility cache for side panels/detail handoff. Large job registers
    // must use route-level pagination or server aggregates.
    let q = withFirmScope(
      supabase
        .from("job_cards")
        .select("data")
        .order("updated_at", { ascending: false })
        .limit(JOB_CARD_COMPAT_CACHE_LIMIT),
      firmId,
    );
    if (bid) q = q.filter("data->>branchId", "eq", bid) as typeof q;
    const { data, error } = await q;
    if (error) {
      // DB error on refresh — leave existing state
      return;
    }
    const rows = (data ?? [])
      .map((r) => r.data as JobCard | null)
      .filter((j): j is JobCard => !!j && !!j.id && !!j.jobNo)
      // Fold legacy statuses (draft / ready_for_gold_issue / qc_pending) onto
      // the live workflow HERE, so no screen, filter or report has to know the
      // old names ever existed.
      .map((j) => ({ ...j, status: normalizeJobStatus(j.status) }));
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
    if (status === "work_received" || status === "ready_for_billing") {
      void import("@/lib/ui-feedback").then(({ emitUiFeedback }) => emitUiFeedback("manufacturing"));
    }
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
    void import("@/lib/ui-feedback").then(({ emitUiFeedback }) => emitUiFeedback("manufacturing"));
    try {
      const [{ append: appendAudit }, { supabase: sb }] = await Promise.all([
        import("./security/audit-log"),
        import("@/lib/providers/data-provider"),
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
  passQc: async (jobId) => {
    const current = get().jobs.find((j) => j.id === jobId);
    if (!current) return;
    const now = Date.now();
    const updated: JobCard = {
      ...current,
      status: "hallmark_pending",
      updatedAt: now,
      timeline: [
        ...current.timeline,
        { ts: now, label: `Status → ${JOB_STATUS_LABELS.hallmark_pending}`, note: "QC passed" },
      ],
    };
    await jobCardRepository.save(updated);
    await get().refresh();
  },

  setHallmark: async (jobId, rec) => {
    const current = get().jobs.find((j) => j.id === jobId);
    if (!current) return;
    const now = Date.now();
    const hallmarkRecord: HallmarkRecord = { ...rec, hallmarkedAt: now };
    const updated: JobCard = {
      ...current,
      hallmarkRecord,
      status: "ready_for_billing",
      updatedAt: now,
      timeline: [
        ...current.timeline,
        {
          ts: now,
          label: rec.skipped
            ? "Hallmarking skipped — ready for billing"
            : `Hallmarked · HUID ${rec.huid}`,
          note: rec.notes,
        },
      ],
    };
    await jobCardRepository.save(updated);
    await get().refresh();
    void import("@/lib/ui-feedback").then(({ emitUiFeedback }) => emitUiFeedback("manufacturing"));
  },

  reset: () => set({ jobs: [] }),
}));

const OPEN_BENCH: JobStatus[] = [
  "awaiting_gold_issue",
  "gold_issued",
  "in_progress",
  "outside_processing",
];

/** Light custody hook: open jobs for this order → Outside Processing (with lane). */
export async function markOrderJobsOutsideProcessing(
  orderId: string,
  note: string,
  custodyKind: JobCustodyKind = "outside",
): Promise<void> {
  const store = useJobCards.getState();
  const jobs = store.jobs.filter(
    (j) => j.orderId === orderId && OPEN_BENCH.includes(normalizeJobStatus(j.status)),
  );
  const now = Date.now();
  for (const job of jobs) {
    if (normalizeJobStatus(job.status) === "outside_processing" && job.custodyKind === custodyKind) {
      continue;
    }
    const label = jobCustodyDisplayLabel({
      status: "outside_processing",
      custodyKind,
    });
    await store.update(job.id, {
      status: "outside_processing",
      custodyKind,
      timeline: [
        ...job.timeline,
        {
          ts: now,
          label: `Status → ${label}`,
          note,
        },
      ],
    });
  }
}

/** After outside/polish/meena receive: return open outside jobs to in_progress. */
export async function clearOrderJobsOutsideProcessing(
  orderId: string,
  note: string,
): Promise<void> {
  const store = useJobCards.getState();
  const jobs = store.jobs.filter(
    (j) => j.orderId === orderId && normalizeJobStatus(j.status) === "outside_processing",
  );
  const now = Date.now();
  for (const job of jobs) {
    await store.update(job.id, {
      status: "in_progress",
      custodyKind: undefined,
      timeline: [
        ...job.timeline,
        {
          ts: now,
          label: `Status → ${JOB_STATUS_LABELS.in_progress}`,
          note,
        },
      ],
    });
  }
}
