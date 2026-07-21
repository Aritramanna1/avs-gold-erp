import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { RealtimeChannel } from "@supabase/supabase-js";
import { create } from "zustand";
import { useExpensesStore } from "@/lib/expenses-store";
import { useCRMStore } from "@/lib/crm-store";
import { useModuleStore } from "@/lib/module-store";
import { useSettings } from "@/lib/settings-store";
import { useMeltStore } from "@/lib/melt-store";
import { useMfgBills } from "@/lib/manufacturing-bill-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { useSettlements } from "@/lib/settlement-store";
import { useMaterialVault } from "@/lib/material-vault-store";
import {
  useCreditNotes,
  useDebitNotes,
  useEstimates,
  useDeliveryChallans,
} from "@/lib/billing-documents-store";
import {
  pullPeople,
  pullLedger,
  pullOrders,
  pullJobCards,
  pullInventory,
  pullMovements,
  pullInvoices,
  pullPayments,
  pullAttendance,
  pullSalaryRules,
  pullWorkerTransactions,
  pullWorkerSettlements,
  pullCatalogDesigns,
  pullRateCutRecords,
  pullRepairs,
  pullDailyCloses,
  pullPrintLogs,
  pullWhatsappInbox,
  pullAppSettings,
  pullDropdownMasters,
  pullAttachments,
  pullCommLogs,
  pullBranches,
  pullBranchSettings,
  pullWorkshops,
} from "@/lib/data-loader";

interface RealtimeState {
  status: "idle" | "live" | "reconnecting" | "error";
  setStatus: (status: "idle" | "live" | "reconnecting" | "error") => void;
}

export const useRealtimeSync = create<RealtimeState>((set) => ({
  status: "idle",
  setStatus: (status) => set({ status }),
}));

let channel: RealtimeChannel | null = null;

// Debounce CRM refresh — all 3 CRM table changes share one 150ms window
let _crmTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleCrmRefresh() {
  clearTimeout(_crmTimer);
  _crmTimer = setTimeout(() => void useCRMStore.getState().refresh(), 150);
}

export function startRealtimeSync() {
  if (channel) return;

  const state = useRealtimeSync.getState();
  state.setStatus("reconnecting");

  channel = supabase
    .channel("public-db-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "people" }, () => {
      void pullPeople();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "gold_ledger" }, () => {
      void pullLedger();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
      void pullOrders();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "job_cards" }, () => {
      void pullJobCards();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, () => {
      void pullInventory();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "stock_movements" }, () => {
      void pullMovements();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => {
      void pullInvoices();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => {
      void pullPayments();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, () => {
      void pullAttendance();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "salary_rules" }, () => {
      void pullSalaryRules();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "worker_transactions" }, () => {
      void pullWorkerTransactions();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "worker_settlements" }, () => {
      void pullWorkerSettlements();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "catalog_designs" }, () => {
      void pullCatalogDesigns();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "rate_cut_records" }, () => {
      void pullRateCutRecords();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "repairs" }, () => {
      void pullRepairs();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "daily_close" }, () => {
      void pullDailyCloses();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "print_logs" }, () => {
      void pullPrintLogs();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_inbox" }, () => {
      void pullWhatsappInbox();
    })
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "app_settings" },
      (payload: any) => {
        const rowId = payload?.new?.id ?? payload?.old?.id;
        if (!rowId || rowId === "firm") void pullAppSettings();
        if (!rowId || rowId === "expenses_store") {
          void useExpensesStore.getState().refresh();
        }
      },
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "dropdown_masters" }, () => {
      void pullDropdownMasters();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "attachments" }, () => {
      void pullAttachments();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "communication_logs" }, () => {
      void pullCommLogs();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "branches" }, () => {
      void pullBranches();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "branch_settings" }, () => {
      void pullBranchSettings();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "workshops" }, () => {
      void pullWorkshops();
    })
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "crm_leads_opportunities" },
      () => {
        scheduleCrmRefresh();
      },
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "crm_tasks_meetings" }, () => {
      scheduleCrmRefresh();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "crm_interactions" }, () => {
      scheduleCrmRefresh();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "module_states" }, () => {
      const branchId = useSettings.getState().selectedBranchId || "MAIN";
      void useModuleStore.getState().refresh(branchId);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "melt_jobs" }, () => {
      void useMeltStore.getState().refresh();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "manufacturing_bills" }, () => {
      void useMfgBills.getState().refresh();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "gold_settlements" }, () => {
      void useGoldSettlement.getState().refresh();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "customer_settlements" }, () => {
      void useSettlements.getState().refresh();
    })
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "material_vault_movements" },
      () => {
        void useMaterialVault.getState().refresh();
      },
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "credit_notes" }, () => {
      void useCreditNotes.getState().refresh();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "debit_notes" }, () => {
      void useDebitNotes.getState().refresh();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "estimates" }, () => {
      void useEstimates.getState().refresh();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "delivery_challans" }, () => {
      void useDeliveryChallans.getState().refresh();
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        state.setStatus("live");
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
        state.setStatus("reconnecting");
      }
    });
}

export function stopRealtimeSync() {
  if (channel) {
    void supabase.removeChannel(channel);
    channel = null;
  }
  useRealtimeSync.getState().setStatus("idle");
}
