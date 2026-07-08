/**
 * MTJ ERP — Workflow Engine
 *
 * Every jewellery business works differently. This store lets the admin configure
 * the ERP to match their process without changing code.
 *
 * MTJ default: manufacturing_first (mfg bill mandatory, stock automatic, outstanding allowed)
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BusinessMode = "retail_only" | "manufacturing_only" | "hybrid";

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
}

export const DEFAULT_WORKFLOW_MTJ: WorkflowConfig = {
  mode: "hybrid",
  mfgBillEnabled: true,
  mfgBillMandatoryBeforeDelivery: true,
  autoCloseJobCard: true,
  autoUpdateOrderStatus: true,
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
  /** Update one or many config fields */
  patch: (diff: Partial<WorkflowConfig>) => void;
  /** Apply a preset wholesale */
  applyPreset: (presetKey: keyof typeof WORKFLOW_PRESETS) => void;
  reset: () => void;
}

export const useWorkflowEngine = create<WorkflowEngineState>()(
  persist(
    (set) => ({
      config: DEFAULT_WORKFLOW_MTJ,
      patch: (diff) => set((s) => ({ config: { ...s.config, ...diff } })),
      applyPreset: (key) => set({ config: { ...WORKFLOW_PRESETS[key] } }),
      reset: () => set({ config: DEFAULT_WORKFLOW_MTJ }),
    }),
    { name: "mtj-workflow-engine-v1" },
  ),
);
