import { create } from "zustand";
import { getQueueEntries } from "@/lib/comm/comm-queue";
import { initLocalDb } from "@/lib/local-db";
import { getSyncStatus } from "@/lib/sync-engine";
import { getPendingApprovals } from "@/lib/workflow/approval-workflow";
import { useLicense } from "@/lib/licensing/license-store";
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

function interpolateCount(
  descriptionKey: string,
  count: number,
): Pick<AppNotification, "descriptionKey" | "descriptionValues"> {
  return { descriptionKey, descriptionValues: { count } };
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

    const license = useLicense.getState();
    if (["trial", "expired", "suspended"].includes(license.status)) {
      items.push({
        id: `license-${license.status}`,
        titleKey: "notifications.license_title",
        descriptionKey: `notifications.license_${license.status}`,
        severity: license.status === "trial" ? "warning" : "critical",
        href: "/settings/license",
        createdAt: now,
      });
    }

    try {
      await initLocalDb();
      const [pendingMessages, failedMessages, approvals] = await Promise.all([
        getQueueEntries("pending"),
        getQueueEntries("permanently_failed"),
        getPendingApprovals(),
      ]);
      const sync = getSyncStatus();

      if (sync.conflicts > 0) {
        items.push({
          id: "sync-conflicts",
          titleKey: "notifications.sync_conflict_title",
          ...interpolateCount("notifications.sync_conflict_description", sync.conflicts),
          severity: "critical",
          href: "/settings/storage-diagnostics",
          createdAt: now,
        });
      } else if (sync.pending > 0) {
        items.push({
          id: "sync-pending",
          titleKey: "notifications.sync_pending_title",
          ...interpolateCount("notifications.sync_pending_description", sync.pending),
          severity: "info",
          href: "/settings/storage-diagnostics",
          createdAt: now,
        });
      }

      if (failedMessages.length > 0) {
        items.push({
          id: "communications-failed",
          titleKey: "notifications.communication_failed_title",
          ...interpolateCount(
            "notifications.communication_failed_description",
            failedMessages.length,
          ),
          severity: "critical",
          href: "/communications",
          createdAt: Math.max(...failedMessages.map((entry) => Date.parse(entry.created_at) || 0)),
        });
      } else if (pendingMessages.length > 0) {
        items.push({
          id: "communications-pending",
          titleKey: "notifications.communication_pending_title",
          ...interpolateCount(
            "notifications.communication_pending_description",
            pendingMessages.length,
          ),
          severity: "warning",
          href: "/communications",
          createdAt: Math.max(...pendingMessages.map((entry) => Date.parse(entry.created_at) || 0)),
        });
      }

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
