import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { RealtimeChannel } from "@supabase/supabase-js";
import { create } from "zustand";
import { useModuleStore } from "@/lib/module-store";
import { useSettings } from "@/lib/settings-store";
import {
  pullPeople,
  pullLedger,
  pullOrders,
  pullJobCards,
  pullInventory,
  pullInvoices,
  pullAppSettings,
  pullBackgroundDeferred,
} from "@/lib/data-loader";
import { recordRealtimeConnection } from "@/lib/monitoring/supabase-egress-monitor";

interface RealtimeState {
  status: "idle" | "live" | "reconnecting" | "error";
  setStatus: (status: "idle" | "live" | "reconnecting" | "error") => void;
}

export const useRealtimeSync = create<RealtimeState>((set) => ({
  status: "idle",
  setStatus: (status) => set({ status }),
}));

let channel: RealtimeChannel | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 8;

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") reconnectAttempts = 0;
  });
}
/** Ignore postgres_changes re-pulls while boot hydrates stores (cuts duplicate REST egress). */
let bootGraceUntil = 0;

export function setRealtimeBootGrace(ms = 45_000): void {
  bootGraceUntil = Date.now() + ms;
}

export function clearRealtimeBootGrace(): void {
  bootGraceUntil = 0;
}

// Debounce pulls — coalesce bursts to cut egress (each pull re-downloads JSONB slices).
const PULL_DEBOUNCE_MS = import.meta.env.DEV ? 3_000 : 2_000;
const pullTimers = new Map<string, ReturnType<typeof setTimeout>>();
function schedulePull(key: string, fn: () => Promise<void>) {
  if (Date.now() < bootGraceUntil) return;
  const existing = pullTimers.get(key);
  if (existing) clearTimeout(existing);
  pullTimers.set(
    key,
    setTimeout(() => {
      pullTimers.delete(key);
      void fn();
    }, PULL_DEBOUNCE_MS),
  );
}

/** One deferred hydrate for infrequent modules — avoids 15+ parallel realtime pulls. */
let deferredHydrateTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleDeferredModuleHydrate() {
  clearTimeout(deferredHydrateTimer);
  deferredHydrateTimer = setTimeout(() => void pullBackgroundDeferred(), 5_000);
}

export function startRealtimeSync() {
  if (channel) return;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
  // Realtime holds channels + triggers JSONB re-pulls; skip in dev unless explicitly enabled.
  if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_SUPABASE !== "1") return;

  const state = useRealtimeSync.getState();
  state.setStatus("reconnecting");

  // Core ops only — other stores refresh on route enter or deferred boot pull.
  channel = supabase
    .channel("erp-core-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "people" }, () => {
      schedulePull("people", pullPeople);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "gold_ledger" }, () => {
      schedulePull("gold_ledger", pullLedger);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
      schedulePull("orders", pullOrders);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "job_cards" }, () => {
      schedulePull("job_cards", pullJobCards);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, () => {
      schedulePull("inventory", pullInventory);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => {
      if (import.meta.env.DEV) return;
      schedulePull("invoices", pullInvoices);
    })
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "app_settings" },
      (payload: unknown) => {
        const row = payload as { new?: { id?: string }; old?: { id?: string } };
        const rowId = row?.new?.id ?? row?.old?.id;
        if (!rowId || rowId === "firm") schedulePull("app_settings", pullAppSettings);
      },
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "module_states" }, () => {
      schedulePull("module_states", async () => {
        const branchId = useSettings.getState().selectedBranchId || "MAIN";
        await useModuleStore.getState().refresh(branchId);
      });
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "stock_movements" }, () => {
      scheduleDeferredModuleHydrate();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "melt_jobs" }, () => {
      scheduleDeferredModuleHydrate();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "manufacturing_bills" }, () => {
      scheduleDeferredModuleHydrate();
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        reconnectAttempts = 0;
        recordRealtimeConnection("connect");
        state.setStatus("live");
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
        state.setStatus("reconnecting");
        if (channel) {
          recordRealtimeConnection("disconnect");
          void supabase.removeChannel(channel);
          channel = null;
        }
        clearTimeout(reconnectTimer);
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          state.setStatus("error");
          return;
        }
        reconnectAttempts += 1;
        const delay = Math.min(PULL_DEBOUNCE_MS * 2 ** (reconnectAttempts - 1), 60_000);
        reconnectTimer = setTimeout(() => {
          if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
          recordRealtimeConnection("reconnect");
          startRealtimeSync();
        }, delay);
      }
    });
}

export function stopRealtimeSync() {
  clearTimeout(reconnectTimer);
  reconnectAttempts = 0;
  if (channel) {
    void supabase.removeChannel(channel);
    channel = null;
  }
  for (const timer of pullTimers.values()) clearTimeout(timer);
  pullTimers.clear();
  if (deferredHydrateTimer) clearTimeout(deferredHydrateTimer);
  useRealtimeSync.getState().setStatus("idle");
}
