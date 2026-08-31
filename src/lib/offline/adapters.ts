/**
 * Canonical offline → online apply adapters.
 * Always call existing Zustand/domain services (Supabase-backed). Never invent balances.
 */
import { decryptBytes, loadQueueSnapshot } from "./storage";
import type { OfflineOperation } from "./types";
import { isNumberConflictMessage, retryOnNumberConflict } from "./number-remint";
import { uploadFileToSupabase, getBucketForEntityType } from "@/lib/supabase-storage";
import { usePeople, type PersonType } from "@/lib/people-store";
import { useOrders } from "@/lib/orders-store";
import { useJobCards } from "@/lib/jobcards-store";
import { useAttachments } from "@/lib/attachments-store";
import { useExpensesStore, type ExpenseRecord } from "@/lib/expenses-store";
import { useStock } from "@/lib/stock-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { useWorkerReturns } from "@/lib/worker-return-store";
import { useMaterialVault } from "@/lib/material-vault-store";
import { useLedger } from "@/lib/ledger-store";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { useBilling, type BillingType, type InvoiceItem, type PaymentRecord } from "@/lib/billing-store";
import { useRepairs } from "@/lib/repair-store";
import { useCatalog } from "@/lib/catalog-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { useSupplierPurchases } from "@/lib/supplier-purchases-store";
import { useStockTransfers } from "@/lib/stock-transfer-store";
import { fineGoldMg } from "@/lib/gold";
import { useWorkers } from "@/lib/workers-store";
import { useMeltStore } from "@/lib/melt-store";
import { postUniversalTransaction } from "@/lib/transaction-types-store";
import { getNextSequenceNumber } from "@/lib/sequence-manager";
import { nextDocumentNumber } from "@/lib/document-numbering";

export type ApplyResult =
  | { ok: true; serverIds?: Record<string, string> }
  | { ok: false; needsAttention: boolean; reason: string };

function isConflictMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("conflict") ||
    m.includes("already") ||
    m.includes("locked") ||
    m.includes("disabled") ||
    m.includes("closed") ||
    m.includes("insufficient") ||
    m.includes("permission") ||
    m.includes("duplicate") ||
    m.includes("period")
  );
}

function isVaultRejectMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("insufficient") ||
    m.includes("permission") ||
    m.includes("locked") ||
    m.includes("closed") ||
    m.includes("period") ||
    m.includes("disabled")
  );
}

/** Replace local:<id> placeholders using synced ops' resultServerIds. */
export function remapLocalRefs(
  payload: Record<string, unknown>,
  ops: OfflineOperation[],
): Record<string, unknown> {
  const map = new Map<string, string>();
  for (const op of ops) {
    if (op.status !== "synced" || !op.resultServerIds) continue;
    for (const [k, v] of Object.entries(op.resultServerIds)) {
      map.set(k, v);
      map.set(op.localId, v);
      if (k === "id") map.set(op.localId, v);
    }
  }

  const out: Record<string, unknown> = { ...payload };
  for (const [key, val] of Object.entries(out)) {
    if (typeof val === "string") {
      if (val.startsWith("local:")) {
        const localId = val.slice(6);
        const server = map.get(localId);
        if (server) out[key] = server;
      } else if (map.has(val)) {
        out[key] = map.get(val);
      }
    } else if (val && typeof val === "object" && !Array.isArray(val)) {
      out[key] = remapLocalRefs(val as Record<string, unknown>, ops);
    }
  }
  if (typeof out.dependsOnPartyLocalId === "string") {
    const server = map.get(out.dependsOnPartyLocalId as string);
    if (server) out.customerId = server;
  }
  return out;
}

async function applyPhoto(op: OfflineOperation): Promise<ApplyResult> {
  if (!op.localAssetId) {
    return { ok: false, needsAttention: true, reason: "Photo has no local asset." };
  }
  const snap = await loadQueueSnapshot();
  const asset = snap.assets.find((a) => a.localId === op.localAssetId);
  if (!asset) {
    return { ok: false, needsAttention: true, reason: "Local photo asset missing." };
  }

  const payload = remapLocalRefs(op.payload, snap.operations);
  const entityType = (payload.entityType as string) || "stock";
  const entityId = String(payload.entityId || payload.stockId || "");
  if (!entityId || entityId.startsWith("local:")) {
    return {
      ok: false,
      needsAttention: false,
      reason: "Waiting for the related record to sync before uploading this photo.",
    };
  }

  try {
    const plain = await decryptBytes(asset.cipherBase64, asset.ivBase64);
    const file = new File([plain], asset.fileName, { type: asset.mimeType || "image/jpeg" });
    const docKey = String(payload.docKey || `photo_${Date.now()}`);
    const bucket = getBucketForEntityType(
      entityType === "expense" ? "expense" : (entityType as never),
    );

    if (entityType === "stock" || entityType === "person" || entityType === "order") {
      await useAttachments.getState().saveWithFile(entityType as never, entityId, docKey, file, {
        note: String(payload.note || "Mobile offline capture"),
      });
    } else {
      await uploadFileToSupabase(bucket, file, entityId, docKey);
    }

    asset.status = "synced";
    asset.serverObjectKey = `${bucket}/${entityId}/${docKey}`;
    await import("./storage").then((m) => m.saveQueueSnapshot(snap));
    return { ok: true, serverIds: { assetId: asset.serverObjectKey } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Photo upload failed";
    return { ok: false, needsAttention: isConflictMessage(msg), reason: msg };
  }
}

async function applyPartyCreate(op: OfflineOperation): Promise<ApplyResult> {
  const snap = await loadQueueSnapshot();
  const payload = remapLocalRefs(op.payload, snap.operations);
  const fullName = String(payload.fullName || "").trim();
  const phone = String(payload.phone || "").trim();
  if (!fullName || !phone) {
    return {
      ok: false,
      needsAttention: true,
      reason: "Name and phone are required to create this party.",
    };
  }

  try {
    const person = await retryOnNumberConflict(async (attempt) => {
      const remintId =
        attempt === 0
          ? undefined
          : await nextDocumentNumber(
              payload.type === "karigar" || payload.type === "worker" || payload.type === "employee"
                ? "worker"
                : "customer",
              payload.type === "karigar" || payload.type === "worker" || payload.type === "employee"
                ? "WRK-"
                : "CUST-",
              4,
            );
      return usePeople.getState().add({
        ...(payload as Record<string, unknown>),
        type: (payload.type as PersonType) || "customer",
        active: payload.active !== false,
        fullName,
        phone,
        ...(remintId ? { id: remintId } : {}),
      } as Parameters<ReturnType<typeof usePeople.getState>["add"]>[0]);
    });
    return { ok: true, serverIds: { id: person.id, customerId: person.id, partyId: person.id } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not create party";
    return { ok: false, needsAttention: isConflictMessage(msg), reason: msg };
  }
}

async function applyOrderDraft(op: OfflineOperation): Promise<ApplyResult> {
  const snap = await loadQueueSnapshot();
  const payload = remapLocalRefs(op.payload, snap.operations);
  const customerId = String(payload.customerId || "");
  if (!customerId || customerId.startsWith("local:")) {
    return {
      ok: false,
      needsAttention: false,
      reason: "Waiting for customer sync before creating this order.",
    };
  }

  const designName = String(payload.designName || payload.itemName || "Mobile draft item");
  const qty = Math.max(1, Number(payload.qty || 1));
  const grossMg = Number(payload.estimatedGrossMg || 0);
  const purity = Number(payload.purity || 916);
  const fineMg = Number(payload.estimatedFineMg || fineGoldMg(grossMg, purity));

  try {
    const order = await retryOnNumberConflict(async (attempt) => {
      const orderNo = attempt === 0 ? undefined : await getNextSequenceNumber("order");
      return useOrders.getState().add(
        {
          type: "custom",
          status: "draft",
          customerId,
          priority: "normal",
          source: "manual",
          ...(orderNo ? { orderNo } : {}),
          design: { notes: designName, pattern: designName },
          advance: {
            cashPaise: Number(payload.advanceCashPaise || 0),
            goldGrossMg: Number(payload.advanceGoldMg || 0),
            goldFineMg: Number(payload.advanceGoldMg || 0),
          },
          items: [
            {
              lineId: crypto.randomUUID(),
              itemName: designName,
              category: String(payload.category || "other"),
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
    });
    return { ok: true, serverIds: { id: order.id, orderId: order.id, orderNo: order.orderNo } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not create order draft";
    return { ok: false, needsAttention: isConflictMessage(msg), reason: msg };
  }
}

async function applyOrderCreate(op: OfflineOperation): Promise<ApplyResult> {
  const snap = await loadQueueSnapshot();
  const payload = remapLocalRefs(op.payload, snap.operations);
  const customerId = String(payload.customerId || "");
  if (!customerId || customerId.startsWith("local:")) {
    return {
      ok: false,
      needsAttention: false,
      reason: "Waiting for customer sync before creating this order.",
    };
  }

  const orderInput = (payload.order as Record<string, unknown> | undefined) ?? payload;
  const goldReceived = payload.goldReceived as
    | {
        netFineMg: number;
        goldGrossMg: number;
        goldPurity: number;
        goldFineMg: number;
        customerName?: string;
      }
    | null
    | undefined;

  try {
    let ledgerEntryId: string | undefined;
    if (goldReceived && goldReceived.goldGrossMg > 0) {
      try {
        const entry = await useLedger.getState().append({
          type: "old_gold_received",
          netFineMg: goldReceived.netFineMg,
          deltas: { vault: goldReceived.goldFineMg },
          grossMg: goldReceived.goldGrossMg,
          purity: goldReceived.goldPurity,
          fineMg: goldReceived.goldFineMg,
          form: "old_gold",
          reference: "Order (pending)",
          notes: `Gold received from ${goldReceived.customerName ?? "customer"} at order creation`,
        });
        ledgerEntryId = entry.id;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gold vault rejected this posting.";
        return { ok: false, needsAttention: true, reason: msg };
      }
    }

    const order = await retryOnNumberConflict(async () => {
      const orderNo = await getNextSequenceNumber("order");
      const designNum = await getNextSequenceNumber("design");
      const design = {
        ...((orderInput.design as Record<string, unknown>) ?? {}),
        designNumber: designNum,
      };
      return useOrders.getState().add(
        {
          ...orderInput,
          customerId,
          orderNo,
          status: (orderInput.status as string) || "confirmed",
          design,
          advance: {
            ...((orderInput.advance as Record<string, unknown>) ?? {}),
            goldLedgerEntryId: ledgerEntryId,
          },
        } as Parameters<ReturnType<typeof useOrders.getState>["add"]>[0],
        { silent: true },
      );
    });
    return { ok: true, serverIds: { id: order.id, orderId: order.id, orderNo: order.orderNo } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not create order";
    return {
      ok: false,
      needsAttention: isVaultRejectMessage(msg) || isConflictMessage(msg),
      reason: msg,
    };
  }
}

async function applyExpenseCreate(op: OfflineOperation): Promise<ApplyResult> {
  const snap = await loadQueueSnapshot();
  const payload = remapLocalRefs(op.payload, snap.operations);
  try {
    const expense = await retryOnNumberConflict(async () => {
      return useExpensesStore.getState().addExpense({
        date: String(payload.date || new Date().toISOString().slice(0, 10)),
        type: (payload.type as ExpenseRecord["type"]) || "business",
        category: String(payload.category || "General"),
        amountPaise: Number(payload.amountPaise || 0),
        paymentMode: (payload.paymentMode as ExpenseRecord["paymentMode"]) || "cash",
        notes: payload.notes ? String(payload.notes) : undefined,
        personId: payload.personId ? String(payload.personId) : undefined,
        branchId: String(payload.branchId || "MAIN"),
      });
    });
    return { ok: true, serverIds: { id: expense.id, expenseId: expense.id } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not create expense";
    return { ok: false, needsAttention: isConflictMessage(msg), reason: msg };
  }
}

async function applyStockCreate(op: OfflineOperation): Promise<ApplyResult> {
  const snap = await loadQueueSnapshot();
  const payload = remapLocalRefs(op.payload, snap.operations);
  const item = (payload.item as Record<string, unknown>) ?? payload;
  const source = (payload.source as "manufactured" | "purchased") || "manufactured";
  try {
    const created = await retryOnNumberConflict(async () => {
      return useStock.getState().addReadyStock(
        {
          itemName: String(item.itemName || "Ready stock"),
          category: String(item.category || "Jewellery"),
          purity: Number(item.purity || 916),
          grossMg: Number(item.grossMg || 0),
          netMg: Number(item.netMg || item.grossMg || 0),
          status: "available",
          location: (item.location as "safe") || "safe",
          notes: item.notes ? String(item.notes) : undefined,
        },
        source,
      );
    });
    return { ok: true, serverIds: { id: created.id, stockId: created.id } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not create stock";
    return {
      ok: false,
      needsAttention: isVaultRejectMessage(msg) || isConflictMessage(msg),
      reason: msg,
    };
  }
}

async function applyPartyUpdate(op: OfflineOperation): Promise<ApplyResult> {
  const snap = await loadQueueSnapshot();
  const payload = remapLocalRefs(op.payload, snap.operations);
  const id = String(payload.id || "");
  if (!id || id.startsWith("local:")) {
    return { ok: false, needsAttention: false, reason: "Waiting for party sync before updating." };
  }
  try {
    await usePeople.getState().update(id, (payload.patch as Record<string, unknown>) ?? payload);
    return { ok: true, serverIds: { id } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not update party";
    return { ok: false, needsAttention: isConflictMessage(msg), reason: msg };
  }
}

async function applyInvoiceCreate(op: OfflineOperation): Promise<ApplyResult> {
  const snap = await loadQueueSnapshot();
  const payload = remapLocalRefs(op.payload, snap.operations);
  const customerId = String(payload.customerId || "");
  if (!customerId || customerId.startsWith("local:")) {
    return {
      ok: false,
      needsAttention: false,
      reason: "Waiting for customer sync before creating this invoice.",
    };
  }

  const items = (payload.items as InvoiceItem[]) ?? [];
  const payments = (payload.payments as PaymentRecord[]) ?? [];
  const billingType = (payload.billingType as BillingType) || "ready_stock";
  const additionalLedgerIds: string[] = [];

  try {
    const invoiceNo = await getNextSequenceNumber("invoice");
    const goldPayment = payments.find(
      (p) => p.mode === "gold_exchange" || p.mode === "customer_gold_credit",
    );

    if (payload.overpaymentAuthorized && payload.overpaymentNotes) {
      try {
        await useLedger.getState().append({
          type: "gold_overdraft_issue",
          netFineMg: 0,
          deltas: {},
          fineMg: 0,
          reference: "INV-OVERPAY",
          notes: String(payload.overpaymentNotes),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gold vault rejected overpayment note.";
        return { ok: false, needsAttention: true, reason: msg };
      }
    }

    if (goldPayment?.mode === "gold_exchange") {
      const goldRatePaise = Number(goldPayment.goldRatePerGramPaise || 1) || 1;
      const goldRequiredGrams = Number(payload.grandTotalPaise || 0) / goldRatePaise;
      const goldReceivedGrams = (goldPayment.goldGrossMg ?? 0) / 1000;
      const goldShortfallGrams = Math.max(0, goldRequiredGrams - goldReceivedGrams);
      const goldSurplusGrams = Math.max(0, goldReceivedGrams - goldRequiredGrams);
      const purity = goldPayment.goldPurity ?? 916;
      const goldShortfallFineMg =
        goldShortfallGrams > 0
          ? fineGoldMg(Math.round(goldShortfallGrams * 1000), Math.round(purity))
          : 0;
      const goldSurplusFineMg =
        goldSurplusGrams > 0
          ? fineGoldMg(Math.round(goldSurplusGrams * 1000), Math.round(purity))
          : 0;

      if (goldShortfallFineMg > 0) {
        const shortfallEntry = await useLedger.getState().append({
          type: "gold_overdraft_issue",
          netFineMg: -goldShortfallFineMg,
          deltas: { customer: -goldShortfallFineMg },
          notes: `Pay-In-Gold settlement shortfall receivable for Invoice ${invoiceNo}`,
          reference: invoiceNo,
          customerId,
        });
        additionalLedgerIds.push(shortfallEntry.id);
        await useGoldSettlement.getState().addSettlement({
          party_type: "customer",
          party_id: customerId,
          branch_id: String(payload.branchId || "MAIN"),
          settlement_type: "gold_shortfall_receivable",
          purity,
          gross_mg: Math.round(goldShortfallGrams * 1000),
          net_mg: Math.round(goldShortfallGrams * 1000),
          wastage_mg: 0,
          rate_per_gram_paise: goldRatePaise,
          amount_paise: 0,
          notes: `Gold payment shortfall receivable from Invoice ${invoiceNo}`,
          payment_mode: "gold_exchange",
        });
      }
      if (goldSurplusFineMg > 0) {
        await useGoldSettlement.getState().addSettlement({
          party_type: "customer",
          party_id: customerId,
          branch_id: String(payload.branchId || "MAIN"),
          settlement_type: "gold_received",
          purity,
          gross_mg: Math.round(goldSurplusGrams * 1000),
          net_mg: Math.round(goldSurplusGrams * 1000),
          wastage_mg: 0,
          rate_per_gram_paise: goldRatePaise,
          amount_paise: 0,
          notes: `Excess gold received against Invoice ${invoiceNo}`,
          payment_mode: "gold_exchange",
        });
      }
    }

    if (goldPayment?.mode === "customer_gold_credit" && (goldPayment.goldFineMg ?? 0) > 0) {
      await useGoldSettlement.getState().addSettlement({
        party_type: "customer",
        party_id: customerId,
        branch_id: String(payload.branchId || "MAIN"),
        settlement_type: "gold_given",
        purity: goldPayment.goldPurity ?? 916,
        gross_mg: goldPayment.goldGrossMg ?? 0,
        net_mg: goldPayment.goldFineMg ?? 0,
        wastage_mg: 0,
        rate_per_gram_paise: goldPayment.goldRatePerGramPaise || 0,
        amount_paise: 0,
        notes: `Gold Advance applied against Invoice ${invoiceNo}`,
        payment_mode: "customer_gold_credit",
        direction: "Naam",
      });
    }

    const inv = await retryOnNumberConflict(async (attempt) => {
      const reminted = attempt === 0 ? invoiceNo : await getNextSequenceNumber("invoice");
      return useBilling.getState().add({
        invoiceNo: reminted,
        billingType,
        status:
          Number(payload.balancePaise || 0) <= 0
            ? "paid"
            : Number(payload.paidPaise || 0) > 0
              ? "partial"
              : "issued",
        customerId,
        customerName: String(payload.customerName || ""),
        customerPhone: payload.customerPhone ? String(payload.customerPhone) : undefined,
        customerGstin: payload.customerGstin ? String(payload.customerGstin) : undefined,
        orderId: payload.orderId ? String(payload.orderId) : undefined,
        orderNo: payload.orderNo ? String(payload.orderNo) : undefined,
        jobId: payload.jobId ? String(payload.jobId) : undefined,
        jobNo: payload.jobNo ? String(payload.jobNo) : undefined,
        items,
        orderAdjustment: payload.orderAdjustment as never,
        gst: (payload.gst as never) ?? "none",
        cgstPaise: Number(payload.cgstPaise || 0),
        sgstPaise: Number(payload.sgstPaise || 0),
        gstPaise: Number(payload.gstPaise || 0),
        tcsPaise: Number(payload.tcsPaise || 0),
        gstGoldEquivalentMg: payload.gstGoldEquivalentMg
          ? Number(payload.gstGoldEquivalentMg)
          : undefined,
        subtotalPaise: Number(payload.subtotalPaise || 0),
        adjustmentPaise: Number(payload.adjustmentPaise || 0),
        grandTotalPaise: Number(payload.grandTotalPaise || 0),
        paidPaise: Number(payload.paidPaise || 0),
        balancePaise: Number(payload.balancePaise || 0),
        payments,
        additionalLedgerEntryIds: additionalLedgerIds.length > 0 ? additionalLedgerIds : undefined,
        notes: String(payload.notes || `[Type: ${billingType}]`),
      });
    });

    useBilling.setState((s) => ({
      invoices: s.invoices.filter((row) => row.id !== op.localId),
    }));

    return { ok: true, serverIds: { id: inv.id, invoiceId: inv.id, invoiceNo: inv.invoiceNo } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not create invoice";
    return {
      ok: false,
      needsAttention: isVaultRejectMessage(msg) || isConflictMessage(msg),
      reason: msg,
    };
  }
}

async function applyInvoicePayment(op: OfflineOperation): Promise<ApplyResult> {
  const snap = await loadQueueSnapshot();
  const payload = remapLocalRefs(op.payload, snap.operations);
  const invoiceId = String(payload.invoiceId || "");
  if (!invoiceId || invoiceId.startsWith("local:")) {
    return {
      ok: false,
      needsAttention: false,
      reason: "Waiting for invoice sync before recording payment.",
    };
  }
  try {
    const pay = await useBilling.getState().addPayment(invoiceId, payload.payment as never);
    return { ok: true, serverIds: { paymentId: pay?.id ?? op.localId } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not record invoice payment";
    return { ok: false, needsAttention: isConflictMessage(msg), reason: msg };
  }
}

async function applyRepairCreate(op: OfflineOperation): Promise<ApplyResult> {
  const snap = await loadQueueSnapshot();
  const payload = remapLocalRefs(op.payload, snap.operations);
  const customerId = String(payload.customerId || "");
  if (!customerId || customerId.startsWith("local:")) {
    return {
      ok: false,
      needsAttention: false,
      reason: "Waiting for customer sync before creating this repair.",
    };
  }
  try {
    const repair = await retryOnNumberConflict(async () => {
      const repairNo = await getNextSequenceNumber("repair");
      const rest = { ...payload };
      delete rest.id;
      delete rest.repairNo;
      return useRepairs.getState().add({
        ...rest,
        repairNo,
        customerId,
      } as Parameters<ReturnType<typeof useRepairs.getState>["add"]>[0]);
    });
    useRepairs.setState((s) => ({
      repairs: s.repairs.filter((row) => row.id !== op.localId),
    }));
    return { ok: true, serverIds: { id: repair.id, repairId: repair.id, repairNo: repair.repairNo } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not create repair";
    return { ok: false, needsAttention: isConflictMessage(msg), reason: msg };
  }
}

async function applyRepairPayment(op: OfflineOperation): Promise<ApplyResult> {
  const snap = await loadQueueSnapshot();
  const payload = remapLocalRefs(op.payload, snap.operations);
  const repairId = String(payload.repairId || "");
  if (!repairId || repairId.startsWith("local:")) {
    return {
      ok: false,
      needsAttention: false,
      reason: "Waiting for repair sync before recording payment.",
    };
  }
  try {
    const pay = useRepairs.getState().addPayment(repairId, payload.payment as never);
    return { ok: true, serverIds: { paymentId: pay?.id ?? op.localId } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not record repair payment";
    return { ok: false, needsAttention: isConflictMessage(msg), reason: msg };
  }
}

async function applyPurchaseCreate(op: OfflineOperation): Promise<ApplyResult> {
  const snap = await loadQueueSnapshot();
  const payload = remapLocalRefs(op.payload, snap.operations);
  try {
    const purchase = await useSupplierPurchases.getState().create(payload as never);
    return { ok: true, serverIds: { id: purchase.id, purchaseNo: purchase.purchaseNo } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not post supplier purchase";
    return {
      ok: false,
      needsAttention: isVaultRejectMessage(msg) || isConflictMessage(msg),
      reason: msg,
    };
  }
}

async function applyVoucherPost(op: OfflineOperation): Promise<ApplyResult> {
  const snap = await loadQueueSnapshot();
  const payload = remapLocalRefs(op.payload, snap.operations);
  try {
    const result = await postUniversalTransaction(payload as never);
    if (result.error || !result.entryId) {
      return {
        ok: false,
        needsAttention: true,
        reason: result.error ?? "Voucher posting failed.",
      };
    }
    return { ok: true, serverIds: { id: result.entryId, entryId: result.entryId } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not post voucher";
    return {
      ok: false,
      needsAttention: isVaultRejectMessage(msg) || isConflictMessage(msg),
      reason: msg,
    };
  }
}

async function applySettlementCreate(op: OfflineOperation): Promise<ApplyResult> {
  const snap = await loadQueueSnapshot();
  const payload = remapLocalRefs(op.payload, snap.operations);
  try {
    const row = await useGoldSettlement.getState().addSettlement(payload as never);
    return { ok: true, serverIds: { id: row.id } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not save settlement";
    return {
      ok: false,
      needsAttention: isVaultRejectMessage(msg) || isConflictMessage(msg),
      reason: msg,
    };
  }
}

async function applyCatalogCreate(op: OfflineOperation): Promise<ApplyResult> {
  const snap = await loadQueueSnapshot();
  const payload = remapLocalRefs(op.payload, snap.operations);
  try {
    const d = useCatalog.getState().add(payload as never);
    return { ok: true, serverIds: { id: d.id, designNumber: d.designNumber } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not save design";
    return { ok: false, needsAttention: isConflictMessage(msg), reason: msg };
  }
}

async function applyJobCardCreate(op: OfflineOperation): Promise<ApplyResult> {
  const snap = await loadQueueSnapshot();
  const payload = remapLocalRefs(op.payload, snap.operations);
  const orderId = String(payload.orderId || "");
  if (!orderId || orderId.startsWith("local:")) {
    return {
      ok: false,
      needsAttention: false,
      reason: "Waiting for order sync before creating this job card.",
    };
  }
  try {
    const order = useOrders.getState().orders.find((o) => o.id === orderId);
    if (!order) {
      return { ok: false, needsAttention: false, reason: "Waiting for order sync before creating this job card." };
    }
    const { createJobCardForLine } = await import("@/lib/orders-store");
    await createJobCardForLine(
      order,
      payload.lineId ? String(payload.lineId) : undefined,
      String(payload.karigarId || ""),
      (payload.opts as { expectedStart?: string }) ?? {},
    );
    const job = useJobCards.getState().jobs.find((j) => j.orderId === orderId && j.lineId === payload.lineId);
    return { ok: true, serverIds: { id: job?.id ?? op.localId, jobNo: job?.jobNo ?? "" } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not create job card";
    return { ok: false, needsAttention: isConflictMessage(msg), reason: msg };
  }
}

async function applyStockTransfer(op: OfflineOperation): Promise<ApplyResult> {
  const snap = await loadQueueSnapshot();
  const payload = remapLocalRefs(op.payload, snap.operations);
  try {
    const v = await useStockTransfers.getState().createTransfer(payload as never);
    return { ok: true, serverIds: { id: v.id, voucherNumber: v.voucherNumber } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not create stock transfer";
    return {
      ok: false,
      needsAttention: isVaultRejectMessage(msg) || isConflictMessage(msg),
      reason: msg,
    };
  }
}

async function applyAttendance(op: OfflineOperation): Promise<ApplyResult> {
  const snap = await loadQueueSnapshot();
  const payload = remapLocalRefs(op.payload, snap.operations);
  try {
    if (Array.isArray(payload.entries)) {
      const rows = await useWorkers.getState().bulkUpsertAttendance(payload.entries as never);
      return { ok: true, serverIds: { id: rows[0]?.id ?? op.localId } };
    }
    const row = await useWorkers.getState().upsertAttendance(payload.entry as never);
    return { ok: true, serverIds: { id: row.id } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not save attendance";
    return { ok: false, needsAttention: isConflictMessage(msg), reason: msg };
  }
}

async function applyMeltCreate(op: OfflineOperation): Promise<ApplyResult> {
  const snap = await loadQueueSnapshot();
  const payload = remapLocalRefs(op.payload, snap.operations);
  try {
    const job = await retryOnNumberConflict(async () => {
      return useMeltStore.getState().createJob(payload as never);
    });
    return { ok: true, serverIds: { id: job.id, jobNo: job.jobNo } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not create melt job";
    return {
      ok: false,
      needsAttention: isVaultRejectMessage(msg) || isConflictMessage(msg),
      reason: msg,
    };
  }
}

async function applyConversionExecute(op: OfflineOperation): Promise<ApplyResult> {
  const snap = await loadQueueSnapshot();
  const payload = remapLocalRefs(op.payload, snap.operations);
  try {
    const { useMetalConversion } = await import("@/lib/metal-conversion-store");
    const record = await useMetalConversion.getState().convert(payload as never);
    return { ok: true, serverIds: { id: record.id, batchNo: record.batchNo } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Conversion failed";
    return {
      ok: false,
      needsAttention: isVaultRejectMessage(msg) || isConflictMessage(msg),
      reason: msg,
    };
  }
}

async function applyWorkshopProcessIssue(op: OfflineOperation): Promise<ApplyResult> {
  const snap = await loadQueueSnapshot();
  const payload = remapLocalRefs(op.payload, snap.operations);
  try {
    const { useWorkshopProcess } = await import("@/lib/workshop-process-store");
    const tx = await useWorkshopProcess.getState().issue(payload as never);
    return { ok: true, serverIds: { id: tx.id } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Workshop issue failed";
    return {
      ok: false,
      needsAttention: isVaultRejectMessage(msg) || isConflictMessage(msg),
      reason: msg,
    };
  }
}

async function applyWorkshopProcessComplete(op: OfflineOperation): Promise<ApplyResult> {
  const snap = await loadQueueSnapshot();
  const payload = remapLocalRefs(op.payload, snap.operations);
  const id = String(payload.id || "");
  const input = (payload.input as Record<string, unknown>) ?? {};
  try {
    const { useWorkshopProcess } = await import("@/lib/workshop-process-store");
    const tx = await useWorkshopProcess.getState().complete(id, input as never);
    return { ok: true, serverIds: { id: tx.id } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Workshop complete failed";
    return {
      ok: false,
      needsAttention: isVaultRejectMessage(msg) || isConflictMessage(msg),
      reason: msg,
    };
  }
}

async function applyManufacturingBillSave(op: OfflineOperation): Promise<ApplyResult> {
  const snap = await loadQueueSnapshot();
  const payload = remapLocalRefs(op.payload, snap.operations);
  try {
    const { useMfgBills } = await import("@/lib/manufacturing-bill-store");
    await useMfgBills.getState().saveBill(payload.bill as never);
    return { ok: true, serverIds: { id: String((payload.bill as { id?: string })?.id ?? op.localId) } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not save manufacturing bill";
    return { ok: false, needsAttention: isConflictMessage(msg), reason: msg };
  }
}

async function applyManufacturingBillFinalise(op: OfflineOperation): Promise<ApplyResult> {
  const snap = await loadQueueSnapshot();
  const payload = remapLocalRefs(op.payload, snap.operations);
  const bill = payload.bill as { id?: string; billNo?: string } | undefined;
  const { isReservedMfgBillNumber } = await import("./mfg-bill-draft-cache");
  if (!isReservedMfgBillNumber(bill?.billNo)) {
    return {
      ok: false,
      needsAttention: false,
      reason: "Internet required to create document number before this bill can be finalised.",
    };
  }
  try {
    const { useMfgBills } = await import("@/lib/manufacturing-bill-store");
    if (payload.bill) {
      await useMfgBills.getState().saveBill(payload.bill as never);
    }
    const id = String(bill?.id || payload.id || "");
    const result = await useMfgBills.getState().finaliseBill(id, (payload.opts as never) ?? {});
    if (!result.ok) {
      return {
        ok: false,
        needsAttention: true,
        reason: result.errors.join(" · ") || "Finalise was rejected.",
      };
    }
    return { ok: true, serverIds: { id } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not finalise manufacturing bill";
    return {
      ok: false,
      needsAttention: isVaultRejectMessage(msg) || isConflictMessage(msg),
      reason: msg,
    };
  }
}

async function applyHallmarkClose(op: OfflineOperation): Promise<ApplyResult> {
  const snap = await loadQueueSnapshot();
  const payload = remapLocalRefs(op.payload, snap.operations);
  try {
    const { useHallmarkBatches } = await import("@/lib/hallmark-store");
    await useHallmarkBatches.getState().close(String(payload.batchId));
    return { ok: true, serverIds: { id: String(payload.batchId) } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not close hallmark batch";
    return { ok: false, needsAttention: isConflictMessage(msg), reason: msg };
  }
}

async function applyAttendanceLoan(op: OfflineOperation): Promise<ApplyResult> {
  const snap = await loadQueueSnapshot();
  const payload = remapLocalRefs(op.payload, snap.operations);
  try {
    const row = await useWorkers.getState().addLoan(payload as never);
    return { ok: true, serverIds: { id: row.id } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not record loan";
    return { ok: false, needsAttention: isConflictMessage(msg), reason: msg };
  }
}

async function applyGoldRateUpdate(op: OfflineOperation): Promise<ApplyResult> {
  const payload = op.payload;
  try {
    const { useSettings } = await import("@/lib/settings-store");
    const s = useSettings.getState();
    s.setGoldRate24K(Number(payload.gold24KPaise));
    s.setGoldRate(Number(payload.gold22KPaise));
    s.setGoldRate18K(Number(payload.gold18KPaise));
    s.setSilverRate(Number(payload.silverPaise));
    return { ok: true, serverIds: { id: "gold_rate" } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not persist metal rates";
    return { ok: false, needsAttention: isConflictMessage(msg), reason: msg };
  }
}

async function applyOutsideWorkApprove(op: OfflineOperation): Promise<ApplyResult> {
  const payload = op.payload;
  try {
    const { useOutsideWorkLabour } = await import("@/lib/outside-work-labour-store");
    await useOutsideWorkLabour.getState().approveCharge(String(payload.chargeId));
    return { ok: true, serverIds: { id: String(payload.chargeId) } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not approve labour charge";
    return { ok: false, needsAttention: isConflictMessage(msg), reason: msg };
  }
}

async function applyGoldOrAccountingCapture(op: OfflineOperation): Promise<ApplyResult> {
  if (payloadNeedsReview(op.payload)) {
    return {
      ok: false,
      needsAttention: true,
      reason:
        String(op.payload.reviewReason || "") ||
        "This gold/accounting change needs review — server state may have changed.",
    };
  }

  const snap = await loadQueueSnapshot();
  const payload = remapLocalRefs(op.payload, snap.operations);
  const kind = String(payload.kind || "gold_book");

  try {
    if (kind === "worker_issue" || kind === "worker_return") {
      const ledger = payload.ledger as Record<string, unknown> | undefined;
      const entryInput = payload.entry as Record<string, unknown> | undefined;
      if (!ledger || !entryInput) {
        return {
          ok: false,
          needsAttention: true,
          reason: "Incomplete gold issue/return payload — ledger and gold-book entry are required.",
        };
      }

      const ledgerEntry = await useLedger.getState().append(
        ledger as Parameters<ReturnType<typeof useLedger.getState>["append"]>[0],
      );
      const gbEntry = await retryOnNumberConflict(async () => {
        return useWorkerGoldBook.getState().addEntry(
          entryInput as Parameters<ReturnType<typeof useWorkerGoldBook.getState>["addEntry"]>[0],
        );
      });

      if (kind === "worker_return") {
        const wr = payload.workerReturn as Record<string, unknown> | undefined;
        if (wr) {
          await useWorkerReturns.getState().add({
            ...wr,
            ledgerEntryId: ledgerEntry.id,
            workerGoldBookEntryId: gbEntry.id,
          } as Parameters<ReturnType<typeof useWorkerReturns.getState>["add"]>[0]);
        }
      }

      const vault = payload.vault as Record<string, unknown> | undefined;
      if (vault && vault.category) {
        const { data } = await supabase.auth.getSession();
        await useMaterialVault.getState().append({
          ...vault,
          actorId: data.session?.user.id ?? null,
          actorEmail: data.session?.user.email ?? null,
        } as Parameters<ReturnType<typeof useMaterialVault.getState>["append"]>[0]);
      }

      const timeline = payload.timeline as
        | { orderId?: string; label?: string; note?: string }
        | undefined;
      if (timeline?.orderId) {
        await useOrders.getState().appendTimeline(timeline.orderId, {
          ts: Date.now(),
          label: timeline.label || (kind === "worker_return" ? "Worker Return" : "Gold / Material Issue"),
          note: timeline.note || "",
        });
      }

      return {
        ok: true,
        serverIds: {
          id: gbEntry.id,
          entryNo: gbEntry.entryNo,
          ledgerId: ledgerEntry.id,
          goldBookId: gbEntry.id,
        },
      };
    }

    if (kind === "gold_book") {
      const entryInput = (payload.entry as Record<string, unknown>) ?? payload;
      const entry = await retryOnNumberConflict(async () => {
        return useWorkerGoldBook.getState().addEntry(
          entryInput as Parameters<ReturnType<typeof useWorkerGoldBook.getState>["addEntry"]>[0],
        );
      });
      return {
        ok: true,
        serverIds: { id: entry.id, entryNo: entry.entryNo, goldBookId: entry.id },
      };
    }

    return {
      ok: false,
      needsAttention: true,
      reason: `No gold apply handler for kind “${kind}”.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gold posting failed";
    return {
      ok: false,
      needsAttention: isVaultRejectMessage(msg) || !isNumberConflictMessage(msg),
      reason: msg,
    };
  }
}

function payloadNeedsReview(payload: Record<string, unknown>): boolean {
  return payload.forceNeedsReview === true || payload.conflict === true;
}

/** Main dispatcher used by sync-runner. */
export async function applyOfflineOperation(op: OfflineOperation): Promise<ApplyResult> {
  const action = op.action.toLowerCase();

  if (action === "photo.upload" || op.domain === "photo") {
    return applyPhoto(op);
  }
  if (action === "party.create" || action.startsWith("people.create")) {
    return applyPartyCreate(op);
  }
  if (action === "party.update" || action.startsWith("people.update")) {
    return applyPartyUpdate(op);
  }
  if (action === "order.create") {
    return applyOrderCreate(op);
  }
  if (action === "order.draft") {
    return applyOrderDraft(op);
  }
  if (action === "expense.create") {
    return applyExpenseCreate(op);
  }
  if (action === "stock.create") {
    return applyStockCreate(op);
  }
  if (action === "invoice.create") {
    return applyInvoiceCreate(op);
  }
  if (action === "invoice.payment") {
    return applyInvoicePayment(op);
  }
  if (action === "repair.create") {
    return applyRepairCreate(op);
  }
  if (action === "repair.payment") {
    return applyRepairPayment(op);
  }
  if (action === "purchase.create") {
    return applyPurchaseCreate(op);
  }
  if (action === "voucher.post") {
    return applyVoucherPost(op);
  }
  if (action === "settlement.create") {
    return applySettlementCreate(op);
  }
  if (action === "catalog.create") {
    return applyCatalogCreate(op);
  }
  if (action === "jobcard.create") {
    return applyJobCardCreate(op);
  }
  if (action === "stock.transfer") {
    return applyStockTransfer(op);
  }
  if (action === "attendance.upsert") {
    return applyAttendance(op);
  }
  if (action === "melt.create") {
    return applyMeltCreate(op);
  }
  if (action === "conversion.execute") {
    return applyConversionExecute(op);
  }
  if (action === "workshop.process.issue") {
    return applyWorkshopProcessIssue(op);
  }
  if (action === "workshop.process.complete") {
    return applyWorkshopProcessComplete(op);
  }
  if (action === "manufacturing.bill.save") {
    return applyManufacturingBillSave(op);
  }
  if (action === "manufacturing.bill.finalise") {
    return applyManufacturingBillFinalise(op);
  }
  if (action === "hallmark.close") {
    return applyHallmarkClose(op);
  }
  if (action === "attendance.loan") {
    return applyAttendanceLoan(op);
  }
  if (action === "settings.gold_rate") {
    return applyGoldRateUpdate(op);
  }
  if (action === "outside_work.approve") {
    return applyOutsideWorkApprove(op);
  }
  if (
    action === "issue.gold" ||
    action === "receive.gold" ||
    op.domain === "gold" ||
    op.domain === "billing" ||
    op.domain === "treasury" ||
    op.domain === "settlement" ||
    op.domain === "inventory_mutation"
  ) {
    return applyGoldOrAccountingCapture(op);
  }
  if (op.capability === "OFFLINE_SAFE" && op.domain === "note") {
    return { ok: true, serverIds: { noteId: op.localId } };
  }

  return {
    ok: false,
    needsAttention: true,
    reason: `No sync handler for “${op.action}”.`,
  };
}
