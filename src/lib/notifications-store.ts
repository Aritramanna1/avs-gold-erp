import { create } from "zustand";
import { getPendingApprovals } from "@/lib/workflow/approval-workflow";
import { useSettings } from "@/lib/settings-store";

export type NotificationSeverity = "info" | "warning" | "critical";

export interface AppNotification {
  id: string;
  titleKey: string;
  descriptionKey: string;
  descriptionValues?: Record<string, string | number>;
  severity: NotificationSeverity;
  href: string;
  createdAt: number;
}

interface NotificationsState {
  items: AppNotification[];
  readIds: string[];
  loading: boolean;
  lastRefreshedAt: number | null;
  refresh: () => Promise<void>;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const READ_KEY = "erp-gold-notifications-read-v1";

function readStoredIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(READ_KEY) || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function persistReadIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(READ_KEY, JSON.stringify(ids.slice(-250)));
}

export const useNotifications = create<NotificationsState>()((set, get) => ({
  items: [],
  readIds: readStoredIds(),
  loading: false,
  lastRefreshedAt: null,

  refresh: async () => {
    if (get().loading) return;
    set({ loading: true });
    const items: AppNotification[] = [];
    const now = Date.now();

    const settings = useSettings.getState();
    if (settings.goldRatePerGramPaise <= 0) {
      items.push({
        id: "gold-rate-not-set",
        titleKey: "notifications.gold_rate_title",
        descriptionKey: "notifications.gold_rate_description",
        severity: "critical",
        href: "/settings",
        createdAt: 0,
      });
    }

    try {
      const approvals = await getPendingApprovals();
      for (const approval of approvals) {
        items.push({
          id: `approval-${approval.id}`,
          titleKey: "notifications.approval_title",
          descriptionKey: "notifications.approval_description",
          descriptionValues: { type: approval.entityType, reason: approval.reason },
          severity: "warning",
          href: "/reports/approvals",
          createdAt: approval.requestedAt,
        });
      }
    } catch (error) {
      console.warn("[Notifications] Could not refresh operational alerts:", error);
    }

    const rank: Record<NotificationSeverity, number> = { critical: 3, warning: 2, info: 1 };
    items.sort((a, b) => rank[b.severity] - rank[a.severity] || b.createdAt - a.createdAt);
    set({ items, loading: false, lastRefreshedAt: Date.now() });
  },

  markRead: (id) => {
    const ids = Array.from(new Set([...get().readIds, id]));
    persistReadIds(ids);
    set({ readIds: ids });
  },

  markAllRead: () => {
    const ids = Array.from(new Set([...get().readIds, ...get().items.map((item) => item.id)]));
    persistReadIds(ids);
    set({ readIds: ids });
  },
}));
