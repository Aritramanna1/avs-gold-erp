/**
 * AVS ERP — Workflow Engine
 *
 * Every jewellery business works differently. This store lets the admin configure
 * the ERP to match their process without changing code.
 *
 * AVS default: manufacturing-first (mfg bill mandatory, stock automatic, outstanding allowed)
 */

import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";

export type BusinessMode = "retail_only" | "manufacturing_only" | "combined_commerce_manufacturing";
type PersistedBusinessMode = BusinessMode | "hybrid";

export interface WorkflowConfig {
  /** Which business model this branch follows */
  mode: BusinessMode;

  // ── Manufacturing Bill ──────────────────────────────────────────────────
  /** Manufacturing Bill feature enabled */
  mfgBillEnabled: boolean;
  /** Must a Manufacturing Bill be finalised before customer delivery is allowed? */
  mfgBillMandatoryBeforeDelivery: boolean;
  /** Automatically close Job Card when Manufacturing Bill is finalised */
  autoCloseJobCard: boolean;
  /** Automatically update the Order to "ready_for_delivery" after Manufacturing Bill */
  autoUpdateOrderStatus: boolean;
  /** Show and charge for the Hallmark/BIS line on a Manufacturing Bill. When off, the field is hidden and forced to 0 in cost calculations. */
  mfgChargeHallmarkEnabled: boolean;
  /** Show and charge for the HUID registration line. When off, the field is hidden and forced to 0. */
  mfgChargeHuidEnabled: boolean;
  /** Reserved — gates a future final-barcode field on the bill; not implemented yet. */
  mfgBarcodeEnabled: boolean;
  /** Reserved — gates a future QR field on the bill; not implemented yet. */
  mfgQrEnabled: boolean;
  /** Require an explicit "Approved" mark on a Manufacturing Bill before it can be finalised. */
  mfgApprovalRequired: boolean;

  // ── Finished Stock ──────────────────────────────────────────────────────
  /** Move product to Finished Stock automatically on Manufacturing Bill finalisation */
  finishedStockAutomatic: boolean;
  /** Allow manual stock entry without a Manufacturing Bill */
  allowManualStockEntry: boolean;

  // ── Gold Ledger ─────────────────────────────────────────────────────────
  /** Automatically post gold ledger entries when Manufacturing Bill is finalised */
  autoPostGoldLedger: boolean;
  /** Automatically post worker gold book entry on finalisation */
  autoPostWorkerGoldBook: boolean;

  // ── Delivery & Payment ──────────────────────────────────────────────────
  /** Customer must pay in full before delivery */
  deliveryRequiresFullPayment: boolean;
  /** Allow delivery with outstanding balance */
  outstandingDeliveryAllowed: boolean;
  /** Automatically create an Outstanding Bill if partial payment at delivery */
  autoCreateOutstanding: boolean;
  /** Days before a payment reminder is triggered automatically */
  paymentReminderDays: number;

  // ── Communication ───────────────────────────────────────────────────────
  /** Automatically send communication after Manufacturing Bill is finalised */
  autoSendMfgBillComm: boolean;
  /** Automatically send communication after delivery invoice is created */
  autoSendInvoiceComm: boolean;
  /** Automatically send payment receipt on payment */
  autoSendPaymentReceipt: boolean;
  /** Automatically send due reminder */
  autoSendDueReminder: boolean;

  // ── Financial Controls ──────────────────────────────────────────────────
  /**
   * Enforce month-end financial locks (financial-lock-store.ts) on every
   * gold ledger, worker gold book, and expense posting. Defaults ON —
   * turning this off should be a deliberate, audited decision (e.g. a
   * one-off data migration/backfill), never a silent default.
   */
  financialLockEnforcementEnabled: boolean;

  // ── Outside Work (External Jeweller) ────────────────────────────────────
  /**
   * Default labour calculation method offered on a new Labour Charge — a
   * default only, never enforced: the method is chosen per-charge, and new
   * methods can be added without touching this type (see
   * OUTSIDE_WORK_LABOUR_METHODS in outside-work-labour-store.ts).
   */
  outsideWorkDefaultLabourMethod: string;
  /** Whether GST is applied to outside-worker labour charges by default. */
  outsideWorkGstEnabled: boolean;
  /** Default GST rate (%) pre-filled on a new labour charge when GST is on. */
  outsideWorkGstRatePct: number;
  /**
   * Require an explicit "Approved" mark on a labour charge before its
   * amount counts toward what a Settlement can close out (unapproved bills
   * still show as owed, they just can't be settled yet).
   */
  outsideWorkApprovalRequired: boolean;
  /** When off, a Payment cannot exceed the current Labour Outstanding — blocks recording an advance. */
  outsideWorkAllowAdvancePayments: boolean;
}

export const DEFAULT_WORKFLOW_MTJ: WorkflowConfig = {
  mode: "manufacturing_only",
  mfgBillEnabled: true,
  mfgBillMandatoryBeforeDelivery: true,
  autoCloseJobCard: true,
  autoUpdateOrderStatus: true,
  mfgChargeHallmarkEnabled: true,
  mfgChargeHuidEnabled: true,
  mfgBarcodeEnabled: false,
  mfgQrEnabled: false,
  mfgApprovalRequired: false,
  finishedStockAutomatic: true,
  allowManualStockEntry: false,
  autoPostGoldLedger: true,
  autoPostWorkerGoldBook: true,
  deliveryRequiresFullPayment: false,
  outstandingDeliveryAllowed: true,
  autoCreateOutstanding: true,
  paymentReminderDays: 7,
  autoSendMfgBillComm: true,
  autoSendInvoiceComm: true,
  autoSendPaymentReceipt: true,
  autoSendDueReminder: true,
  financialLockEnforcementEnabled: true,
  outsideWorkDefaultLabourMethod: "per_gram",
  outsideWorkGstEnabled: false,
  outsideWorkGstRatePct: 5,
  outsideWorkApprovalRequired: false,
  outsideWorkAllowAdvancePayments: true,
};

export const WORKFLOW_PRESETS: Record<string, WorkflowConfig> = {
  mtj_default: DEFAULT_WORKFLOW_MTJ,
  retail_only: {
    ...DEFAULT_WORKFLOW_MTJ,
    mode: "retail_only",
    mfgBillEnabled: false,
    mfgBillMandatoryBeforeDelivery: false,
    autoCloseJobCard: false,
    autoUpdateOrderStatus: false,
    finishedStockAutomatic: false,
    allowManualStockEntry: true,
    autoPostGoldLedger: false,
    autoPostWorkerGoldBook: false,
  },
  manufacturing_strict: {
    ...DEFAULT_WORKFLOW_MTJ,
    mode: "manufacturing_only",
    deliveryRequiresFullPayment: true,
    outstandingDeliveryAllowed: false,
    autoCreateOutstanding: false,
  },
};

interface WorkflowEngineState {
  config: WorkflowConfig;
  refresh: () => Promise<void>;
  /** Update one or many config fields */
  patch: (diff: Partial<WorkflowConfig>) => void;
  /** Apply a preset wholesale */
  applyPreset: (presetKey: keyof typeof WORKFLOW_PRESETS) => void;
  reset: () => void;
}

const workflowSettingsRepository = createRepository<{ id: string; config: WorkflowConfig }>(
  "app_settings",
);

type PersistedWorkflowConfig = Omit<WorkflowConfig, "mode"> & {
  mode: PersistedBusinessMode;
};

function normalizeWorkflowConfig(config: WorkflowConfig | PersistedWorkflowConfig): WorkflowConfig {
  return {
    ...config,
    mode: config.mode === "hybrid" ? "combined_commerce_manufacturing" : config.mode,
  };
}

function persistWorkflow(config: WorkflowConfig): void {
  const normalized = normalizeWorkflowConfig(config);
  void workflowSettingsRepository.saveAs("workflow_engine", {
    id: "workflow_engine",
    config: normalized,
  });
}

export const useWorkflowEngine = create<WorkflowEngineState>()((set) => ({
  config: DEFAULT_WORKFLOW_MTJ,
  async refresh() {
    const saved = await workflowSettingsRepository.read("workflow_engine").catch(() => null);
    if (saved?.config) {
      set({
        config: normalizeWorkflowConfig({
          ...DEFAULT_WORKFLOW_MTJ,
          ...(saved.config as WorkflowConfig | PersistedWorkflowConfig),
        }),
      });
    }
  },
  patch: (diff) =>
    set((s) => {
      const config = normalizeWorkflowConfig({ ...s.config, ...diff });
      persistWorkflow(config);
      return { config };
    }),
  applyPreset: (key) =>
    set(() => {
      const config = { ...WORKFLOW_PRESETS[key] };
      persistWorkflow(config);
      return { config };
    }),
  reset: () => {
    persistWorkflow(DEFAULT_WORKFLOW_MTJ);
    set({ config: DEFAULT_WORKFLOW_MTJ });
  },
}));
