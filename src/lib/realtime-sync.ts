import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { create } from "zustand";
import {
  pullAppSettings,
  pullBranchSettings,
  pullBranches,
  pullCommLogs,
  pullDropdownMasters,
  pullInvoices,
  pullLedger,
  pullPeople,
  pullPayments,
  pullWorkerSettlements,
  pullWorkerTransactions,
} from "@/lib/data-loader";
import { useSettings } from "@/lib/settings-store";

interface RealtimeState {
  status: "idle" | "live" | "reconnecting" | "error";
  setStatus: (status: RealtimeState["status"]) => void;
}

export const useRealtimeSync = create<RealtimeState>((set) => ({
  status: "idle",
  setStatus: (status) => set({ status }),
}));

let channel: RealtimeChannel | null = null;

export function startRealtimeSync() {
  if (channel) return;
  const state = useRealtimeSync.getState();
  state.setStatus("reconnecting");

  channel = supabase
    .channel("workshop-db-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "people" },
      () => void pullPeople(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "gold_ledger" },
      () => void pullLedger(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "invoices" },
      () => void pullInvoices(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "payments" },
      () => void pullPayments(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "worker_transactions" },
      () => void pullWorkerTransactions(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "worker_settlements" },
      () => void pullWorkerSettlements(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "app_settings" },
      (payload: any) => {
        const id = payload?.new?.id ?? payload?.old?.id;
        if (!id || id === "firm") void pullAppSettings();
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "dropdown_masters" },
      () => void pullDropdownMasters(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "communication_logs" },
      () => void pullCommLogs(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "branches" },
      () => void pullBranches(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "branch_settings" },
      () => void pullBranchSettings(),
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "module_states" }, () => {
      const branchId = useSettings.getState().selectedBranchId || "MAIN";
      void import("@/lib/module-store").then(({ useModuleStore }) =>
        useModuleStore.getState().refresh(branchId),
      );
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") state.setStatus("live");
      if (status === "CLOSED" || status === "CHANNEL_ERROR") state.setStatus("reconnecting");
    });
}

export function stopRealtimeSync() {
  if (channel) {
    void supabase.removeChannel(channel);
    channel = null;
  }
  useRealtimeSync.getState().setStatus("idle");
}
