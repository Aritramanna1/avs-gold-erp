/**
 * MTJ ERP — Test seed for E2E harness.
 *
 * Exposes `window.__mtjSeed()` (idempotent) which:
 *   1) Resets all mtj-* persisted stores
 *   2) Creates one full pilot dataset: SRM Jewelers customer, Raju Das karigar,
 *      opening vault, order, job card with issue + receive, stock item,
 *      invoice + payment, repair, rate-cut, worker passbook, daily close,
 *      filed attachments, WhatsApp message, and print-log entries.
 *   3) Returns the created ids so the Playwright script can navigate.
 *
 * Only used by `/tmp/browser/audit/*.py` Playwright harnesses. No UI surface.
 */
// @ts-nocheck
import { useAttachments } from "./attachments-store";
import { useBilling, type GstKind } from "./billing-store";
import {
  useCreditNotes,
  useDebitNotes,
  useEstimates,
  useDeliveryChallans,
} from "./billing-documents-store";
import { useCommLog } from "./comm-log-store";
import { useDailyCloses } from "./dailyclose-store";
import { useJobCards } from "./jobcards-store";
import { useLedger } from "./ledger-store";
import { usePeople } from "./people-store";
import { useOrders } from "./orders-store";
import { useSettings } from "./settings-store";
import { usePrintLog } from "./printlog-store";
import { useRateCuts } from "./ratecut-store";
import { useRepairs } from "./repair-store";
import { getNextSequenceNumber } from "./sequence-manager";
import { useStock } from "./stock-store";
import { useWhatsapp } from "./whatsapp-store";
import { useWorkers } from "./workers-store";
import { useWorkerGoldBook } from "./worker-gold-book-store";
import { useCatalog } from "./catalog-store";

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface SeedResult {
  customerId: string;
  karigarId: string;
  outsideJewellerId: string;
  workerId: string;
  passbookWorkerId: string;
  orderId: string;
  orderNo: string;
  jobId: string;
  jobNo: string;
  goldIssueId: string;
  goldReceiveId: string;
  stockItemId: string;
  invoiceId: string;
  invoiceNo: string;
  creditNoteId: string;
  creditNoteNo: string;
  debitNoteId: string;
  debitNoteNo: string;
  estimateId: string;
  estimateNo: string;
  deliveryChallanId: string;
  deliveryChallanNo: string;
  custodyRefOrderNo: string;
  paymentId: string;
  repairId: string;
  polishingRepairId: string;
  rateCutId: string;
  dailyCloseId: string;
  whatsappId: string;
  withdrawalId: string;
  advanceId: string;
  loanId: string;
  goldAdvanceId: string;
  wastageReturnId: string;
  settlementId: string;
  printLogId: string;
  issueSlipNo: string;
  receiveSlipNo: string;
}

const E2E_SEED_CACHE_KEY = "avs_e2e_seed_result_v1";

function readSeedCache(): SeedResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(E2E_SEED_CACHE_KEY);
    if (!raw) return null;
    const decoded = typeof atob === "function" ? atob(raw) : raw;
    const parsed = JSON.parse(decoded);
    return parsed && parsed.orderId && parsed.invoiceId ? (parsed as SeedResult) : null;
  } catch {
    return null;
  }
}

function writeSeedCache(result: SeedResult): void {
  if (typeof window === "undefined") return;
  try {
    const json = JSON.stringify(result);
    const encoded = typeof btoa === "function" ? btoa(json) : json;
    window.sessionStorage.setItem(E2E_SEED_CACHE_KEY, encoded);
  } catch {
    // Test seed cache is a speed-up only; seed data itself is still returned.
  }
}

export async function seedPilotDataset(): Promise<SeedResult> {
  const cached = readSeedCache();
  if (cached) return cached;

  // 1. Reset everything
  usePeople.getState().reset?.();
  useOrders.getState().reset();
  useJobCards.getState().reset?.();
  useStock.getState();
  // Stock store has no reset; clear via direct set
  useStock.setState({ items: [], movements: [] });
  useBilling.getState().reset();
  useCreditNotes.getState().reset();
  useDebitNotes.getState().reset();
  useEstimates.getState().reset();
  useDeliveryChallans.getState().reset();
  useRepairs.getState().reset();
  useRateCuts.getState().reset();
  useDailyCloses.getState().reset();
  useLedger.getState().reset();
  useWhatsapp.getState().reset();
  usePrintLog.getState().reset();
  useWorkers.getState().reset();
  useCommLog.getState().reset?.();
  useWorkerGoldBook.getState().reset();
  useAttachments.setState({ items: {} });
  useCatalog.setState({ designs: [] });

  // 1b. Seed Catalog Designs
  useCatalog.getState().add({
    designNumber: "N-2026-001",
    designName: "Antique Heritage Bridal Necklace",
    category: "Necklace",
    purity: 916,
    approxGrossMg: 35500,
    approxNetMg: 35000,
    difficulty: "hard",
    tags: ["Bridal", "Antique", "22K"],
    source: "internal",
    notes: "Handcrafted bridal heritage choker",
  });
  useCatalog.getState().add({
    designNumber: "R-2026-002",
    designName: "Solitaire Diamond Engagement Ring",
    category: "Ring",
    purity: 750,
    approxGrossMg: 4200,
    approxNetMg: 4000,
    difficulty: "medium",
    tags: ["Diamond", "Ring", "18K"],
    source: "internal",
    notes: "18K White Gold Solitaire Diamond Ring",
  });
  useCatalog.getState().add({
    designNumber: "B-2026-003",
    designName: "Traditional Kadda Bangle Set",
    category: "Bangle",
    purity: 916,
    approxGrossMg: 48000,
    approxNetMg: 48000,
    difficulty: "medium",
    tags: ["Bangle", "22K", "Traditional"],
    source: "internal",
    notes: "Solid 22K 916 Gold Kadda Bangle Set",
  });

  // 2. People
  const customer = await usePeople.getState().add({
    type: "firm_customer",
    fullName: "SRM Jewelers",
    phone: "9830012345",
    altPhone: "",
    villageCity: "Kolkata",
    state: "West Bengal",
    currentAddress: "12 Bowbazar St",
    permanentAddress: "12 Bowbazar St",
    aadhaar: "",
    pan: "",
    gstin: "19AAACS1234L1Z9",
    workType: "",
    joiningDate: "",
    emergencyName: "",
    emergencyPhone: "",
    referenceName: "",
    referencePhone: "",
    notes: "Bulk order customer (pilot test seed)",
    active: true,
  });

  const karigar = await usePeople.getState().add({
    type: "karigar",
    fullName: "Raju Das",
    phone: "9876501234",
    altPhone: "",
    villageCity: "Howrah",
    state: "West Bengal",
    currentAddress: "Raju Lane",
    permanentAddress: "Raju Lane",
    aadhaar: "123456789012",
    pan: "",
    gstin: "",
    workType: "Handmade",
    joiningDate: "2024-01-15",
    emergencyName: "Lila Das",
    emergencyPhone: "9876500000",
    referenceName: "",
    referencePhone: "",
    notes: "Senior handmade karigar (pilot test seed)",
    active: true,
  });

  const outsideJeweller = await usePeople.getState().add({
    type: "outside_worker",
    fullName: "Ganesh Chain Works",
    phone: "9876502222",
    altPhone: "",
    villageCity: "Bowbazar",
    state: "West Bengal",
    currentAddress: "Bowbazar Lane",
    permanentAddress: "Bowbazar Lane",
    aadhaar: "",
    pan: "",
    gstin: "",
    workType: "Chain making",
    joiningDate: "2024-02-01",
    emergencyName: "",
    emergencyPhone: "",
    referenceName: "",
    referencePhone: "",
    notes: "Outside chain-making jeweller (pilot test seed)",
    active: true,
  });

  // Mark a few KYC docs filed on both — non-fatal: a Supabase timeout here
  // must not abort the whole seed; the people & order data is what matters.
  const toggleDocSafe = async (id: string, doc: string) => {
    try {
      await usePeople.getState().toggleDoc(id, doc as any);
    } catch (e) {
      console.warn(`[seed] toggleDoc(${id}, ${doc}) failed — continuing seed:`, e);
    }
  };
  await toggleDocSafe(customer.id, "photo");
  await toggleDocSafe(customer.id, "pan");
  await toggleDocSafe(karigar.id, "photo");
  await toggleDocSafe(karigar.id, "aadhaar_front");
  await toggleDocSafe(karigar.id, "aadhaar_back");

  // 3. Shared attachment store: filed-with-note records (so Photos & Files sections render filled)
  const att = useAttachments.getState();
  att.save("person", customer.id, "photo", {
    filed: true,
    note: "Filed in folder SRM/2026 page 1",
  });
  att.save("person", karigar.id, "photo", { filed: true, note: "Worker file folder W-12" });

  // 4. Opening Vault — 1000.000 g @ 916 = 916000 mg fine
  const openingFineMg = 916000;
  await useLedger.getState().append({
    type: "opening_vault",
    netFineMg: openingFineMg,
    deltas: { vault: openingFineMg },
    grossMg: 1000000,
    purity: 916,
    fineMg: openingFineMg,
    form: "bar",
    notes: "Opening vault (pilot test seed)",
    reference: "OPEN-001",
  });

  // 5. WhatsApp message
  const wa = useWhatsapp.getState().add({
    senderName: "SRM Jewelers",
    senderPhone: "9830012345",
    rawText:
      "Customer: SRM Jewelers, Mobile: 9830012345, Item: Bulk handmade order - 7 rings, 10 bangles, 20 earrings, Purity: 22K, Est Weight: 500g, Wastage Charged: 10%, Delivery: 25/06/2026",
    status: "parsed",
    linkedPersonId: customer.id,
    parsed: {
      customerName: "SRM Jewelers",
      phone: "9830012345",
      itemName: "Bulk handmade order — 7 rings, 10 bangles, 20 earrings",
      category: "Mixed",
      purityLabel: "22K",
      permille: 916,
      estWeightG: 500,
      wastagePct: 10,
      quantities: [
        { kind: "rings", count: 7 },
        { kind: "bangles", count: 10 },
        { kind: "earrings", count: 20 },
      ],
      deliveryDate: "2026-06-25",
    },
  });

  // 6. Order
  const targetGrossMg = 500000; // 500.000 g
  const targetFineMg = Math.round((targetGrossMg * 916) / 1000); // 458000
  const order = await useOrders.getState().add({
    type: "wholesale",
    status: "in_production",
    customerId: customer.id,
    karigarId: karigar.id,
    expectedDelivery: "2026-06-25",
    priority: "high",
    source: "whatsapp",
    whatsappSourceId: wa.id,
    design: {
      designNumber: "SRM-2026-BULK-001",
      customerCode: "SRM",
      pattern: "Handmade traditional",
      notes: "Bulk: 7 rings + 10 bangles + 20 earrings",
      saveToCatalog: false,
    },
    item: {
      itemName: "Bulk handmade order — 7 rings, 10 bangles, 20 earrings",
      category: "Mixed",
      quantity: 37,
      size: "Mixed",
      metal: "gold",
      metalColor: "yellow",
      purity: 916,
      grossMg: targetGrossMg,
      lessMg: 0,
      netMg: targetGrossMg,
      fineMg: targetFineMg,
      expectedWastagePct: 100, // store uses tenths-of-percent (10.0%)? we keep simple int per-mille percent
      expectedWastageMg: Math.round((targetFineMg * 10) / 100),
      stoneDetails: "",
      remarks: "Pilot bulk seed",
    },
    advance: {
      cashPaise: 500000, // ₹5,000 cash advance
      cashMode: "cash",
      cashRef: "ADV-CASH-001",
      goldKind: "old_gold",
      goldGrossMg: 10000, // 10g old gold
      goldPurity: 916,
      goldFineMg: 9160,
      goldApplyMode: "apply",
      goldRatePerGram: 7000,
    },
  });
  useWhatsapp.getState().update(wa.id, { convertedOrderId: order.id, status: "converted" });

  att.save("order", order.id, "design_photo", {
    filed: true,
    note: "Customer brought 4 sample photos",
  });

  // 7. Job Card
  const job = await useJobCards.getState().add({
    orderId: order.id,
    orderNo: order.orderNo,
    customerId: customer.id,
    customerName: customer.fullName,
    karigarId: karigar.id,
    karigarName: karigar.fullName,
    itemName: order.item.itemName,
    category: order.item.category,
    purity: order.item.purity,
    targetGrossMg: order.item.grossMg,
    targetNetMg: order.item.netMg,
    targetFineMg: order.item.fineMg,
    expectedWastagePct: 10,
    status: "work_received",
    priority: "high",
    expectedDelivery: order.expectedDelivery,
  });

  att.save("jobcard", job.id, "karigar_photo", { filed: true, note: "" });

  // 8. Issue Gold — 500g @ 916 = 458000 mg fine
  const issueFineMg = 458000;
  const issueEntry = await useLedger.getState().append({
    type: "issue_to_karigar",
    netFineMg: 0,
    deltas: { vault: -issueFineMg, karigar: issueFineMg },
    grossMg: 500000,
    purity: 916,
    fineMg: issueFineMg,
    notes: `Issued to ${karigar.fullName} for Job ${job.jobNo}`,
    reference: `${job.jobNo}-ISSUE`,
  });
  // Gold-issue tracking lives entirely in the ledger now (see the `append`
  // above) — JobCard no longer carries its own issue record (mirrors the
  // real app's worker-issue-dialog.tsx, which only writes to useLedger).
  // issueSlipNo/goldIssueId are kept as synthetic ids for the seed result
  // and the print-log entry below.
  const issueSlipNo = `ISS-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-001`;
  const goldIssueId = makeId();

  // Worker Gold Book — the Workshop ledger's own custody record (distinct
  // from the vault ledger above): backs karigar_custody_statement print and
  // the Worker Gold Book UI. Linked to a SYNTHETIC order reference — not
  // `order.id`/`order.orderNo` — because order-gold-material-issue.spec.ts
  // and manufacturing-barcode.spec.ts assert an exact, order-scoped
  // issue-history count/return-completeness starting from zero for that
  // same seeded order; a real "given"+"return" pair backing the custody
  // statement's own printed ledger rows still needs an order-like reference
  // to show, just not one that collides with that other order's own count.
  const custodyRefOrderNo = "DEMO-CUSTODY-01";
  await useWorkerGoldBook.getState().addEntry({
    workerId: karigar.id,
    workerName: karigar.fullName,
    particulars: "Gold Given",
    grossMg: 500000,
    lessMg: 0,
    netMg: 500000,
    purity: 916,
    fineMg: issueFineMg,
    quantity: 1,
    notes: "Workshop opening custody balance",
    givenBy: "Staff",
    receivedBy: karigar.fullName,
    type: "given",
    orderId: "demo-custody-order",
    orderNo: custodyRefOrderNo,
  });
  await useWorkerGoldBook.getState().addEntry({
    workerId: karigar.id,
    workerName: karigar.fullName,
    particulars: "Gold Received",
    grossMg: 500000,
    lessMg: 0,
    netMg: 500000,
    purity: 916,
    fineMg: issueFineMg,
    quantity: 1,
    notes: "Workshop opening custody balance settled",
    givenBy: karigar.fullName,
    receivedBy: "Staff",
    type: "return",
    orderId: "demo-custody-order",
    orderNo: custodyRefOrderNo,
  });

  // 9. Receive Work — finished + filings + actualLoss reconcile to 458000 fine
  const filingsFineMg = 9160; // 1% as filings (return to vault as scrap-bucket)
  const scrapFineMg = 0;
  const dustFineMg = 0;
  const actualLossMg = 22900; // 5% of 458000 = 22900 (worker wastage)
  const finishedFineMg = issueFineMg - filingsFineMg - scrapFineMg - dustFineMg - actualLossMg; // 425940
  const expectedLossMg = Math.round((issueFineMg * 10) / 100); // 45800
  const overlossMg = Math.max(0, actualLossMg - expectedLossMg); // 0 → within limits

  const recEntry = await useLedger.getState().append({
    type: "receive_from_karigar",
    netFineMg: 0,
    deltas: { karigar: -finishedFineMg, finished: finishedFineMg },
    grossMg: Math.round((finishedFineMg * 1000) / 916),
    purity: 916,
    fineMg: finishedFineMg,
    notes: `Finished work received from ${karigar.fullName} for Job ${job.jobNo}`,
    reference: `${job.jobNo}-RECV`,
  });
  const filingsEntry = await useLedger.getState().append({
    type: "scrap_returned",
    netFineMg: 0,
    deltas: { karigar: -filingsFineMg, scrap: filingsFineMg },
    fineMg: filingsFineMg,
    purity: 916,
    notes: "Filings returned",
    reference: `${job.jobNo}-FILINGS`,
  });
  const wastageEntry = await useLedger.getState().append({
    type: "wastage",
    netFineMg: -actualLossMg,
    deltas: { karigar: -actualLossMg },
    fineMg: actualLossMg,
    notes: `Wastage during production (within ${expectedLossMg}mg limit)`,
    reference: `${job.jobNo}-WASTE`,
  });

  const receiveSlipNo = `RCV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-001`;
  const goldReceiveId = makeId();
  await useJobCards.getState().setWorkReceipt(job.id, {
    id: goldReceiveId,
    slipNo: receiveSlipNo,
    ts: Date.now(),
    finishedGrossMg: Math.round((finishedFineMg * 1000) / 916),
    finishedPurity: 916,
    finishedFineMg,
    scrapGrossMg: 0,
    scrapPurity: 916,
    scrapFineMg,
    filingsGrossMg: Math.round((filingsFineMg * 1000) / 916),
    filingsPurity: 916,
    filingsFineMg,
    dustFineMg,
    expectedWastagePct: 10,
    expectedLossMg,
    actualLossMg,
    overlossMg,
    qa: { finishOk: true, weightChecked: true, stoneChecked: true, readyForStock: true },
    notes: "Within wastage limit. Margin saved by karigar: 22.900 g fine.",
    ledgerEntryIds: [recEntry.id, filingsEntry.id, wastageEntry.id],
  });
  await useJobCards.getState().update(job.id, { status: "ready_for_billing" });

  // 10. Stock item from finished work
  const stockItem = await useStock.getState().add({
    itemName: "SRM Bulk Set (handmade)",
    category: "Mixed",
    purity: 916,
    grossMg: Math.round((finishedFineMg * 1000) / 916),
    netMg: Math.round((finishedFineMg * 1000) / 916),
    huid: "HUID-SRM-001",
    makingChargePct: 12, // 12% of gold value
    pricePaise: 0,
    status: "available",
    location: "vault",
    linkedOrderId: order.id,
    linkedJobId: job.id,
    linkedCustomerId: customer.id,
    notes: "From Job " + job.jobNo,
  });

  // 11. Invoice — sale to customer
  const goldRatePerGramPaise = 700000; // ₹7,000/g (test rate)
  // Also set the LIVE settings gold rate — routes that price a NEW record
  // created interactively during a test (e.g. settlement.new.tsx) read
  // useSettings' own goldRatePerGramPaise, not this seed's local constant.
  // Left at its default 0 ("NOT SET"), any such record prices as ₹0.
  useSettings.getState().setGoldRate(goldRatePerGramPaise);
  const goldValuePaise = Math.round((finishedFineMg * goldRatePerGramPaise) / 1000);
  const makingChargesPaise = Math.round((finishedFineMg * 80000) / 1000); // ₹80/g
  const stoneChargesPaise = 0;
  const otherChargesPaise = 0;
  const discountPaise = 0;
  const lineTotalPaise =
    goldValuePaise + makingChargesPaise + stoneChargesPaise + otherChargesPaise - discountPaise;
  const subtotalPaise = lineTotalPaise;
  const taxable = makingChargesPaise + stoneChargesPaise;
  const cgstPaise = Math.round((taxable * 15) / 1000);
  const sgstPaise = Math.round((taxable * 15) / 1000);
  const gstPaise = cgstPaise + sgstPaise;
  const grandTotalPaise = subtotalPaise + gstPaise;
  const invoice = await useBilling.getState().add({
    status: "issued",
    customerId: customer.id,
    customerName: customer.fullName,
    customerPhone: customer.phone,
    customerGstin: customer.gstin || undefined,
    orderId: order.id,
    orderNo: order.orderNo,
    jobId: job.id,
    jobNo: job.jobNo,
    items: [
      {
        id: makeId(),
        stockItemId: stockItem.id,
        barcode: stockItem.barcode,
        itemName: stockItem.itemName,
        category: stockItem.category,
        purity: stockItem.purity,
        grossMg: stockItem.grossMg,
        netMg: stockItem.netMg,
        fineMg: stockItem.fineMg,
        goldRatePerGramPaise,
        goldValuePaise,
        makingChargesPaise,
        stoneChargesPaise,
        otherChargesPaise,
        discountPaise,
        lineTotalPaise,
      },
    ],
    gst: "gst3" as GstKind,
    cgstPaise,
    sgstPaise,
    gstPaise,
    subtotalPaise,
    adjustmentPaise: 0,
    grandTotalPaise,
    paidPaise: 0,
    balancePaise: grandTotalPaise,
  });
  // Add a payment (full)
  const paymentRec = await useBilling.getState().addPayment(invoice.id, {
    mode: "cash",
    amountPaise: grandTotalPaise,
    reference: "CASH-001",
    notes: "Full payment received",
  });
  const paymentId = paymentRec?.id ?? "";
  // Credit note against the invoice — exercises the Unified Print Engine's
  // migrated credit_note document end-to-end in e2e (status, customer,
  // amount, reason all need a real record to render against).
  const creditNote = await useCreditNotes.getState().issue(
    {
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      customerId: customer.id,
      customerName: customer.fullName,
      amountPaise: 50000,
      goldFineMg: 0,
      reason: "Price adjustment agreed with customer after delivery.",
    },
    { id: null, email: "seed@test.local" },
  );
  // Debit note against the invoice — Unified Print Engine's migrated
  // debit_note document needs a real record to render against.
  const debitNote = await useDebitNotes.getState().issue(
    {
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      customerId: customer.id,
      customerName: customer.fullName,
      amountPaise: 25000,
      goldFineMg: 0,
      reason: "Additional making charge billed after delivery.",
    },
    { id: null, email: "seed@test.local" },
  );
  // Estimate (draft) — Unified Print Engine's migrated estimate_doc document.
  const estimate = await useEstimates.getState().create({
    customerId: customer.id,
    customerName: customer.fullName,
    customerPhone: customer.phone,
    items: [
      {
        id: makeId(),
        stockItemId: stockItem.id,
        barcode: stockItem.barcode,
        itemName: stockItem.itemName,
        category: stockItem.category,
        purity: stockItem.purity,
        grossMg: stockItem.grossMg,
        netMg: stockItem.netMg,
        fineMg: stockItem.fineMg,
        goldRatePerGramPaise,
        goldValuePaise,
        makingChargesPaise,
        stoneChargesPaise,
        otherChargesPaise,
        discountPaise,
        lineTotalPaise,
      },
    ],
    gst: "gst3" as GstKind,
    subtotalPaise,
    gstPaise,
    grandTotalPaise,
    validUntilIso: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
  });
  // Delivery challan — Unified Print Engine's migrated delivery_challan document.
  const deliveryChallan = await useDeliveryChallans.getState().create({
    customerId: customer.id,
    customerName: customer.fullName,
    items: [
      {
        itemName: stockItem.itemName,
        category: stockItem.category,
        grossMg: stockItem.grossMg,
        netMg: stockItem.grossMg,
        purity: stockItem.purity,
        fineMg: stockItem.fineMg,
        qty: 1,
      },
    ],
    purpose: "job_work",
    notes: "Sent for polishing and hallmarking.",
  });
  // Sale ledger entry — finished goes out of system
  await useLedger.getState().append({
    type: "sale",
    netFineMg: -finishedFineMg,
    deltas: { finished: -finishedFineMg },
    fineMg: finishedFineMg,
    notes: `Sale on invoice ${invoice.invoiceNo}`,
    reference: invoice.invoiceNo,
  });
  // Mark stock sold
  await useStock.getState().changeStatus(stockItem.id, "sold", "Sold on " + invoice.invoiceNo);

  // 12. Rate-cut record (even though overloss=0, create one with small symbolic value)
  // Per spec the karigar saved gold, so no real overloss penalty. We still create
  // a tiny advisory record for completeness — useful for print route test.
  const rateCut = useRateCuts.getState().add({
    karigarId: karigar.id,
    karigarName: karigar.fullName,
    jobId: job.id,
    jobNo: job.jobNo,
    overlossFineMg: 0,
    goldRatePerGramPaise,
    penaltyValuePaise: 0,
    mode: "waived",
    amountSettledPaise: 0,
    remainingPaise: 0,
    notes: "No overloss — within wastage limit; record kept for audit.",
  });

  // 13. Repair
  const repair = useRepairs.getState().add({
    repairNo: await getNextSequenceNumber("repair"),
    kind: "repair",
    status: "delivered",
    customerId: customer.id,
    customerName: customer.fullName,
    customerPhone: customer.phone,
    itemType: "Ring",
    itemDescription: "22K ring, broken shank",
    conditionNotes: "Crack near base, stone intact",
    receivedGrossMg: 4500,
    purity: 916,
    repairType: "soldering",
    workerId: karigar.id,
    workerName: karigar.fullName,
    expectedDelivery: "2026-06-22",
    estimatedChargePaise: 50000,
    advancePaise: 20000,
    advanceMode: "cash",
  });
  useRepairs
    .getState()
    .addPayment(repair.id, { mode: "cash", amountPaise: 30000, reference: "RPR-PAY-001" });
  useRepairs.getState().setStatus(repair.id, "delivered", "Repaired & polished");

  // 13b. Polishing job
  const polishing = useRepairs.getState().add({
    repairNo: await getNextSequenceNumber("repair"),
    kind: "polishing",
    status: "delivered",
    customerId: customer.id,
    customerName: customer.fullName,
    customerPhone: customer.phone,
    itemType: "Chain",
    itemDescription: "22K rope chain — full polishing",
    conditionNotes: "Surface dull; no damage",
    receivedGrossMg: 12000,
    purity: 916,
    repairType: "polishing",
    workerId: karigar.id,
    workerName: karigar.fullName,
    expectedDelivery: "2026-06-22",
    estimatedChargePaise: 30000,
    advancePaise: 0,
    advanceMode: "cash",
  });
  useRepairs.getState().setStatus(polishing.id, "delivered", "Polished and delivered");

  // 14. Worker passbook items: pre-existing loan, gold advance, withdrawal, wastage return, settlement
  const today = new Date().toISOString().slice(0, 10);
  const loan = await useWorkers.getState().addLoan({
    workerId: karigar.id,
    date: today,
    amountPaise: 50000, // ₹500
    reason: "Festival",
  });
  const goldAdv = await useWorkers.getState().addGoldAdvance({
    workerId: karigar.id,
    date: today,
    grossMg: 437,
    purity: 916,
    fineMg: 400,
    reason: "Personal use (pre-existing)",
  });
  const withdrawal = await useWorkers.getState().addWithdrawal({
    workerId: karigar.id,
    date: today,
    amountPaise: 100000,
    mode: "cash",
  });
  const advance = await useWorkers.getState().addAdvance({
    workerId: karigar.id,
    date: today,
    amountPaise: 50000,
    mode: "cash",
    notes: "Pilot seed salary advance",
  });
  const wastageReturn = await useWorkers.getState().addWastageReturn({
    workerId: karigar.id,
    date: today,
    grossMg: 250,
    purity: 916,
    fineMg: 229,
    notes: "Pilot wastage gold return (within limit)",
  });
  await useWorkers.getState().upsertAttendance({
    workerId: karigar.id,
    date: today,
    status: "present",
  });
  const settlement = await useWorkers.getState().addSettlement({
    workerId: karigar.id,
    fromDate: today,
    toDate: today,
    presentDays: 1,
    halfDays: 0,
    absentDays: 0,
    leaveDays: 0,
    payableDays: 1,
    salaryEarnedPaise: 200000,
    withdrawalsTotalPaise: 100000,
    loanDeductionPaise: 50000,
    advanceDeductionPaise: 0,
    finalCashPayablePaise: 50000,
    loanDeductions: { [loan.id]: 50000 },
    advanceDeductions: {},
    goldAdvanceFineMg: 400,
    wastageReturnedFineMg: 229,
    netGoldMg: 171,
    notes: "Pilot seed home-going settlement",
  });

  // 15. Daily Close
  const dc = useDailyCloses.getState().add({
    date: today,
    snapshot: {
      openingVaultMg: openingFineMg,
      goldIssuedMg: issueFineMg,
      goldReceivedMg: finishedFineMg + filingsFineMg,
      finishedCreatedMg: finishedFineMg,
      scrapReturnedMg: filingsFineMg,
      soldFineMg: finishedFineMg,
      closingVaultMg: openingFineMg - issueFineMg + filingsFineMg,
      karigarOutstandingMg: 0,
      balanceSheetBalanced: true,
      discrepancyMg: 0,
      invoiceCount: 1,
      salesTotalPaise: grandTotalPaise,
      cashTotalPaise: grandTotalPaise,
      upiTotalPaise: 0,
      bankTotalPaise: 0,
      cardTotalPaise: 0,
      outstandingTotalPaise: 0,
      repairPaymentsPaise: 50000,
      workerWithdrawalsPaise: 100000,
      gstCollectedPaise: gstPaise,
      jobCardsCreated: 1,
      jobCardsClosed: 0,
      repairsCreated: 1,
      repairsDelivered: 1,
    },
    checklist: {
      cashCounted: true,
      goldChecked: true,
      pendingOrdersReviewed: true,
      karigarCustodyReviewed: true,
      printReportsSaved: true,
    },
    physicalCashCountedPaise: grandTotalPaise,
    expectedCashPaise: grandTotalPaise,
    cashVariancePaise: 0,
    notes: "Pilot test seed daily close",
    ownerSignature: "Owner",
  });

  // 16. Print log entries so /reports/print-log shows real history
  usePrintLog.getState().recordPrint({
    docType: "order_slip",
    docNumber: order.orderNo,
    linkedId: order.id,
    linkedLabel: customer.fullName,
  });
  usePrintLog.getState().recordPrint({
    docType: "job_card",
    docNumber: job.jobNo,
    linkedId: job.id,
    linkedLabel: karigar.fullName,
  });
  usePrintLog.getState().recordPrint({
    docType: "gold_issue_slip",
    docNumber: issueSlipNo,
    linkedId: job.id,
    linkedLabel: karigar.fullName,
  });
  usePrintLog.getState().recordPrint({
    docType: "gold_receive_slip",
    docNumber: receiveSlipNo,
    linkedId: job.id,
    linkedLabel: karigar.fullName,
  });
  usePrintLog.getState().recordPrint({
    docType: "jewellery_tag",
    docNumber: stockItem.itemCode,
    linkedId: stockItem.id,
    linkedLabel: stockItem.itemName,
  });
  usePrintLog.getState().recordPrint({
    docType: "gst_invoice",
    docNumber: invoice.invoiceNo,
    linkedId: invoice.id,
    linkedLabel: customer.fullName,
  });
  usePrintLog.getState().recordPrint({
    docType: "payment_receipt",
    docNumber: invoice.invoiceNo,
    linkedId: invoice.id,
    linkedLabel: customer.fullName,
  });
  const lastPrint = usePrintLog.getState().recordPrint({
    docType: "daily_close_report",
    docNumber: dc.date,
    linkedId: dc.id,
    linkedLabel: dc.date,
  });

  const result = {
    customerId: customer.id,
    karigarId: karigar.id,
    outsideJewellerId: outsideJeweller.id,
    workerId: karigar.id,
    passbookWorkerId: karigar.id,
    orderId: order.id,
    orderNo: order.orderNo,
    jobId: job.id,
    jobNo: job.jobNo,
    goldIssueId,
    goldReceiveId,
    stockItemId: stockItem.id,
    invoiceId: invoice.id,
    invoiceNo: invoice.invoiceNo,
    creditNoteId: creditNote.id,
    creditNoteNo: creditNote.creditNoteNo,
    debitNoteId: debitNote.id,
    debitNoteNo: debitNote.debitNoteNo,
    estimateId: estimate.id,
    estimateNo: estimate.estimateNo,
    deliveryChallanId: deliveryChallan.id,
    deliveryChallanNo: deliveryChallan.challanNo,
    custodyRefOrderNo,
    paymentId,
    repairId: repair.id,
    polishingRepairId: polishing.id,
    rateCutId: rateCut.id,
    dailyCloseId: dc.id,
    whatsappId: wa.id,
    withdrawalId: withdrawal.id,
    advanceId: advance.id,
    loanId: loan.id,
    goldAdvanceId: goldAdv.id,
    wastageReturnId: wastageReturn.id,
    settlementId: settlement.id,
    printLogId: lastPrint.id,
    issueSlipNo,
    receiveSlipNo,
  };
  writeSeedCache(result);
  return result;
}

/** Mount once on window for Playwright harnesses. Safe to call repeatedly. */
export function installTestSeedOnWindow() {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    __mtjSeed?: () => SeedResult;
    __people_store?: typeof usePeople;
    __orders_store?: typeof useOrders;
    __ledger_store?: typeof useLedger;
    __jobcards_store?: typeof useJobCards;
    __stock_store?: typeof useStock;
    __cloud_sync_store?: unknown;
    __cloud_sync?: unknown;
    __sync_queue?: unknown;
    __sb?: unknown;
  };
  if (!w.__mtjSeed) w.__mtjSeed = seedPilotDataset;
  w.__people_store = usePeople;
  w.__orders_store = useOrders;
  w.__ledger_store = useLedger;
  w.__jobcards_store = useJobCards;
  w.__stock_store = useStock;
  void import("./data-loader").then((m) => {
    w.__cloud_sync_store = null;
    w.__cloud_sync = m;
  });
  void import("@/integrations/supabase/client").then((m) => {
    w.__sb = m.supabase;
  });
}
