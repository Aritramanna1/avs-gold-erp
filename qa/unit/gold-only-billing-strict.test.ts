import { describe, it, expect } from "vitest";
import type { Invoice, InvoiceItem, PaymentRecord } from "@/lib/billing-store";
import { rowToInvoice } from "@/lib/billing-query";
import { buildInvoicePrintData } from "@/lib/print-engine/invoice-data";
import { generateInvoicePdf, generateGoldSettlementPdf } from "@/lib/pdf/document-pdf-generator";
import { buildCustomerSettlementSlipData } from "@/lib/customer-settlement-slip";

describe("Strict Gold-Only Billing & Document Consistency", () => {
  const mockGoldItem: InvoiceItem = {
    id: "item-1",
    itemName: "22K Traditional Bangle",
    category: "Bangles",
    purity: 916,
    grossMg: 12450,
    netMg: 12450,
    fineMg: 11404,
    goldRatePerGramPaise: 750000,
    goldValuePaise: 8553000,
    makingChargesPaise: 50000,
    makingChargesGoldMg: 66,
    stoneChargesPaise: 0,
    hallmarkChargesPaise: 4500,
    hallmarkChargesGoldMg: 6,
    otherChargesPaise: 0,
    discountPaise: 0,
    lineTotalPaise: 8607500,
    chargeMode: "job_work",
  };

  const mockGoldPayment: PaymentRecord = {
    id: "pay-1",
    ts: Date.now(),
    mode: "gold_exchange",
    amountPaise: 0,
    goldGrossMg: 12450,
    goldPurity: 916,
    goldFineMg: 11404,
    goldRatePerGramPaise: 750000,
    reference: "Physical Gold Received (22K)",
    notes: "Full payment received in 916 gold",
  };

  const mockCashItem: InvoiceItem = {
    id: "item-cash-1",
    itemName: "Ready Stock Ring",
    category: "Rings",
    purity: 916,
    grossMg: 5000,
    netMg: 5000,
    fineMg: 4580,
    goldRatePerGramPaise: 750000,
    goldValuePaise: 3435000,
    makingChargesPaise: 35000,
    stoneChargesPaise: 0,
    hallmarkChargesPaise: 4500,
    otherChargesPaise: 0,
    discountPaise: 0,
    lineTotalPaise: 3474500,
    chargeMode: "full_value",
  };

  const mockCashPayment: PaymentRecord = {
    id: "pay-cash-1",
    ts: Date.now(),
    mode: "cash",
    amountPaise: 3474500,
    reference: "CASH-COUNTER-01",
    notes: "Full settlement in cash",
  };

  it("TEST 1: GOLD-ONLY billing transaction contains zero customer-facing cash representation", () => {
    const goldOnlyInvoice: Invoice = {
      id: "inv-gold-1",
      invoiceNo: "AVS/26-27/0001",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "paid",
      billingType: "job_work",
      transactionMode: "gold",
      customerId: "cust-1",
      customerName: "Ramesh Jewellers",
      items: [mockGoldItem],
      gst: "gst3",
      cgstPaise: 129113,
      sgstPaise: 129112,
      gstPaise: 258225,
      tcsPaise: 0,
      subtotalPaise: 8607500,
      adjustmentPaise: 0,
      grandTotalPaise: 8865725,
      paidPaise: 0,
      balancePaise: 0,
      payments: [mockGoldPayment],
    };

    const printData = buildInvoicePrintData(goldOnlyInvoice);

    // Assert strictly Gold-First flags and labels
    expect(printData.flags.isPureGold).toBe(true);
    expect(printData.flags.isGoldOnly).toBe(true);
    expect(printData.flags.hasCash).toBe(false);

    // Grand total is strictly Fine Gold, with zero rupee amounts
    expect(printData.fields.grandTotalLabel).toBe("11.404 g Fine Gold");
    expect(printData.fields.goldGrandTotalLabel).toBe("11.404 g Fine Gold");
    expect(printData.fields.paidLabel).toBe("11.404 g Fine Gold");
    expect(printData.fields.balanceLabel).toBe("0.000 g Fine Gold");
    expect(printData.fields.subtotalLabel).toBe("11.404 g Fine Gold");

    // Cash-specific fields must be empty / suppressed
    expect(printData.fields.openingCashLabel).toBe("");
    expect(printData.fields.closingCashLabel).toBe("");
    expect(printData.fields.cashAdvanceLabel).toBe("");
    expect(printData.fields.gstSummaryLabel).toBe("");
    expect(printData.fields.tcsLabel).toBe("");
    expect(printData.fields.roundOffLabel).toBe("");

    // Amount in words is in Grams Fine Gold Only
    expect(printData.fields.amountInWordsText).toContain("Grams Fine Gold Only (995 Touch Basis)");
    expect(printData.fields.amountInWordsText).not.toContain("Rupees");
  });

  it("TEST 2: CASH-ONLY transaction renders cash fields correctly", () => {
    const cashInvoice: Invoice = {
      id: "inv-cash-1",
      invoiceNo: "AVS/26-27/0002",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "paid",
      billingType: "ready_stock",
      transactionMode: "cash",
      customerId: "cust-2",
      customerName: "Suresh Patil",
      items: [mockCashItem],
      gst: "gst3",
      cgstPaise: 52118,
      sgstPaise: 52117,
      gstPaise: 104235,
      tcsPaise: 0,
      subtotalPaise: 3474500,
      adjustmentPaise: 0,
      grandTotalPaise: 3578735,
      paidPaise: 3578735,
      balancePaise: 0,
      payments: [mockCashPayment],
    };

    const printData = buildInvoicePrintData(cashInvoice);

    expect(printData.flags.isPureGold).toBe(false);
    expect(printData.flags.hasCash).toBe(true);
    expect(printData.fields.grandTotalLabel).toContain("₹");
    expect(printData.fields.amountInWordsText).toContain("Rupees");
  });

  it("TEST 3: MIXED transaction shows gold and cash dimensions separately", () => {
    const mixedInvoice: Invoice = {
      id: "inv-mixed-1",
      invoiceNo: "AVS/26-27/0003",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "paid",
      billingType: "ready_stock",
      transactionMode: "mixed",
      customerId: "cust-3",
      customerName: "Mahesh Traders",
      items: [mockCashItem],
      gst: "gst3",
      cgstPaise: 52118,
      sgstPaise: 52117,
      gstPaise: 104235,
      tcsPaise: 0,
      subtotalPaise: 3474500,
      adjustmentPaise: 0,
      grandTotalPaise: 3578735,
      paidPaise: 578735,
      balancePaise: 0,
      payments: [
        {
          id: "pay-m-1",
          ts: Date.now(),
          mode: "gold_exchange",
          amountPaise: 3000000,
          goldGrossMg: 4366,
          goldPurity: 916,
          goldFineMg: 4000,
          goldRatePerGramPaise: 750000,
          reference: "Part Metal",
        },
        {
          id: "pay-m-2",
          ts: Date.now(),
          mode: "cash",
          amountPaise: 578735,
          reference: "Shortfall Cash",
        },
      ],
    };

    const printData = buildInvoicePrintData(mixedInvoice);

    expect(printData.flags.isPureGold).toBe(false);
    expect(printData.flags.hasCash).toBe(true);
    expect(printData.flags.hasPayments).toBe(true);
    expect(printData.tables.payments.length).toBe(2);
  });

  it("TEST 4: Reopening / re-deserializing GOLD-ONLY invoice preserves GOLD ONLY mode", () => {
    const rawRow = {
      id: "inv-reload-1",
      invoice_no: "AVS/26-27/0004",
      customer_id: "cust-1",
      order_id: null,
      status: "paid",
      subtotal_paise: 8607500,
      gst_paise: 0,
      grand_total_paise: 8607500,
      paid_paise: 0,
      balance_paise: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      data: {
        id: "inv-reload-1",
        invoiceNo: "AVS/26-27/0004",
        billingType: "job_work",
        transactionMode: "gold",
        customerId: "cust-1",
        customerName: "Ramesh Jewellers",
        items: [mockGoldItem],
        payments: [mockGoldPayment],
        paidPaise: 0,
        balancePaise: 0,
      },
    };

    const deserialized = rowToInvoice(rawRow);

    expect(deserialized.transactionMode).toBe("gold");
    const printData = buildInvoicePrintData(deserialized);
    expect(printData.flags.isPureGold).toBe(true);
    expect(printData.fields.grandTotalLabel).toBe("11.404 g Fine Gold");
  });

  it("TEST 5: PDF generator outputs 100% gold document for gold invoices", () => {
    const goldOnlyInvoice: Invoice = {
      id: "inv-pdf-1",
      invoiceNo: "AVS/26-27/0005",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "paid",
      billingType: "job_work",
      transactionMode: "gold",
      customerId: "cust-1",
      customerName: "Ramesh Jewellers",
      items: [mockGoldItem],
      gst: "gst3",
      cgstPaise: 0,
      sgstPaise: 0,
      gstPaise: 0,
      tcsPaise: 0,
      subtotalPaise: 8607500,
      adjustmentPaise: 0,
      grandTotalPaise: 8607500,
      paidPaise: 0,
      balancePaise: 0,
      payments: [mockGoldPayment],
    };

    const mockFirm = {
      shopName: "AVS Gold Workshop",
      address: "Main Market, Kolhapur",
      phone: "+91 9876543210",
      email: "info@avsgold.in",
      gstin: "27AAAAA0000A1Z5",
    };

    const pdfBlob = generateInvoicePdf(goldOnlyInvoice, mockFirm as any);
    expect(pdfBlob).toBeInstanceOf(Blob);
    expect(pdfBlob.size).toBeGreaterThan(1000);
  });

  it("TEST 6: Customer settlement slip for GOLD-ONLY contains pure gold data", () => {
    const goldOnlyInvoice: Invoice = {
      id: "inv-slip-1",
      invoiceNo: "AVS/26-27/0006",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "paid",
      billingType: "job_work",
      transactionMode: "gold",
      customerId: "cust-1",
      customerName: "Ramesh Jewellers",
      items: [mockGoldItem],
      gst: "gst3",
      cgstPaise: 0,
      sgstPaise: 0,
      gstPaise: 0,
      tcsPaise: 0,
      subtotalPaise: 8607500,
      adjustmentPaise: 0,
      grandTotalPaise: 8607500,
      paidPaise: 0,
      balancePaise: 0,
      payments: [mockGoldPayment],
    };

    const slip = buildCustomerSettlementSlipData(goldOnlyInvoice);
    expect(slip.goldUsedFineMg).toBe(11404);
    expect(slip.goldReceivedFineMg).toBe(11404);
    expect(slip.cashReceivedPaise).toBe(0);
  });
});
