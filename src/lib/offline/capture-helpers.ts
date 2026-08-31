/**
 * High-level offline capture helpers for mobile UI.
 * Payloads match the online store/RPC shapes. Gold Vault is never posted locally.
 */
import { enqueueOfflinePhoto } from "./queue";
import { executeOrEnqueue } from "./execute-or-enqueue";
import { usePeople, type PersonType } from "@/lib/people-store";
import { useOrders } from "@/lib/orders-store";
import { useExpensesStore, type ExpenseRecord } from "@/lib/expenses-store";
import { useStock } from "@/lib/stock-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { useLedger } from "@/lib/ledger-store";
import { useBilling } from "@/lib/billing-store";
import { useRepairs } from "@/lib/repair-store";
import { useCatalog } from "@/lib/catalog-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { useSupplierPurchases } from "@/lib/supplier-purchases-store";
import { useStockTransfers } from "@/lib/stock-transfer-store";
import { useWorkers } from "@/lib/workers-store";
import { useMeltStore } from "@/lib/melt-store";
import { fineGoldMg } from "@/lib/gold";
import { postUniversalTransaction } from "@/lib/transaction-types-store";

export async function capturePartyCreate(
  input: Record<string, unknown> & {
    fullName: string;
    phone: string;
    type?: PersonType;
    active?: boolean;
  },
) {
  const type = (input.type as PersonType) ?? "customer";
  const result = await executeOrEnqueue(
    "party.create",
    async () =>
      usePeople.getState().add({
        ...input,
        type,
        active: input.active !== false,
      } as never),
    {
      title: `New ${type}`,
      summary: `${input.fullName} · ${input.phone}`,
      payload: { ...input, type },
    },
  );
  if (result.mode === "queued") {
    const id = result.operation.localId;
    usePeople.setState((s) => ({
      people: [
        {
          ...(input as object),
          id,
          type,
          active: input.active !== false,
          fullName: input.fullName,
          phone: input.phone,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          docs: {},
        } as never,
        ...s.people.filter((p) => p.id !== id),
      ],
    }));
  }
  return result;
}

export async function captureExpenseCreate(input: Omit<ExpenseRecord, "id">) {
  return executeOrEnqueue("expense.create", async () => useExpensesStore.getState().addExpense(input), {
    title: "New expense",
    summary: `${input.category} · ₹${(input.amountPaise / 100).toLocaleString("en-IN")}`,
    payload: { ...input },
  });
}

export async function captureOrderCreate(input: {
  customerId: string;
  customerLocalId?: string;
  order: Omit<Parameters<ReturnType<typeof useOrders.getState>["add"]>[0], "orderNo"> & {
    orderNo?: string;
  };
  goldReceived?: {
    netFineMg: number;
    goldGrossMg: number;
    goldPurity: number;
    goldFineMg: number;
    customerName?: string;
  };
}) {
  const customerId = input.customerLocalId ? `local:${input.customerLocalId}` : input.customerId;

  return executeOrEnqueue(
    "order.create",
    async () => {
      let ledgerEntryId: string | undefined;
      if (input.goldReceived && input.goldReceived.goldGrossMg > 0) {
        const entry = await useLedger.getState().append({
          type: "customer_gold_received",
          netFineMg: input.goldReceived.goldFineMg + input.goldReceived.goldFineMg,
          deltas: {
            vault: input.goldReceived.goldFineMg,
            customer: input.goldReceived.goldFineMg,
          },
          grossMg: input.goldReceived.goldGrossMg,
          purity: input.goldReceived.goldPurity,
          fineMg: input.goldReceived.goldFineMg,
          form: "old_gold",
          reference: "Order (pending)",
          notes: `Gold received from ${input.goldReceived.customerName ?? "customer"} at order creation`,
          customerId: input.customerId,
        });
        ledgerEntryId = entry.id;
      }
      return useOrders.getState().add({
        ...input.order,
        customerId: input.customerId,
        advance: {
          ...input.order.advance,
          goldLedgerEntryId: ledgerEntryId ?? input.order.advance?.goldLedgerEntryId,
        },
      } as Parameters<ReturnType<typeof useOrders.getState>["add"]>[0]);
    },
    {
      title: "New order",
      summary: customerId,
      payload: {
        customerId,
        order: input.order,
        goldReceived: input.goldReceived ?? null,
      },
      dependsOnLocalIds: input.customerLocalId ? [input.customerLocalId] : [],
    },
  );
}

/** @deprecated Prefer captureOrderCreate — kept for queued drafts already in the outbox. */
export async function captureOrderDraft(input: {
  customerId: string;
  customerLocalId?: string;
  designName: string;
  qty?: number;
  purity?: number;
  estimatedGrossMg?: number;
}) {
  const customerId = input.customerLocalId ? `local:${input.customerLocalId}` : input.customerId;

  return executeOrEnqueue(
    "order.draft",
    async () => {
      const designName = input.designName;
      const qty = Math.max(1, input.qty ?? 1);
      const grossMg = input.estimatedGrossMg ?? 0;
      const purity = input.purity ?? 916;
      const fineMg = fineGoldMg(grossMg, purity);
      return useOrders.getState().add(
        {
          type: "custom",
          status: "draft",
          customerId: input.customerId,
          priority: "normal",
          source: "manual",
          design: { notes: designName, pattern: designName },
          advance: { cashPaise: 0, goldGrossMg: 0, goldFineMg: 0 },
          items: [
            {
              lineId: crypto.randomUUID(),
              itemName: designName,
              category: "other",
              quantity: qty,
              metal: "gold",
              metalColor: "yellow",
              purity,
              grossMg,
              lessMg: 0,
              netMg: grossMg,
              fineMg,
              expectedWastagePct: 0,
              expectedWastageMg: 0,
            },
          ],
        },
        { silent: true },
      );
    },
    {
      title: "Order draft",
      summary: `${input.designName} · ${customerId.slice(0, 8)}`,
      payload: {
        customerId,
        designName: input.designName,
        qty: input.qty ?? 1,
        purity: input.purity ?? 916,
        estimatedGrossMg: input.estimatedGrossMg ?? 0,
      },
      dependsOnLocalIds: input.customerLocalId ? [input.customerLocalId] : [],
    },
  );
}

export async function captureStockCreate(input: {
  item: Parameters<ReturnType<typeof useStock.getState>["addReadyStock"]>[0];
  source: Parameters<ReturnType<typeof useStock.getState>["addReadyStock"]>[1];
}) {
  return executeOrEnqueue(
    "stock.create",
    async () => useStock.getState().addReadyStock(input.item, input.source),
    {
      title: "Ready stock",
      summary: input.item.itemName,
      payload: { item: input.item, source: input.source },
    },
  );
}

export async function captureGoldBookEntry(
  input: Parameters<ReturnType<typeof useWorkerGoldBook.getState>["addEntry"]>[0],
) {
  const action = input.type === "given" ? "issue.gold" : "receive.gold";
  return executeOrEnqueue(
    action,
    async () => useWorkerGoldBook.getState().addEntry(input),
    {
      title: input.type === "given" ? "Gold issue" : "Gold receive",
      summary: `${input.workerName} · ${input.particulars}`,
      payload: { kind: "gold_book", entry: input },
    },
  );
}

export async function captureEntityPhotoOffline(opts: {
  entityType: string;
  entityId: string;
  fileName: string;
  mimeType: string;
  bytes: ArrayBuffer;
  dependsOnLocalIds?: string[];
  docKey?: string;
}) {
  return enqueueOfflinePhoto({
    fileName: opts.fileName,
    mimeType: opts.mimeType,
    bytes: opts.bytes,
    title: `${opts.entityType} photo — Pending Sync`,
    dependsOnLocalIds: opts.dependsOnLocalIds,
    linkedPayload: {
      entityType: opts.entityType,
      entityId: opts.entityId,
      docKey: opts.docKey ?? `photo_${Date.now()}`,
    },
  });
}

export async function captureStockPhotoOffline(opts: {
  stockId: string;
  fileName: string;
  mimeType: string;
  bytes: ArrayBuffer;
}) {
  const local = opts.stockId.startsWith("local:") ? opts.stockId.slice(6) : undefined;
  return captureEntityPhotoOffline({
    entityType: "stock",
    entityId: opts.stockId,
    fileName: opts.fileName,
    mimeType: opts.mimeType,
    bytes: opts.bytes,
    dependsOnLocalIds: local ? [local] : undefined,
  });
}

/** Queue a gold/accounting capture that must remain Pending Server Validation. */
export async function captureGoldPendingValidation(input: {
  action: string;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
}) {
  const { enqueueOfflineOperation } = await import("./queue");
  return enqueueOfflineOperation({
    action: input.action,
    title: input.title,
    summary: input.summary,
    payload: input.payload,
    capability: "OFFLINE_CAPTURE_THEN_VALIDATE",
  });
}

export async function capturePartyUpdate(id: string, patch: Record<string, unknown>) {
  const result = await executeOrEnqueue(
    "party.update",
    async () => usePeople.getState().update(id, patch as never),
    {
      title: "Update party",
      summary: String(patch.fullName || id),
      payload: { id, patch },
    },
  );
  if (result.mode === "queued") {
    usePeople.setState((s) => ({
      people: s.people.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)),
    }));
  }
  return result;
}

export async function captureInvoiceCreate(input: Record<string, unknown>) {
  const result = await executeOrEnqueue(
    "invoice.create",
    async () => {
      throw new Error("invoice.create online path must run in BillingModule");
    },
    {
      title: "New invoice",
      summary: String(input.customerName || input.customerId || "Invoice"),
      payload: input,
    },
  );
  if (result.mode === "queued") {
    const id = result.operation.localId;
    const { useBilling } = await import("@/lib/billing-store");
    useBilling.setState((s) => ({
      invoices: [
        {
          id,
          invoiceNo: `PENDING-${id.slice(0, 8).toUpperCase()}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: "draft",
          billingType: input.billingType as never,
          customerId: String(input.customerId || ""),
          customerName: String(input.customerName || ""),
          customerPhone: input.customerPhone ? String(input.customerPhone) : undefined,
          items: (input.items as never) ?? [],
          gst: (input.gst as never) ?? "none",
          cgstPaise: Number(input.cgstPaise || 0),
          sgstPaise: Number(input.sgstPaise || 0),
          gstPaise: Number(input.gstPaise || 0),
          tcsPaise: Number(input.tcsPaise || 0),
          subtotalPaise: Number(input.subtotalPaise || 0),
          adjustmentPaise: Number(input.adjustmentPaise || 0),
          grandTotalPaise: Number(input.grandTotalPaise || 0),
          paidPaise: Number(input.paidPaise || 0),
          balancePaise: Number(input.balancePaise || 0),
          payments: (input.payments as never) ?? [],
          notes: "Pending Sync — legal number and gold post on reconnect",
        },
        ...s.invoices.filter((row) => row.id !== id),
      ],
    }));
  }
  return result;
}

export async function captureInvoicePayment(
  invoiceId: string,
  payment: Record<string, unknown>,
) {
  return executeOrEnqueue(
    "invoice.payment",
    async () => useBilling.getState().addPayment(invoiceId, payment as never),
    {
      title: "Invoice payment",
      summary: invoiceId,
      payload: { invoiceId, payment },
    },
  );
}

export async function captureRepairCreate(input: Record<string, unknown>) {
  const result = await executeOrEnqueue(
    "repair.create",
    async () => {
      const { getNextSequenceNumber } = await import("@/lib/sequence-manager");
      const repairNo = await getNextSequenceNumber("repair");
      return useRepairs.getState().add({ ...input, repairNo } as never);
    },
    {
      title: input.kind === "polishing" ? "New polishing job" : "New repair",
      summary: String(input.customerName || input.customerId || ""),
      payload: input,
    },
  );
  if (result.mode === "queued") {
    const id = result.operation.localId;
    useRepairs.setState((s) => ({
      repairs: [
        {
          ...(input as object),
          id,
          repairNo: `PENDING-${id.slice(0, 8).toUpperCase()}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: "pending",
          payments: [],
          timeline: [],
          finalChargePaise: 0,
          polishingChargePaise: 0,
          additionalChargePaise: 0,
          gstEnabled: false,
          cgstPaise: 0,
          sgstPaise: 0,
        } as never,
        ...s.repairs.filter((row) => row.id !== id),
      ],
    }));
  }
  return result;
}

export async function captureRepairPayment(
  repairId: string,
  payment: Record<string, unknown>,
) {
  return executeOrEnqueue(
    "repair.payment",
    async () => useRepairs.getState().addPayment(repairId, payment as never),
    {
      title: "Repair payment",
      summary: repairId,
      payload: { repairId, payment },
    },
  );
}

export async function capturePurchaseCreate(input: Record<string, unknown>) {
  return executeOrEnqueue(
    "purchase.create",
    async () => useSupplierPurchases.getState().create(input as never),
    {
      title: "Supplier purchase",
      summary: String(input.supplierId || ""),
      payload: input,
    },
  );
}

export async function captureVoucherPost(input: Record<string, unknown>) {
  return executeOrEnqueue(
    "voucher.post",
    async () => postUniversalTransaction(input as never),
    {
      title: "Treasury voucher",
      summary: String(input.voucherNumber || input.transactionCode || "Voucher"),
      payload: input,
    },
  );
}

export async function captureSettlementCreate(input: Record<string, unknown>) {
  return executeOrEnqueue(
    "settlement.create",
    async () => useGoldSettlement.getState().addSettlement(input as never),
    {
      title: "Gold settlement",
      summary: String(input.party_id || ""),
      payload: input,
    },
  );
}

export async function captureCatalogCreate(input: Record<string, unknown>) {
  return executeOrEnqueue(
    "catalog.create",
    async () => useCatalog.getState().add(input as never),
    {
      title: "Catalog design",
      summary: String(input.designName || input.designNumber || ""),
      payload: input,
    },
  );
}

export async function captureJobCardCreate(input: {
  orderId: string;
  job: Record<string, unknown>;
  setOrderInProduction?: boolean;
  timelineLabel?: string;
  timelineNote?: string;
  runOnline: () => Promise<unknown>;
}) {
  return executeOrEnqueue("jobcard.create", input.runOnline, {
    title: "Job card",
    summary: input.orderId,
    payload: {
      orderId: input.orderId,
      job: input.job,
      setOrderInProduction: input.setOrderInProduction ?? false,
      timelineLabel: input.timelineLabel,
      timelineNote: input.timelineNote,
    },
  });
}

export async function captureStockTransfer(input: {
  branchId: string;
  fromLocation: string;
  toLocation: string;
  items: unknown[];
  narration?: string;
}) {
  return executeOrEnqueue(
    "stock.transfer",
    async () => useStockTransfers.getState().createTransfer(input as never),
    {
      title: "Stock transfer",
      summary: `${input.fromLocation} → ${input.toLocation}`,
      payload: input,
    },
  );
}

export async function captureAttendanceUpsert(input: {
  entries?: unknown[];
  entry?: unknown;
}) {
  return executeOrEnqueue(
    "attendance.upsert",
    async () => {
      if (input.entries) {
        return useWorkers.getState().bulkUpsertAttendance(input.entries as never);
      }
      return useWorkers.getState().upsertAttendance(input.entry as never);
    },
    {
      title: "Attendance",
      summary: input.entries ? `${input.entries.length} workers` : "1 worker",
      payload: { entries: input.entries, entry: input.entry },
    },
  );
}

export async function captureMeltCreate(input: Record<string, unknown>) {
  return executeOrEnqueue(
    "melt.create",
    async () => useMeltStore.getState().createJob(input as never),
    {
      title: "Melt job",
      summary: String(input.karigarName || input.branchId || "Melt"),
      payload: input,
    },
  );
}

export const PENDING_SYNC_GOLD =
  "Queued — Pending Sync. Gold Vault will not change until the server confirms.";

export const PENDING_SYNC_GENERIC = "Queued — Pending Sync. Will post when you are back online.";

export async function captureConversionExecute(plan: Record<string, unknown>) {
  const { useMetalConversion } = await import("@/lib/metal-conversion-store");
  return executeOrEnqueue(
    "conversion.execute",
    async () => useMetalConversion.getState().convert(plan as never),
    {
      title: "Metal conversion",
      summary: `${String(plan.sourcePurity || "")} → ${String(plan.destPurity || "")}`,
      payload: plan,
    },
  );
}

export async function captureWorkshopProcessIssue(input: Record<string, unknown>) {
  const { useWorkshopProcess } = await import("@/lib/workshop-process-store");
  return executeOrEnqueue(
    "workshop.process.issue",
    async () => useWorkshopProcess.getState().issue(input as never),
    {
      title: "Workshop issue gold",
      summary: `${String(input.processType || "")} · ${String(input.karigarName || "")}`,
      payload: input,
    },
  );
}

export async function captureWorkshopProcessComplete(
  id: string,
  input: Record<string, unknown>,
) {
  const { useWorkshopProcess } = await import("@/lib/workshop-process-store");
  return executeOrEnqueue(
    "workshop.process.complete",
    async () => useWorkshopProcess.getState().complete(id, input as never),
    {
      title: "Workshop complete",
      summary: id,
      payload: { id, input },
    },
  );
}

export async function captureManufacturingBillSave(bill: Record<string, unknown>) {
  const { useMfgBills } = await import("@/lib/manufacturing-bill-store");
  const { isReservedMfgBillNumber, saveLocalMfgBillDraft } = await import(
    "./mfg-bill-draft-cache"
  );
  const jobId = String(bill.jobCardId || "");
  if (jobId) {
    await saveLocalMfgBillDraft(jobId, bill as never);
  }
  if (!isReservedMfgBillNumber(String(bill.billNo || ""))) {
    return { mode: "executed" as const, result: { localOnly: true } };
  }
  return executeOrEnqueue(
    "manufacturing.bill.save",
    async () => useMfgBills.getState().saveBill(bill as never),
    {
      title: "Manufacturing bill draft",
      summary: String(bill.billNo || bill.id || "Draft"),
      payload: { bill },
    },
  );
}

export async function captureManufacturingBillFinalise(
  bill: Record<string, unknown>,
  opts: Record<string, unknown>,
) {
  const { isReservedMfgBillNumber } = await import("./mfg-bill-draft-cache");
  if (!isReservedMfgBillNumber(String(bill.billNo || ""))) {
    const { DocumentNumberOnlineRequiredError } = await import("@/lib/document-numbering");
    throw new DocumentNumberOnlineRequiredError();
  }
  const { useMfgBills } = await import("@/lib/manufacturing-bill-store");
  return executeOrEnqueue(
    "manufacturing.bill.finalise",
    async () => {
      await useMfgBills.getState().saveBill(bill as never);
      return useMfgBills.getState().finaliseBill(String(bill.id), opts as never);
    },
    {
      title: "Finalise manufacturing bill",
      summary: String(bill.billNo || bill.id || ""),
      payload: { bill, opts },
    },
  );
}

export async function captureHallmarkClose(batchId: string) {
  const { useHallmarkBatches } = await import("@/lib/hallmark-store");
  return executeOrEnqueue(
    "hallmark.close",
    async () => useHallmarkBatches.getState().close(batchId),
    {
      title: "Close hallmark batch",
      summary: batchId,
      payload: { batchId },
    },
  );
}

export async function captureAttendanceLoan(input: Record<string, unknown>) {
  return executeOrEnqueue(
    "attendance.loan",
    async () => useWorkers.getState().addLoan(input as never),
    {
      title: "Worker loan",
      summary: String(input.workerId || ""),
      payload: input,
    },
  );
}

export async function captureGoldRateUpdate(input: {
  gold24KPaise: number;
  gold22KPaise: number;
  gold18KPaise: number;
  silverPaise: number;
}) {
  const { useSettings } = await import("@/lib/settings-store");
  const apply = () => {
    const s = useSettings.getState();
    s.setGoldRate24K(input.gold24KPaise);
    s.setGoldRate(input.gold22KPaise);
    s.setGoldRate18K(input.gold18KPaise);
    s.setSilverRate(input.silverPaise);
  };
  apply();
  return executeOrEnqueue("settings.gold_rate", async () => undefined, {
    title: "Metal rates",
    summary: `22K ₹${(input.gold22KPaise / 100).toFixed(2)}/g`,
    payload: input,
  });
}

export async function captureOutsideWorkApprove(chargeId: string) {
  const { useOutsideWorkLabour } = await import("@/lib/outside-work-labour-store");
  return executeOrEnqueue(
    "outside_work.approve",
    async () => useOutsideWorkLabour.getState().approveCharge(chargeId),
    {
      title: "Approve outside labour",
      summary: chargeId,
      payload: { chargeId },
    },
  );
}
