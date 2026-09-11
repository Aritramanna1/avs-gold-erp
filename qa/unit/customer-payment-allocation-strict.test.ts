/**
 * QA Unit & Invariant Test Suite:
 * Automatic Customer Outstanding Payment Allocation (Gold-First & FIFO)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  previewPaymentAllocation,
  useCustomerPaymentAllocation,
  type AllocationStrategy,
} from "../../src/lib/customer-payment-allocation";
import { useBilling, type Invoice } from "../../src/lib/billing-store";
import { gramsToMg, mgToGrams } from "../../src/lib/gold";

function createMockInvoice(params: {
  id: string;
  invoiceNo: string;
  customerId: string;
  goldFineG: number;
  totalPaise: number;
  createdAt?: number;
  dueAt?: number;
  status?: "draft" | "issued" | "paid" | "partial" | "cancelled";
  paidPaise?: number;
  transactionMode?: "gold" | "cash" | "mixed";
}): Invoice {
  const goldFineMg = Math.round(gramsToMg(params.goldFineG));
  return {
    id: params.id,
    invoiceNo: params.invoiceNo,
    createdAt: params.createdAt || Date.now(),
    updatedAt: params.createdAt || Date.now(),
    dueAt: params.dueAt,
    status: params.status || "issued",
    customerId: params.customerId,
    customerName: "Test Jeweller Customer",
    transactionMode: params.transactionMode || "gold",
    totalFineMg: goldFineMg,
    items: [
      {
        id: `item_${params.id}`,
        itemName: "Gold Necklace",
        category: "Chains",
        purity: 995,
        grossMg: goldFineMg,
        netMg: goldFineMg,
        fineMg: goldFineMg,
        goldRatePerGramPaise: 750000,
        goldValuePaise: params.totalPaise,
        makingChargesPaise: 0,
        stoneChargesPaise: 0,
        hallmarkChargesPaise: 0,
        otherChargesPaise: 0,
        discountPaise: 0,
        lineTotalPaise: params.totalPaise,
      },
    ],
    gst: "none",
    cgstPaise: 0,
    sgstPaise: 0,
    gstPaise: 0,
    tcsPaise: 0,
    subtotalPaise: params.totalPaise,
    adjustmentPaise: 0,
    grandTotalPaise: params.totalPaise,
    paidPaise: params.paidPaise || 0,
    balancePaise: Math.max(0, params.totalPaise - (params.paidPaise || 0)),
    payments: [],
  };
}

describe("Automatic Customer Outstanding Payment Allocation Engine", () => {
  const testCustomerId = "cust_test_999";

  beforeEach(() => {
    useBilling.setState({ invoices: [] });
    useCustomerPaymentAllocation.setState({ receipts: [], allocations: [] });
  });

  it("Scenario 1: 5 invoices — payment clears all invoices to PAID", () => {
    const invoices: Invoice[] = [
      createMockInvoice({ id: "inv_1", invoiceNo: "INV-001", customerId: testCustomerId, goldFineG: 10, totalPaise: 7500000, createdAt: 1000 }),
      createMockInvoice({ id: "inv_2", invoiceNo: "INV-002", customerId: testCustomerId, goldFineG: 15, totalPaise: 11250000, createdAt: 2000 }),
      createMockInvoice({ id: "inv_3", invoiceNo: "INV-003", customerId: testCustomerId, goldFineG: 20, totalPaise: 15000000, createdAt: 3000 }),
      createMockInvoice({ id: "inv_4", invoiceNo: "INV-004", customerId: testCustomerId, goldFineG: 25, totalPaise: 18750000, createdAt: 4000 }),
      createMockInvoice({ id: "inv_5", invoiceNo: "INV-005", customerId: testCustomerId, goldFineG: 10, totalPaise: 7500000, createdAt: 5000 }),
    ];

    // Total gold due = 80g
    const preview = previewPaymentAllocation({
      customerId: testCustomerId,
      customerName: "Test Customer",
      invoices,
      goldReceivedMg: 80000, // 80g
      cashReceivedPaise: 0,
      mode: "gold",
    });

    expect(preview.eligibleInvoiceCount).toBe(5);
    expect(preview.clearedInvoiceCount).toBe(5);
    expect(preview.partiallyClearedInvoiceCount).toBe(0);
    expect(preview.totalAllocatedGoldMg).toBe(80000);
    expect(preview.remainingOutstandingGoldMg).toBe(0);
    expect(preview.unappliedGoldMg).toBe(0);

    for (const item of preview.items) {
      expect(item.nextStatus).toBe("paid");
      expect(item.remainingGoldMg).toBe(0);
    }
  });

  it("Scenario 2: 50 invoices — payment clears first 40 invoices in FIFO order", () => {
    const invoices: Invoice[] = [];
    // 50 invoices of 2.000g each = 100.000g total
    for (let i = 1; i <= 50; i++) {
      invoices.push(
        createMockInvoice({
          id: `inv_${i}`,
          invoiceNo: `INV-${String(i).padStart(3, "0")}`,
          customerId: testCustomerId,
          goldFineG: 2,
          totalPaise: 1500000,
          createdAt: 1000 + i * 10,
        }),
      );
    }

    // Customer pays 80.000g (clears first 40 invoices of 2g each)
    const preview = previewPaymentAllocation({
      customerId: testCustomerId,
      customerName: "Test Customer",
      invoices,
      goldReceivedMg: 80000, // 80g
      cashReceivedPaise: 0,
      mode: "gold",
    });

    expect(preview.eligibleInvoiceCount).toBe(50);
    expect(preview.clearedInvoiceCount).toBe(40);
    expect(preview.partiallyClearedInvoiceCount).toBe(0);
    expect(preview.unaffectedInvoiceCount).toBe(10);
    expect(preview.totalAllocatedGoldMg).toBe(80000);
    expect(preview.remainingOutstandingGoldMg).toBe(20000); // 20g remaining

    // Verify first 40 are paid and last 10 remain issued
    for (let i = 0; i < 40; i++) {
      expect(preview.items[i].nextStatus).toBe("paid");
      expect(preview.items[i].appliedGoldMg).toBe(2000);
    }
    for (let i = 40; i < 50; i++) {
      expect(preview.items[i].nextStatus).toBe("issued");
      expect(preview.items[i].appliedGoldMg).toBe(0);
    }
  });

  it("Scenario 3: Partial payment against the next invoice", () => {
    // Invoice A: 30g, Invoice B: 25g, Invoice C: 40g (Total: 95g)
    const invoices: Invoice[] = [
      createMockInvoice({ id: "inv_a", invoiceNo: "INV-A", customerId: testCustomerId, goldFineG: 30, totalPaise: 22500000, createdAt: 1000 }),
      createMockInvoice({ id: "inv_b", invoiceNo: "INV-B", customerId: testCustomerId, goldFineG: 25, totalPaise: 18750000, createdAt: 2000 }),
      createMockInvoice({ id: "inv_c", invoiceNo: "INV-C", customerId: testCustomerId, goldFineG: 40, totalPaise: 30000000, createdAt: 3000 }),
    ];

    // Customer pays 50g
    const preview = previewPaymentAllocation({
      customerId: testCustomerId,
      customerName: "Test Customer",
      invoices,
      goldReceivedMg: 50000, // 50g
      cashReceivedPaise: 0,
      mode: "gold",
    });

    expect(preview.clearedInvoiceCount).toBe(1); // Inv A is paid
    expect(preview.partiallyClearedInvoiceCount).toBe(1); // Inv B is partial
    expect(preview.unaffectedInvoiceCount).toBe(1); // Inv C is unaffected

    // Inv A: 30g allocated -> PAID
    expect(preview.items[0].appliedGoldMg).toBe(30000);
    expect(preview.items[0].remainingGoldMg).toBe(0);
    expect(preview.items[0].nextStatus).toBe("paid");

    // Inv B: 20g allocated -> 5g remaining -> PARTIAL
    expect(preview.items[1].appliedGoldMg).toBe(20000);
    expect(preview.items[1].remainingGoldMg).toBe(5000);
    expect(preview.items[1].nextStatus).toBe("partial");

    // Inv C: 0g allocated -> 40g remaining -> ISSUED
    expect(preview.items[2].appliedGoldMg).toBe(0);
    expect(preview.items[2].remainingGoldMg).toBe(40000);
    expect(preview.items[2].nextStatus).toBe("issued");

    expect(preview.remainingOutstandingGoldMg).toBe(45000); // 45g remaining
  });

  it("Scenario 4: Payment exceeds total outstanding (Overpayment surplus)", () => {
    // Total outstanding = 100g
    const invoices: Invoice[] = [
      createMockInvoice({ id: "inv_1", invoiceNo: "INV-001", customerId: testCustomerId, goldFineG: 50, totalPaise: 37500000, createdAt: 1000 }),
      createMockInvoice({ id: "inv_2", invoiceNo: "INV-002", customerId: testCustomerId, goldFineG: 50, totalPaise: 37500000, createdAt: 2000 }),
    ];

    // Customer pays 110g
    const preview = previewPaymentAllocation({
      customerId: testCustomerId,
      customerName: "Test Customer",
      invoices,
      goldReceivedMg: 110000, // 110g
      cashReceivedPaise: 0,
      mode: "gold",
    });

    expect(preview.totalAllocatedGoldMg).toBe(100000); // 100g allocated
    expect(preview.unappliedGoldMg).toBe(10000); // 10g unapplied advance credit
    expect(preview.remainingOutstandingGoldMg).toBe(0);
    expect(preview.clearedInvoiceCount).toBe(2);
  });

  it("Scenario 5: Mixed payment allocates gold to gold and cash to cash separately", () => {
    const invoices: Invoice[] = [
      createMockInvoice({ id: "inv_1", invoiceNo: "INV-001", customerId: testCustomerId, goldFineG: 30, totalPaise: 5000000, createdAt: 1000, transactionMode: "mixed" }),
      createMockInvoice({ id: "inv_2", invoiceNo: "INV-002", customerId: testCustomerId, goldFineG: 20, totalPaise: 5000000, createdAt: 2000, transactionMode: "mixed" }),
    ];

    const preview = previewPaymentAllocation({
      customerId: testCustomerId,
      customerName: "Test Customer",
      invoices,
      goldReceivedMg: 50000, // 50g gold
      cashReceivedPaise: 5000000, // ₹50,000 cash
      mode: "mixed",
    });

    expect(preview.totalAllocatedGoldMg).toBe(50000);
    expect(preview.totalAllocatedCashPaise).toBe(5000000);
    expect(preview.remainingOutstandingGoldMg).toBe(0);
    expect(preview.remainingOutstandingCashPaise).toBe(5000000); // remaining ₹50,000 cash on inv_2
  });

  it("Scenario 6: End-to-end atomic execution with idempotency protection and reversal", async () => {
    const inv1 = createMockInvoice({ id: "inv_e2e_1", invoiceNo: "INV-E2E-1", customerId: testCustomerId, goldFineG: 10, totalPaise: 7500000, createdAt: 1000 });
    const inv2 = createMockInvoice({ id: "inv_e2e_2", invoiceNo: "INV-E2E-2", customerId: testCustomerId, goldFineG: 15, totalPaise: 11250000, createdAt: 2000 });

    useBilling.setState({ invoices: [inv1, inv2] });

    const idempotencyKey = "test_idempotency_12345";

    // First submission
    const receipt1 = await useCustomerPaymentAllocation.getState().receiveCustomerPaymentAndAllocate({
      customerId: testCustomerId,
      customerName: "Test Customer",
      goldReceivedMg: 25000, // 25g
      cashReceivedPaise: 0,
      mode: "gold",
      idempotencyKey,
    });

    expect(receipt1.receiptNo).toBeDefined();
    expect(receipt1.goldAllocatedMg).toBe(25000);
    expect(receipt1.allocations.length).toBe(2);

    // Verify invoice states updated in billing store
    const updatedInvoices = useBilling.getState().invoices;
    const updatedInv1 = updatedInvoices.find((i) => i.id === "inv_e2e_1");
    const updatedInv2 = updatedInvoices.find((i) => i.id === "inv_e2e_2");

    expect(updatedInv1?.status).toBe("paid");
    expect(updatedInv2?.status).toBe("paid");

    // Second submission with same idempotency key (double-click simulation)
    const receipt2 = await useCustomerPaymentAllocation.getState().receiveCustomerPaymentAndAllocate({
      customerId: testCustomerId,
      customerName: "Test Customer",
      goldReceivedMg: 25000,
      cashReceivedPaise: 0,
      mode: "gold",
      idempotencyKey,
    });

    // Must return the exact same receipt without duplicating allocations
    expect(receipt2.id).toBe(receipt1.id);
    expect(useCustomerPaymentAllocation.getState().receipts.length).toBe(1);

    // Reversal Test
    const reverseRes = await useCustomerPaymentAllocation.getState().reverseCustomerPaymentAllocation(
      receipt1.id,
      "Customer returned cheque / cancelled settlement",
    );

    expect(reverseRes.success).toBe(true);
    expect(reverseRes.receipt?.reversedAt).toBeDefined();

    // Verify invoices restored to unpaid
    const restoredInvoices = useBilling.getState().invoices;
    const restoredInv1 = restoredInvoices.find((i) => i.id === "inv_e2e_1");
    const restoredInv2 = restoredInvoices.find((i) => i.id === "inv_e2e_2");

    expect(restoredInv1?.status).toBe("issued");
    expect(restoredInv2?.status).toBe("issued");
  });
});
