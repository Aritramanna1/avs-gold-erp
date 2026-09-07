/**
 * AVS ERP — Authoritative Workflow Engine
 *
 * Central configuration point for enterprise workflow behavior across:
 * - Manufacturing
 * - Retail
 * - Shared / Cross-domain workflows
 *
 * Configures and enforces:
 * - Workflow Scopes (Manufacturing Only, Retail Only, Combined)
 * - Custom & Standard Processes (Add, Edit, Toggle, Ledger Mapping)
 * - Custom & Standard Physical Books (22K/916, 18K/750, 995 Standard)
 * - Sequential Steps & State Machine Validation
 * - Field Requirements & Visibility (Mandatory, Optional, Hidden, Calculated)
 * - Versioning (Draft -> Validate -> Publish -> Active)
 * - Integration with Native Automation Engine and Authoritative Double-Entry Ledger
 */

import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";
import { DEFAULT_FINENESS_BASIS } from "./gold";

export type BusinessMode = "retail_only" | "manufacturing_only" | "combined_commerce_manufacturing";
export type WorkflowScope = "manufacturing" | "retail" | "shared";
type PersistedBusinessMode = BusinessMode | "hybrid";

export interface WorkflowProcessConfig {
  id: string;
  name: string;
  processType: string;
  workflowScope: WorkflowScope;
  applicableModule: string;
  processRule?: string;
  requiredFields: string[];
  approvalRequired: boolean;
  ledgerMapping?: string;
  labourRatePaise?: number;
  labourCalcMethod?: "per_gram" | "per_piece" | "flat" | "percentage";
  active: boolean;
  isCustom?: boolean;
  orderIndex: number;
}

export interface WorkflowBookConfig {
  id: string;
  bookName: string;
  purity: number; // e.g. 916, 750, 995
  unit: "mg" | "g" | "kg";
  workflowScope: WorkflowScope;
  active: boolean;
  openingBalanceBehavior: "carry_forward" | "zero_reset" | "manual_entry";
  applicableTransactionTypes: string[];
  ledgerMapping: string; // e.g. 'karigar', 'vault', 'scrap', 'finished'
  isCustom?: boolean;
}

export interface WorkflowStepConfig {
  id: string;
  name: string;
  sequence: number;
  active: boolean;
  required: boolean;
  roleRequired: string;
  approvalRequired: boolean;
  fieldsRequired: string[];
  actionEvent: string;
}

export interface WorkflowFieldConfig {
  fieldKey: string;
  label: string;
  visibility: "visible" | "hidden";
  requirement: "mandatory" | "optional" | "read_only" | "calculated";
  moduleScope: WorkflowScope;
}

export interface WorkflowVersion {
  versionId: string;
  versionNumber: string;
  status: "draft" | "valid" | "published" | "active";
  publishedAt?: string;
  publishedBy?: string;
  changeNotes?: string;
  configSnapshot?: Partial<WorkflowConfig>;
}

export interface WorkflowConfig {
  /** Which business model this branch follows */
  mode: BusinessMode;
  workflowScope: WorkflowScope;
  activeVersion: string;

  // ── Processes & Books Masters ───────────────────────────────────────────
  processes: WorkflowProcessConfig[];
  books: WorkflowBookConfig[];
  steps: WorkflowStepConfig[];
  fields: WorkflowFieldConfig[];
  versions: WorkflowVersion[];

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
   * gold ledger, worker gold book, and expense posting. Defaults ON.
   */
  financialLockEnforcementEnabled: boolean;

  // ── Outside Work (External Jeweller) ────────────────────────────────────
  outsideWorkDefaultLabourMethod: string;
  outsideWorkGstEnabled: boolean;
  outsideWorkGstRatePct: number;
  outsideWorkApprovalRequired: boolean;
  outsideWorkAllowAdvancePayments: boolean;

  // ── Process & Workshop Delegation ─────────────────────────────────────────
  polishingProcessType: "outside" | "in_house";
  polishingEnabledByDefault: boolean;
  meenaProcessType: "outside" | "in_house";
  makingProcessType: "in_house" | "outside";
}

export const DEFAULT_PROCESSES: WorkflowProcessConfig[] = [
  {
    id: "proc_kdm",
    name: "Manufacturing Material Making (KDM/Solder)",
    processType: "kdm",
    workflowScope: "manufacturing",
    applicableModule: "workshop",
    processRule: "Track metal conversion and additive alloy touch",
    requiredFields: ["grossMg", "purity"],
    approvalRequired: false,
    ledgerMapping: "workshop_process_gold_issued",
    labourRatePaise: 0,
    labourCalcMethod: "per_gram",
    active: true,
    isCustom: false,
    orderIndex: 1,
  },
  {
    id: "proc_casting",
    name: "Casting & Tree Processing",
    processType: "casting",
    workflowScope: "manufacturing",
    applicableModule: "workshop",
    processRule: "Enforce standard melting recovery and flask shrinkage calculation",
    requiredFields: ["grossMg", "netMg", "purity"],
    approvalRequired: false,
    ledgerMapping: "workshop_process_gold_issued",
    labourRatePaise: 1500,
    labourCalcMethod: "per_gram",
    active: true,
    isCustom: false,
    orderIndex: 2,
  },
  {
    id: "proc_filing",
    name: "Filing / Ghasai",
    processType: "filing",
    workflowScope: "manufacturing",
    applicableModule: "workshop",
    processRule: "Collect and weigh bench dust and filings before process exit",
    requiredFields: ["grossMg", "purity"],
    approvalRequired: false,
    ledgerMapping: "workshop_process_gold_issued",
    labourRatePaise: 2500,
    labourCalcMethod: "per_gram",
    active: true,
    isCustom: false,
    orderIndex: 3,
  },
  {
    id: "proc_setting",
    name: "Stone Setting / Jadhai",
    processType: "setting",
    workflowScope: "manufacturing",
    applicableModule: "workshop",
    processRule: "Require stone bag itemization and gross vs net stone weight",
    requiredFields: ["grossMg", "netMg", "purity"],
    approvalRequired: false,
    ledgerMapping: "workshop_process_gold_issued",
    labourRatePaise: 5000,
    labourCalcMethod: "per_piece",
    active: true,
    isCustom: false,
    orderIndex: 4,
  },
  {
    id: "proc_polish",
    name: "Polishing / Buffing",
    processType: "polish",
    workflowScope: "manufacturing",
    applicableModule: "workshop",
    processRule: "Enforce polish dust collection recovery rule",
    requiredFields: ["grossMg", "purity"],
    approvalRequired: false,
    ledgerMapping: "workshop_process_gold_issued",
    labourRatePaise: 2000,
    labourCalcMethod: "per_gram",
    active: true,
    isCustom: false,
    orderIndex: 5,
  },
  {
    id: "proc_meena",
    name: "Meena / Enameling",
    processType: "meena",
    workflowScope: "manufacturing",
    applicableModule: "workshop",
    processRule: "Support outside job-work artisan delegation",
    requiredFields: ["grossMg", "purity"],
    approvalRequired: false,
    ledgerMapping: "workshop_process_gold_issued",
    labourRatePaise: 3500,
    labourCalcMethod: "per_piece",
    active: true,
    isCustom: false,
    orderIndex: 6,
  },
  {
    id: "proc_plating",
    name: "Plating / Electroplating / Rhodium",
    processType: "plating",
    workflowScope: "manufacturing",
    applicableModule: "workshop",
    processRule: "Record two-tone micron plating details",
    requiredFields: ["grossMg", "purity"],
    approvalRequired: false,
    ledgerMapping: "workshop_process_gold_issued",
    labourRatePaise: 1200,
    labourCalcMethod: "per_piece",
    active: true,
    isCustom: false,
    orderIndex: 7,
  },
  {
    id: "proc_cutting",
    name: "Diamond / CNC Cutting",
    processType: "cutting",
    workflowScope: "manufacturing",
    applicableModule: "workshop",
    processRule: "High-precision cutting with automatic over-loss check",
    requiredFields: ["grossMg", "netMg", "purity"],
    approvalRequired: false,
    ledgerMapping: "workshop_process_gold_issued",
    labourRatePaise: 4000,
    labourCalcMethod: "per_gram",
    active: true,
    isCustom: false,
    orderIndex: 8,
  },
];

export const DEFAULT_BOOKS: WorkflowBookConfig[] = [
  {
    id: "book_22k",
    bookName: "22K / 916 Physical Karigar Book",
    purity: 916,
    unit: "mg",
    workflowScope: "manufacturing",
    active: true,
    openingBalanceBehavior: "carry_forward",
    applicableTransactionTypes: ["given", "return", "overloss", "wastage"],
    ledgerMapping: "karigar",
    isCustom: false,
  },
  {
    id: "book_18k",
    bookName: "18K / 750 Physical Karigar Book",
    purity: 750,
    unit: "mg",
    workflowScope: "manufacturing",
    active: true,
    openingBalanceBehavior: "carry_forward",
    applicableTransactionTypes: ["given", "return", "overloss", "wastage"],
    ledgerMapping: "karigar",
    isCustom: false,
  },
  {
    id: "book_995",
    bookName: "99.50% Standard Bullion & Vault Book",
    purity: DEFAULT_FINENESS_BASIS,
    unit: "mg",
    workflowScope: "shared",
    active: true,
    openingBalanceBehavior: "carry_forward",
    applicableTransactionTypes: ["purchase", "opening_vault", "finished_item_created", "sale"],
    ledgerMapping: "vault",
    isCustom: false,
  },
  {
    id: "book_scrap",
    bookName: "Workshop Scrap & Dust Recovery Book",
    purity: 850,
    unit: "mg",
    workflowScope: "manufacturing",
    active: true,
    openingBalanceBehavior: "carry_forward",
    applicableTransactionTypes: ["scrap_returned", "dust_returned", "melt_scrap_input"],
    ledgerMapping: "scrap",
    isCustom: false,
  },
];

export const DEFAULT_STEPS: WorkflowStepConfig[] = [
  {
    id: "step_create",
    name: "Create Job Card",
    sequence: 1,
    active: true,
    required: true,
    roleRequired: "staff",
    approvalRequired: false,
    fieldsRequired: ["itemName", "targetGrossMg", "purity"],
    actionEvent: "jobcard.created",
  },
  {
    id: "step_issue",
    name: "Issue Gold & Raw Materials",
    sequence: 2,
    active: true,
    required: true,
    roleRequired: "supervisor",
    approvalRequired: false,
    fieldsRequired: ["workerId", "grossMg", "purity"],
    actionEvent: "gold.issued_to_karigar",
  },
  {
    id: "step_process",
    name: "Workshop Bench Processing",
    sequence: 3,
    active: true,
    required: false,
    roleRequired: "worker",
    approvalRequired: false,
    fieldsRequired: ["grossMg"],
    actionEvent: "process.executed",
  },
  {
    id: "step_receipt",
    name: "Receive Work & Weighing Inspection",
    sequence: 4,
    active: true,
    required: true,
    roleRequired: "supervisor",
    approvalRequired: false,
    fieldsRequired: ["receivedGrossMg", "netMg"],
    actionEvent: "work.received",
  },
  {
    id: "step_qc_hallmark",
    name: "QC Verification & Hallmark HUID",
    sequence: 5,
    active: true,
    required: true,
    roleRequired: "supervisor",
    approvalRequired: false,
    fieldsRequired: ["huid"],
    actionEvent: "hallmark.verified",
  },
  {
    id: "step_settlement",
    name: "Artisan & Karigar Settlement",
    sequence: 6,
    active: true,
    required: true,
    roleRequired: "accountant",
    approvalRequired: true,
    fieldsRequired: ["labourCashPaise", "fineGoldMg"],
    actionEvent: "settlement.finalised",
  },
  {
    id: "step_close",
    name: "Close Job Card & Release Stock",
    sequence: 7,
    active: true,
    required: true,
    roleRequired: "admin",
    approvalRequired: false,
    fieldsRequired: [],
    actionEvent: "jobcard.closed",
  },
];

export const DEFAULT_FIELDS: WorkflowFieldConfig[] = [
  { fieldKey: "grossMg", label: "Gross Weight (mg)", visibility: "visible", requirement: "mandatory", moduleScope: "shared" },
  { fieldKey: "lessMg", label: "Less Weight / Stone (mg)", visibility: "visible", requirement: "optional", moduleScope: "shared" },
  { fieldKey: "addMg", label: "Add Weight / Solder (mg)", visibility: "visible", requirement: "optional", moduleScope: "manufacturing" },
  { fieldKey: "netMg", label: "Net Weight (mg)", visibility: "visible", requirement: "calculated", moduleScope: "shared" },
  { fieldKey: "purity", label: "Purity / Touch (‰)", visibility: "visible", requirement: "mandatory", moduleScope: "shared" },
  { fieldKey: "wastagePct", label: "Wastage Allowance (%)", visibility: "visible", requirement: "optional", moduleScope: "manufacturing" },
  { fieldKey: "overLossMg", label: "Over-Loss Discrepancy (mg)", visibility: "visible", requirement: "mandatory", moduleScope: "manufacturing" },
  { fieldKey: "huid", label: "BIS Hallmark HUID", visibility: "visible", requirement: "optional", moduleScope: "shared" },
  { fieldKey: "makingCharges", label: "Making Charges", visibility: "visible", requirement: "optional", moduleScope: "retail" },
  { fieldKey: "labourRate", label: "Labour Rate", visibility: "visible", requirement: "mandatory", moduleScope: "manufacturing" },
];

export const DEFAULT_WORKFLOW_MTJ: WorkflowConfig = {
  mode: "manufacturing_only",
  workflowScope: "manufacturing",
  activeVersion: "1.1.0",
  processes: DEFAULT_PROCESSES,
  books: DEFAULT_BOOKS,
  steps: DEFAULT_STEPS,
  fields: DEFAULT_FIELDS,
  versions: [
    {
      versionId: "v_1_1_0",
      versionNumber: "1.1.0",
      status: "active",
      publishedAt: new Date().toISOString(),
      publishedBy: "system_admin",
      changeNotes: "Authoritative AVS Manufacturing Workflow Core",
    },
  ],
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
    workflowScope: "retail",
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
    workflowScope: "manufacturing",
    deliveryRequiresFullPayment: true,
    outstandingDeliveryAllowed: false,
    autoCreateOutstanding: false,
    mfgApprovalRequired: true,
  },
  combined: {
    ...DEFAULT_WORKFLOW_MTJ,
    mode: "combined_commerce_manufacturing",
    workflowScope: "shared",
    mfgBillEnabled: true,
    finishedStockAutomatic: true,
    allowManualStockEntry: true,
  },
};

interface WorkflowEngineState {
  config: WorkflowConfig;
  refresh: () => Promise<void>;
  patch: (diff: Partial<WorkflowConfig>) => void;
  applyPreset: (presetKey: keyof typeof WORKFLOW_PRESETS) => void;
  reset: () => void;

  // ── Process Operations ──────────────────────────────────────────────────
  addProcess: (proc: Omit<WorkflowProcessConfig, "id" | "orderIndex">) => WorkflowProcessConfig;
  updateProcess: (id: string, patch: Partial<WorkflowProcessConfig>) => void;
  toggleProcess: (id: string, active: boolean) => void;
  deleteProcess: (id: string) => void;
  isProcessEnabled: (processIdOrType: string) => boolean;

  // ── Book Operations ─────────────────────────────────────────────────────
  addBook: (book: Omit<WorkflowBookConfig, "id">) => WorkflowBookConfig;
  updateBook: (id: string, patch: Partial<WorkflowBookConfig>) => void;
  toggleBook: (id: string, active: boolean) => void;
  deleteBook: (id: string) => void;
  isBookEnabled: (bookId: string) => boolean;

  // ── Step & Field Operations ─────────────────────────────────────────────
  addStep: (step: Omit<WorkflowStepConfig, "id">) => WorkflowStepConfig;
  updateStep: (id: string, patch: Partial<WorkflowStepConfig>) => void;
  toggleStep: (id: string, active: boolean) => void;
  updateFieldConfig: (fieldKey: string, patch: Partial<WorkflowFieldConfig>) => void;
  isFieldMandatory: (fieldKey: string, module?: string) => boolean;

  // ── Lifecycle, State Machine & Versioning ───────────────────────────────
  validateWorkflow: (config?: WorkflowConfig) => { valid: boolean; errors: string[] };
  publishWorkflow: (changeNotes?: string) => Promise<{ success: boolean; version: string; errors?: string[] }>;
  validateStateTransition: (fromStatus: string, toStatus: string, role?: string) => { allowed: boolean; reason?: string };
}

const workflowSettingsRepository = createRepository<{ id: string; config: WorkflowConfig }>(
  "app_settings",
);

const STORAGE_CONFIG_KEY = "avs_workflow_config_v2";
const STORAGE_MODE_KEY = "avs_workflow_mode_v2";

function normalizeWorkflowConfig(config: WorkflowConfig | (Omit<WorkflowConfig, "mode"> & { mode: PersistedBusinessMode })): WorkflowConfig {
  const mode: BusinessMode = config.mode === "hybrid" ? "combined_commerce_manufacturing" : (config.mode || "manufacturing_only");
  const workflowScope: WorkflowScope =
    mode === "retail_only" ? "retail" : mode === "manufacturing_only" ? "manufacturing" : "shared";

  return {
    ...DEFAULT_WORKFLOW_MTJ,
    ...config,
    mode,
    workflowScope,
    processes: Array.isArray(config.processes) && config.processes.length > 0 ? config.processes : DEFAULT_PROCESSES,
    books: Array.isArray(config.books) && config.books.length > 0 ? config.books : DEFAULT_BOOKS,
    steps: Array.isArray(config.steps) && config.steps.length > 0 ? config.steps : DEFAULT_STEPS,
    fields: Array.isArray(config.fields) && config.fields.length > 0 ? config.fields : DEFAULT_FIELDS,
    versions: Array.isArray(config.versions) && config.versions.length > 0 ? config.versions : DEFAULT_WORKFLOW_MTJ.versions,
    activeVersion: config.activeVersion || "1.1.0",
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

// Allowed State Transitions in the Manufacturing/Jobcard Lifecycle
const VALID_STATE_TRANSITIONS: Record<string, string[]> = {
  draft: ["awaiting_gold_issue", "gold_issued"],
  awaiting_gold_issue: ["gold_issued", "closed"],
  gold_issued: ["in_progress", "outside_processing", "work_received", "awaiting_gold_issue"],
  in_progress: ["outside_processing", "work_received", "rework", "closed"],
  outside_processing: ["in_progress", "work_received", "rework"],
  work_received: ["rework", "hallmark_pending", "ready_for_billing", "closed"],
  rework: ["in_progress", "work_received", "outside_processing"],
  hallmark_pending: ["ready_for_billing", "work_received"],
  ready_for_billing: ["closed", "work_received"],
  closed: [],
};

export const useWorkflowEngine = create<WorkflowEngineState>()((set, get) => ({
  config: getInitialWorkflowConfig(),

  async refresh() {
    const saved = await workflowSettingsRepository.read("workflow_engine").catch(() => null);
    if (saved?.config) {
      const normalized = normalizeWorkflowConfig(saved.config as WorkflowConfig);
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

  // ── Process Management ────────────────────────────────────────────────────
  addProcess: (proc) => {
    const current = get().config;
    const newId = `proc_custom_${Date.now()}`;
    const newProcess: WorkflowProcessConfig = {
      ...proc,
      id: newId,
      orderIndex: current.processes.length + 1,
      isCustom: true,
      active: proc.active !== false,
    };
    const updated = {
      ...current,
      processes: [...current.processes, newProcess],
    };
    persistWorkflow(updated);
    set({ config: updated });
    return newProcess;
  },

  updateProcess: (id, patch) => {
    const current = get().config;
    const updated = {
      ...current,
      processes: current.processes.map((p) => (p.id === id || p.processType === id ? { ...p, ...patch } : p)),
    };
    persistWorkflow(updated);
    set({ config: updated });
  },

  toggleProcess: (id, active) => {
    get().updateProcess(id, { active });
  },

  deleteProcess: (id) => {
    const current = get().config;
    const updated = {
      ...current,
      processes: current.processes.filter((p) => p.id !== id && p.processType !== id),
    };
    persistWorkflow(updated);
    set({ config: updated });
  },

  isProcessEnabled: (processIdOrType) => {
    const { config } = get();
    if (config.mode === "retail_only") return false;
    const proc = config.processes.find(
      (p) =>
        p.id === processIdOrType ||
        p.processType === processIdOrType ||
        p.name.toLowerCase() === processIdOrType.toLowerCase()
    );
    if (!proc) return true; // default allowed if standard
    return proc.active;
  },

  // ── Book Management ───────────────────────────────────────────────────────
  addBook: (book) => {
    const current = get().config;
    const newId = `book_custom_${Date.now()}`;
    const newBook: WorkflowBookConfig = {
      ...book,
      id: newId,
      isCustom: true,
      active: book.active !== false,
    };
    const updated = {
      ...current,
      books: [...current.books, newBook],
    };
    persistWorkflow(updated);
    set({ config: updated });
    return newBook;
  },

  updateBook: (id, patch) => {
    const current = get().config;
    const updated = {
      ...current,
      books: current.books.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    };
    persistWorkflow(updated);
    set({ config: updated });
  },

  toggleBook: (id, active) => {
    get().updateBook(id, { active });
  },

  deleteBook: (id) => {
    const current = get().config;
    const updated = {
      ...current,
      books: current.books.filter((b) => b.id !== id),
    };
    persistWorkflow(updated);
    set({ config: updated });
  },

  isBookEnabled: (bookId) => {
    const { config } = get();
    const book = config.books.find((b) => b.id === bookId || b.bookName.toLowerCase() === bookId.toLowerCase());
    if (!book) return true;
    return book.active;
  },

  // ── Steps & Fields ────────────────────────────────────────────────────────
  addStep: (step) => {
    const current = get().config;
    const newId = `step_custom_${Date.now()}`;
    const newStep: WorkflowStepConfig = {
      ...step,
      id: newId,
    };
    const updated = {
      ...current,
      steps: [...current.steps, newStep].sort((a, b) => a.sequence - b.sequence),
    };
    persistWorkflow(updated);
    set({ config: updated });
    return newStep;
  },

  updateStep: (id, patch) => {
    const current = get().config;
    const updated = {
      ...current,
      steps: current.steps
        .map((s) => (s.id === id ? { ...s, ...patch } : s))
        .sort((a, b) => a.sequence - b.sequence),
    };
    persistWorkflow(updated);
    set({ config: updated });
  },

  toggleStep: (id, active) => {
    get().updateStep(id, { active });
  },

  updateFieldConfig: (fieldKey, patch) => {
    const current = get().config;
    const updated = {
      ...current,
      fields: current.fields.map((f) => (f.fieldKey === fieldKey ? { ...f, ...patch } : f)),
    };
    persistWorkflow(updated);
    set({ config: updated });
  },

  isFieldMandatory: (fieldKey, module) => {
    const { config } = get();
    const field = config.fields.find((f) => f.fieldKey === fieldKey);
    if (!field) return false;
    if (field.visibility === "hidden") return false;
    if (module && field.moduleScope !== "shared" && field.moduleScope !== module) return false;
    return field.requirement === "mandatory";
  },

  // ── Validation, Versioning & State Machine ────────────────────────────────
  validateWorkflow: (testConfig) => {
    const cfg = testConfig || get().config;
    const errors: string[] = [];

    if (!cfg.mode) errors.push("Workflow mode must be specified.");
    if (!cfg.processes || cfg.processes.length === 0) errors.push("At least one workshop process must be declared.");
    if (!cfg.books || cfg.books.length === 0) errors.push("At least one physical metal book must be declared.");
    if (!cfg.steps || cfg.steps.length === 0) errors.push("At least one workflow step must be defined.");

    // Check step sequence uniqueness
    const seqs = new Set<number>();
    for (const step of cfg.steps) {
      if (seqs.has(step.sequence)) {
        errors.push(`Duplicate step sequence detected: #${step.sequence} (${step.name})`);
      }
      seqs.add(step.sequence);
    }

    // Check books purity boundaries
    for (const book of cfg.books) {
      if (book.purity <= 0 || book.purity > 1000) {
        errors.push(`Invalid purity grade ${book.purity} for book "${book.bookName}".`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  publishWorkflow: async (changeNotes) => {
    const { config, validateWorkflow } = get();
    const val = validateWorkflow(config);
    if (!val.valid) {
      return { success: false, version: config.activeVersion, errors: val.errors };
    }

    const versionParts = config.activeVersion.split(".").map(Number);
    const nextMinor = `${versionParts[0] || 1}.${(versionParts[1] || 1) + 1}.0`;

    const newVersion: WorkflowVersion = {
      versionId: `ver_${Date.now()}`,
      versionNumber: nextMinor,
      status: "published",
      publishedAt: new Date().toISOString(),
      publishedBy: "system_admin",
      changeNotes: changeNotes || "Workflow configuration updated & published",
      configSnapshot: { ...config },
    };

    const updated: WorkflowConfig = {
      ...config,
      activeVersion: nextMinor,
      versions: [newVersion, ...config.versions],
    };

    persistWorkflow(updated);
    set({ config: updated });

    return { success: true, version: nextMinor };
  },

  validateStateTransition: (fromStatus, toStatus, _role) => {
    const from = (fromStatus || "draft").toLowerCase();
    const to = (toStatus || "").toLowerCase();

    if (from === to) return { allowed: true };

    const allowedNext = VALID_STATE_TRANSITIONS[from];
    if (!allowedNext || !allowedNext.includes(to)) {
      return {
        allowed: false,
        reason: `Transition from "${from}" to "${to}" is not permitted under the active workflow state machine.`,
      };
    }

    return { allowed: true };
  },
}));
