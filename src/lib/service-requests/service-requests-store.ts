/**
 * AVS ERP — Service Requests / Helpdesk Management Store
 *
 * Provides authoritative UI controls for:
 * - Technical, Billing, Integration, and Feature requests
 * - Workflow statuses: OPEN, ACKNOWLEDGED, IN PROGRESS, WAITING, RESOLVED, CLOSED
 * - Ticket creation & administrator resolution logs
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { toast } from "sonner";

export type TicketCategory =
  | "technical"
  | "billing"
  | "integration"
  | "account"
  | "feature_request"
  | "deployment";

export type TicketPriority = "low" | "medium" | "high" | "urgent";

export type TicketStatus =
  | "open"
  | "acknowledged"
  | "in_progress"
  | "waiting"
  | "resolved"
  | "closed";

export interface ServiceRequestItem {
  id: string;
  tenantId: string;
  ticketNo: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  subject: string;
  description: string;
  resolutionNotes?: string;
  createdBy: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_TICKETS: ServiceRequestItem[] = [
  {
    id: "sr_001",
    tenantId: "tenant_default",
    ticketNo: "SR-2026-0001",
    category: "integration",
    priority: "medium",
    status: "resolved",
    subject: "Razorpay Webhook Secret Rotation",
    description: "Rotate the live webhook secret key on Hostinger dispatcher.",
    resolutionNotes: "Secret updated and verified via test simulation.",
    createdBy: "owner@maatarajewellers.shop",
    assignedTo: "support@avs-erp.com",
    createdAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 40 * 3600000).toISOString(),
  },
  {
    id: "sr_002",
    tenantId: "tenant_default",
    ticketNo: "SR-2026-0002",
    category: "technical",
    priority: "low",
    status: "in_progress",
    subject: "Additional Karigar Unit Printer Configuration",
    description: "Configure barcode 50x25mm thermal printer for Branch 2 workbench.",
    createdBy: "manager@maatarajewellers.shop",
    assignedTo: "admin@maatarajewellers.shop",
    createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

interface ServiceRequestsState {
  tickets: ServiceRequestItem[];
  isLoading: boolean;

  fetchTickets: () => Promise<void>;
  createTicket: (ticket: {
    category: TicketCategory;
    priority: TicketPriority;
    subject: string;
    description: string;
    createdBy?: string;
  }) => Promise<boolean>;
  updateTicketStatus: (
    id: string,
    status: TicketStatus,
    resolutionNotes?: string,
  ) => Promise<boolean>;
}

export const useServiceRequestsStore = create<ServiceRequestsState>()(
  persist(
    (set, get) => ({
      tickets: DEFAULT_TICKETS,
      isLoading: false,

      fetchTickets: async () => {
        set({ isLoading: true });
        try {
          const { data } = await (supabase as any)
            .from("service_requests")
            .select("*")
            .order("created_at", { ascending: false });

          if (data && data.length > 0) {
            set({
              tickets: data.map((r: any) => ({
                id: r.id,
                tenantId: r.tenant_id,
                ticketNo: r.ticket_no,
                category: r.category,
                priority: r.priority,
                status: r.status,
                subject: r.subject,
                description: r.description,
                resolutionNotes: r.resolution_notes,
                createdBy: r.created_by,
                assignedTo: r.assigned_to,
                createdAt: r.created_at,
                updatedAt: r.updated_at,
              })),
            });
          }
        } catch {
          // Fallback to local
        } finally {
          set({ isLoading: false });
        }
      },

      createTicket: async (ticketData) => {
        const state = get();
        const ticketNo = `SR-2026-${String(state.tickets.length + 1).padStart(4, "0")}`;
        const newTicket: ServiceRequestItem = {
          id: `sr_${Date.now()}`,
          tenantId: "tenant_default",
          ticketNo,
          category: ticketData.category,
          priority: ticketData.priority,
          status: "open",
          subject: ticketData.subject,
          description: ticketData.description,
          createdBy: ticketData.createdBy || "admin@maatarajewellers.shop",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set({ tickets: [newTicket, ...state.tickets] });

        try {
          await (supabase as any).from("service_requests").insert({
            id: newTicket.id,
            tenant_id: newTicket.tenantId,
            ticket_no: newTicket.ticketNo,
            category: newTicket.category,
            priority: newTicket.priority,
            status: newTicket.status,
            subject: newTicket.subject,
            description: newTicket.description,
            created_by: newTicket.createdBy,
            created_at: newTicket.createdAt,
            updated_at: newTicket.updatedAt,
          });

          toast.success(`Service request ${ticketNo} created`);
          return true;
        } catch {
          toast.success(`Service request ${ticketNo} recorded`);
          return true;
        }
      },

      updateTicketStatus: async (id, status, resolutionNotes) => {
        const state = get();
        const updated = state.tickets.map((t) =>
          t.id === id
            ? {
                ...t,
                status,
                resolutionNotes: resolutionNotes || t.resolutionNotes,
                updatedAt: new Date().toISOString(),
              }
            : t,
        );

        set({ tickets: updated });

        try {
          await (supabase as any)
            .from("service_requests")
            .update({
              status,
              resolution_notes: resolutionNotes,
              updated_at: new Date().toISOString(),
            })
            .eq("id", id);

          toast.success(`Ticket status changed to ${status.toUpperCase()}`);
          return true;
        } catch {
          return true;
        }
      },
    }),
    {
      name: "avs-service-requests-v2",
    },
  ),
);
