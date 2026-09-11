import { describe, it, expect, beforeEach } from "vitest";
import { useBilling, type Invoice } from "@/lib/billing-store";
import { usePeople, type Person } from "@/lib/people-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { resolvePrintContext } from "@/lib/print-engine/data-mapper";
import {
  ensureCustomerLedgerForPrint,
  isCustomerLedgerDocType,
} from "@/lib/billing-print-prep";
import { buildCustomerLedgerStatementData, buildCustomerUnpaidInvoicesData, buildCustomerPaidInvoicesData } from "@/lib/print-engine/ledger-statements-data";
import { buildInvoicePrintData } from "@/lib/print-engine/invoice-data";

describe("Customer Ledger Print Hydration and Balance Rendering", () => {
  const dummyPerson: Person = {
    id: "cust-test-101",
    fullName: "Praveen Jewellers",
    phone: "9876543210",
    email: "praveen@test.com",
    type: "customer",
    active: true,
    currentAddress: "123 Market Street",
    villageCity: "Surat",
    state: "Gujarat",
    gstin: "24AAAAA0000A1Z5",
    pan: "AAAAA0000A",
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
  };

  const dummyInvoice: Invoice = {
    id: "inv-test-101",
    invoiceNo: "INV-2026-101",
    firmId: "firm-1",
    branchId: "branch-1",
    customerId: "cust-test-101",
    customerName: "Praveen Jewellers",
    customerPhone: "9876543210",
    customerGstin: "24AAAAA0000A1Z5",
    status: "partially_paid",
    billingType: "retail",
    transactionMode: "cash",
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now(),
    subtotalPaise: 5000000,
    cgstPaise: 75000,
    sgstPaise: 75000,
    adjustmentPaise: 0,
    roundOffPaise: 0,
    tcsPaise: 0,
    grandTotalPaise: 5150000,
    paidPaise: 2000000,
    balancePaise: 3150000,
    items: [
      {
        id: "item-1",
        itemName: "Gold Bangle 22K",
        metalKind: "gold",
        purity: 916,
        pcs: 1,
        grossMg: 15000,
        netMg: 15000,
        fineMg: 13809,
        wastagePct: 0,
        goldRatePerGramPaise: 750000,
        goldValuePaise: 5000000,
        makingChargesPaise: 0,
        hallmarkChargesPaise: 0,
        stoneChargesPaise: 0,
        otherChargesPaise: 0,
        lineTotalPaise: 5000000,
        appliedRules: {} as any,
      },
    ],
    payments: [
      {
        id: "pay-1",
        mode: "cash",
        amountPaise: 2000000,
        ts: Date.now() - 1800000,
      },
    ],
  };

  beforeEach(() => {
    usePeople.setState({ people: [dummyPerson] });
    useBilling.setState({ invoices: [dummyInvoice], payments: [] });
    useGoldSettlement.setState({ settlements: [] });
  });

  it("identifies customer ledger doc types correctly", () => {
    expect(isCustomerLedgerDocType("customer_ledger_statement")).toBe(true);
    expect(isCustomerLedgerDocType("customer_unpaid_invoices")).toBe(true);
    expect(isCustomerLedgerDocType("customer_paid_invoices")).toBe(true);
    expect(isCustomerLedgerDocType("karigar_custody_statement")).toBe(true);
    expect(isCustomerLedgerDocType("gst_invoice")).toBe(false);
  });

  it("ensureCustomerLedgerForPrint executes cleanly without throwing", async () => {
    await expect(ensureCustomerLedgerForPrint("cust-test-101")).resolves.not.toThrow();
  });

  it("compiles customer ledger statement with non-zero balances and formatted strings", () => {
    const data = buildCustomerLedgerStatementData("cust-test-101");
    expect(data).not.toBeNull();
    expect(data?.fields.customerName).toBe("Praveen Jewellers");
    expect(data?.fields.goldBalanceLabel).toContain("g fine");
    expect(data?.fields.moneyBalanceLabel).toContain("INR");
    // Since there's an invoice with balance 3150000, money due should reflect in closingCashText / closingOutstandingText
    expect(data?.fields.closingCashText).toContain("INR 31,500.00");
    expect(data?.tables.entries.length).toBeGreaterThan(0);
    expect(data?.tables.billWiseReconciliation.length).toBe(1);
    expect(data?.tables.billWiseReconciliation[0].invoiceNo).toBe("INV-2026-101");
    expect(data?.tables.billWiseReconciliation[0].status).toBe("PARTIAL");
  });

  it("compiles customer unpaid invoices with valid breakdown rows and totals", () => {
    const data = buildCustomerUnpaidInvoicesData("cust-test-101");
    expect(data).not.toBeNull();
    expect(data?.fields.customerName).toBe("Praveen Jewellers");
    expect(data?.fields.unpaidCountText).toContain("1 Unpaid / Partial Invoices");
    expect(data?.fields.totalOutstandingCashText).toBe("₹ 31,500.00");
    expect(data?.tables.items.length).toBe(1);
    expect(data?.tables.items[0].invoiceNo).toBe("INV-2026-101");
  });

  it("compiles customer paid invoices correctly when fully settled", () => {
    useBilling.setState({
      invoices: [
        {
          ...dummyInvoice,
          id: "inv-paid-102",
          invoiceNo: "INV-PAID-102",
          status: "paid",
          paidPaise: 5150000,
          balancePaise: 0,
        },
      ],
    });

    const data = buildCustomerPaidInvoicesData("cust-test-101");
    expect(data).not.toBeNull();
    expect(data?.fields.customerName).toBe("Praveen Jewellers");
    expect(data?.fields.paidCountText).toContain("1 Settled Invoices");
    expect(data?.tables.items.length).toBe(1);
    expect(data?.tables.items[0].invoiceNo).toBe("INV-PAID-102");
  });

  it("resolves print context through universal data-mapper cleanly", () => {
    const statementContext = resolvePrintContext("customer_ledger_statement", "cust-test-101");
    expect(statementContext).not.toBeNull();
    expect(statementContext?.docType).toBe("customer_ledger_statement");

    const unpaidContext = resolvePrintContext("customer_unpaid_invoices", "cust-test-101");
    expect(unpaidContext).not.toBeNull();
    expect(unpaidContext?.docType).toBe("customer_unpaid_invoices");
  });

  it("provides live compiled customer ledger fallback for invoice party snapshots", () => {
    const invoicePrintData = buildInvoicePrintData(dummyInvoice);
    expect(invoicePrintData).not.toBeNull();
    expect(invoicePrintData?.flags.hasPartyPrintSnapshot).toBe(true);
    expect(invoicePrintData?.fields.closingCashLabel).toBe("₹31,500.00");
  });
});
