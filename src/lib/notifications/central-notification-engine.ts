/**
 * AVS ERP — Central Notification Engine
 *
 * Provides authoritative event routing for:
 * - Subscription Lifecycle Notifications (Trial ending, Payment success/failed, Renewal)
 * - Service / Outage Notifications (SERVICE_DOWN, MAINTENANCE_STARTED, SERVICE_RESTORED)
 * - Alert Deduplication & Anti-Spam via unique event IDs
 * - Multi-channel routing: In-App, Email, Webhook Relay
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { toast } from "sonner";

export type ServiceAlertType =
  | "SERVICE_DOWN"
  | "SERVICE_DEGRADED"
  | "PLANNED_MAINTENANCE"
  | "MAINTENANCE_STARTED"
  | "MAINTENANCE_COMPLETED"
  | "SERVICE_RESTORED";

export interface ServiceAlertItem {
  id: string;
  eventId: string;
  alertType: ServiceAlertType;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  isActive: boolean;
  startsAt: string;
  endsAt?: string;
  createdAt: string;
}

export interface NotificationLogItem {
  id: string;
  eventId: string;
  eventType: string;
  channel: string;
  recipient: string;
  subject: string;
  status: "sent" | "delivered" | "failed" | "suppressed";
  createdAt: string;
}

const DEFAULT_SERVICE_ALERTS: ServiceAlertItem[] = [
  {
    id: "alert_001",
    eventId: "maint_20260905_db_opt",
    alertType: "PLANNED_MAINTENANCE",
    title: "Scheduled Hostinger Database Optimization",
    message: "Routine database index optimization scheduled for Sunday at 02:00 AM IST. No downtime expected.",
    severity: "info",
    isActive: true,
    startsAt: new Date(Date.now() + 24 * 3600000).toISOString(),
    createdAt: new Date().toISOString(),
  },
];

interface NotificationEngineState {
  alerts: ServiceAlertItem[];
  logs: NotificationLogItem[];
  isLoading: boolean;

  fetchAlerts: () => Promise<void>;
  broadcastAlert: (alert: Omit<ServiceAlertItem, "id" | "createdAt">) => Promise<boolean>;
  dismissAlert: (id: string) => Promise<boolean>;
  dispatchNotification: (
    eventType: string,
    recipient: string,
    subject: string,
    body: string,
    customEventId?: string,
  ) => Promise<boolean>;
}

export const useNotificationEngine = create<NotificationEngineState>()(
  persist(
    (set, get) => ({
      alerts: DEFAULT_SERVICE_ALERTS,
      logs: [],
      isLoading: false,

      fetchAlerts: async () => {
        set({ isLoading: true });
        try {
          const { data } = await (supabase as any)
            .from("service_alerts")
            .select("*")
            .order("created_at", { ascending: false });

          if (data && data.length > 0) {
            set({
              alerts: data.map((r: any) => ({
                id: r.id,
                eventId: r.event_id,
                alertType: r.alert_type,
                title: r.title,
                message: r.message,
                severity: r.severity,
                isActive: r.is_active,
                startsAt: r.starts_at,
                endsAt: r.ends_at,
                createdAt: r.created_at,
              })),
            });
          }
        } catch {
          // Fallback to local
        } finally {
          set({ isLoading: false });
        }
      },

      broadcastAlert: async (alertData) => {
        const state = get();
        const id = `alert_${Date.now()}`;
        const newAlert: ServiceAlertItem = {
          ...alertData,
          id,
          createdAt: new Date().toISOString(),
        };

        set({ alerts: [newAlert, ...state.alerts] });

        try {
          await (supabase as any).from("service_alerts").insert({
            id: newAlert.id,
            event_id: newAlert.eventId,
            alert_type: newAlert.alertType,
            title: newAlert.title,
            message: newAlert.message,
            severity: newAlert.severity,
            is_active: newAlert.isActive,
            starts_at: newAlert.startsAt,
            ends_at: newAlert.endsAt,
            created_at: newAlert.createdAt,
          });

          toast.success(`Service alert broadcasted: ${newAlert.title}`);
          return true;
        } catch {
          toast.success("Broadcast recorded locally");
          return true;
        }
      },

      dismissAlert: async (id) => {
        const state = get();
        const updated = state.alerts.map((a) => (a.id === id ? { ...a, isActive: false } : a));
        set({ alerts: updated });

        try {
          await (supabase as any).from("service_alerts").update({ is_active: false }).eq("id", id);
          toast.info("Alert dismissed");
          return true;
        } catch {
          return true;
        }
      },

      dispatchNotification: async (eventType, recipient, subject, body, customEventId) => {
        const eventId = customEventId || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        try {
          const resp = await fetch("/api/notifications/dispatcher.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event_id: eventId,
              event_type: eventType,
              recipient,
              subject,
              body,
            }),
          });

          if (resp.ok) {
            const json = await resp.json();
            if (json.status === "suppressed") {
              // Deduplicated alert
              return true;
            }
            toast.success(`Notification sent to ${recipient}`);
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },
    }),
    {
      name: "avs-notification-engine-v2",
    },
  ),
);
