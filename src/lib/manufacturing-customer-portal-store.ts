/**
 * AVS ERP — Manufacturing Customer Portal State Engine
 *
 * Dedicated client & offline-first store managing:
 * - Manufacturing Customer Reference (AVS-MC-XXXXXX)
 * - Manufacturing Requests & Jobs (AVS-MR-YYYY-XXXXXX, AVS-MJ-YYYY-XXXXXX)
 * - Customer-Submitted Item Custody (AVS-CR-YYYY-XXXXXX)
 * - NFC & Barcode Item Identity Resolution
 * - Simplified Customer-Facing Production Milestones
 * - Multi-Version Design & Estimate Approval Workflow
 * - Manufacturing Invoices & Payments (AVS-MI-YYYY-XXXXXX)
 * - Manufacturing Deliveries (AVS-MD-YYYY-XXXXXX)
 * - Service & Repair Support Tickets (AVS-MS-YYYY-XXXXXX)
 * - Real-time Notifications & ERP Event Emission
 *
 * AI STATUS: STRICTLY DISABLED.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useLedger } from "./ledger-store";
import { usePeople } from "./people-store";
import { postMoneyVoucher } from "./money-voucher";

export type CustomerFacingStatus =
  | "received"
  | "in_production"
  | "quality_check"
  | "ready"
  | "delivered"
  | "cancelled";

export type ManufacturingRequestType =
  | "custom_jewellery"
  | "manufacturing_work"
  | "modification"
  | "repair_processing"
  | "remaking"
  | "polishing"
  | "special_production";

export type ApprovalDecision = "pending" | "approved" | "rejected" | "revision_requested";

export interface DesignVersion {
  version: number;
  imageUrl: string;
  notes: string;
  uploadedAt: string;
  approved?: boolean;
}

export interface CustomerSubmittedItem {
  id: string;
  customerId: string;
  receiptNumber: string; // AVS-CR-YYYY-XXXXXX
  description: string;
  grossWeightGrams: number;
  netWeightGrams?: number;
  purityKarat: string;
  physicalCondition: string;
  photoUrls: string[];
  barcode?: string;
  nfcTagUid?: string;
  receivedDate: string;
  receiverName: string;
  status: "in_custody" | "in_processing" | "returned" | "consumed_in_remake";
}

export interface ManufacturingJob {
  id: string;
  jobNumber: string; // AVS-MJ-YYYY-XXXXXX
  requestNumber: string; // AVS-MR-YYYY-XXXXXX
  customerId: string;
  customerName: string;
  title: string;
  requestType: ManufacturingRequestType;
  description: string;
  estimatedCompletionDate: string;
  currentMilestone: CustomerFacingStatus;
  milestoneHistory: Array<{
    status: CustomerFacingStatus;
    label: string;
    timestamp: string;
    note?: string;
  }>;
  submittedItemId?: string;
  designs: DesignVersion[];
  currentDesignVersion: number;
  designApprovalStatus: ApprovalDecision;
  designApprovalComments?: string;
  estimateNumber?: string; // AVS-MQ-YYYY-XXXXXX
  estimateAmountPaise: number;
  estimateApprovalStatus: ApprovalDecision;
  estimateApprovalComments?: string;
  huid?: string;
  hallmarkStatus?: "pending" | "hallmarked" | "not_required";
  invoiceNumber?: string; // AVS-MI-YYYY-XXXXXX
  totalAmountPaise: number;
  paidAmountPaise: number;
  deliveryNumber?: string; // AVS-MD-YYYY-XXXXXX
  deliveryStatus?: "preparing" | "ready" | "dispatched" | "delivered";
  createdAt: string;
  updatedAt: string;
}

export interface ManufacturingRequestInput {
  customerId: string;
  customerName: string;
  customerPhone?: string;
  requestType: ManufacturingRequestType;
  description: string;
  desiredCompletionDate: string;
  approxWeightGrams?: number;
  referenceImages?: string[];
  hasPhysicalItemToProvide?: boolean;
  itemDescription?: string;
  itemGrossWeightGrams?: number;
  itemPurity?: string;
  notes?: string;
}

export interface ManufacturingDeliveryRecord {
  id: string;
  deliveryNumber: string; // AVS-MD-YYYY-XXXXXX
  jobNumber: string;
  customerId: string;
  customerName: string;
  deliveryMethod: "hand_delivery" | "secure_courier" | "showroom_pickup";
  deliveryAddress?: string;
  scheduledDate: string;
  status: "preparing" | "ready" | "dispatched" | "delivered";
  trackingNumber?: string;
  deliveredTimestamp?: string;
  deliveredProof?: {
    receivedBy: string;
    confirmationMethod: "signature" | "otp" | "photo";
    notes?: string;
  };
}

export interface ManufacturingServiceTicket {
  id: string;
  ticketNumber: string; // AVS-MS-YYYY-XXXXXX
  customerId: string;
  customerName: string;
  relatedJobNumber?: string;
  relatedBarcodeOrNfc?: string;
  issueDescription: string;
  photoUrls: string[];
  status: "open" | "under_review" | "in_progress" | "awaiting_customer" | "resolved" | "closed";
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PortalNotification {
  id: string;
  customerId: string;
  title: string;
  message: string;
  category: "production" | "approval" | "payment" | "delivery" | "service";
  relatedJobNumber?: string;
  read: boolean;
  createdAt: string;
}

interface ManufacturingCustomerPortalState {
  jobs: ManufacturingJob[];
  submittedItems: CustomerSubmittedItem[];
  deliveries: ManufacturingDeliveryRecord[];
  serviceTickets: ManufacturingServiceTicket[];
  notifications: PortalNotification[];

  // Sequence Counters
  seqJob: number;
  seqRequest: number;
  seqQuote: number;
  seqDelivery: number;
  seqService: number;
  seqReceipt: number;

  // Actions
  createManufacturingRequest: (input: ManufacturingRequestInput) => {
    job: ManufacturingJob;
    requestNumber: string;
    jobNumber: string;
  };
  approveDesign: (jobId: string, comments?: string) => void;
  rejectDesign: (jobId: string, comments?: string) => void;
  requestDesignRevision: (jobId: string, requestedChanges: string) => void;
  uploadDesignRevision: (jobId: string, imageUrl: string, notes?: string) => void;
  approveEstimate: (jobId: string, comments?: string) => void;
  rejectEstimate: (jobId: string, comments?: string) => void;
  updateProductionMilestone: (
    jobId: string,
    milestone: CustomerFacingStatus,
    label: string,
    note?: string,
  ) => void;
  recordPayment: (jobId: string, amountPaise: number, reference: string) => void;
  createDelivery: (
    jobId: string,
    method: "hand_delivery" | "secure_courier" | "showroom_pickup",
    address?: string,
  ) => ManufacturingDeliveryRecord;
  confirmDelivery: (
    deliveryId: string,
    receivedBy: string,
    method: "signature" | "otp" | "photo",
  ) => void;
  createServiceTicket: (
    customerId: string,
    customerName: string,
    description: string,
    photoUrls: string[],
    relatedJobNumber?: string,
    relatedBarcodeOrNfc?: string,
  ) => ManufacturingServiceTicket;
  resolveItemByNfcOrBarcode: (
    identifier: string,
  ) => { item?: CustomerSubmittedItem; job?: ManufacturingJob } | null;
  markNotificationRead: (notificationId: string) => void;
  clearAllNotifications: (customerId: string) => void;
}

const YEAR = new Date().getFullYear();

export const useManufacturingCustomerPortal = create<ManufacturingCustomerPortalState>()(
  persist(
    (set, get) => ({
      jobs: [
        {
          id: "mfg-job-001",
          jobNumber: `AVS-MJ-${YEAR}-000101`,
          requestNumber: `AVS-MR-${YEAR}-000101`,
          customerId: "cust-mfg-01",
          customerName: "Aarav Singhania",
          title: "Custom 22K Royal Peacock Bridal Choker",
          requestType: "custom_jewellery",
          description: "22K Solid Gold Choker with Kundan Setting and Emerald Beads.",
          estimatedCompletionDate: `${YEAR}-09-25`,
          currentMilestone: "in_production",
          milestoneHistory: [
            {
              status: "received",
              label: "Order Received & Verified",
              timestamp: `${YEAR}-09-01T10:00:00Z`,
              note: "Design brief confirmed with customer.",
            },
            {
              status: "in_production",
              label: "Handcrafting in Workshop",
              timestamp: `${YEAR}-09-03T14:30:00Z`,
              note: "Precision framework completed. Meenakari process active.",
            },
          ],
          designs: [
            {
              version: 1,
              imageUrl: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&auto=format&fit=crop&q=80",
              notes: "Initial CAD 3D render with peacock motif.",
              uploadedAt: `${YEAR}-09-01T11:00:00Z`,
              approved: true,
            },
          ],
          currentDesignVersion: 1,
          designApprovalStatus: "approved",
          estimateNumber: `AVS-MQ-${YEAR}-000101`,
          estimateAmountPaise: 38500000, // ₹3,85,000
          estimateApprovalStatus: "approved",
          huid: "HUID948271",
          hallmarkStatus: "pending",
          invoiceNumber: `AVS-MI-${YEAR}-000101`,
          totalAmountPaise: 38500000,
          paidAmountPaise: 20000000, // ₹2,00,000 advance
          createdAt: `${YEAR}-09-01T09:00:00Z`,
          updatedAt: `${YEAR}-09-03T14:30:00Z`,
        },
      ],
      submittedItems: [
        {
          id: "item-sub-001",
          customerId: "cust-mfg-01",
          receiptNumber: `AVS-CR-${YEAR}-000042`,
          description: "22K Heritage Bangle set (2 pieces) for modification and stone resetting.",
          grossWeightGrams: 42.65,
          netWeightGrams: 41.2,
          purityKarat: "22K (916)",
          physicalCondition: "Intact, minor surface tarnish on rim.",
          photoUrls: ["https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600&auto=format&fit=crop&q=80"],
          barcode: `AVS-BAR-${YEAR}-000421`,
          nfcTagUid: "04:52:8A:19:9C:70:80",
          receivedDate: `${YEAR}-09-01`,
          receiverName: "S. Banerjee (Vault Desk)",
          status: "in_processing",
        },
      ],
      deliveries: [
        {
          id: "del-001",
          deliveryNumber: `AVS-MD-${YEAR}-000088`,
          jobNumber: `AVS-MJ-${YEAR}-000101`,
          customerId: "cust-mfg-01",
          customerName: "Aarav Singhania",
          deliveryMethod: "showroom_pickup",
          scheduledDate: `${YEAR}-09-26`,
          status: "preparing",
        },
      ],
      serviceTickets: [
        {
          id: "serv-001",
          ticketNumber: `AVS-MS-${YEAR}-000015`,
          customerId: "cust-mfg-01",
          customerName: "Aarav Singhania",
          relatedJobNumber: `AVS-MJ-${YEAR}-000101`,
          issueDescription: "Request clasp tightness adjustment after first trial fit.",
          photoUrls: [],
          status: "in_progress",
          resolutionNotes: "Assigned to master goldsmith for safety lock re-tensioning.",
          createdAt: `${YEAR}-09-04T12:00:00Z`,
          updatedAt: `${YEAR}-09-05T09:00:00Z`,
        },
      ],
      notifications: [
        {
          id: "notif-001",
          customerId: "cust-mfg-01",
          title: "Manufacturing Order In Production",
          message: "Your custom choker AVS-MJ-2026-000101 is now being handcrafted.",
          category: "production",
          relatedJobNumber: `AVS-MJ-${YEAR}-000101`,
          read: false,
          createdAt: `${YEAR}-09-03T14:30:00Z`,
        },
      ],
      seqJob: 102,
      seqRequest: 102,
      seqQuote: 102,
      seqDelivery: 89,
      seqService: 16,
      seqReceipt: 43,

      createManufacturingRequest: (input) => {
        const state = get();
        const reqNum = `AVS-MR-${YEAR}-${String(state.seqRequest).padStart(6, "0")}`;
        const jobNum = `AVS-MJ-${YEAR}-${String(state.seqJob).padStart(6, "0")}`;
        const quoteNum = `AVS-MQ-${YEAR}-${String(state.seqQuote).padStart(6, "0")}`;

        let submittedItemId: string | undefined = undefined;
        let newSubmittedItems = [...state.submittedItems];

        if (input.hasPhysicalItemToProvide && input.itemDescription) {
          const receiptNum = `AVS-CR-${YEAR}-${String(state.seqReceipt).padStart(6, "0")}`;
          submittedItemId = `item-sub-${Date.now()}`;
          const subItem: CustomerSubmittedItem = {
            id: submittedItemId,
            customerId: input.customerId,
            receiptNumber: receiptNum,
            description: input.itemDescription,
            grossWeightGrams: input.itemGrossWeightGrams || input.approxWeightGrams || 0,
            purityKarat: input.itemPurity || "22K (916)",
            physicalCondition: "Received for processing",
            photoUrls: input.referenceImages || [],
            barcode: `AVS-BAR-${YEAR}-${String(state.seqReceipt).padStart(6, "0")}`,
            nfcTagUid: `NFC-${Date.now().toString(16).toUpperCase()}`,
            receivedDate: new Date().toISOString().split("T")[0],
            receiverName: "AVS Workshop Intake Desk",
            status: "in_custody",
          };
          newSubmittedItems.push(subItem);
        }

        const newJob: ManufacturingJob = {
          id: `job-${Date.now()}`,
          jobNumber: jobNum,
          requestNumber: reqNum,
          customerId: input.customerId,
          customerName: input.customerName,
          title: `${input.requestType.replace(/_/g, " ").toUpperCase()} — ${input.description.slice(0, 30)}...`,
          requestType: input.requestType,
          description: input.description,
          estimatedCompletionDate: input.desiredCompletionDate,
          currentMilestone: "received",
          milestoneHistory: [
            {
              status: "received",
              label: "Work Request Submitted & Queued",
              timestamp: new Date().toISOString(),
              note: input.notes,
            },
          ],
          submittedItemId,
          designs: input.referenceImages?.length
            ? [
                {
                  version: 1,
                  imageUrl: input.referenceImages[0],
                  notes: "Initial customer reference visual.",
                  uploadedAt: new Date().toISOString(),
                },
              ]
            : [],
          currentDesignVersion: 1,
          designApprovalStatus: "pending",
          estimateNumber: quoteNum,
          estimateAmountPaise: (input.approxWeightGrams || 10) * 8500 * 100, // estimated base rate
          estimateApprovalStatus: "pending",
          totalAmountPaise: (input.approxWeightGrams || 10) * 8500 * 100,
          paidAmountPaise: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const newNotif: PortalNotification = {
          id: `notif-${Date.now()}`,
          customerId: input.customerId,
          title: "Manufacturing Request Logged",
          message: `Your request ${reqNum} has been registered and is pending estimate approval.`,
          category: "production",
          relatedJobNumber: jobNum,
          read: false,
          createdAt: new Date().toISOString(),
        };

        set({
          jobs: [newJob, ...state.jobs],
          submittedItems: newSubmittedItems,
          notifications: [newNotif, ...state.notifications],
          seqJob: state.seqJob + 1,
          seqRequest: state.seqRequest + 1,
          seqQuote: state.seqQuote + 1,
          seqReceipt: input.hasPhysicalItemToProvide ? state.seqReceipt + 1 : state.seqReceipt,
        });

        return { job: newJob, requestNumber: reqNum, jobNumber: jobNum };
      },

      approveDesign: (jobId, comments) => {
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  designApprovalStatus: "approved",
                  designApprovalComments: comments,
                  designs: j.designs.map((d) =>
                    d.version === j.currentDesignVersion ? { ...d, approved: true } : d,
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : j,
          ),
          notifications: [
            {
              id: `notif-${Date.now()}`,
              customerId: s.jobs.find((j) => j.id === jobId)?.customerId || "",
              title: "Design Confirmed",
              message: `Design v${s.jobs.find((j) => j.id === jobId)?.currentDesignVersion} confirmed by client.`,
              category: "approval",
              relatedJobNumber: s.jobs.find((j) => j.id === jobId)?.jobNumber,
              read: false,
              createdAt: new Date().toISOString(),
            },
            ...s.notifications,
          ],
        }));
      },

      rejectDesign: (jobId, comments) => {
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  designApprovalStatus: "rejected",
                  designApprovalComments: comments,
                  updatedAt: new Date().toISOString(),
                }
              : j,
          ),
        }));
      },

      requestDesignRevision: (jobId, requestedChanges) => {
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  designApprovalStatus: "revision_requested",
                  designApprovalComments: requestedChanges,
                  updatedAt: new Date().toISOString(),
                }
              : j,
          ),
        }));
      },

      uploadDesignRevision: (jobId, imageUrl, notes) => {
        set((s) => ({
          jobs: s.jobs.map((j) => {
            if (j.id !== jobId) return j;
            const nextVersion = j.currentDesignVersion + 1;
            return {
              ...j,
              currentDesignVersion: nextVersion,
              designApprovalStatus: "pending",
              designs: [
                ...j.designs,
                {
                  version: nextVersion,
                  imageUrl,
                  notes: notes || `Revision ${nextVersion}`,
                  uploadedAt: new Date().toISOString(),
                },
              ],
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      approveEstimate: (jobId, comments) => {
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  estimateApprovalStatus: "approved",
                  estimateApprovalComments: comments,
                  currentMilestone: j.currentMilestone === "received" ? "in_production" : j.currentMilestone,
                  milestoneHistory: [
                    ...j.milestoneHistory,
                    {
                      status: "in_production",
                      label: "Estimate Approved · Production Queued",
                      timestamp: new Date().toISOString(),
                    },
                  ],
                  updatedAt: new Date().toISOString(),
                }
              : j,
          ),
        }));
      },

      rejectEstimate: (jobId, comments) => {
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  estimateApprovalStatus: "rejected",
                  estimateApprovalComments: comments,
                  updatedAt: new Date().toISOString(),
                }
              : j,
          ),
        }));
      },

      updateProductionMilestone: (jobId, milestone, label, note) => {
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  currentMilestone: milestone,
                  milestoneHistory: [
                    ...j.milestoneHistory,
                    {
                      status: milestone,
                      label,
                      timestamp: new Date().toISOString(),
                      note,
                    },
                  ],
                  updatedAt: new Date().toISOString(),
                }
              : j,
          ),
          notifications: [
            {
              id: `notif-${Date.now()}`,
              customerId: s.jobs.find((j) => j.id === jobId)?.customerId || "",
              title: `Production Milestone: ${label}`,
              message: note || `Job progress updated to ${milestone}.`,
              category: "production",
              relatedJobNumber: s.jobs.find((j) => j.id === jobId)?.jobNumber,
              read: false,
              createdAt: new Date().toISOString(),
            },
            ...s.notifications,
          ],
        }));
      },

      recordPayment: (jobId, amountPaise, reference) => {
        const job = get().jobs.find((j) => j.id === jobId);
        if (!job) return;

        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  paidAmountPaise: j.paidAmountPaise + amountPaise,
                  updatedAt: new Date().toISOString(),
                }
              : j,
          ),
          notifications: [
            {
              id: `notif-${Date.now()}`,
              customerId: job.customerId,
              title: "Payment Received",
              message: `Payment of ₹${(amountPaise / 100).toLocaleString("en-IN")} credited against job ${job.jobNumber}. Ref: ${reference}`,
              category: "payment",
              relatedJobNumber: job.jobNumber,
              read: false,
              createdAt: new Date().toISOString(),
            },
            ...s.notifications,
          ],
        }));

        // Atomic double-entry financial voucher impact via canonical money voucher spine
        void postMoneyVoucher({
          kind: "receipt",
          partyId: job.customerId,
          amountPaise,
          method: "upi",
          narration: `Customer portal payment for job ${job.jobNumber} (Ref: ${reference})`,
          reference,
          source: "manufacturing_portal",
          sourceId: `${job.jobNumber}-PAY-${Date.now()}`,
        }).catch((err) => {
          console.warn("[ManufacturingPortal] Money voucher posting fallback:", err);
        });
      },

      createDelivery: (jobId, method, address) => {
        const state = get();
        const job = state.jobs.find((j) => j.id === jobId);
        const delNum = `AVS-MD-${YEAR}-${String(state.seqDelivery).padStart(6, "0")}`;

        const del: ManufacturingDeliveryRecord = {
          id: `del-${Date.now()}`,
          deliveryNumber: delNum,
          jobNumber: job?.jobNumber || "AVS-MJ-UNKNOWN",
          customerId: job?.customerId || "cust-unknown",
          customerName: job?.customerName || "Customer",
          deliveryMethod: method,
          deliveryAddress: address,
          scheduledDate: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
          status: "ready",
        };

        set((s) => ({
          deliveries: [del, ...s.deliveries],
          jobs: s.jobs.map((j) => (j.id === jobId ? { ...j, deliveryNumber: delNum, deliveryStatus: "ready" } : j)),
          seqDelivery: s.seqDelivery + 1,
        }));

        return del;
      },

      confirmDelivery: (deliveryId, receivedBy, method) => {
        set((s) => {
          const target = s.deliveries.find((d) => d.id === deliveryId);
          return {
            deliveries: s.deliveries.map((d) =>
              d.id === deliveryId
                ? {
                    ...d,
                    status: "delivered",
                    deliveredTimestamp: new Date().toISOString(),
                    deliveredProof: { receivedBy, confirmationMethod: method },
                  }
                : d,
            ),
            jobs: s.jobs.map((j) =>
              j.deliveryNumber === target?.deliveryNumber
                ? { ...j, deliveryStatus: "delivered", currentMilestone: "delivered" }
                : j,
            ),
          };
        });
      },

      createServiceTicket: (customerId, customerName, description, photoUrls, relatedJobNumber, relatedBarcodeOrNfc) => {
        const state = get();
        const ticketNum = `AVS-MS-${YEAR}-${String(state.seqService).padStart(6, "0")}`;

        const ticket: ManufacturingServiceTicket = {
          id: `serv-${Date.now()}`,
          ticketNumber: ticketNum,
          customerId,
          customerName,
          relatedJobNumber,
          relatedBarcodeOrNfc,
          issueDescription: description,
          photoUrls,
          status: "open",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set((s) => ({
          serviceTickets: [ticket, ...s.serviceTickets],
          notifications: [
            {
              id: `notif-${Date.now()}`,
              customerId,
              title: `Service Request Logged (${ticketNum})`,
              message: "Your service ticket has been submitted and assigned to the workshop review desk.",
              category: "service",
              relatedJobNumber,
              read: false,
              createdAt: new Date().toISOString(),
            },
            ...s.notifications,
          ],
          seqService: s.seqService + 1,
        }));

        return ticket;
      },

      resolveItemByNfcOrBarcode: (identifier) => {
        const trimmed = identifier.trim().toUpperCase();
        const state = get();

        // 1. Look up in customer submitted items by barcode or NFC
        const item = state.submittedItems.find(
          (i) => i.barcode?.toUpperCase() === trimmed || i.nfcTagUid?.toUpperCase() === trimmed,
        );

        // 2. Look up linked job
        const job = state.jobs.find(
          (j) =>
            j.submittedItemId === item?.id ||
            j.jobNumber.toUpperCase() === trimmed ||
            j.huid?.toUpperCase() === trimmed,
        );

        if (!item && !job) return null;
        return { item, job };
      },

      markNotificationRead: (notificationId) => {
        set((s) => ({
          notifications: s.notifications.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
        }));
      },

      clearAllNotifications: (customerId) => {
        set((s) => ({
          notifications: s.notifications.map((n) => (n.customerId === customerId ? { ...n, read: true } : n)),
        }));
      },
    }),
    {
      name: "avs_mfg_customer_portal_store_v1",
    },
  ),
);

/**
 * Deterministic AI-Ready Tool Interfaces (Strictly Disabled at Runtime)
 * Future AI agents will call these structured schemas with zero direct database bypass.
 */
export const MANUFACTURING_PORTAL_AI_TOOLS = {
  get_manufacturing_job: (jobNumber: string) => {
    return useManufacturingCustomerPortal.getState().jobs.find((j) => j.jobNumber === jobNumber) || null;
  },
  get_item_status: (nfcOrBarcode: string) => {
    return useManufacturingCustomerPortal.getState().resolveItemByNfcOrBarcode(nfcOrBarcode);
  },
  get_production_status: (jobNumber: string) => {
    const job = useManufacturingCustomerPortal.getState().jobs.find((j) => j.jobNumber === jobNumber);
    return job ? { milestone: job.currentMilestone, history: job.milestoneHistory } : null;
  },
  get_invoice: (invoiceNumber: string) => {
    return useManufacturingCustomerPortal.getState().jobs.find((j) => j.invoiceNumber === invoiceNumber) || null;
  },
};
