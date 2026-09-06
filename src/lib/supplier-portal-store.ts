/**
 * AVS ERP — Supplier Portal State Engine
 *
 * Dedicated vendor-facing state & transactional workflow engine:
 * - Single Global Supplier Master linkage (no duplicate databases)
 * - Purchase Order Lifecycle: PO -> Acknowledgement -> Dispatch -> Receiving -> Inspection -> Invoicing -> Payment
 * - Partial Fulfillment & Item Tracking
 * - Quality Inspection & Detailed Rejection Audit (photos, reasons, return tracking)
 * - Multi-contact Authorized User Roles (Supplier Owner, Sales, Accounts, Dispatch)
 * - Supplier Document Center & Compliance
 * - Supplier Clarifications Desk & Notifications
 *
 * AI STATUS: STRICTLY DISABLED.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SupplierContactRole =
  | "supplier_owner"
  | "supplier_sales"
  | "supplier_accounts"
  | "supplier_dispatch";

export type PurchaseOrderStatus =
  | "pending_confirmation"
  | "accepted"
  | "rejected"
  | "change_requested"
  | "dispatched"
  | "partially_fulfilled"
  | "completed"
  | "cancelled";

export interface SupplierAuthorizedContact {
  id: string;
  supplierId: string;
  name: string;
  email: string;
  phone: string;
  role: SupplierContactRole;
  status: "active" | "suspended";
}

export interface PurchaseOrderItem {
  id: string;
  description: string;
  orderedQty: number;
  receivedQty: number;
  rejectedQty: number;
  unit: string;
  ratePaise: number;
  totalPaise: number;
  metalType?: string;
  purity?: string;
  weightGrams?: number;
}

export interface SupplierPurchaseOrder {
  id: string;
  poNumber: string; // e.g. AVS-PO-2026-000101
  supplierId: string;
  supplierName: string;
  orderDate: string;
  expectedDeliveryDate: string;
  deliveryAddress: string;
  paymentTerms: string;
  totalAmountPaise: number;
  paidAmountPaise: number;
  status: PurchaseOrderStatus;
  items: PurchaseOrderItem[];
  acknowledgementNotes?: string;
  changeRequest?: {
    requestedDate?: string;
    notes: string;
    submittedAt: string;
    status: "pending" | "approved" | "rejected";
  };
  createdAt: string;
  updatedAt: string;
}

export interface SupplierDispatchRecord {
  id: string;
  dispatchNumber: string; // e.g. AVS-SD-2026-000101
  poNumber: string;
  supplierId: string;
  supplierName: string;
  dispatchDate: string;
  expectedArrivalDate: string;
  courierPartner: string;
  trackingNumber: string;
  packageCount: number;
  dispatchedItems: Array<{
    poItemId: string;
    description: string;
    shippedQty: number;
  }>;
  status: "dispatched" | "in_transit" | "received" | "inspection_complete";
  createdAt: string;
}

export interface SupplierQualityInspection {
  id: string;
  inspectionNumber: string; // e.g. AVS-QC-2026-000101
  dispatchId: string;
  poNumber: string;
  supplierId: string;
  inspectorName: string;
  inspectionDate: string;
  overallResult: "passed" | "rejected" | "partially_accepted";
  acceptedQty: number;
  rejectedQty: number;
  rejectionReason?: "purity_mismatch" | "stone_damage" | "weight_discrepancy" | "casting_flaws" | "specification_deviation";
  rejectionNotes?: string;
  evidencePhotoUrls: string[];
  returnTrackingNumber?: string;
  createdAt: string;
}

export interface SupplierInvoiceRecord {
  id: string;
  invoiceNumber: string; // e.g. SUP-INV-2026-000101
  supplierId: string;
  poNumber: string;
  invoiceDate: string;
  amountPaise: number;
  taxAmountPaise: number;
  totalPaise: number;
  status: "submitted" | "under_review" | "approved" | "posted" | "paid";
  paymentReference?: string;
  paidDate?: string;
  documentUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierDocument {
  id: string;
  documentNumber: string;
  supplierId: string;
  title: string;
  documentType: "po" | "invoice" | "delivery_challan" | "quality_certificate" | "gst_certificate" | "contract";
  url: string;
  fileSizeText: string;
  uploadedAt: string;
}

export interface SupplierMessage {
  id: string;
  supplierId: string;
  poNumber?: string;
  sender: "supplier" | "avs_procurement";
  senderName: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface SupplierPortalState {
  purchaseOrders: SupplierPurchaseOrder[];
  dispatches: SupplierDispatchRecord[];
  inspections: SupplierQualityInspection[];
  invoices: SupplierInvoiceRecord[];
  documents: SupplierDocument[];
  contacts: SupplierAuthorizedContact[];
  messages: SupplierMessage[];
  seqPo: number;
  seqDispatch: number;
  seqQc: number;
  seqInv: number;

  // Actions
  acknowledgePurchaseOrder: (
    poId: string,
    action: "accept" | "reject" | "request_change",
    notes?: string,
    requestedDeliveryDate?: string,
  ) => void;
  createDispatch: (input: {
    poNumber: string;
    supplierId: string;
    supplierName: string;
    dispatchDate: string;
    expectedArrivalDate: string;
    courierPartner: string;
    trackingNumber: string;
    packageCount: number;
    dispatchedItems: Array<{ poItemId: string; description: string; shippedQty: number }>;
  }) => SupplierDispatchRecord;
  receiveAndInspectGoods: (input: {
    dispatchId: string;
    inspectorName: string;
    overallResult: "passed" | "rejected" | "partially_accepted";
    acceptedQty: number;
    rejectedQty: number;
    rejectionReason?: "purity_mismatch" | "stone_damage" | "weight_discrepancy" | "casting_flaws" | "specification_deviation";
    rejectionNotes?: string;
    evidencePhotoUrls?: string[];
  }) => SupplierQualityInspection;
  submitSupplierInvoice: (input: {
    supplierId: string;
    poNumber: string;
    invoiceNumber: string;
    invoiceDate: string;
    amountPaise: number;
    taxAmountPaise: number;
    documentUrl?: string;
  }) => SupplierInvoiceRecord;
  approveAndPayInvoice: (invoiceId: string, paymentReference: string) => void;
  sendSupplierMessage: (
    supplierId: string,
    sender: "supplier" | "avs_procurement",
    senderName: string,
    message: string,
    poNumber?: string,
  ) => SupplierMessage;
  uploadSupplierDocument: (
    supplierId: string,
    title: string,
    documentType: SupplierDocument["documentType"],
    url: string,
    fileSizeText?: string,
  ) => SupplierDocument;
}

const YEAR = new Date().getFullYear();

export const useSupplierPortalStore = create<SupplierPortalState>()(
  persist(
    (set, get) => ({
      purchaseOrders: [
        {
          id: "po-001",
          poNumber: `AVS-PO-${YEAR}-000101`,
          supplierId: "sup-01",
          supplierName: "Royal Bullion & Alloy Refiners",
          orderDate: `${YEAR}-09-01`,
          expectedDeliveryDate: `${YEAR}-09-15`,
          deliveryAddress: "AVS Bullion Vault, 12 Jewellers Hub, Zaveri Bazaar, Mumbai",
          paymentTerms: "Net 15 Days after QC Inspection",
          totalAmountPaise: 185000000, // ₹18,50,000
          paidAmountPaise: 0,
          status: "pending_confirmation",
          items: [
            {
              id: "poi-01",
              description: "24K 999.9 Fine Gold Raw Casting Grain (Cast Granules)",
              orderedQty: 250,
              receivedQty: 0,
              rejectedQty: 0,
              unit: "grams",
              ratePaise: 740000, // ₹7,400/g
              totalPaise: 185000000,
              metalType: "gold",
              purity: "999.9",
              weightGrams: 250,
            },
          ],
          createdAt: `${YEAR}-09-01T10:00:00Z`,
          updatedAt: `${YEAR}-09-01T10:00:00Z`,
        },
        {
          id: "po-002",
          poNumber: `AVS-PO-${YEAR}-000102`,
          supplierId: "sup-01",
          supplierName: "Royal Bullion & Alloy Refiners",
          orderDate: `${YEAR}-08-20`,
          expectedDeliveryDate: `${YEAR}-08-28`,
          deliveryAddress: "AVS Bullion Vault, 12 Jewellers Hub, Zaveri Bazaar, Mumbai",
          paymentTerms: "Immediate upon Delivery",
          totalAmountPaise: 370000000, // ₹37,00,000
          paidAmountPaise: 370000000,
          status: "completed",
          items: [
            {
              id: "poi-02",
              description: "24K Fine Gold Cast Bars (100g each x 5)",
              orderedQty: 500,
              receivedQty: 500,
              rejectedQty: 0,
              unit: "grams",
              ratePaise: 740000,
              totalPaise: 370000000,
              metalType: "gold",
              purity: "999.9",
              weightGrams: 500,
            },
          ],
          createdAt: `${YEAR}-08-20T10:00:00Z`,
          updatedAt: `${YEAR}-08-28T16:00:00Z`,
        },
      ],
      dispatches: [
        {
          id: "sd-001",
          dispatchNumber: `AVS-SD-${YEAR}-000041`,
          poNumber: `AVS-PO-${YEAR}-000102`,
          supplierId: "sup-01",
          supplierName: "Royal Bullion & Alloy Refiners",
          dispatchDate: `${YEAR}-08-25`,
          expectedArrivalDate: `${YEAR}-08-27`,
          courierPartner: "BVC Logistics Secure Armored Courier",
          trackingNumber: "BVC-SEC-98421045",
          packageCount: 1,
          dispatchedItems: [
            {
              poItemId: "poi-02",
              description: "24K Fine Gold Cast Bars (100g each x 5)",
              shippedQty: 500,
            },
          ],
          status: "inspection_complete",
          createdAt: `${YEAR}-08-25T11:00:00Z`,
        },
      ],
      inspections: [
        {
          id: "qc-001",
          inspectionNumber: `AVS-QC-${YEAR}-000041`,
          dispatchId: "sd-001",
          poNumber: `AVS-PO-${YEAR}-000102`,
          supplierId: "sup-01",
          inspectorName: "Vikram Rathore (Lead Assayer)",
          inspectionDate: `${YEAR}-08-27`,
          overallResult: "passed",
          acceptedQty: 500,
          rejectedQty: 0,
          rejectionNotes: "XRF Assay confirmed 99.94% fine gold. Density & ultrasonic test passed.",
          evidencePhotoUrls: ["https://images.unsplash.com/photo-1610375461246-83df859d849d?w=600&auto=format&fit=crop&q=80"],
          createdAt: `${YEAR}-08-27T14:00:00Z`,
        },
      ],
      invoices: [
        {
          id: "sinv-001",
          invoiceNumber: `SUP-INV-${YEAR}-0089`,
          supplierId: "sup-01",
          poNumber: `AVS-PO-${YEAR}-000102`,
          invoiceDate: `${YEAR}-08-27`,
          amountPaise: 370000000,
          taxAmountPaise: 11100000, // 3% IGST
          totalPaise: 381100000,
          status: "paid",
          paymentReference: "HDFC-RTGS-98127391",
          paidDate: `${YEAR}-08-28`,
          documentUrl: "https://example.com/invoices/SUP-INV-2026-0089.pdf",
          createdAt: `${YEAR}-08-27T15:00:00Z`,
          updatedAt: `${YEAR}-08-28T16:00:00Z`,
        },
      ],
      documents: [
        {
          id: "sdoc-001",
          documentNumber: `AVS-DOC-${YEAR}-0012`,
          supplierId: "sup-01",
          title: "NABL Hallmarking Accreditation & Assay Lab Certificate",
          documentType: "quality_certificate",
          url: "https://example.com/docs/nabl-cert.pdf",
          fileSizeText: "1.8 MB",
          uploadedAt: `${YEAR}-01-10T10:00:00Z`,
        },
        {
          id: "sdoc-002",
          documentNumber: `AVS-DOC-${YEAR}-0013`,
          supplierId: "sup-01",
          title: "Annual Bullion Refining Supply Agreement (2026-2027)",
          documentType: "contract",
          url: "https://example.com/docs/supply-agreement.pdf",
          fileSizeText: "3.4 MB",
          uploadedAt: `${YEAR}-04-01T10:00:00Z`,
        },
      ],
      contacts: [
        {
          id: "sc-001",
          supplierId: "sup-01",
          name: "Rajesh Parekh",
          email: "rajesh@royalbullion.in",
          phone: "+91 98200 11223",
          role: "supplier_owner",
          status: "active",
        },
        {
          id: "sc-002",
          supplierId: "sup-01",
          name: "Siddharth Jha",
          email: "dispatch@royalbullion.in",
          phone: "+91 98200 44556",
          role: "supplier_dispatch",
          status: "active",
        },
        {
          id: "sc-003",
          supplierId: "sup-01",
          name: "Meera Gandhi",
          email: "accounts@royalbullion.in",
          phone: "+91 98200 77889",
          role: "supplier_accounts",
          status: "active",
        },
      ],
      messages: [
        {
          id: "msg-001",
          supplierId: "sup-01",
          poNumber: `AVS-PO-${YEAR}-000101`,
          sender: "avs_procurement",
          senderName: "AVS Central Procurement",
          message: "Please review and acknowledge PO for 250g casting granules at agreed spot rate.",
          timestamp: `${YEAR}-09-01T10:05:00Z`,
          read: true,
        },
      ],
      seqPo: 103,
      seqDispatch: 42,
      seqQc: 42,
      seqInv: 90,

      acknowledgePurchaseOrder: (poId, action, notes, requestedDeliveryDate) => {
        set((state) => ({
          purchaseOrders: state.purchaseOrders.map((po) => {
            if (po.id !== poId) return po;
            if (action === "accept") {
              return {
                ...po,
                status: "accepted",
                acknowledgementNotes: notes || "Purchase order accepted as specified.",
                updatedAt: new Date().toISOString(),
              };
            }
            if (action === "reject") {
              return {
                ...po,
                status: "rejected",
                acknowledgementNotes: notes || "Purchase order declined by vendor.",
                updatedAt: new Date().toISOString(),
              };
            }
            if (action === "request_change") {
              return {
                ...po,
                status: "change_requested",
                changeRequest: {
                  requestedDate: requestedDeliveryDate,
                  notes: notes || "Requested adjustment to delivery schedule/terms.",
                  submittedAt: new Date().toISOString(),
                  status: "pending",
                },
                updatedAt: new Date().toISOString(),
              };
            }
            return po;
          }),
        }));
      },

      createDispatch: (input) => {
        const state = get();
        const dispNum = `AVS-SD-${YEAR}-${String(state.seqDispatch).padStart(6, "0")}`;
        const newRecord: SupplierDispatchRecord = {
          id: `sd-${Date.now()}`,
          dispatchNumber: dispNum,
          poNumber: input.poNumber,
          supplierId: input.supplierId,
          supplierName: input.supplierName,
          dispatchDate: input.dispatchDate,
          expectedArrivalDate: input.expectedArrivalDate,
          courierPartner: input.courierPartner,
          trackingNumber: input.trackingNumber,
          packageCount: input.packageCount,
          dispatchedItems: input.dispatchedItems,
          status: "dispatched",
          createdAt: new Date().toISOString(),
        };

        set((s) => ({
          dispatches: [newRecord, ...s.dispatches],
          purchaseOrders: s.purchaseOrders.map((po) =>
            po.poNumber === input.poNumber ? { ...po, status: "dispatched", updatedAt: new Date().toISOString() } : po,
          ),
          seqDispatch: s.seqDispatch + 1,
        }));

        return newRecord;
      },

      receiveAndInspectGoods: (input) => {
        const state = get();
        const qcNum = `AVS-QC-${YEAR}-${String(state.seqQc).padStart(6, "0")}`;
        const targetDispatch = state.dispatches.find((d) => d.id === input.dispatchId);

        const newQc: SupplierQualityInspection = {
          id: `qc-${Date.now()}`,
          inspectionNumber: qcNum,
          dispatchId: input.dispatchId,
          poNumber: targetDispatch?.poNumber || "AVS-PO-UNKNOWN",
          supplierId: targetDispatch?.supplierId || "sup-unknown",
          inspectorName: input.inspectorName,
          inspectionDate: new Date().toISOString().split("T")[0],
          overallResult: input.overallResult,
          acceptedQty: input.acceptedQty,
          rejectedQty: input.rejectedQty,
          rejectionReason: input.rejectionReason,
          rejectionNotes: input.rejectionNotes,
          evidencePhotoUrls: input.evidencePhotoUrls || [],
          createdAt: new Date().toISOString(),
        };

        set((s) => ({
          inspections: [newQc, ...s.inspections],
          dispatches: s.dispatches.map((d) =>
            d.id === input.dispatchId ? { ...d, status: "inspection_complete" } : d,
          ),
          purchaseOrders: s.purchaseOrders.map((po) => {
            if (po.poNumber !== targetDispatch?.poNumber) return po;
            const updatedItems = po.items.map((item) => {
              const matchedDispatchItem = targetDispatch?.dispatchedItems.find((di) => di.poItemId === item.id);
              if (!matchedDispatchItem) return item;
              const nextReceived = item.receivedQty + input.acceptedQty;
              const nextRejected = item.rejectedQty + input.rejectedQty;
              return {
                ...item,
                receivedQty: nextReceived,
                rejectedQty: nextRejected,
              };
            });
            const isFull = updatedItems.every((i) => i.receivedQty >= i.orderedQty);
            return {
              ...po,
              items: updatedItems,
              status: isFull ? "completed" : "partially_fulfilled",
              updatedAt: new Date().toISOString(),
            };
          }),
          seqQc: s.seqQc + 1,
        }));

        return newQc;
      },

      submitSupplierInvoice: (input) => {
        const totalPaise = input.amountPaise + input.taxAmountPaise;
        const newInvoice: SupplierInvoiceRecord = {
          id: `sinv-${Date.now()}`,
          invoiceNumber: input.invoiceNumber,
          supplierId: input.supplierId,
          poNumber: input.poNumber,
          invoiceDate: input.invoiceDate,
          amountPaise: input.amountPaise,
          taxAmountPaise: input.taxAmountPaise,
          totalPaise,
          status: "submitted",
          documentUrl: input.documentUrl,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set((s) => ({
          invoices: [newInvoice, ...s.invoices],
          seqInv: s.seqInv + 1,
        }));

        return newInvoice;
      },

      approveAndPayInvoice: (invoiceId, paymentReference) => {
        set((s) => ({
          invoices: s.invoices.map((inv) =>
            inv.id === invoiceId
              ? {
                  ...inv,
                  status: "paid",
                  paymentReference,
                  paidDate: new Date().toISOString().split("T")[0],
                  updatedAt: new Date().toISOString(),
                }
              : inv,
          ),
          purchaseOrders: s.purchaseOrders.map((po) => {
            const matchedInv = s.invoices.find((i) => i.id === invoiceId);
            if (matchedInv && po.poNumber === matchedInv.poNumber) {
              return {
                ...po,
                paidAmountPaise: po.paidAmountPaise + matchedInv.totalPaise,
                updatedAt: new Date().toISOString(),
              };
            }
            return po;
          }),
        }));
      },

      sendSupplierMessage: (supplierId, sender, senderName, message, poNumber) => {
        const newMsg: SupplierMessage = {
          id: `msg-${Date.now()}`,
          supplierId,
          poNumber,
          sender,
          senderName,
          message,
          timestamp: new Date().toISOString(),
          read: false,
        };

        set((s) => ({
          messages: [...s.messages, newMsg],
        }));

        return newMsg;
      },

      uploadSupplierDocument: (supplierId, title, documentType, url, fileSizeText) => {
        const state = get();
        const docNum = `AVS-DOC-${YEAR}-${String(Date.now()).slice(-4)}`;
        const newDoc: SupplierDocument = {
          id: `sdoc-${Date.now()}`,
          documentNumber: docNum,
          supplierId,
          title,
          documentType,
          url,
          fileSizeText: fileSizeText || "1.2 MB",
          uploadedAt: new Date().toISOString(),
        };

        set((s) => ({
          documents: [newDoc, ...s.documents],
        }));

        return newDoc;
      },
    }),
    {
      name: "avs_supplier_portal_store_v1",
    },
  ),
);

/**
 * Deterministic AI-Ready Tool Interfaces (AI Strictly OFF)
 */
export const SUPPLIER_PORTAL_AI_TOOLS = {
  get_supplier_purchase_order: (poNumber: string) => {
    return useSupplierPortalStore.getState().purchaseOrders.find((p) => p.poNumber === poNumber) || null;
  },
  get_supplier_payment_status: (supplierId: string) => {
    const invoices = useSupplierPortalStore.getState().invoices.filter((i) => i.supplierId === supplierId);
    const totalInvoiced = invoices.reduce((sum, i) => sum + i.totalPaise, 0);
    const totalPaid = invoices.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.totalPaise, 0);
    const outstanding = totalInvoiced - totalPaid;
    return { totalInvoiced, totalPaid, outstanding, invoiceCount: invoices.length };
  },
  get_delivery_status: (dispatchNumber: string) => {
    return useSupplierPortalStore.getState().dispatches.find((d) => d.dispatchNumber === dispatchNumber) || null;
  },
};
