/**
 * MTJ ERP — Manufacturing Bill Store
 *
 * The Manufacturing Bill is the PRODUCTION COMPLETION DOCUMENT.
 * It is NOT a billing type inside BillingModule — it is a standalone module
 * that closes the manufacturing cycle.
 *
 * Flow:
 *   Job Card (gold_issued → work_received → qc_pending → ready_for_billing)
 *   ↓
 *   ManufacturingBill created (auto-populates from JobCard)
 *   ↓  on finalise():
 *   ├─ JobCard.status → "closed"
 *   ├─ Order.status  → "ready_for_delivery"
 *   ├─ Finished item → stock_items (if autoFinishedStock)
 *   ├─ Gold Ledger   → post entries (issued, finished, scrap, filings, loss)
 *   ├─ Worker Gold Book → post karigar settlement
 *   └─ Communication → send mfg bill PDF (via commService)
 *
 * Weights: milligrams (integers).
 * Money:   paise (integers).
 * Purity:  per-mille (0–999), tunch = purity/10 (0.0–99.9%).
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/integrations/supabase/client";
import type { JobCard, GoldIssueRecord, WorkReceiptRecord } from "./jobcards-store";
import { useWorkflowEngine } from "./workflow-engine";
import { commService } from "./comm/service";
import { useSettings } from "./settings-store";
import { createRepository } from "./repositories/base-repository";

const manufacturingBillRepository = createRepository<{ id: string } & Record<string, unknown>>(
  "manufacturing_bills",
);

// ── Data Types ───────────────────────────────────────────────────────────────

/** An additional gold top-up given to the karigar during production (P entries) */
export interface PEntry {
  id: string;
  ref: string; // P1, P2 …
  description: string;
  stamp: string; // hallmark / purity stamp e.g. "22K", "916"
  grossMg: number;
  addWtMg: number; // add weight (e.g. wire, solder)
  netMg: number; // grossMg + addWtMg
  tunchPct: number; // purity as percentage, e.g. 91.6
  wstgPct: number; // wastage percentage charged
  pcs: number;
  labourPaise: number;
  fineMg: number; // netMg × (tunchPct + wstgPct) / 100 — manufacturing formula
}

/** Gold received back from karigar (MP entries) */
export interface MpEntry {
  id: string;
  entryType: "fine" | "lagad" | "scrap" | "filings" | "dust" | "other";
  label: string; // e.g. "MP FINE", "MP LAGAD", "MP SCRAP"
  grossMg: number;
  tunchPct: number;
  pcs: number;
  fineMg: number; // grossMg × tunchPct / 100
}

export type MfgBillStatus =
  | "draft" // being edited, not yet finalised
  | "finalised" // production complete, awaiting customer delivery
  | "delivered" // customer has received the item
  | "settled"; // fully paid

export const MFG_BILL_STATUS_LABELS: Record<MfgBillStatus, string> = {
  draft: "Draft",
  finalised: "Finalised — Ready for Delivery",
  delivered: "Delivered",
  settled: "Settled",
};

export interface ManufacturingBill {
  id: string;
  billNo: string;
  createdAt: number;
  finalisedAt?: number;
  updatedAt: number;
  status: MfgBillStatus;
  branchId: string;

  // ── Links ──────────────────────────────────────────────────────────────
  jobCardId: string;
  jobNo: string;
  orderId: string;
  orderNo: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  karigarId?: string;
  karigarName?: string;

  // ── Item Description ───────────────────────────────────────────────────
  itemName: string;
  category: string;
  pcs: number;

  // ── Gold Issued (primary issue from vault) ─────────────────────────────
  goldIssuedGrossMg: number;
  goldIssuedPurity: number; // per-mille
  goldIssuedFineMg: number;
  goldIssueSlipNo: string;

  // ── Additional P Entries (top-ups given to karigar during production) ──
  pEntries: PEntry[];

  // ── Karigar Returns ────────────────────────────────────────────────────
  /** Finished jewellery returned */
  finishedGrossMg: number;
  finishedPurity: number;
  finishedFineMg: number;

  /** Scrap (runner, sprue, off-cuts) */
  scrapGrossMg: number;
  scrapPurity: number;
  scrapFineMg: number;

  /** Filings / polish dust collected */
  filingsGrossMg: number;
  filingsPurity: number;
  filingsFineMg: number;

  /** Dust / unrecovered fine (estimated) */
  dustFineMg: number;

  // ── Computed Gold Summary ──────────────────────────────────────────────
  /** Total fine gold returned = finished + scrap + filings + dust */
  totalGoldReturnedFineMg: number;
  /** Fine gold issued (vault issue + all P entries) */
  totalGoldIssuedFineMg: number;
  /** Actual wastage (loss) = issued − returned */
  actualWastageFineMg: number;
  /** Wastage as percentage of issued */
  actualWastagePct: number;

  // ── Charges ────────────────────────────────────────────────────────────────
  labourChargesPaise: number;
  stoneChargesPaise: number;
  otherChargesPaise: number;

  // ── Manufacturing Costing (Phase 2) ────────────────────────────────────────
  /** Making charges per piece in paise */
  makingChargesPaise: number;
  /** Hallmark/BIS charges in paise */
  hallmarkChargesPaise: number;
  /** Stone setting charges in paise */
  stoneSettingPaise: number;
  /** Selling price set on the bill in paise */
  sellingPricePaise: number;
  /** Net manufacturing cost = labour + making + stone + hallmark + wastage value */
  netMfgCostPaise: number;
  /** Profit margin in basis points (e.g. 1500 = 15.00%) */
  profitMarginBps: number;

  // ── Karigar Account Settlement (Ledger Balance) ───────────────────────
  /** LB — opening balance of karigar account (negative = they owe us) */
  openingBalanceMg: number;
  /** MP entries — gold received from karigar that reduces their debit */
  mpEntries: MpEntry[];
  /** Cash paid by karigar (converted to gold equivalent via bhav rate) */
  cashPaymentPaise: number;
  goldBhavRatePaise: number; // rate per gram in paise
  /** bhavGoldMg = cash / (bhavRate / 1000) * 1000 */
  bhavGoldMg: number;
  /** Closing karigar balance = openingMg − totalPFineMg + totalMpFineMg + bhavGoldMg */
  closingBalanceMg: number;

  // ── Post-Finalisation ──────────────────────────────────────────────────
  /** Stock item ID created in finished_stock table */
  finishedStockItemId?: string;
  /** Delivery Invoice ID (set when converted to customer delivery) */
  deliveryInvoiceId?: string;

  notes?: string;
}

// ── Arithmetic Helpers ───────────────────────────────────────────────────────

/** Manufacturing fine formula: Fine = Net × (Tunch% + Wstg%) / 100 */
export function calcPEntryFine(netMg: number, tunchPct: number, wstgPct: number): number {
  return Math.round((netMg * (tunchPct + wstgPct)) / 100);
}

/** Standard fine formula for MP entries: Fine = Gross × Tunch% / 100 */
export function calcMpEntryFine(grossMg: number, tunchPct: number): number {
  return Math.round((grossMg * tunchPct) / 100);
}

export function calcBhavGoldMg(cashPaise: number, bhavRatePaise: number): number {
  if (bhavRatePaise <= 0 || cashPaise <= 0) return 0;
  // bhavRate is paise per gram → cashPaise / (bhavRatePaise/1000) gives grams → ×1000 for mg
  return Math.round((cashPaise / bhavRatePaise) * 1000);
}

export function deriveClosingBalance(bill: ManufacturingBill): number {
  const totalPFine = bill.pEntries.reduce((s, e) => s + e.fineMg, 0);
  const totalMpFine = bill.mpEntries.reduce((s, e) => s + e.fineMg, 0);
  // opening − P entries (they increase debit) + MP returns + bhav cash conversion
  return bill.openingBalanceMg - totalPFine + totalMpFine + bill.bhavGoldMg;
}

/** Build a ManufacturingBill shell from an existing JobCard. */
export function buildBillFromJobCard(
  jobCard: JobCard,
  billNo: string,
  branchId: string,
): ManufacturingBill {
  const gi = jobCard.goldIssue;
  const wr = jobCard.workReceipt;

  const goldIssuedGrossMg = gi?.grossMg ?? 0;
  const goldIssuedPurity = gi?.purity ?? 916;
  const goldIssuedFineMg = gi?.fineMg ?? 0;

  const finishedGrossMg = wr?.finishedGrossMg ?? 0;
  const finishedPurity = wr?.finishedPurity ?? 916;
  const finishedFineMg = wr?.finishedFineMg ?? 0;
  const scrapGrossMg = wr?.scrapGrossMg ?? 0;
  const scrapPurity = wr?.scrapPurity ?? 300;
  const scrapFineMg = wr?.scrapFineMg ?? 0;
  const filingsGrossMg = wr?.filingsGrossMg ?? 0;
  const filingsPurity = wr?.filingsPurity ?? 250;
  const filingsFineMg = wr?.filingsFineMg ?? 0;
  const dustFineMg = wr?.dustFineMg ?? 0;

  const totalGoldReturnedFineMg = finishedFineMg + scrapFineMg + filingsFineMg + dustFineMg;
  const totalGoldIssuedFineMg = goldIssuedFineMg; // P entries added later by user
  const actualWastageFineMg = Math.max(0, totalGoldIssuedFineMg - totalGoldReturnedFineMg);
  const actualWastagePct =
    totalGoldIssuedFineMg > 0
      ? Math.round((actualWastageFineMg / totalGoldIssuedFineMg) * 10000) / 100
      : 0;

  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    billNo,
    createdAt: now,
    updatedAt: now,
    status: "draft",
    branchId,

    jobCardId: jobCard.id,
    jobNo: jobCard.jobNo,
    orderId: jobCard.orderId,
    orderNo: jobCard.orderNo,
    customerId: jobCard.customerId,
    customerName: jobCard.customerName,
    karigarId: jobCard.karigarId,
    karigarName: jobCard.karigarName,

    itemName: jobCard.itemName,
    category: jobCard.category,
    pcs: 1,

    goldIssuedGrossMg,
    goldIssuedPurity,
    goldIssuedFineMg,
    goldIssueSlipNo: gi?.slipNo ?? "",

    pEntries: [],

    finishedGrossMg,
    finishedPurity,
    finishedFineMg,
    scrapGrossMg,
    scrapPurity,
    scrapFineMg,
    filingsGrossMg,
    filingsPurity,
    filingsFineMg,
    dustFineMg,

    totalGoldReturnedFineMg,
    totalGoldIssuedFineMg,
    actualWastageFineMg,
    actualWastagePct,

    labourChargesPaise: 0,
    stoneChargesPaise: 0,
    otherChargesPaise: 0,
    makingChargesPaise: 0,
    hallmarkChargesPaise: 0,
    stoneSettingPaise: 0,
    sellingPricePaise: 0,
    netMfgCostPaise: 0,
    profitMarginBps: 0,

    openingBalanceMg: 0,
    mpEntries: [],
    cashPaymentPaise: 0,
    goldBhavRatePaise: 0,
    bhavGoldMg: 0,
    closingBalanceMg: 0,

    notes: jobCard.notes,
  };
}

// ── Store ────────────────────────────────────────────────────────────────────

interface MfgBillState {
  bills: ManufacturingBill[];
  /** Load from Supabase */
  refresh: () => Promise<void>;
  /** Save a draft or create new */
  saveBill: (bill: ManufacturingBill) => Promise<void>;
  /** Patch a specific field of a bill */
  patchBill: (id: string, diff: Partial<ManufacturingBill>) => Promise<void>;
  /** Delete a draft bill */
  deleteBill: (id: string) => Promise<void>;
  /**
   * FINALISE — the core action.
   * Cascades: close job card, update order, move to finished stock, post ledger, send comms.
   */
  finaliseBill: (
    id: string,
    opts?: { sendComm?: boolean; branchId?: string },
  ) => Promise<FinaliseResult>;
}

export interface FinaliseResult {
  ok: boolean;
  finishedStockItemId?: string;
  errors: string[];
  warnings: string[];
}

export const useMfgBills = create<MfgBillState>()(
  persist(
    (set, get) => ({
      bills: [],

      refresh: async () => {
        try {
          const { currentUserRole, selectedBranchId } = useSettings.getState();
          const GLOBAL_ROLES = ["Super Owner", "Administrator", "CEO (View Only)"];
          const bid =
            !currentUserRole || GLOBAL_ROLES.includes(currentUserRole)
              ? null
              : selectedBranchId || "MAIN";

          let q = (supabase as any)
            .from("manufacturing_bills")
            .select("*")
            .order("created_at", { ascending: false });
          if (bid) q = q.eq("branch_id", bid);

          const { data, error } = await q;
          if (error) throw error;
          if (data) {
            // Map snake_case DB columns back to camelCase
            const mapped = data.map(dbRowToBill);
            set({ bills: mapped });
          }
        } catch {
          // Graceful degradation — table may not exist yet (pre-migration)
        }
      },

      saveBill: async (bill) => {
        await manufacturingBillRepository.save(billToDbRow(bill));
        set((s) => {
          const existing = s.bills.findIndex((b) => b.id === bill.id);
          if (existing >= 0) {
            const next = [...s.bills];
            next[existing] = bill;
            return { bills: next };
          }
          return { bills: [bill, ...s.bills] };
        });
      },

      patchBill: async (id, diff) => {
        set((s) => ({
          bills: s.bills.map((b) => {
            if (b.id !== id) return b;
            const merged = { ...b, ...diff, updatedAt: Date.now() };
            // Recompute derived fields whenever relevant inputs change
            const totalPFine = merged.pEntries.reduce((s, e) => s + e.fineMg, 0);
            const totalMpFine = merged.mpEntries.reduce((s, e) => s + e.fineMg, 0);
            merged.totalGoldIssuedFineMg = merged.goldIssuedFineMg + totalPFine;
            merged.totalGoldReturnedFineMg =
              merged.finishedFineMg + merged.scrapFineMg + merged.filingsFineMg + merged.dustFineMg;
            merged.actualWastageFineMg = Math.max(
              0,
              merged.totalGoldIssuedFineMg - merged.totalGoldReturnedFineMg,
            );
            merged.actualWastagePct =
              merged.totalGoldIssuedFineMg > 0
                ? Math.round((merged.actualWastageFineMg / merged.totalGoldIssuedFineMg) * 10000) /
                  100
                : 0;
            merged.bhavGoldMg = calcBhavGoldMg(merged.cashPaymentPaise, merged.goldBhavRatePaise);
            merged.closingBalanceMg =
              merged.openingBalanceMg - totalPFine + totalMpFine + merged.bhavGoldMg;
            return merged;
          }),
        }));
        const bill = get().bills.find((b) => b.id === id);
        if (bill) {
          await manufacturingBillRepository.save(billToDbRow(bill));
        }
      },

      deleteBill: async (id) => {
        await manufacturingBillRepository.delete(id);
        set((s) => ({ bills: s.bills.filter((b) => b.id !== id) }));
      },

      finaliseBill: async (id, opts = {}) => {
        const bill = get().bills.find((b) => b.id === id);
        if (!bill) return { ok: false, errors: ["Bill not found"], warnings: [] };
        if (bill.status !== "draft") {
          return { ok: false, errors: ["Bill is already finalised"], warnings: [] };
        }

        const errors: string[] = [];
        const warnings: string[] = [];
        const wf = useWorkflowEngine.getState().config;

        // ── 1. Update Bill status ─────────────────────────────────────────
        const now = Date.now();
        const updated: ManufacturingBill = {
          ...bill,
          status: "finalised",
          finalisedAt: now,
          updatedAt: now,
        };
        await get().saveBill(updated);

        // Event-driven communication automation (Plan 1 Step 9) — no-op
        // unless "manufacturing_update" is enabled; never blocks finalisation.
        import("@/lib/comm/comm-automation")
          .then(({ emitBusinessEvent }) =>
            emitBusinessEvent("manufacturing_update", {
              branchId: updated.branchId,
              recipient: {
                name: updated.customerName,
                phone: updated.customerPhone,
                email: updated.customerEmail,
              },
              linkedId: updated.id,
              linkedType: "job",
            }),
          )
          .catch((err) => console.error("[ManufacturingBill] manufacturing_update automation failed:", err));

        // ── 2. Close Job Card ─────────────────────────────────────────────
        if (wf.autoCloseJobCard) {
          try {
            const { useJobCards } = await import("./jobcards-store");
            await useJobCards.getState().update(bill.jobCardId, {
              status: "closed",
            });
            await useJobCards.getState().appendTimeline(bill.jobCardId, {
              ts: now,
              label: "Manufacturing Bill Finalised",
              note: `Bill No: ${bill.billNo}`,
            });
          } catch (e) {
            warnings.push("Could not close Job Card automatically");
          }
        }

        // ── 3. Update Order status ────────────────────────────────────────
        if (wf.autoUpdateOrderStatus) {
          try {
            const { useOrders } = await import("./orders-store");
            await useOrders.getState().update(bill.orderId, {
              status: "ready_for_delivery",
            });
          } catch {
            warnings.push("Could not update Order status automatically");
          }
        }

        // ── 4. Move to Finished Stock ─────────────────────────────────────
        let finishedStockItemId: string | undefined;
        if (wf.finishedStockAutomatic) {
          try {
            const { useStock } = await import("./stock-store");
            const stockId = crypto.randomUUID();
            await useStock.getState().add({
              id: stockId,
              itemName: bill.itemName,
              category: bill.category,
              purity: bill.finishedPurity,
              grossMg: bill.finishedGrossMg,
              netMg: bill.finishedGrossMg,
              fineMg: bill.finishedFineMg,
              status: "available",
              location: "safe",
              linkedOrderId: bill.orderId,
              linkedJobId: bill.id,
              linkedCustomerId: bill.customerId,
              notes: `Auto-created from Manufacturing Bill ${bill.billNo}`,
            } as any);
            finishedStockItemId = stockId;
            await get().patchBill(id, { finishedStockItemId });
          } catch {
            warnings.push("Could not move item to Finished Stock automatically — add manually");
          }
        }

        // ── 5. Post Gold Ledger entries ───────────────────────────────────
        if (wf.autoPostGoldLedger) {
          try {
            await postMfgGoldLedger(updated);
          } catch {
            warnings.push("Gold ledger posting failed — post manually");
          }
        }

        // ── 6. Post Worker Gold Book ──────────────────────────────────────
        if (wf.autoPostWorkerGoldBook && bill.karigarId) {
          try {
            await postWorkerGoldBook(updated);
          } catch {
            warnings.push("Worker gold book posting failed — post manually");
          }
        }

        // ── 7. Send Communication ─────────────────────────────────────────
        const branchId = opts.branchId ?? bill.branchId;
        if ((opts.sendComm ?? wf.autoSendMfgBillComm) && bill.customerPhone) {
          try {
            await commService.sendInvoice(bill.id, branchId, "whatsapp", bill.customerName, {
              phone: bill.customerPhone,
              email: bill.customerEmail ?? undefined,
            });
          } catch {
            warnings.push("Communication send failed — send manually");
          }
        }

        return { ok: true, finishedStockItemId, errors, warnings };
      },
    }),
    { name: "mtj-mfg-bills-v1" },
  ),
);

// ── Gold Ledger Posting ───────────────────────────────────────────────────────

async function postMfgGoldLedger(bill: ManufacturingBill) {
  const entries = [
    {
      type: "mfg_gold_issued",
      fine_mg: -bill.goldIssuedFineMg, // gold left vault
      notes: `Issued to ${bill.karigarName} — ${bill.billNo}`,
    },
    {
      type: "mfg_gold_returned_finished",
      fine_mg: bill.finishedFineMg, // finished came back
      notes: `Finished from ${bill.karigarName} — ${bill.billNo}`,
    },
    bill.scrapFineMg > 0 && {
      type: "mfg_gold_scrap",
      fine_mg: bill.scrapFineMg,
      notes: `Scrap from ${bill.karigarName} — ${bill.billNo}`,
    },
    bill.filingsFineMg > 0 && {
      type: "mfg_gold_filings",
      fine_mg: bill.filingsFineMg,
      notes: `Filings from ${bill.karigarName} — ${bill.billNo}`,
    },
    bill.actualWastageFineMg > 0 && {
      type: "mfg_gold_loss",
      fine_mg: -bill.actualWastageFineMg,
      notes: `Manufacturing loss — ${bill.billNo} (${bill.actualWastagePct}%)`,
    },
  ].filter(Boolean);

  for (const entry of entries) {
    await (supabase as any).from("gold_ledger_entries").insert({
      id: crypto.randomUUID(),
      branch_id: bill.branchId,
      source_type: (entry as { type: string }).type,
      source_id: bill.id,
      fine_mg: (entry as { fine_mg: number }).fine_mg,
      notes: (entry as { notes: string }).notes,
      created_at: new Date(bill.finalisedAt ?? bill.updatedAt).toISOString(),
    });
  }
}

async function postWorkerGoldBook(bill: ManufacturingBill) {
  if (!bill.karigarId) return;
  const { useWorkerGoldBook } = await import("./worker-gold-book-store");
  const store = useWorkerGoldBook.getState();
  // Record the settlement — karigar's account is now closed out
  await store.addEntry?.({
    workerId: bill.karigarId,
    entryType: "mfg_bill_settlement",
    grossMg: bill.finishedGrossMg,
    purity: bill.finishedPurity,
    fineMg: bill.finishedFineMg,
    sourceId: bill.id,
    sourceType: "manufacturing_bill",
    notes: `Settlement — ${bill.billNo}. Closing balance: ${(bill.closingBalanceMg / 1000).toFixed(3)}g`,
  } as any);
}

// ── DB Serialisation ─────────────────────────────────────────────────────────

function billToDbRow(b: ManufacturingBill): { id: string } & Record<string, unknown> {
  return {
    id: b.id,
    bill_no: b.billNo,
    created_at: new Date(b.createdAt).toISOString(),
    finalised_at: b.finalisedAt ? new Date(b.finalisedAt).toISOString() : null,
    updated_at: new Date(b.updatedAt).toISOString(),
    status: b.status,
    branch_id: b.branchId,
    job_card_id: b.jobCardId,
    job_no: b.jobNo,
    order_id: b.orderId,
    order_no: b.orderNo,
    customer_id: b.customerId,
    customer_name: b.customerName,
    customer_phone: b.customerPhone ?? null,
    customer_email: b.customerEmail ?? null,
    karigar_id: b.karigarId ?? null,
    karigar_name: b.karigarName ?? null,
    item_name: b.itemName,
    category: b.category,
    pcs: b.pcs,
    gold_issued_gross_mg: b.goldIssuedGrossMg,
    gold_issued_purity: b.goldIssuedPurity,
    gold_issued_fine_mg: b.goldIssuedFineMg,
    gold_issue_slip_no: b.goldIssueSlipNo,
    p_entries: JSON.stringify(b.pEntries),
    finished_gross_mg: b.finishedGrossMg,
    finished_purity: b.finishedPurity,
    finished_fine_mg: b.finishedFineMg,
    scrap_gross_mg: b.scrapGrossMg,
    scrap_purity: b.scrapPurity,
    scrap_fine_mg: b.scrapFineMg,
    filings_gross_mg: b.filingsGrossMg,
    filings_purity: b.filingsPurity,
    filings_fine_mg: b.filingsFineMg,
    dust_fine_mg: b.dustFineMg,
    total_gold_returned_fine_mg: b.totalGoldReturnedFineMg,
    total_gold_issued_fine_mg: b.totalGoldIssuedFineMg,
    actual_wastage_fine_mg: b.actualWastageFineMg,
    actual_wastage_pct: b.actualWastagePct,
    labour_charges_paise: b.labourChargesPaise,
    stone_charges_paise: b.stoneChargesPaise,
    other_charges_paise: b.otherChargesPaise,
    making_charges_paise: b.makingChargesPaise,
    hallmark_charges_paise: b.hallmarkChargesPaise,
    stone_setting_paise: b.stoneSettingPaise,
    selling_price_paise: b.sellingPricePaise,
    net_mfg_cost_paise: b.netMfgCostPaise,
    profit_margin_bps: b.profitMarginBps,
    opening_balance_mg: b.openingBalanceMg,
    mp_entries: JSON.stringify(b.mpEntries),
    cash_payment_paise: b.cashPaymentPaise,
    gold_bhav_rate_paise: b.goldBhavRatePaise,
    bhav_gold_mg: b.bhavGoldMg,
    closing_balance_mg: b.closingBalanceMg,
    finished_stock_item_id: b.finishedStockItemId ?? null,
    delivery_invoice_id: b.deliveryInvoiceId ?? null,
    notes: b.notes ?? null,
  };
}

function dbRowToBill(row: Record<string, unknown>): ManufacturingBill {
  return {
    id: row.id as string,
    billNo: row.bill_no as string,
    createdAt: new Date(row.created_at as string).getTime(),
    finalisedAt: row.finalised_at ? new Date(row.finalised_at as string).getTime() : undefined,
    updatedAt: new Date(row.updated_at as string).getTime(),
    status: row.status as MfgBillStatus,
    branchId: row.branch_id as string,
    jobCardId: row.job_card_id as string,
    jobNo: row.job_no as string,
    orderId: row.order_id as string,
    orderNo: row.order_no as string,
    customerId: row.customer_id as string,
    customerName: row.customer_name as string,
    customerPhone: row.customer_phone as string | undefined,
    customerEmail: row.customer_email as string | undefined,
    karigarId: row.karigar_id as string | undefined,
    karigarName: row.karigar_name as string | undefined,
    itemName: row.item_name as string,
    category: row.category as string,
    pcs: row.pcs as number,
    goldIssuedGrossMg: row.gold_issued_gross_mg as number,
    goldIssuedPurity: row.gold_issued_purity as number,
    goldIssuedFineMg: row.gold_issued_fine_mg as number,
    goldIssueSlipNo: row.gold_issue_slip_no as string,
    pEntries: JSON.parse((row.p_entries as string) || "[]"),
    finishedGrossMg: row.finished_gross_mg as number,
    finishedPurity: row.finished_purity as number,
    finishedFineMg: row.finished_fine_mg as number,
    scrapGrossMg: row.scrap_gross_mg as number,
    scrapPurity: row.scrap_purity as number,
    scrapFineMg: row.scrap_fine_mg as number,
    filingsGrossMg: row.filings_gross_mg as number,
    filingsPurity: row.filings_purity as number,
    filingsFineMg: row.filings_fine_mg as number,
    dustFineMg: row.dust_fine_mg as number,
    totalGoldReturnedFineMg: row.total_gold_returned_fine_mg as number,
    totalGoldIssuedFineMg: row.total_gold_issued_fine_mg as number,
    actualWastageFineMg: row.actual_wastage_fine_mg as number,
    actualWastagePct: row.actual_wastage_pct as number,
    labourChargesPaise: (row.labour_charges_paise as number) ?? 0,
    stoneChargesPaise: (row.stone_charges_paise as number) ?? 0,
    otherChargesPaise: (row.other_charges_paise as number) ?? 0,
    makingChargesPaise: (row.making_charges_paise as number) ?? 0,
    hallmarkChargesPaise: (row.hallmark_charges_paise as number) ?? 0,
    stoneSettingPaise: (row.stone_setting_paise as number) ?? 0,
    sellingPricePaise: (row.selling_price_paise as number) ?? 0,
    netMfgCostPaise: (row.net_mfg_cost_paise as number) ?? 0,
    profitMarginBps: (row.profit_margin_bps as number) ?? 0,
    openingBalanceMg: row.opening_balance_mg as number,
    mpEntries: JSON.parse((row.mp_entries as string) || "[]"),
    cashPaymentPaise: row.cash_payment_paise as number,
    goldBhavRatePaise: row.gold_bhav_rate_paise as number,
    bhavGoldMg: row.bhav_gold_mg as number,
    closingBalanceMg: row.closing_balance_mg as number,
    finishedStockItemId: row.finished_stock_item_id as string | undefined,
    deliveryInvoiceId: row.delivery_invoice_id as string | undefined,
    notes: row.notes as string | undefined,
  };
}
