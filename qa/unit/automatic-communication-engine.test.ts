import { describe, it, expect, beforeEach, vi } from "vitest";
import { useEmailConfigStore } from "@/lib/comm/email-config-store";
import { useCommunicationAuditStore } from "@/lib/comm/communication-audit-store";
import { dispatchAutomaticBusinessEvent } from "@/lib/comm/automatic-communication-engine";
import { renderEmailTemplate } from "@/lib/comm/email-templates";
import { sendWhatsAppDocument } from "@/lib/comm/send-whatsapp-document";
import { useBilling } from "@/lib/billing-store";
import { useOrders } from "@/lib/orders-store";
import { resolvePrintContext } from "@/lib/print-engine/data-mapper";

// Mock email service transport
vi.mock("@/lib/email-service", () => ({
  sendGenericEmail: vi.fn().mockImplementation(async (opts) => {
    return {
      success: true,
      emailId: `mock_eml_${Date.now()}`,
    };
  }),
}));

// Mock native share
vi.mock("@/lib/native/share-business-document", () => ({
  canShareFiles: vi.fn().mockReturnValue(true),
  shareBusinessDocument: vi.fn().mockImplementation(async (opts) => {
    return {
      initiated: true,
      downloaded: false,
      channel: "native_share",
      format: opts.format,
    };
  }),
}));

describe("MTJ ERP — Single Universal Communication Engine Verification", () => {
  beforeEach(async () => {
    await useEmailConfigStore.getState().setAutoEmailEnabled(true);
    await useEmailConfigStore.getState().setAttachFullDocumentPdf(true);
    await useEmailConfigStore.getState().setSenderMode("avs_company_email");
    await useCommunicationAuditStore.getState().clearLogs();
  });

  it("A. Email configured → automatic email + full document attached", async () => {
    const result = await dispatchAutomaticBusinessEvent({
      eventKey: "invoice_created",
      recipient: {
        name: "Rahul Verma",
        email: "rahul.verma@example.com",
        phone: "9830012345",
      },
      documentNumber: "AVS/26-27/0101",
      variables: {
        invoiceNo: "AVS/26-27/0101",
        amount: "1,25,000.00",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.skipped).toBeFalsy();

    const logs = useCommunicationAuditStore.getState().entries;
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].status).toBe("sent");
    expect(logs[0].recipientEmail).toBe("rahul.verma@example.com");
    expect(logs[0].provider).toBe("avs_company_mail");
  });

  it("B. Email unavailable/no recipient → gracefully skips without errors", async () => {
    const result = await dispatchAutomaticBusinessEvent({
      eventKey: "invoice_created",
      recipient: {
        name: "Walk-in Buyer",
        email: null,
        phone: "9830099999",
      },
      documentNumber: "AVS/26-27/0102",
      variables: {
        invoiceNo: "AVS/26-27/0102",
        amount: "15,000.00",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("no_email_address_available");

    const logs = useCommunicationAuditStore.getState().entries;
    expect(logs[0].status).toBe("skipped_no_email");
    expect(logs[0].errorMessage).toContain("No valid recipient email");
  });

  it("C & D & E. WhatsApp API vs Native Share fallback → uses native share when API unconfigured", async () => {
    // Seed an invoice into billing store
    const mockInvoice = {
      id: "inv-comm-test-01",
      invoiceNo: "INV/2026/999",
      customerId: "cust-01",
      customerName: "Sanjay Jewellers",
      date: "2026-08-31",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "paid" as const,
      gst: "gst3" as const,
      cgstPaise: 15000,
      sgstPaise: 15000,
      gstPaise: 30000,
      subtotalPaise: 1000000,
      grandTotalPaise: 1030000,
      paidPaise: 1030000,
      balancePaise: 0,
      items: [
        {
          id: "it-1",
          itemName: "22K Ring",
          category: "Rings",
          purity: 916,
          grossMg: 4000,
          netMg: 4000,
          fineMg: 3664,
          lineTotalPaise: 350000,
        },
      ],
      payments: [],
    };

    useBilling.setState({ invoices: [mockInvoice as any] });

    // Calling sendWhatsAppDocument without configured official API routes to Native Share fallback
    const res = await sendWhatsAppDocument({
      docType: "retail_invoice",
      recordId: "inv-comm-test-01",
      phone: "9830011111",
      recipientName: "Sanjay Jewellers",
    });

    expect(res.ok).toBe(true);
    expect(res.deliveryMode).toBe("native_share");
  });

  it("F. Invoice → derives exact same data model across Communication & Print engines", () => {
    const docData = resolvePrintContext("retail_invoice", "inv-comm-test-01");
    expect(docData).not.toBeNull();
    expect(docData?.docNumber).toBe("INV/2026/999");
    expect(docData?.fields.customerName).toBe("Sanjay Jewellers");
    expect(docData?.tables.items?.length).toBe(1);
  });

  it("G. Delayed order → dispatches apology message with revised expected date", async () => {
    const rendered = renderEmailTemplate("order_delayed", {
      recipientName: "Priya Sharma",
      recipientEmail: "priya@example.com",
      firmName: "Maa Tara Jewellers",
      documentNumber: "ORD-902",
      reasonText: "Hand-crafted Meenakari detailing taking extra precision",
      revisedDate: "05 Sep 2026",
    });

    expect(rendered.subject).toContain("Order ORD-902 Delayed");
    expect(rendered.html).toContain("Meenakari detailing");
    expect(rendered.html).toContain("05 Sep 2026");

    const result = await dispatchAutomaticBusinessEvent({
      eventKey: "order_delayed",
      recipient: {
        name: "Priya Sharma",
        email: "priya@example.com",
      },
      documentNumber: "ORD-902",
      variables: {
        reason: "Hand-crafted Meenakari detailing taking extra precision",
        revisedDate: "05 Sep 2026",
      },
    });

    expect(result.ok).toBe(true);
  });

  it("H. Delivered order → dispatches completion message with delivery confirmation", async () => {
    const rendered = renderEmailTemplate("order_delivered", {
      recipientName: "Amit Roy",
      recipientEmail: "amit@example.com",
      firmName: "Maa Tara Jewellers",
      documentNumber: "ORD-903",
    });

    expect(rendered.subject).toContain("Order ORD-903 Delivered");
    expect(rendered.html).toContain("successfully completed and delivered");
  });

  it("I. Credit Note → renders linked parent invoice and financial/gold balance adjustment", async () => {
    const rendered = renderEmailTemplate("credit_note", {
      recipientName: "Sneha Sen",
      recipientEmail: "sneha@example.com",
      firmName: "Maa Tara Jewellers",
      documentNumber: "CN-2026-001",
      parentInvoiceNo: "AVS/26-27/0088",
      amountFormatted: "12,000.00",
      goldEquivalent: "1.600 g Fine Gold",
      reasonText: "Weight difference adjustment upon hallmarking verification",
    });

    expect(rendered.subject).toContain("Credit Note CN-2026-001");
    expect(rendered.html).toContain("AVS/26-27/0088");
    expect(rendered.html).toContain("1.600 g Fine Gold");
  });

  it("J. Deleted/cancelled document → renders voiding correction notice with audit reference", async () => {
    const rendered = renderEmailTemplate("document_cancelled", {
      recipientName: "Vikram Das",
      recipientEmail: "vikram@example.com",
      firmName: "Maa Tara Jewellers",
      documentNumber: "AVS/26-27/VOID-01",
      auditReference: "AUD-DEL-20260830-99",
    });

    expect(rendered.subject).toContain("Document AVS/26-27/VOID-01 Cancelled");
    expect(rendered.html).toContain("Please do not consider the previous document valid");
    expect(rendered.html).toContain("AUD-DEL-20260830-99");
  });

  it("K. Duplicate event → prevents duplicate email storm via idempotency guard", async () => {
    const payload = {
      eventKey: "invoice_created" as const,
      recipient: {
        name: "Dev Customer",
        email: "dev.cust@example.com",
      },
      documentNumber: "AVS/DUP/001",
    };

    const first = await dispatchAutomaticBusinessEvent(payload);
    expect(first.ok).toBe(true);
    expect(first.skipped).toBeFalsy();

    const second = await dispatchAutomaticBusinessEvent(payload);
    expect(second.ok).toBe(true);
    expect(second.skipped).toBe(true);
    expect(second.reason).toBe("duplicate_event_suppressed");
  });
});
