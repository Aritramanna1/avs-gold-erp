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
  // ── Process & Workshop Delegation ─────────────────────────────────────────
  /** Whether Polishing is delegated to an Outside Vendor/Artisan or In-House Karigar */
  polishingProcessType: "outside" | "in_house";
  /** Whether Polishing phase is active/enabled by default on new jobcards/orders */
  polishingEnabledByDefault: boolean;
  /** Whether Meena (Enameling) is delegated to an Outside Vendor/Artisan or In-House Karigar */
  meenaProcessType: "outside" | "in_house";
  /** Whether Making/Manufacturing is primarily In-House or Outside Jobwork */
  makingProcessType: "in_house" | "outside";
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
  polishingProcessType: "outside",
  polishingEnabledByDefault: true,
  meenaProcessType: "outside",
  makingProcessType: "in_house",
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

const STORAGE_CONFIG_KEY = "avs_workflow_config_v2";
const STORAGE_MODE_KEY = "avs_workflow_mode_v2";

function normalizeWorkflowConfig(config: WorkflowConfig | PersistedWorkflowConfig): WorkflowConfig {
  return {
    ...config,
    mode: config.mode === "hybrid" ? "combined_commerce_manufacturing" : config.mode,
  };
}

function getInitialWorkflowConfig(): WorkflowConfig {
  if (typeof window === "undefined") return DEFAULT_WORKFLOW_MTJ;
  try {
    const raw = localStorage.getItem(STORAGE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return normalizeWorkflowConfig({ ...DEFAULT_WORKFLOW_MTJ, ...parsed });
    }
    const savedMode = localStorage.getItem(STORAGE_MODE_KEY) as BusinessMode | null;
    if (savedMode) {
      return normalizeWorkflowConfig({ ...DEFAULT_WORKFLOW_MTJ, mode: savedMode });
    }
  } catch {
    /* fallback */
  }
  return DEFAULT_WORKFLOW_MTJ;
}

function persistWorkflow(config: WorkflowConfig): void {
  const normalized = normalizeWorkflowConfig(config);
  try {
    localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(normalized));
    localStorage.setItem(STORAGE_MODE_KEY, normalized.mode);
  } catch {
    /* ignore storage errors */
  }
  void workflowSettingsRepository.saveAs("workflow_engine", {
    id: "workflow_engine",
    config: normalized,
  });
}

export const useWorkflowEngine = create<WorkflowEngineState>()((set) => ({
  config: getInitialWorkflowConfig(),
  async refresh() {
    const saved = await workflowSettingsRepository.read("workflow_engine").catch(() => null);
    if (saved?.config) {
      const normalized = normalizeWorkflowConfig({
        ...DEFAULT_WORKFLOW_MTJ,
        ...(saved.config as WorkflowConfig | PersistedWorkflowConfig),
      });
      try {
        localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(normalized));
        localStorage.setItem(STORAGE_MODE_KEY, normalized.mode);
      } catch {
        /* ignore */
      }
      set({ config: normalized });
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
