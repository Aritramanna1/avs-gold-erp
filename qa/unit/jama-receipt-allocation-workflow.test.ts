/**
 * QA Unit & Invariant Test Suite:
 * Standalone Jama Receipt, Bill Clearance, and Paid Invoice Automation
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  useCustomerPaymentAllocation,
  previewPaymentAllocation,
} from "../../src/lib/customer-payment-allocation";
import { useBilling, type Invoice } from "../../src/lib/billing-store";
import { useLedger } from "../../src/lib/ledger-store";
import { gramsToMg } from "../../src/lib/gold";

function createMockInvoice(params: {
  id: string;
  invoiceNo: string;
  customerId: string;
  customerName: string;
  goldFineG: number;
  totalPaise: number;
  createdAt: number;
  status?: "draft" | "issued" | "paid" | "partial" | "cancelled";
}): Invoice {
  const goldFineMg = Math.round(gramsToMg(params.goldFineG));
  return {
    id: params.id,
    invoiceNo: params.invoiceNo,
    createdAt: params.createdAt,
    updatedAt: params.createdAt,
    status: params.status || "issued",
    customerId: params.customerId,
    customerName: params.customerName,
    transactionMode: "gold",
    totalFineMg: goldFineMg,
    items: [
      {
        id: `item_${params.id}`,
        itemName: "Necklace Gold",
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
    paidPaise: 0,
    balancePaise: params.totalPaise,
    payments: [],
  };
}

describe("Standalone Jama Receipt, Bill Clearance & Paid Invoice Automation", () => {
  const customerId = "cust_raju_das_001";
  const customerName = "Raju Das";

  beforeEach(() => {
    useBilling.setState({ invoices: [] });
    useCustomerPaymentAllocation.setState({ receipts: [], allocations: [] });
  });

  it("Clears 3 unpaid invoices FIFO (5g + 7g + 3g = 15g) from 20g Jama Receipt, leaves 5g advance credit", async () => {
    const inv1 = createMockInvoice({
      id: "inv_1",
      invoiceNo: "INV-2026-001",
      customerId,
      customerName,
      goldFineG: 5.0,
      totalPaise: 3750000,
      createdAt: 1000,
    });

    const inv2 = createMockInvoice({
      id: "inv_2",
      invoiceNo: "INV-2026-002",
      customerId,
      customerName,
      goldFineG: 7.0,
      totalPaise: 5250000,
      createdAt: 2000,
    });

    const inv3 = createMockInvoice({
      id: "inv_3",
      invoiceNo: "INV-2026-003",
      customerId,
      customerName,
      goldFineG: 3.0,
      totalPaise: 2250000,
      createdAt: 3000,
    });

    useBilling.setState({ invoices: [inv1, inv2, inv3] });

    // Preview allocation first
    const preview = previewPaymentAllocation({
      customerId,
      customerName,
      invoices: [inv1, inv2, inv3],
      goldReceivedMg: 20000, // 20.000g Fine Gold
      cashReceivedPaise: 0,
      mode: "gold",
      strategy: "fifo",
    });

    expect(preview.eligibleInvoiceCount).toBe(3);
    expect(preview.clearedInvoiceCount).toBe(3);
    expect(preview.partiallyClearedInvoiceCount).toBe(0);
    expect(preview.totalAllocatedGoldMg).toBe(15000); // 15.000g allocated
    expect(preview.unappliedGoldMg).toBe(5000); // 5.000g excess credit

    // Execute Standalone Jama Receipt and auto-allocation
    const receipt = await useCustomerPaymentAllocation
      .getState()
      .receiveCustomerPaymentAndAllocate({
        customerId,
        customerName,
        customerPhone: "9876543210",
        goldReceivedMg: 20000,
        cashReceivedPaise: 0,
        mode: "gold",
        strategy: "fifo",
        notes: "Received 20g 995 pure gold for bill clearance and future booking",
      });

    expect(receipt).toBeDefined();
    expect(receipt.receiptNo).toBeTruthy();
    expect(receipt.goldReceivedMg).toBe(20000);
    expect(receipt.goldAllocatedMg).toBe(15000);
    expect(receipt.goldUnappliedMg).toBe(5000);
    expect(receipt.allocations.length).toBe(3);

    // Verify all 3 invoices became PAID
    const updatedInvoices = useBilling.getState().invoices;
    const u1 = updatedInvoices.find((i) => i.id === "inv_1");
    const u2 = updatedInvoices.find((i) => i.id === "inv_2");
    const u3 = updatedInvoices.find((i) => i.id === "inv_3");

    expect(u1?.status).toBe("paid");
    expect(u2?.status).toBe("paid");
    expect(u3?.status).toBe("paid");

    expect(u1?.payments.some((p) => p.mode === "customer_gold_credit" && p.goldFineMg === 5000)).toBe(true);
    expect(u2?.payments.some((p) => p.mode === "customer_gold_credit" && p.goldFineMg === 7000)).toBe(true);
    expect(u3?.payments.some((p) => p.mode === "customer_gold_credit" && p.goldFineMg === 3000)).toBe(true);
  });

  it("Partial allocation: 10g deposit against 15g invoice results in PARTIAL status", async () => {
    const inv1 = createMockInvoice({
      id: "inv_p1",
      invoiceNo: "INV-2026-P01",
      customerId,
      customerName,
      goldFineG: 15.0,
      totalPaise: 11250000,
      createdAt: 1000,
    });

    useBilling.setState({ invoices: [inv1] });

    const receipt = await useCustomerPaymentAllocation
      .getState()
      .receiveCustomerPaymentAndAllocate({
        customerId,
        customerName,
        goldReceivedMg: 10000, // 10g
        cashReceivedPaise: 0,
        mode: "gold",
        strategy: "fifo",
      });

    expect(receipt.goldReceivedMg).toBe(10000);
    expect(receipt.goldAllocatedMg).toBe(10000);
    expect(receipt.goldUnappliedMg).toBe(0);

    const updatedInvoices = useBilling.getState().invoices;
    const u1 = updatedInvoices.find((i) => i.id === "inv_p1");
    expect(u1?.status).toBe("partial");
  });
});
