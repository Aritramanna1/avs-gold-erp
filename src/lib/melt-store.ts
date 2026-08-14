/**
 * MTJ ERP — Melt Account Store
 *
 * Tracks gold melting operations:
 *   - Scrap / dust / sweepings collection
 *   - Refinery processing
 *   - Fine gold recovery weight
 *   - Loss tracking (fine gold that didn't come back)
 *
 * Weights stored as integer mg. Purity stored as per-mille (e.g. 916 = 91.6%).
 * Recovery % stored as basis-points (e.g. 9850 = 98.50%).
 */
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { useLedger } from "@/lib/ledger-store";
import { useSettings } from "@/lib/settings-store";
import { createRepository } from "./repositories/base-repository";
import { fineGoldMg } from "./gold";
import { nextDocumentNumber } from "./document-numbering";

const meltJobRepository = createRepository<{ id: string } & Record<string, unknown>>("melt_jobs");

export interface MeltJob {
  id: string;
  jobNo: string;
  branchId: string;
  date: string; // ISO date string YYYY-MM-DD
  karigarId?: string;
  karigarName?: string;
  status: "open" | "processing" | "completed" | "cancelled";

  // Input weights (mg)
  scrapInputGrossMg: number;
  scrapInputPurity: number; // per-mille
  scrapInputFineMg: number; // computed: round(gross * purity / 1000)

  dustInputGrossMg: number;
  dustInputPurity: number;
  dustInputFineMg: number;

  otherInputGrossMg: number;
  otherInputPurity: number;
  otherInputFineMg: number;

  totalInputFineMg: number; // scrap + dust + other fine mg

  // Recovery
  fineGoldRecoveredMg: number; // actual fine gold received from refinery
  fineSilverRecoveredMg?: number; // actual fine silver received from refinery (Section 46)
  copperAlloyResidueMg?: number; // copper/alloy residue (mg)
  scrapReturnedMg: number; // non-recoverable scrap returned (gross)

  // XRF Machine Integration (Section 43)
  xrfTouchScanId?: string;

  // Calculations
  recoveryPct: number; // basis points e.g. 9850 = 98.50%
  lossFineMg: number; // totalInputFineMg - fineGoldRecoveredMg (if positive)

  // Refinery info
  refineryName?: string;
  refineryReceiptNo?: string;
  refinerySentDate?: string;
  refineryReceivedDate?: string;

  notes?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Recomputes derived fields from raw inputs.
 * All arithmetic is integer-only.
 */
export function calcMeltJob(
  job: Pick<
    MeltJob,
    | "scrapInputGrossMg"
    | "scrapInputPurity"
    | "dustInputGrossMg"
    | "dustInputPurity"
    | "otherInputGrossMg"
    | "otherInputPurity"
    | "fineGoldRecoveredMg"
  >,
): Pick<
  MeltJob,
  | "scrapInputFineMg"
  | "dustInputFineMg"
  | "otherInputFineMg"
  | "totalInputFineMg"
  | "lossFineMg"
  | "recoveryPct"
> {
  // Delegates to gold.ts's fineGoldMg() rather than reimplementing the
  // formula — an inline `/1000` here previously disagreed with every other
  // fine-gold figure in the ERP (which uses /999), silently undervaluing
  // melt inputs relative to the ledger they reconcile against.
  const scrapInputFineMg = fineGoldMg(job.scrapInputGrossMg, job.scrapInputPurity);
  const dustInputFineMg = fineGoldMg(job.dustInputGrossMg, job.dustInputPurity);
  const otherInputFineMg = fineGoldMg(job.otherInputGrossMg, job.otherInputPurity);
  const totalInputFineMg = scrapInputFineMg + dustInputFineMg + otherInputFineMg;
  const lossFineMg = Math.max(0, totalInputFineMg - job.fineGoldRecoveredMg);
  // recoveryPct in basis points (10000 = 100.00%)
  const recoveryPct =
    totalInputFineMg > 0 ? Math.round((job.fineGoldRecoveredMg * 10000) / totalInputFineMg) : 0;

  return {
    scrapInputFineMg,
    dustInputFineMg,
    otherInputFineMg,
    totalInputFineMg,
    lossFineMg,
    recoveryPct,
  };
}

function makeId(prefix = "mj"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Generate job number: MELT-YYYYMM-NNN, atomic across clients/branches via nextDocumentNumber */
async function generateJobNo(): Promise<string> {
  const d = new Date();
  const monthKey = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `MELT-${monthKey}-`;
  return nextDocumentNumber(`melt:${monthKey}`, prefix, 3);
}

function meltJobRow(job: MeltJob) {
  // The current Supabase schema for `melt_jobs` is `{id, data jsonb}` only.
  // Once `supabase/migrations/20260630_phase2_stabilization.sql` has been applied the
  // remaining columns (job_no, branch_id, date, status, totals) become available; until
  // then we send only what the table actually accepts so writes succeed.
  return {
    id: job.id,
    data: job,
  };
}

interface MeltState {
  jobs: MeltJob[];
  refresh: () => Promise<void>;
  createJob: (
    jobData: Omit<
      MeltJob,
      | "id"
      | "jobNo"
      | "createdAt"
      | "updatedAt"
      | "scrapInputFineMg"
      | "dustInputFineMg"
      | "otherInputFineMg"
      | "totalInputFineMg"
      | "lossFineMg"
      | "recoveryPct"
    >,
  ) => Promise<MeltJob>;
  updateJob: (id: string, patch: Partial<MeltJob>) => Promise<MeltJob>;
  deleteJob: (id: string) => Promise<void>;
  completeJob: (id: string) => Promise<void>;
  reset: () => void;
}

let createJobInFlight = false;
const MELT_JOB_COMPAT_CACHE_LIMIT = 500;

export const useMeltStore = create<MeltState>()((set, get) => ({
  jobs: [],

  refresh: async () => {
    const { currentUserRole, selectedBranchId } = useSettings.getState();
    const GLOBAL_ROLES = [
      "Super Owner",
      "Administrator",
      "CEO (View Only)",
      "owner",
      "admin",
      "saas_admin",
    ];
    const bid =
      !currentUserRole || GLOBAL_ROLES.includes(currentUserRole)
        ? null
        : selectedBranchId || "MAIN";

    // NOTE: `melt_jobs` is stored as { id, data: jsonb } only — the branch filter therefore
    // targets the JSON path `data->>branchId`. A schema migration in
    // supabase/migrations/20260630_melt_jobs_columns.sql adds dedicated columns; once applied
    // both this filter and the legacy `.eq("branch_id", bid)` form will work identically.
    let q = (supabase as any)
      .from("melt_jobs")
      .select("data")
      .order("id", { ascending: false })
      .limit(MELT_JOB_COMPAT_CACHE_LIMIT);
    if (bid) q = q.filter("data->>branchId", "eq", bid);

    const { data, error } = await q;

    if (error) {
      console.error("[melt-store] Error fetching melt_jobs:", error);
      return;
    }
    const rows = ((data as any[]) ?? [])
      .map((r: any) => r.data as MeltJob | null)
      .filter((j: any): j is MeltJob => !!j && !!j.id && typeof j.jobNo === "string");

    set({ jobs: rows });
  },

  createJob: async (jobData) => {
    // generateJobNo() is now atomic (nextDocumentNumber's RPC) so cross-client
    // races are handled server-side; this same-tab guard just prevents a
    // double-click from firing two createJob() calls before the first resolves.
    if (createJobInFlight) {
      throw new Error("A melt job is already being created — please wait.");
    }
    createJobInFlight = true;
    try {
      const id = makeId("mj");
      const branchId = jobData.branchId || useSettings.getState().selectedBranchId || "MAIN";
      const jobNo = await generateJobNo();

      const computed = calcMeltJob({
        scrapInputGrossMg: jobData.scrapInputGrossMg,
        scrapInputPurity: jobData.scrapInputPurity,
        dustInputGrossMg: jobData.dustInputGrossMg,
        dustInputPurity: jobData.dustInputPurity,
        otherInputGrossMg: jobData.otherInputGrossMg,
        otherInputPurity: jobData.otherInputPurity,
        fineGoldRecoveredMg: jobData.fineGoldRecoveredMg,
      });

      const now = Date.now();
      const job: MeltJob = {
        ...jobData,
        id,
        jobNo,
        branchId,
        ...computed,
        createdAt: now,
        updatedAt: now,
      };

      await meltJobRepository.save(meltJobRow(job));
      await get().refresh();
      return job;
    } finally {
      createJobInFlight = false;
    }
  },

  updateJob: async (id, patch) => {
    const existing = get().jobs.find((j) => j.id === id);
    if (!existing) throw new Error(`Melt job not found: ${id}`);

    const merged: MeltJob = { ...existing, ...patch, updatedAt: Date.now() };

    // Recompute derived fields if weights/purity changed
    const computed = calcMeltJob({
      scrapInputGrossMg: merged.scrapInputGrossMg,
      scrapInputPurity: merged.scrapInputPurity,
      dustInputGrossMg: merged.dustInputGrossMg,
      dustInputPurity: merged.dustInputPurity,
      otherInputGrossMg: merged.otherInputGrossMg,
      otherInputPurity: merged.otherInputPurity,
      fineGoldRecoveredMg: merged.fineGoldRecoveredMg,
    });

    const updated: MeltJob = { ...merged, ...computed };

    await meltJobRepository.save(meltJobRow(updated));
    await get().refresh();
    return updated;
  },

  deleteJob: async (id) => {
    const existing = get().jobs.find((j) => j.id === id);
    if (!existing) return;
    if (existing.status === "completed") {
      throw new Error(
        "Cannot delete a completed melt job. Please create a reversal entry instead.",
      );
    }
    await meltJobRepository.delete(id);
    await get().refresh();
  },

  completeJob: async (id) => {
    const job = get().jobs.find((j) => j.id === id);
    if (!job) throw new Error(`Melt job not found: ${id}`);
    if (job.status === "completed") throw new Error("Melt job is already completed.");
    if (job.status === "cancelled") throw new Error("Cannot complete a cancelled melt job.");

    // Recompute to ensure ledger amounts are current
    const computed = calcMeltJob({
      scrapInputGrossMg: job.scrapInputGrossMg,
      scrapInputPurity: job.scrapInputPurity,
      dustInputGrossMg: job.dustInputGrossMg,
      dustInputPurity: job.dustInputPurity,
      otherInputGrossMg: job.otherInputGrossMg,
      otherInputPurity: job.otherInputPurity,
      fineGoldRecoveredMg: job.fineGoldRecoveredMg,
    });

    const { append } = useLedger.getState();
    const ref = job.jobNo;

    // 1. Scrap input: scrap bucket decreases (going to melt)
    if (computed.scrapInputFineMg > 0) {
      await append({
        type: "melt_scrap_input",
        netFineMg: -computed.scrapInputFineMg,
        deltas: { scrap: -computed.scrapInputFineMg },
        grossMg: job.scrapInputGrossMg,
        purity: job.scrapInputPurity,
        fineMg: computed.scrapInputFineMg,
        reference: ref,
        notes: `Melt job ${job.jobNo} — scrap input${job.notes ? `: ${job.notes}` : ""}`,
      });
    }

    // 2. Dust/sweepings input: scrap bucket decreases
    if (computed.dustInputFineMg > 0) {
      await append({
        type: "melt_dust_input",
        netFineMg: -computed.dustInputFineMg,
        deltas: { scrap: -computed.dustInputFineMg },
        grossMg: job.dustInputGrossMg,
        purity: job.dustInputPurity,
        fineMg: computed.dustInputFineMg,
        reference: ref,
        notes: `Melt job ${job.jobNo} — dust/sweepings input`,
      });
    }

    // 3. Other input (also from scrap bucket)
    if (computed.otherInputFineMg > 0) {
      await append({
        type: "melt_scrap_input",
        netFineMg: -computed.otherInputFineMg,
        deltas: { scrap: -computed.otherInputFineMg },
        grossMg: job.otherInputGrossMg,
        purity: job.otherInputPurity,
        fineMg: computed.otherInputFineMg,
        reference: ref,
        notes: `Melt job ${job.jobNo} — other material input`,
      });
    }

    // 4. Fine gold recovery: vault bucket increases
    if (job.fineGoldRecoveredMg > 0) {
      await append({
        type: "melt_recovery_received",
        netFineMg: job.fineGoldRecoveredMg,
        deltas: { vault: job.fineGoldRecoveredMg },
        purity: 999,
        fineMg: job.fineGoldRecoveredMg,
        grossMg: job.fineGoldRecoveredMg,
        reference: ref,
        notes: `Melt job ${job.jobNo} — fine gold recovered${job.refineryName ? ` from ${job.refineryName}` : ""}`,
      });
    }

    // 5. Loss entry (only if there's a net loss)
    if (computed.lossFineMg > 0) {
      await append({
        type: "melt_loss",
        netFineMg: -computed.lossFineMg,
        deltas: { scrap: -computed.lossFineMg },
        fineMg: computed.lossFineMg,
        reference: ref,
        notes: `Melt job ${job.jobNo} — unrecovered loss (${(computed.recoveryPct / 100).toFixed(2)}% recovery)`,
      });
    }

    // Mark job as completed
    const completed: MeltJob = {
      ...job,
      ...computed,
      status: "completed",
      updatedAt: Date.now(),
    };
    await meltJobRepository.save(meltJobRow(completed));
    await get().refresh();
  },

  reset: () => set({ jobs: [] }),
}));
