/**
 * AVS ERP — Supplier Portal Engine Automated Unit Tests
 *
 * Verifies:
 * 1. Purchase Order Lifecycle: Acknowledgement (Accept, Reject, Request Change)
 * 2. Outbound Dispatch Creation & Logistics Waybill Tracking
 * 3. Inbound Goods Receiving & Quality Inspection (Assay results, Rejection audit)
 * 4. Supplier Invoicing & Payment Posting
 * 5. Supplier Document Vault Upload & Classification
 * 6. Procurement Communication Messages
 * 7. Deterministic AI Read Tools (AI Strictly OFF)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  useSupplierPortalStore,
  SUPPLIER_PORTAL_AI_TOOLS,
} from "@/lib/supplier-portal-store";

describe("AVS ERP — Supplier Portal State Engine", () => {
  beforeEach(() => {
    // Reset state before each test
    useSupplierPortalStore.setState({
      purchaseOrders: [
        {
          id: "po-test-1",
          poNumber: "AVS-PO-2026-000999",
          supplierId: "sup-01",
          supplierName: "Royal Bullion & Alloy Refiners",
          orderDate: "2026-09-01",
          expectedDeliveryDate: "2026-09-15",
          deliveryAddress: "AVS Bullion Vault, Mumbai",
          paymentTerms: "Net 15 Days after QC Inspection",
          totalAmountPaise: 74000000, // ₹7,40,000
          paidAmountPaise: 0,
          status: "pending_confirmation",
          items: [
            {
              id: "poi-test-1",
              description: "24K Fine Gold Granules",
              orderedQty: 100,
              receivedQty: 0,
              rejectedQty: 0,
              unit: "grams",
              ratePaise: 740000,
              totalPaise: 74000000,
              metalType: "gold",
              purity: "999.9",
              weightGrams: 100,
            },
          ],
          createdAt: "2026-09-01T10:00:00Z",
          updatedAt: "2026-09-01T10:00:00Z",
        },
      ],
      dispatches: [],
      inspections: [],
      invoices: [],
      documents: [],
      messages: [],
      seqPo: 1000,
      seqDispatch: 10,
      seqQc: 10,
      seqInv: 10,
    });
  });

  it("1. Purchase Order Acknowledgement & Change Requests", () => {
    const store = useSupplierPortalStore.getState();

    // Accept PO
    store.acknowledgePurchaseOrder("po-test-1", "accept", "Order accepted for standard delivery.");
    let po = useSupplierPortalStore.getState().purchaseOrders.find((p) => p.id === "po-test-1");
    expect(po?.status).toBe("accepted");
    expect(po?.acknowledgementNotes).toContain("Order accepted");

    // Request Change
    store.acknowledgePurchaseOrder("po-test-1", "request_change", "Need 2 extra days", "2026-09-17");
    po = useSupplierPortalStore.getState().purchaseOrders.find((p) => p.id === "po-test-1");
    expect(po?.status).toBe("change_requested");
    expect(po?.changeRequest?.requestedDate).toBe("2026-09-17");
    expect(po?.changeRequest?.status).toBe("pending");
  });

  it("2. Outbound Dispatch Creation & Tracking", () => {
    const store = useSupplierPortalStore.getState();

    const dispatch = store.createDispatch({
      poNumber: "AVS-PO-2026-000999",
      supplierId: "sup-01",
      supplierName: "Royal Bullion & Alloy Refiners",
      dispatchDate: "2026-09-05",
      expectedArrivalDate: "2026-09-07",
      courierPartner: "BVC Logistics Armored",
      trackingNumber: "BVC-TRACK-998811",
      packageCount: 2,
      dispatchedItems: [
        { poItemId: "poi-test-1", description: "24K Fine Gold Granules", shippedQty: 100 },
      ],
    });

    expect(dispatch.dispatchNumber).toContain("AVS-SD-2026-");
    expect(dispatch.status).toBe("dispatched");
    expect(dispatch.trackingNumber).toBe("BVC-TRACK-998811");

    const po = useSupplierPortalStore.getState().purchaseOrders.find((p) => p.poNumber === "AVS-PO-2026-000999");
    expect(po?.status).toBe("dispatched");
  });

  it("3. Goods Receiving & Quality Inspection (Assay Pass & Rejection Tracking)", () => {
    const store = useSupplierPortalStore.getState();

    const dispatch = store.createDispatch({
      poNumber: "AVS-PO-2026-000999",
      supplierId: "sup-01",
      supplierName: "Royal Bullion & Alloy Refiners",
      dispatchDate: "2026-09-05",
      expectedArrivalDate: "2026-09-07",
      courierPartner: "BVC Logistics Armored",
      trackingNumber: "BVC-TRACK-998811",
      packageCount: 1,
      dispatchedItems: [
        { poItemId: "poi-test-1", description: "24K Fine Gold Granules", shippedQty: 100 },
      ],
    });

    // Receive and inspect: 95g accepted, 5g rejected for purity mismatch
    const qc = store.receiveAndInspectGoods({
      dispatchId: dispatch.id,
      inspectorName: "Senior Metallurgist (AVS Lab)",
      overallResult: "partially_accepted",
      acceptedQty: 95,
      rejectedQty: 5,
      rejectionReason: "purity_mismatch",
      rejectionNotes: "5g sample tested 99.5% instead of 99.99%. Returned to vendor.",
      evidencePhotoUrls: ["https://example.com/photos/assay-test-995.jpg"],
    });

    expect(qc.inspectionNumber).toContain("AVS-QC-2026-");
    expect(qc.overallResult).toBe("partially_accepted");
    expect(qc.acceptedQty).toBe(95);
    expect(qc.rejectedQty).toBe(5);

    const po = useSupplierPortalStore.getState().purchaseOrders.find((p) => p.poNumber === "AVS-PO-2026-000999");
    expect(po?.items[0].receivedQty).toBe(95);
    expect(po?.items[0].rejectedQty).toBe(5);
    expect(po?.status).toBe("partially_fulfilled");
  });

  it("4. Supplier Invoicing & Payment Settlement", () => {
    const store = useSupplierPortalStore.getState();

    const inv = store.submitSupplierInvoice({
      supplierId: "sup-01",
      poNumber: "AVS-PO-2026-000999",
      invoiceNumber: "SUP-INV-2026-00101",
      invoiceDate: "2026-09-08",
      amountPaise: 74000000,
      taxAmountPaise: 2220000, // 3% GST
    });

    expect(inv.totalPaise).toBe(76220000);
    expect(inv.status).toBe("submitted");

    // Approve & Pay
    store.approveAndPayInvoice(inv.id, "HDFC-RTGS-9812903");
    const updatedInv = useSupplierPortalStore.getState().invoices.find((i) => i.id === inv.id);
    expect(updatedInv?.status).toBe("paid");
    expect(updatedInv?.paymentReference).toBe("HDFC-RTGS-9812903");

    const po = useSupplierPortalStore.getState().purchaseOrders.find((p) => p.poNumber === "AVS-PO-2026-000999");
    expect(po?.paidAmountPaise).toBe(76220000);
  });

  it("5. Supplier Document Vault Upload", () => {
    const store = useSupplierPortalStore.getState();

    const doc = store.uploadSupplierDocument(
      "sup-01",
      "BIS Bullion Refinery Certification (2026)",
      "quality_certificate",
      "https://example.com/docs/bis-cert.pdf",
      "2.5 MB",
    );

    expect(doc.documentNumber).toContain("AVS-DOC-2026-");
    expect(doc.title).toBe("BIS Bullion Refinery Certification (2026)");
    expect(doc.documentType).toBe("quality_certificate");
  });

  it("6. Procurement Operational Messaging", () => {
    const store = useSupplierPortalStore.getState();

    const msg = store.sendSupplierMessage(
      "sup-01",
      "supplier",
      "Rajesh Parekh",
      "Dispatch BVC-TRACK-998811 is on route with armored escort.",
      "AVS-PO-2026-000999",
    );

    expect(msg.sender).toBe("supplier");
    expect(msg.message).toContain("Dispatch BVC-TRACK-998811");
  });

  it("7. Deterministic AI Read Tools (AI OFF)", () => {
    const poTool = SUPPLIER_PORTAL_AI_TOOLS.get_supplier_purchase_order("AVS-PO-2026-000999");
    expect(poTool).not.toBeNull();
    expect(poTool?.supplierId).toBe("sup-01");

    const paymentStatus = SUPPLIER_PORTAL_AI_TOOLS.get_supplier_payment_status("sup-01");
    expect(paymentStatus).toBeDefined();
    expect(paymentStatus.outstanding).toBeGreaterThanOrEqual(0);
  });
});
