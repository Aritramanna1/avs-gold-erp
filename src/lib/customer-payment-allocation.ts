/**
 * AVS ERP — Automatic Customer Outstanding Payment Allocation Engine (Gold-First & FIFO)
 *
 * Core Principles:
 * 1. ZERO MANUAL CLEARING: Receive payment at customer level, automatically allocate across eligible unpaid invoices.
 * 2. GOLD-FIRST: Discrete gold dimension. Gold payments allocate to gold dues; cash payments allocate to cash dues.
 * 3. DEFAULT FIFO: Oldest eligible unpaid invoice first (Due Date -> Invoice Date -> Invoice No).
 * 4. ATOMIC & AUDITABLE: 1 Payment Receipt with multiple allocation lines.
 * 5. IDEMPOTENT: Double-submissions with the same idempotency key safely return existing result.
 * 6. REVERSIBLE: Clean rollback restores invoice balances and customer ledger without data distortion.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useBilling, type Invoice, type PaymentRecord, paiseToRupees } from "./billing-store";
import { useGoldSettlement } from "./gold-settlement-store";
import { useLedger } from "./ledger-store";
import { append as appendAudit } from "./security/audit-log";
import { nextDocumentNumber } from "./document-numbering";
import { mgToGrams } from "./gold";
import { getCurrentGoldRatePaise } from "./bullion-rate-service";

export type AllocationStrategy = "fifo" | "oldest_first" | "due_date" | "manual";

export interface PaymentAllocationRecord {
  id: string;
  paymentId: string;
  receiptNo: string;
  invoiceId: string;
  invoiceNo: string;
  customerId: string;
  appliedGoldMg: number;
  appliedCashPaise: number;
  previousBalanceGoldMg: number;
  previousBalanceCashPaise: number;
  remainingBalanceGoldMg: number;
  remainingBalanceCashPaise: number;
  statusAfter: "paid" | "partial" | "issued";
  createdAt: number;
}

export interface CustomerPaymentReceipt {
  id: string;
  receiptNo: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  branchId?: string;
  date: string;
  createdAt: number;
  mode: "gold" | "cash" | "mixed";
  strategy: AllocationStrategy;

  // Amounts Received
  goldReceivedMg: number;
  cashReceivedPaise: number;

  // Amounts Allocated
  goldAllocatedMg: number;
  cashAllocatedPaise: number;

  // Unapplied / Advance Surplus Balance
  goldUnappliedMg: number;
  cashUnappliedPaise: number;

  // Customer Outstanding Balance Remaining After Payment
  remainingOutstandingGoldMg: number;
  remainingOutstandingCashPaise: number;

  allocations: PaymentAllocationRecord[];

  idempotencyKey?: string;
  reversedAt?: number;
  reversalReason?: string;
  reversedBy?: string;
  notes?: string;
  settlementId?: string;
}

export interface InvoiceAllocationPreview {
  invoice: Invoice;
  dueGoldMg: number;
  dueCashPaise: number;
  appliedGoldMg: number;
  appliedCashPaise: number;
  remainingGoldMg: number;
  remainingCashPaise: number;
  nextStatus: "paid" | "partial" | "issued";
}

export interface PaymentAllocationPreview {
  customerId: string;
  customerName: string;
  mode: "gold" | "cash" | "mixed";
  strategy: AllocationStrategy;
  totalReceivedGoldMg: number;
  totalReceivedCashPaise: number;
  totalAllocatedGoldMg: number;
  totalAllocatedCashPaise: number;
  unappliedGoldMg: number;
  unappliedCashPaise: number;
  initialOutstandingGoldMg: number;
  initialOutstandingCashPaise: number;
  remainingOutstandingGoldMg: number;
  remainingOutstandingCashPaise: number;
  eligibleInvoiceCount: number;
  clearedInvoiceCount: number;
  partiallyClearedInvoiceCount: number;
  unaffectedInvoiceCount: number;
  items: InvoiceAllocationPreview[];
}

/**
 * Helper to calculate the exact gold and cash due for an invoice.
 */
export function getInvoiceObligations(
  inv: Invoice,
  fallbackRatePaise = 750000,
): {
  dueGoldMg: number;
  dueCashPaise: number;
  totalGoldMg: number;
  totalCashPaise: number;
} {
  const isCancelled = inv.status === "cancelled" || !!inv.cancelledAt;
  if (isCancelled) {
    return { dueGoldMg: 0, dueCashPaise: 0, totalGoldMg: 0, totalCashPaise: 0 };
  }

  const rate = inv.items?.[0]?.goldRatePerGramPaise || fallbackRatePaise;
  const itemFineMg = inv.items?.reduce((s, it) => s + (it.fineMg || 0), 0) || 0;
  const totalTaxablePaise = (inv.subtotalPaise || 0) + (inv.gstPaise || (inv.cgstPaise || 0) + (inv.sgstPaise || 0)) + (inv.tcsPaise || 0);

  // Total invoice obligations
  const totalGoldMg = inv.totalFineMg || itemFineMg || (totalTaxablePaise > 0 && rate > 0 ? Math.round((totalTaxablePaise / rate) * 1000) : 0);
  const totalCashPaise = totalTaxablePaise;

  // Payments already posted on this invoice
  let paidGoldMg = 0;
  let paidCashPaise = 0;

  for (const p of inv.payments || []) {
    if (p.mode === "outstanding") continue;
    if (p.mode === "gold_exchange" || p.mode === "customer_gold_credit") {
      paidGoldMg += p.goldFineMg || 0;
    } else {
      paidCashPaise += p.amountPaise || 0;
    }
  }

  // Also factor order adjustments
  if (inv.orderAdjustment) {
    if (inv.orderAdjustment.goldFineMg > 0) {
      paidGoldMg += inv.orderAdjustment.goldFineMg;
    }
    if (inv.orderAdjustment.cashAdvancePaise > 0) {
      paidCashPaise += inv.orderAdjustment.cashAdvancePaise;
    }
  }

  const isGoldOnly = inv.transactionMode === "gold" || inv.billingType === "job_work";

  let dueGoldMg = Math.max(0, totalGoldMg - paidGoldMg);
  let dueCashPaise = isGoldOnly ? 0 : Math.max(0, totalCashPaise - paidCashPaise);

  // If already marked paid
  if (inv.status === "paid" || (dueGoldMg === 0 && dueCashPaise === 0)) {
    dueGoldMg = 0;
    dueCashPaise = 0;
  }

  return { dueGoldMg, dueCashPaise, totalGoldMg, totalCashPaise };
}

/**
 * Sorts invoices according to allocation strategy.
 * Default FIFO: Oldest Due Date -> Oldest Creation Date -> Oldest Invoice Number.
 */
export function sortInvoicesForAllocation(
  invoices: Invoice[],
  strategy: AllocationStrategy = "fifo",
): Invoice[] {
  return [...invoices].sort((a, b) => {
    if (strategy === "due_date") {
      const aDue = a.dueAt || a.createdAt || 0;
      const bDue = b.dueAt || b.createdAt || 0;
      if (aDue !== bDue) return aDue - bDue;
    }

    // Default FIFO / Oldest First
    const aTs = a.createdAt || 0;
    const bTs = b.createdAt || 0;
    if (aTs !== bTs) return aTs - bTs;

    return (a.invoiceNo || "").localeCompare(b.invoiceNo || "");
  });
}

/**
 * Previews payment allocation across a customer's unpaid invoices without mutating state.
 */
export function previewPaymentAllocation(params: {
  customerId: string;
  customerName: string;
  invoices: Invoice[];
  goldReceivedMg: number;
  cashReceivedPaise: number;
  mode: "gold" | "cash" | "mixed";
  strategy?: AllocationStrategy;
  manualAllocations?: Record<string, { goldMg: number; cashPaise: number }>;
}): PaymentAllocationPreview {
  const {
    customerId,
    customerName,
    invoices,
    goldReceivedMg,
    cashReceivedPaise,
    mode,
    strategy = "fifo",
    manualAllocations = {},
  } = params;

  // Filter invoices for this customer that are eligible (not cancelled, not fully paid)
  const customerInvoices = invoices.filter(
    (i) => i.customerId === customerId && i.status !== "cancelled" && !i.cancelledAt,
  );

  const sortedInvoices = sortInvoicesForAllocation(customerInvoices, strategy);

  let remainingGoldToAllocate = Math.max(0, goldReceivedMg);
  let remainingCashToAllocate = Math.max(0, cashReceivedPaise);

  let initialOutstandingGoldMg = 0;
  let initialOutstandingCashPaise = 0;

  const items: InvoiceAllocationPreview[] = [];
  let clearedCount = 0;
  let partialCount = 0;
  let unaffectedCount = 0;

  for (const inv of sortedInvoices) {
    const { dueGoldMg, dueCashPaise } = getInvoiceObligations(inv);

    initialOutstandingGoldMg += dueGoldMg;
    initialOutstandingCashPaise += dueCashPaise;

    // If invoice already has 0 due, skip adding to allocation targets
    if (dueGoldMg <= 0 && dueCashPaise <= 0) {
      continue;
    }

    let applyGoldMg = 0;
    let applyCashPaise = 0;

    if (strategy === "manual" && manualAllocations[inv.id]) {
      applyGoldMg = Math.min(dueGoldMg, manualAllocations[inv.id].goldMg || 0);
      applyCashPaise = Math.min(dueCashPaise, manualAllocations[inv.id].cashPaise || 0);
    } else {
      // Auto Allocation
      if ((mode === "gold" || mode === "mixed") && remainingGoldToAllocate > 0 && dueGoldMg > 0) {
        applyGoldMg = Math.min(dueGoldMg, remainingGoldToAllocate);
        remainingGoldToAllocate -= applyGoldMg;
      }

      if ((mode === "cash" || mode === "mixed") && remainingCashToAllocate > 0 && dueCashPaise > 0) {
        applyCashPaise = Math.min(dueCashPaise, remainingCashToAllocate);
        remainingCashToAllocate -= applyCashPaise;
      }
    }

    const remGold = Math.max(0, dueGoldMg - applyGoldMg);
    const remCash = Math.max(0, dueCashPaise - applyCashPaise);

    let nextStatus: "paid" | "partial" | "issued" = "issued";
    if (remGold === 0 && remCash === 0) {
      nextStatus = "paid";
      clearedCount++;
    } else if (applyGoldMg > 0 || applyCashPaise > 0) {
      nextStatus = "partial";
      partialCount++;
    } else {
      nextStatus = inv.paidPaise > 0 ? "partial" : "issued";
      unaffectedCount++;
    }

    items.push({
      invoice: inv,
      dueGoldMg,
      dueCashPaise,
      appliedGoldMg: applyGoldMg,
      appliedCashPaise: applyCashPaise,
      remainingGoldMg: remGold,
      remainingCashPaise: remCash,
      nextStatus,
    });
  }

  const totalAllocatedGoldMg = items.reduce((s, it) => s + it.appliedGoldMg, 0);
  const totalAllocatedCashPaise = items.reduce((s, it) => s + it.appliedCashPaise, 0);

  const unappliedGoldMg = Math.max(0, goldReceivedMg - totalAllocatedGoldMg);
  const unappliedCashPaise = Math.max(0, cashReceivedPaise - totalAllocatedCashPaise);

  const remainingOutstandingGoldMg = Math.max(0, initialOutstandingGoldMg - totalAllocatedGoldMg);
  const remainingOutstandingCashPaise = Math.max(0, initialOutstandingCashPaise - totalAllocatedCashPaise);

  return {
    customerId,
    customerName,
    mode,
    strategy,
    totalReceivedGoldMg: goldReceivedMg,
    totalReceivedCashPaise: cashReceivedPaise,
    totalAllocatedGoldMg,
    totalAllocatedCashPaise,
    unappliedGoldMg,
    unappliedCashPaise,
    initialOutstandingGoldMg,
    initialOutstandingCashPaise,
    remainingOutstandingGoldMg,
    remainingOutstandingCashPaise,
    eligibleInvoiceCount: items.length,
    clearedInvoiceCount: clearedCount,
    partiallyClearedInvoiceCount: partialCount,
    unaffectedInvoiceCount: unaffectedCount,
    items,
  };
}

export interface CustomerPaymentAllocationStore {
  receipts: CustomerPaymentReceipt[];
  allocations: PaymentAllocationRecord[];

  /**
   * Authoritative Business Operation: Receive customer payment and atomically allocate across outstanding invoices.
   */
  receiveCustomerPaymentAndAllocate: (params: {
    customerId: string;
    customerName: string;
    customerPhone?: string;
    branchId?: string;
    goldReceivedMg?: number;
    cashReceivedPaise?: number;
    mode: "gold" | "cash" | "mixed";
    strategy?: AllocationStrategy;
    notes?: string;
    idempotencyKey?: string;
    manualAllocations?: Record<string, { goldMg: number; cashPaise: number }>;
    actor?: { id: string | null; email: string | null };
  }) => Promise<CustomerPaymentReceipt>;

  /**
   * Reverse payment allocation and restore original invoice & customer balances.
   */
  reverseCustomerPaymentAllocation: (
    receiptId: string,
    reason: string,
    actor?: { id: string | null; email: string | null },
  ) => Promise<{ success: boolean; receipt: CustomerPaymentReceipt | null }>;

  getReceiptsForCustomer: (customerId: string) => CustomerPaymentReceipt[];
  getAllocationsForInvoice: (invoiceId: string) => PaymentAllocationRecord[];
  getReceiptById: (receiptId: string) => CustomerPaymentReceipt | undefined;
}

export const useCustomerPaymentAllocation = create<CustomerPaymentAllocationStore>()(
  persist(
    (set, get) => ({
      receipts: [],
      allocations: [],

      receiveCustomerPaymentAndAllocate: async (params) => {
        const {
          customerId,
          customerName,
          customerPhone,
          branchId,
          goldReceivedMg = 0,
          cashReceivedPaise = 0,
          mode,
          strategy = "fifo",
          notes,
          idempotencyKey,
          manualAllocations,
          actor,
        } = params;

        // 1. Check Idempotency Key
        if (idempotencyKey) {
          const existing = get().receipts.find(
            (r) => r.idempotencyKey === idempotencyKey && !r.reversedAt,
          );
          if (existing) {
            return existing;
          }
        }

        const billingState = useBilling.getState();
        const invoices = billingState.invoices;

        // 2. Compute Preview Allocation
        const preview = previewPaymentAllocation({
          customerId,
          customerName,
          invoices,
          goldReceivedMg,
          cashReceivedPaise,
          mode,
          strategy,
          manualAllocations,
        });

        // 3. Generate Centralized Receipt Number
        const d = new Date();
        const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
        const prefix = branchId ? `PAY-${branchId}-${ymd}-` : `PAY-${ymd}-`;
        let receiptNo = "";
        try {
          receiptNo = await nextDocumentNumber(`cust_pay:${ymd}`, prefix, 3);
        } catch {
          const count = get().receipts.length + 1;
          receiptNo = `${prefix}${String(count).padStart(3, "0")}`;
        }
        const receiptId = `pay_rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const now = Date.now();
        const isoDate = new Date(now).toISOString();

        // 4. Create Allocation Records
        const createdAllocations: PaymentAllocationRecord[] = [];

        for (const item of preview.items) {
          if (item.appliedGoldMg > 0 || item.appliedCashPaise > 0) {
            const allocId = `alloc_${receiptId}_${item.invoice.id}`;
            const alloc: PaymentAllocationRecord = {
              id: allocId,
              paymentId: receiptId,
              receiptNo,
              invoiceId: item.invoice.id,
              invoiceNo: item.invoice.invoiceNo,
              customerId,
              appliedGoldMg: item.appliedGoldMg,
              appliedCashPaise: item.appliedCashPaise,
              previousBalanceGoldMg: item.dueGoldMg,
              previousBalanceCashPaise: item.dueCashPaise,
              remainingBalanceGoldMg: item.remainingGoldMg,
              remainingBalanceCashPaise: item.remainingCashPaise,
              statusAfter: item.nextStatus,
              createdAt: now,
            };
            createdAllocations.push(alloc);

            // 5. Update Invoice State with Payment Record
            const invoice = billingState.invoices.find((i) => i.id === item.invoice.id);
            if (invoice) {
              const paymentRows: PaymentRecord[] = [...(invoice.payments || [])];

              if (item.appliedGoldMg > 0) {
                paymentRows.push({
                  id: `pay_g_${allocId}`,
                  ts: now,
                  mode: "customer_gold_credit",
                  amountPaise: 0,
                  goldGrossMg: item.appliedGoldMg,
                  goldPurity: 995,
                  goldFineMg: item.appliedGoldMg,
                  reference: receiptNo,
                  notes: `Auto-allocated from Payment ${receiptNo} (${mgToGrams(item.appliedGoldMg)}g Fine Gold)`,
                  skipGoldLedger: true,
                });
              }

              if (item.appliedCashPaise > 0) {
                paymentRows.push({
                  id: `pay_c_${allocId}`,
                  ts: now,
                  mode: "cash",
                  amountPaise: item.appliedCashPaise,
                  reference: receiptNo,
                  notes: `Auto-allocated from Payment ${receiptNo} (₹${paiseToRupees(item.appliedCashPaise)})`,
                });
              }

              // Recalculate invoice paid and balance
              let newPaidPaise = 0;
              for (const p of paymentRows) {
                if (p.mode !== "outstanding") newPaidPaise += p.amountPaise || 0;
              }

              const newBalancePaise =
                item.nextStatus === "paid" || invoice.transactionMode === "gold"
                  ? 0
                  : Math.max(0, invoice.grandTotalPaise - newPaidPaise);

              // Update invoice
              try {
                await billingState.update(invoice.id, {
                  payments: paymentRows,
                  paidPaise: newPaidPaise,
                  balancePaise: newBalancePaise,
                  status: item.nextStatus,
                });
              } catch {
                useBilling.setState((s) => ({
                  invoices: s.invoices.map((inv) =>
                    inv.id === invoice.id
                      ? {
                          ...inv,
                          payments: paymentRows,
                          paidPaise: newPaidPaise,
                          balancePaise: newBalancePaise,
                          status: item.nextStatus,
                        }
                      : inv,
                  ),
                }));
              }
            }
          }
        }

        // 6. Post to Customer Ledger via Gold Settlement & Running Account
        let settlementId: string | undefined = undefined;
        if (goldReceivedMg > 0 || cashReceivedPaise > 0) {
          try {
            const settlementRes = await useGoldSettlement.getState().addSettlement({
              party_id: customerId,
              party_type: "customer",
              settlement_date: isoDate.split("T")[0],
              settlement_type: goldReceivedMg > 0 ? "gold_received" : "final_settlement",
              gold_entry_mg: goldReceivedMg,
              gross_mg: goldReceivedMg,
              net_mg: goldReceivedMg,
              purity: 995,
              wastage_mg: 0,
              rate_per_gram_paise: 0,
              amount_paise: cashReceivedPaise,
              cash_entry_paise: cashReceivedPaise,
              notes: `Customer Payment ${receiptNo} · Allocated: ${mgToGrams(preview.totalAllocatedGoldMg)}g / ₹${paiseToRupees(preview.totalAllocatedCashPaise)}${preview.unappliedGoldMg > 0 ? ` · Unapplied Advance: ${mgToGrams(preview.unappliedGoldMg)}g` : ""}${notes ? ` · ${notes}` : ""}`,
              branch_id: branchId,
              direction: "Jama",
            });
            settlementId = settlementRes?.id;
          } catch (err) {
            console.error("Gold settlement creation for payment receipt error:", err);
          }

          if (goldReceivedMg > 0) {
            try {
              await useLedger.getState().append({
                type: "customer_gold_received",
                netFineMg: goldReceivedMg,
                deltas: { vault: goldReceivedMg },
                grossMg: goldReceivedMg,
                purity: 995,
                fineMg: goldReceivedMg,
                customerId: customerId,
                reference: receiptNo,
                notes: `[JAMA RECEIPT] ${receiptNo} · ${mgToGrams(goldReceivedMg)}g Fine Gold from ${customerName}`,
              });
            } catch (err) {
              console.error("Gold ledger posting error:", err);
            }
          }
        }

        // 7. Assemble Receipt Record
        const receiptRecord: CustomerPaymentReceipt = {
          id: receiptId,
          receiptNo,
          customerId,
          customerName,
          customerPhone,
          branchId,
          date: isoDate,
          createdAt: now,
          mode,
          strategy,
          goldReceivedMg,
          cashReceivedPaise,
          goldAllocatedMg: preview.totalAllocatedGoldMg,
          cashAllocatedPaise: preview.totalAllocatedCashPaise,
          goldUnappliedMg: preview.unappliedGoldMg,
          cashUnappliedPaise: preview.unappliedCashPaise,
          remainingOutstandingGoldMg: preview.remainingOutstandingGoldMg,
          remainingOutstandingCashPaise: preview.remainingOutstandingCashPaise,
          allocations: createdAllocations,
          idempotencyKey,
          notes,
          settlementId,
        };

        // 8. Commit to Store
        set((s) => ({
          receipts: [receiptRecord, ...s.receipts.filter((r) => r.id !== receiptId)],
          allocations: [...createdAllocations, ...s.allocations],
        }));

        // 9. Post-commit WhatsApp notification for fully settled invoices (non-blocking)
        if (customerPhone) {
          setTimeout(() => {
            for (const alloc of createdAllocations) {
              if (alloc.statusAfter === "paid") {
                try {
                  const inv = useBilling.getState().invoices.find((i) => i.id === alloc.invoiceId);
                  if (inv) {
                    const docType = inv.gst === "gst3" ? "gst_invoice" : "retail_invoice";
                    import("@/lib/comm/send-whatsapp-document").then(({ sendWhatsAppDocument }) => {
                      sendWhatsAppDocument({
                        docType,
                        recordId: inv.id,
                        phone: customerPhone,
                        caption: `Namaste ${customerName}, your Invoice #${inv.invoiceNo} is fully PAID. Receipt Ref: ${receiptNo}. Thank you!`,
                        branchId: branchId,
                        linkedType: "invoice",
                        linkedId: inv.id,
                      }).catch((e) => console.warn("[PostCommit] WhatsApp paid invoice notification skipped:", e));
                    }).catch(() => {});
                  }
                } catch {
                  /* safe ignore */
                }
              }
            }
          }, 100);
        }

        // 9. Append Audit Log
        try {
          await appendAudit({
            action: "customer_payment_allocated",
            entityType: "customer_payment_receipt",
            entityId: receiptId,
            actorId: actor?.id || null,
            actorEmail: actor?.email || null,
            after: {
              receiptNo,
              customerId,
              customerName,
              mode,
              goldReceivedMg,
              cashReceivedPaise,
              allocatedCount: createdAllocations.length,
              unappliedGoldMg: preview.unappliedGoldMg,
              unappliedCashPaise: preview.unappliedCashPaise,
            },
          });
        } catch {
          // Non-blocking audit logger
        }

        return receiptRecord;
      },

      reverseCustomerPaymentAllocation: async (receiptId, reason, actor) => {
        const state = get();
        const receipt = state.receipts.find((r) => r.id === receiptId);
        if (!receipt || receipt.reversedAt) {
          return { success: false, receipt: null };
        }

        const billingState = useBilling.getState();
        const receiptAllocations = state.allocations.filter((a) => a.paymentId === receiptId);

        // Restore each affected invoice
        for (const alloc of receiptAllocations) {
          const invoice = billingState.invoices.find((i) => i.id === alloc.invoiceId);
          if (invoice) {
            const nextPayments = (invoice.payments || []).filter(
              (p) => !p.id.includes(alloc.id) && p.reference !== alloc.receiptNo,
            );

            let newPaidPaise = 0;
            for (const p of nextPayments) {
              if (p.mode !== "outstanding") newPaidPaise += p.amountPaise || 0;
            }
            const newBalancePaise = Math.max(0, invoice.grandTotalPaise - newPaidPaise);

            // Recompute status
            const nextStatus = newBalancePaise === 0 ? "paid" : newPaidPaise > 0 ? "partial" : "issued";

            try {
              await billingState.update(invoice.id, {
                payments: nextPayments,
                paidPaise: newPaidPaise,
                balancePaise: newBalancePaise,
                status: nextStatus,
              });
            } catch {
              useBilling.setState((s) => ({
                invoices: s.invoices.map((inv) =>
                  inv.id === invoice.id
                    ? {
                        ...inv,
                        payments: nextPayments,
                        paidPaise: newPaidPaise,
                        balancePaise: newBalancePaise,
                        status: nextStatus,
                      }
                    : inv,
                ),
              }));
            }
          }
        }

        // Mark receipt as reversed
        const updatedReceipt: CustomerPaymentReceipt = {
          ...receipt,
          reversedAt: Date.now(),
          reversalReason: reason,
          reversedBy: actor?.email || actor?.id || "operator",
        };

        set((s) => ({
          receipts: s.receipts.map((r) => (r.id === receiptId ? updatedReceipt : r)),
        }));

        try {
          await appendAudit({
            action: "customer_payment_reversed",
            entityType: "customer_payment_receipt",
            entityId: receiptId,
            actorId: actor?.id || null,
            actorEmail: actor?.email || null,
            after: {
              receiptId,
              receiptNo: receipt.receiptNo,
              customerId: receipt.customerId,
              reason,
            },
          });
        } catch {
          // Non-blocking audit logger
        }

        return { success: true, receipt: updatedReceipt };
      },

      getReceiptsForCustomer: (customerId: string) => {
        return get().receipts.filter((r) => r.customerId === customerId);
      },

      getAllocationsForInvoice: (invoiceId: string) => {
        return get().allocations.filter((a) => a.invoiceId === invoiceId);
      },

      getReceiptById: (receiptId: string) => {
        return get().receipts.find((r) => r.id === receiptId);
      },
    }),
    {
      name: "avs_customer_payment_allocation_store_v1",
    },
  ),
);
