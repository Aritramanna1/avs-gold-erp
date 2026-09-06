import { create } from "zustand";
import { type Purity } from "./gold";
import { computeFineGold, netWeightMg } from "./gold-calculation-rules";
import { currentGoldCalculationRules } from "./gold-calculation-rules-store";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { createRepository } from "./repositories/base-repository";
import { assertPeriodOpenOnline } from "./financial-lock-store";
import { useSettings } from "./settings-store";
import { useWorkflowEngine } from "./workflow-engine";
import { nextDocumentNumber } from "./document-numbering";
import { resolveFirmIdForQuery, withFirmScope } from "@/lib/firm-scoped-query";

const workerTransactionRepository = createRepository<{ id: string } & Record<string, unknown>>(
  "worker_transactions",
);

export type MaterialPurity = Purity | "none"; // none for non-gold/silver items

/** Materials a structured, order-linked Issue can post (mirrors the vault-category mapping in material-vault-sync.ts's issueMaterialToVaultCategory). */
export const WORKER_ISSUE_MATERIALS = [
  "Gold",
  "Filings / Dust",
  "KDM",
  "Ball",
  "Die",
  "Wire",
  "Finding",
  "Other",
];

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
  /** Offline Add_wt (mg) — Net = Gr − Less + Add. */
  addMg?: number;
  netMg: number;
  purity: number; // per-mille, 0 if non-gold or custom material
  /** Offline return/process tanch override (‰). When set on return, used for fine calc. */
  processPurity?: number;
  /** Offline Wstg %. */
  wastagePct?: number;
  /** Offline Hishob % (frozen display; fine may come from computeFineGold). */
  hisobPct?: number;
  /** Offline plus_fine (mg) added after base fine. */
  plusFineMg?: number;
  fineMg: number; // calculated gold weight
  quantity: number; // pieces/quantity if non-gold
  /** Offline m_rate (paise per unit / display rate). */
  labourRatePaise?: number;
  /** Offline m_cash (paise) labour paid with this line. */
  labourCashPaise?: number;
  /** Offline dg_no → dhadi_groups.id */
  dhadiGroupId?: string;
  dhadiGroupName?: string;
  /** Offline is_code / stamp label. */
  stampCode?: string;
  /** Offline tr_type label (PATLA / GAT / RAWAL / …). */
  processType?: string;
  notes: string;
  givenBy: string; // Given: staff name, Return: worker name
  receivedBy: string; // Given: worker name, Return: staff name
  type: "given" | "return" | "overloss";
  reference?: string; // Optional reference note / order name / design reference
  createdAt: number;

  // ── Over-Loss Specific Fields ───────────────────────────────────────────
  expectedGrossMg?: number;
  actualReturnedGrossMg?: number;
  overLossGrossMg?: number;
  overLossFineMg?: number;
  overLossRatePaisePerGram?: number;
  overLossValuePaise?: number;
  overLossReason?: string;
  approvalStatus?: "approved" | "pending_approval" | "rejected";
  approverId?: string;
  supportingDocUrl?: string;

  // ── Order linkage ───────────────────────────────────────────────────────
  orderId?: string;
  orderNo?: string;
  /** Stamps this entry as consumed by a Manufacturing Bill */
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
      /** When true, only write worker_transactions — caller already posted gold_ledger. */
      skipGoldLedger?: boolean;
      /** Live vault stock line id for gold issues. */
      vaultStockLineId?: string;
    },
  ) => Promise<WorkerGoldBookEntry>;
  removeEntry: (id: string) => Promise<void>;
  forOrder: (orderId: string) => WorkerGoldBookEntry[];
  /** Stamps this entry as consumed by a Manufacturing Bill */
  linkToManufacturingBill: (id: string, billId: string) => Promise<void>;
  getWorkerBalance: (workerId: string) => {
    totalGivenFine: number;
    totalReturnedFine: number;
    givenFine: number;
    returnedFine: number;
    pendingFine: number;
    totalGivenQty: number;
    totalReturnedQty: number;
    givenQty: number;
    returnedQty: number;
    pendingQty: number;
    materialBalances: WorkerMaterialBalance[];
  };
  reset: () => void;
}

function makeId(prefix = "wgb") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const WORKER_GOLD_BOOK_COMPAT_CACHE_LIMIT = 200;

export const useWorkerGoldBook = create<WorkerGoldBookState>()((set, get) => ({
  entries: [],

  refresh: async () => {
    const firmId = await resolveFirmIdForQuery();
    const rows = await workerTransactionRepository.list({
      ...withFirmScope(firmId),
      orderBy: { column: "created_at", ascending: false },
    });
    const mapped: WorkerGoldBookEntry[] = rows.map((r: any) => {
      const grossMg = Number(r.gross_mg ?? r.grossMg ?? 0);
      const lessMg = Number(r.less_mg ?? r.lessMg ?? 0);
      const addMg = r.add_mg != null || r.addMg != null ? Number(r.add_mg ?? r.addMg) : undefined;
      const netMg =
        r.net_mg != null || r.netMg != null
          ? Number(r.net_mg ?? r.netMg)
          : netWeightMg(grossMg, lessMg, addMg || 0);
      const purity = Number(r.purity ?? 0);
      const wastagePct =
        r.wastage_pct != null || r.wastagePct != null
          ? Number(r.wastage_pct ?? r.wastagePct)
          : undefined;
      const computedFine =
        purity > 0
          ? computeFineGold(
              {
                module: r.type === "given" ? "karigar_issue" : "karigar_return",
                grossMg,
                lessMg,
                addMg,
                purityPermille: Math.round(purity),
                wastagePct: wastagePct && wastagePct > 0 ? wastagePct : undefined,
              },
              currentGoldCalculationRules(),
            ).fineMg
          : 0;
      const fineMg =
        r.fine_mg != null || r.fineMg != null ? Number(r.fine_mg ?? r.fineMg) : computedFine;

      let entryType: "given" | "return" | "overloss" = "given";
      if (r.type === "return" || r.kind === "gold_book_return") {
        entryType = "return";
      } else if (r.type === "overloss" || r.kind === "gold_book_overloss") {
        entryType = "overloss";
      }

      return {
        id: String(r.id),
        entryNo: String(r.entry_no ?? r.entryNo ?? ""),
        date: String(r.date ?? new Date().toISOString().slice(0, 10)),
        time: String(r.time ?? "00:00:00"),
        workerId: String(r.worker_id ?? r.workerId ?? ""),
        workerName: String(r.worker_name ?? r.workerName ?? ""),
        particulars: String(r.particulars ?? ""),
        grossMg,
        lessMg,
        addMg,
        netMg,
        purity,
        processPurity:
          r.process_purity != null || r.processPurity != null
            ? Number(r.process_purity ?? r.processPurity)
            : undefined,
        wastagePct,
        hisobPct:
          r.hisob_pct != null || r.hisobPct != null
            ? Number(r.hisob_pct ?? r.hisobPct)
            : undefined,
        plusFineMg:
          r.plus_fine_mg != null || r.plusFineMg != null
            ? Number(r.plus_fine_mg ?? r.plusFineMg)
            : undefined,
        fineMg,
        quantity: Number(r.quantity ?? 0),
        labourRatePaise:
          r.labour_rate_paise != null || r.labourRatePaise != null
            ? Number(r.labour_rate_paise ?? r.labourRatePaise)
            : undefined,
        labourCashPaise:
          r.labour_cash_paise != null || r.labourCashPaise != null
            ? Number(r.labour_cash_paise ?? r.labourCashPaise)
            : undefined,
        dhadiGroupId: r.dhadi_group_id ?? r.dhadiGroupId,
        dhadiGroupName: r.dhadi_group_name ?? r.dhadiGroupName,
        stampCode: r.stamp_code ?? r.stampCode,
        processType: r.process_type ?? r.processType,
        notes: String(r.notes ?? ""),
        givenBy: String(r.given_by ?? r.givenBy ?? ""),
        receivedBy: String(r.received_by ?? r.receivedBy ?? ""),
        type: entryType,
        reference: r.reference ? String(r.reference) : "",
        createdAt:
          typeof r.created_at === "number"
            ? r.created_at
            : r.created_at
              ? Date.parse(r.created_at)
              : Date.now(),
        expectedGrossMg: r.expectedGrossMg,
        actualReturnedGrossMg: r.actualReturnedGrossMg,
        overLossGrossMg: r.overLossGrossMg,
        overLossFineMg: r.overLossFineMg,
        overLossRatePaisePerGram: r.overLossRatePaisePerGram,
        overLossValuePaise: r.overLossValuePaise,
        overLossReason: r.overLossReason,
        approvalStatus: r.approvalStatus,
        approverId: r.approverId,
        supportingDocUrl: r.supportingDocUrl,
        orderId: r.order_id ?? r.orderId,
        orderNo: r.order_no ?? r.orderNo,
        manufacturingBillId: r.manufacturing_bill_id ?? r.manufacturingBillId,
      };
    });
    set({ entries: mapped });
  },

  addEntry: async (input) => {
    const date = input.date || new Date().toISOString().slice(0, 10);
    const time = input.time || new Date().toTimeString().slice(0, 8);
    const entryNo = await nextDocumentNumber("gold_issue_voucher");

    const grossMg = input.grossMg || 0;
    const lessMg = input.lessMg || 0;
    const addMg = input.addMg || 0;
    const netMg = netWeightMg(grossMg, lessMg, addMg);
    const wastagePct = input.wastagePct ?? 0;
    const plusFineMg = Math.max(0, input.plusFineMg || 0);
    const purityForCalc =
      input.type === "return" && input.processPurity && input.processPurity > 0
        ? input.processPurity
        : input.purity || 0;

    // Calculate fineMg if purity is provided (> 0) via Customization karigar rules
    let fineMg = 0;
    let hisobPct: number | undefined = input.hisobPct;
    if (purityForCalc > 0) {
      const module = input.type === "given" ? "karigar_issue" : input.type === "return" ? "karigar_return" : "karigar_overloss";
      const computed = computeFineGold(
        {
          module: module as any,
          grossMg: input.type === "overloss" ? (input.overLossGrossMg || netMg) : netMg,
          lessMg,
          addMg,
          purityPermille: Math.round(purityForCalc),
          wastagePct: wastagePct > 0 ? wastagePct : undefined,
        },
        currentGoldCalculationRules(),
      );
      fineMg = computed.fineMg + plusFineMg;
      hisobPct = computed.hisobPct ?? hisobPct;
    } else if (plusFineMg > 0) {
      fineMg = plusFineMg;
    }

    if (input.type === "overloss" && input.overLossFineMg) {
      fineMg = input.overLossFineMg;
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
      addMg: addMg > 0 ? addMg : undefined,
      netMg,
      purity: input.purity || 0,
      processPurity: input.processPurity,
      wastagePct: wastagePct > 0 ? wastagePct : undefined,
      hisobPct,
      plusFineMg: plusFineMg > 0 ? plusFineMg : undefined,
      fineMg,
      quantity: input.quantity || 0,
      labourRatePaise: input.labourRatePaise,
      labourCashPaise: input.labourCashPaise,
      dhadiGroupId: input.dhadiGroupId,
      dhadiGroupName: input.dhadiGroupName,
      stampCode: input.stampCode,
      processType: input.processType,
      notes: input.notes || "",
      givenBy: input.givenBy,
      receivedBy: input.receivedBy,
      type: input.type,
      reference: input.reference || "",
      createdAt: Date.now(),
      expectedGrossMg: input.expectedGrossMg,
      actualReturnedGrossMg: input.actualReturnedGrossMg,
      overLossGrossMg: input.overLossGrossMg,
      overLossFineMg: fineMg,
      overLossRatePaisePerGram: input.overLossRatePaisePerGram,
      overLossValuePaise: input.overLossValuePaise,
      overLossReason: input.overLossReason,
      approvalStatus: input.approvalStatus || "approved",
      approverId: input.approverId,
      supportingDocUrl: input.supportingDocUrl,
      orderId: input.orderId,
      orderNo: input.orderNo,
    };

    // Financial lock check
    if (useWorkflowEngine.getState().config.financialLockEnforcementEnabled) {
      await assertPeriodOpenOnline(useSettings.getState().selectedBranchId || "MAIN", date);
    }

    if (input.type === "given" && netMg > 0) {
      const { assertMaterialIssueStock } = await import("./material-issue-stock");
      assertMaterialIssueStock(input.particulars, input.purity || 0, netMg);
    }

    if (fineMg > 0) {
      const { allowNegativeStock } = await import("./invoice-due");
      const { computeBalances, useLedger } = await import("./ledger-store");
      const ledgerEntries = useLedger.getState().entries;
      
      if (input.type === "given" && input.purity && input.purity > 0) {
        const { assertTransactionGoldIssueFromLedger } = await import(
          "./transaction-ledger-guards"
        );
        try {
          assertTransactionGoldIssueFromLedger({
            entries: ledgerEntries,
            purityPermille: input.purity,
            fineMg,
            grossMg: netMg,
            vaultStockLineId: input.vaultStockLineId,
          });
        } catch (vaultErr) {
          if (!allowNegativeStock()) throw vaultErr;
        }
      } else if (input.type === "given") {
        const vaultMg = computeBalances(ledgerEntries).buckets.vault;
        if (fineMg > vaultMg && !allowNegativeStock()) {
          throw new Error(
            `Insufficient vault stock. Requested ${fineMg} mg fine; available ${vaultMg} mg. Issue was not posted.`,
          );
        }
      }

      if (!input.skipGoldLedger) {
        if (input.type === "overloss") {
          // Overloss permanently relieves the Karigar bucket and records system loss in Gold Ledger
          await useLedger.getState().append({
            type: "overloss",
            netFineMg: -fineMg,
            deltas: { karigar: -fineMg },
            grossMg: input.overLossGrossMg || netMg,
            purity: input.purity || undefined,
            fineMg,
            reference: input.reference || entryNo,
            notes: input.notes || `Karigar Over-Loss ${entryNo}: ${input.overLossReason || ""}`,
            karigarId: input.workerId,
          });
        } else {
          await useLedger.getState().append({
            type: input.type === "given" ? "issue_to_karigar" : "receive_from_karigar",
            netFineMg: 0,
            deltas:
              input.type === "given"
                ? { vault: -fineMg, karigar: fineMg }
                : { vault: fineMg, karigar: -fineMg },
            grossMg: netMg,
            purity: input.purity || undefined,
            fineMg,
            reference: input.reference || entryNo,
            notes: input.notes || `Karigar book ${input.type} ${entryNo}`,
            karigarId: input.workerId,
          });
        }
      }
    }

    if (!input.skipGoldLedger && netMg > 0 && input.type !== "overloss") {
      const { issueMaterialToVaultCategory } = await import("./material-vault-sync");
      const { useMaterialVault } = await import("./material-vault-store");
      const { data } = await supabase.auth.getSession();
      const category = issueMaterialToVaultCategory(input.particulars);
      await useMaterialVault.getState().append({
        category,
        type: input.type === "given" ? "worker_issue" : "worker_return",
        deltaMg: input.type === "given" ? -netMg : netMg,
        grossMg: netMg,
        purity: input.purity || undefined,
        reference: input.reference || entryNo,
        remarks: input.notes || `${input.particulars} ${input.type} ${input.workerName}`,
        actorId: data.session?.user.id ?? null,
        actorEmail: data.session?.user.email ?? null,
      });
    }

    const kind = input.type === "given" ? "gold_book_given" : input.type === "return" ? "gold_book_return" : "gold_book_overloss";
    await workerTransactionRepository.save({ ...newEntry, kind });
    await get().refresh();

    // Trigger Custom Automation event
    try {
      const { useCustomAutomation } = await import("./automation/custom-automation-store");
      if (input.type === "overloss") {
        void useCustomAutomation.getState().evaluateAndExecute("KARIGAR_OVERLOSS_RECORDED" as any, {
          overLossMg: fineMg,
          karigarId: input.workerId,
          karigarName: input.workerName,
          reason: input.overLossReason,
          entryNo,
        });
      }
    } catch {
      /* ignore */
    }

    // Best-effort audit trail
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
    const entry = get().entries.find((e) => e.id === id);
    if (!entry) return;
    if (entry.fineMg > 0 && !entry.orderId) {
      const { useLedger } = await import("./ledger-store");
      const ledger = useLedger.getState();
      const related = ledger.entries.find(
        (e) =>
          (e.type === "issue_to_karigar" || e.type === "receive_from_karigar" || e.type === "overloss") &&
          (e.reference === entry.reference || e.reference === entry.entryNo) &&
          e.karigarId === entry.workerId,
      );
      if (related) {
        await ledger.reverse(related.id, `Worker gold book entry ${entry.entryNo} deleted`);
      }
    }
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
    const kind = updated.type === "given" ? "gold_book_given" : updated.type === "return" ? "gold_book_return" : "gold_book_overloss";
    await workerTransactionRepository.save({ ...updated, kind });
    set((s) => ({ entries: s.entries.map((e) => (e.id === id ? updated : e)) }));
  },

  getWorkerBalance: (workerId) => {
    const workerEntries = get().entries.filter((e) => e.workerId === workerId);

    let totalGivenFine = 0;
    let totalReturnedFine = 0;
    let totalGivenQty = 0;
    let totalReturnedQty = 0;

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
      const particulars = e.particulars || "Gold";
      const purity = Number(e.purity || 999);
      const matKey = `${particulars.toLowerCase().trim()}::${purity}`;
      if (!materialMap.has(matKey)) {
        materialMap.set(matKey, {
          material: particulars,
          purity,
          givenGross: 0,
          returnedGross: 0,
          givenFine: 0,
          returnedFine: 0,
          givenQty: 0,
          returnedQty: 0,
        });
      }

      const stats = materialMap.get(matKey)!;
      const entryGross = Number(e.grossMg ?? e.netMg ?? 0);
      const entryNet = Number(e.netMg ?? e.grossMg ?? 0);
      const entryFine = Number(e.fineMg ?? (entryNet > 0 && purity > 0 ? Math.round(entryNet * (purity / 1000)) : 0));
      const entryQty = Number(e.quantity ?? 0);

      const isGiven = e.type === "given" || (e as any).type === "issue";
      const isReturn =
        e.type === "return" ||
        (e as any).type === "returned" ||
        (e as any).type === "receive" ||
        (e as any).type === "received" ||
        e.type === "overloss";

      if (isGiven) {
        totalGivenFine += entryFine;
        totalGivenQty += entryQty;
        stats.givenGross += entryGross;
        stats.givenFine += entryFine;
        stats.givenQty += entryQty;
      } else if (isReturn) {
        totalReturnedFine += entryFine;
        totalReturnedQty += entryQty;
        stats.returnedGross += e.type === "overloss" ? (e.overLossGrossMg || entryGross) : entryGross;
        stats.returnedFine += entryFine;
        stats.returnedQty += entryQty;
      }
    }

    const materialBalances: WorkerMaterialBalance[] = Array.from(materialMap.values()).map((m) => ({
      material: m.material,
      purity: m.purity,
      givenGross: m.givenGross,
      returnedGross: m.returnedGross,
      pendingGross: m.givenGross - m.returnedGross,
      givenFine: m.givenFine,
      returnedFine: m.returnedFine,
      pendingFine: m.givenFine - m.returnedFine,
      givenQty: m.givenQty,
      returnedQty: m.returnedQty,
      pendingQty: m.givenQty - m.returnedQty,
    }));

    return {
      totalGivenFine,
      totalReturnedFine,
      givenFine: totalGivenFine,
      returnedFine: totalReturnedFine,
      pendingFine: totalGivenFine - totalReturnedFine,
      totalGivenQty,
      totalReturnedQty,
      givenQty: totalGivenQty,
      returnedQty: totalReturnedQty,
      pendingQty: totalGivenQty - totalReturnedQty,
      materialBalances,
    };
  },

  reset: () => set({ entries: [] }),
}));
