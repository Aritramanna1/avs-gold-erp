/**
 * Universal Transaction Types Store
 * Authoritative Declarative Transaction Engine for Ornexa Gold ERP
 *
 * Master Reference: docs/MASTER/UNIVERSAL_TRANSACTION_ENGINE.md
 * Master Reference: docs/MASTER/CUSTOMIZATION_MASTER.md
 *
 * "WE CANNOT PREDICT EVERY FUTURE JEWELLERY TRANSACTION. THEREFORE, AUTHORISED
 * TENANTS CAN INTRODUCE LEGITIMATE NEW BUSINESS TRANSACTIONS THROUGH DECLARATIVE
 * METADATA WITHOUT TOUCHING SOURCE CODE."
 */
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { toast } from "sonner";

export type TransactionCategory =
  "sales" | "purchase" | "workshop" | "subcontractor" | "treasury" | "custom";

export type PartyRequirement =
  "customer" | "supplier" | "karigar" | "refinery" | "hallmark" | "optional" | "none";

export type MovementDirection = "INWARD" | "OUTWARD" | "TRANSFER" | "NONE";

export type LineItemType = "metal" | "stone" | "charge" | "payment";

export interface TransactionCustomField {
  id: string;
  name: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "boolean";
  required: boolean;
  options?: string[];
  placeholder?: string;
  defaultValue?: string | number | boolean;
}

export interface LedgerImpactConfig {
  moneyLedger: boolean; // 1. Financial Money Ledger (Debit / Credit)
  metalLedger: boolean; // 2. Physical Metal Ledger (Gross / Touch / Fine)
  stockLedger: boolean; // 3. Stock & Inventory Ledger (Tags / Loose / Vault)
  partyLedger: boolean; // 4. Party 360 Balance Ledger
  mfgLedger: boolean; // 5. Manufacturing WIP & Job Traceability Ledger
  taxLedger: boolean; // 6. GST & Statutory Tax Ledger
}

export interface ApprovalRuleConfig {
  mode: "auto" | "single" | "threshold";
  minAmountPaise?: number;
  minWeightG?: number;
  approverRole?: "manager" | "owner" | "admin";
}

export interface TransactionTypeDefinition {
  id: string;
  code: string;
  name: string;
  description: string;
  category: TransactionCategory;
  prefix: string;
  partyRequirement: PartyRequirement;
  movementDirection: MovementDirection;
  lineItemTypes: LineItemType[];
  customFields: TransactionCustomField[];
  ledgerImpact: LedgerImpactConfig;
  approvalRule: ApprovalRuleConfig;
  defaultTemplateId?: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const STANDARD_TRANSACTION_PRESETS: TransactionTypeDefinition[] = [
  // 1. Commercial Sales
  {
    id: "tx_retail_tax_inv",
    code: "RETAIL_TAX_INV",
    name: "Retail Tax Invoice",
    description:
      "Standard GST compliant retail sale with metal, making charges, and instant split settlements.",
    category: "sales",
    prefix: "INV-2026-",
    partyRequirement: "customer",
    movementDirection: "OUTWARD",
    lineItemTypes: ["metal", "stone", "charge", "payment"],
    customFields: [
      {
        id: "f_e_way",
        name: "e_way_bill_no",
        label: "E-Way Bill Number",
        type: "text",
        required: false,
      },
      {
        id: "f_salesperson",
        name: "salesperson_id",
        label: "Sales Counter Executive",
        type: "select",
        options: ["Counter 1", "Counter 2", "VIP Lounge"],
        required: false,
      },
    ],
    ledgerImpact: {
      moneyLedger: true,
      metalLedger: true,
      stockLedger: true,
      partyLedger: true,
      mfgLedger: false,
      taxLedger: true,
    },
    approvalRule: { mode: "auto" },
    defaultTemplateId: "gst_invoice",
    isSystem: true,
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-08-15T00:00:00Z",
  },
  {
    id: "tx_sales_estimate",
    code: "SALES_ESTIMATE",
    name: "Sales Quotation / Estimate",
    description: "Non-fiscal quotation with gold rate lock and making charge calculations.",
    category: "sales",
    prefix: "EST-",
    partyRequirement: "customer",
    movementDirection: "NONE",
    lineItemTypes: ["metal", "stone", "charge"],
    customFields: [
      {
        id: "f_valid_days",
        name: "validity_days",
        label: "Validity (Days)",
        type: "number",
        required: true,
        defaultValue: 3,
      },
    ],
    ledgerImpact: {
      moneyLedger: false,
      metalLedger: false,
      stockLedger: false,
      partyLedger: false,
      mfgLedger: false,
      taxLedger: false,
    },
    approvalRule: { mode: "auto" },
    defaultTemplateId: "estimate",
    isSystem: true,
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-08-15T00:00:00Z",
  },

  // 2. Purchases & Inward
  {
    id: "tx_old_gold_purchase",
    code: "OLD_GOLD_PURCHASE",
    name: "Old Gold Scrap Purchase",
    description: "Direct gold purchase from walk-in customer with melt assay touch deduction.",
    category: "purchase",
    prefix: "OGP-2026-",
    partyRequirement: "customer",
    movementDirection: "INWARD",
    lineItemTypes: ["metal", "charge", "payment"],
    customFields: [
      {
        id: "f_id_proof",
        name: "kyc_id_type",
        label: "Customer KYC ID Type",
        type: "select",
        options: ["Aadhaar Card", "PAN Card", "Driving License", "Passport"],
        required: true,
      },
      {
        id: "f_melt_purity",
        name: "assay_method",
        label: "Assay Method",
        type: "select",
        options: ["XRF Touchstone", "Acid Scratch", "Specific Gravity"],
        required: true,
      },
    ],
    ledgerImpact: {
      moneyLedger: true,
      metalLedger: true,
      stockLedger: true,
      partyLedger: true,
      mfgLedger: false,
      taxLedger: true,
    },
    approvalRule: { mode: "threshold", minWeightG: 50.0, approverRole: "manager" },
    defaultTemplateId: "purchase_voucher",
    isSystem: true,
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-08-15T00:00:00Z",
  },

  // 3. Workshop & Manufacturing
  {
    id: "tx_karigar_issue",
    code: "KARIGAR_METAL_ISSUE",
    name: "Karigar Metal Issue Slip",
    description: "Issue raw gold bar, alloy, or semi-finished casting to artisan workshop bench.",
    category: "workshop",
    prefix: "ISS-",
    partyRequirement: "karigar",
    movementDirection: "TRANSFER",
    lineItemTypes: ["metal"],
    customFields: [
      {
        id: "f_target_job",
        name: "job_card_ref",
        label: "Job Card Reference",
        type: "text",
        required: true,
      },
      {
        id: "f_allowed_loss",
        name: "allowed_loss_pct",
        label: "Max Wastage Allowed (%)",
        type: "number",
        required: true,
        defaultValue: 0.5,
      },
    ],
    ledgerImpact: {
      moneyLedger: false,
      metalLedger: true,
      stockLedger: true,
      partyLedger: true,
      mfgLedger: true,
      taxLedger: false,
    },
    approvalRule: { mode: "threshold", minWeightG: 100.0, approverRole: "manager" },
    defaultTemplateId: "job_card",
    isSystem: true,
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-08-15T00:00:00Z",
  },
  {
    id: "tx_karigar_receive",
    code: "KARIGAR_RECEIVE_SCRAP",
    name: "Karigar Receive & Scrap Voucher",
    description: "Receive finished ornament, dust, filings, and reconcile gold balance.",
    category: "workshop",
    prefix: "REC-",
    partyRequirement: "karigar",
    movementDirection: "TRANSFER",
    lineItemTypes: ["metal", "stone", "charge"],
    customFields: [
      {
        id: "f_qc_passed",
        name: "qc_status",
        label: "QC Inspection Status",
        type: "select",
        options: ["Passed", "Rework Required", "Assay Recheck"],
        required: true,
      },
    ],
    ledgerImpact: {
      moneyLedger: true,
      metalLedger: true,
      stockLedger: true,
      partyLedger: true,
      mfgLedger: true,
      taxLedger: false,
    },
    approvalRule: { mode: "auto" },
    defaultTemplateId: "job_card",
    isSystem: true,
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-08-15T00:00:00Z",
  },

  // 4. Subcontractor & Specialized
  {
    id: "tx_outside_mina_challan",
    code: "OUTSIDE_MINA_CHALLAN",
    name: "Outside Mina / Polish Challan",
    description:
      "Subcontract delivery challan for enameling, setting, laser soldering, or rhodium plating.",
    category: "subcontractor",
    prefix: "CHL-",
    partyRequirement: "supplier",
    movementDirection: "TRANSFER",
    lineItemTypes: ["metal", "charge"],
    customFields: [
      {
        id: "f_operation",
        name: "outside_operation",
        label: "Operation Type",
        type: "select",
        options: [
          "Meenakari (Enamel)",
          "Micro Diamond Setting",
          "Rhodium / Two-Tone Plating",
          "Laser Hallmarking",
          "High-Gloss Buffing",
        ],
        required: true,
      },
      {
        id: "f_expected_date",
        name: "expected_return_date",
        label: "Expected Return Date",
        type: "date",
        required: true,
      },
    ],
    ledgerImpact: {
      moneyLedger: false,
      metalLedger: true,
      stockLedger: true,
      partyLedger: true,
      mfgLedger: true,
      taxLedger: false,
    },
    approvalRule: { mode: "auto" },
    defaultTemplateId: "delivery_challan",
    isSystem: true,
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-08-15T00:00:00Z",
  },
  {
    id: "tx_refinery_melting_voucher",
    code: "REFINERY_MELTING_LOSS",
    name: "Refinery Melting Loss Voucher",
    description:
      "Assay and refinery bar conversion voucher with exact dross and melting loss write-off.",
    category: "workshop",
    prefix: "MLT-",
    partyRequirement: "refinery",
    movementDirection: "TRANSFER",
    lineItemTypes: ["metal", "charge"],
    customFields: [
      {
        id: "f_gross_in",
        name: "gross_inward_g",
        label: "Gross Scrap Inward (g)",
        type: "number",
        required: true,
      },
      {
        id: "f_melt_loss",
        name: "loss_weight_g",
        label: "Actual Melting Loss (g)",
        type: "number",
        required: true,
      },
      {
        id: "f_bar_touch",
        name: "final_purity_pct",
        label: "Refined Bar Purity (%)",
        type: "number",
        required: true,
      },
    ],
    ledgerImpact: {
      moneyLedger: true,
      metalLedger: true,
      stockLedger: true,
      partyLedger: true,
      mfgLedger: true,
      taxLedger: false,
    },
    approvalRule: { mode: "threshold", minWeightG: 5.0, approverRole: "owner" },
    defaultTemplateId: "purchase_voucher",
    isSystem: true,
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-08-15T00:00:00Z",
  },

  // 5. Treasury & Accounting Vouchers
  {
    id: "tx_cash_receipt",
    code: "CASH_RECEIPT",
    name: "Cash / Bank Receipt",
    description:
      "Money received from customer, supplier, or internal transfer — posts to cash/bank debit.",
    category: "treasury",
    prefix: "RCP-",
    partyRequirement: "optional",
    movementDirection: "INWARD",
    lineItemTypes: ["payment"],
    customFields: [
      {
        id: "f_debit_account",
        name: "debit_account_id",
        label: "Debit Account (Cash/Bank)",
        type: "text",
        required: true,
      },
      {
        id: "f_credit_account",
        name: "credit_account_id",
        label: "Credit Account (Party/Income)",
        type: "text",
        required: true,
      },
      {
        id: "f_narration",
        name: "narration",
        label: "Narration",
        type: "text",
        required: false,
      },
    ],
    ledgerImpact: {
      moneyLedger: true,
      metalLedger: false,
      stockLedger: false,
      partyLedger: true,
      mfgLedger: false,
      taxLedger: false,
    },
    approvalRule: { mode: "auto" },
    isSystem: true,
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-08-16T00:00:00Z",
  },
  {
    id: "tx_cash_payment",
    code: "CASH_PAYMENT",
    name: "Cash / Bank Payment",
    description:
      "Money paid out for expenses, suppliers, or transfers — posts to cash/bank credit.",
    category: "treasury",
    prefix: "PAY-",
    partyRequirement: "optional",
    movementDirection: "OUTWARD",
    lineItemTypes: ["payment"],
    customFields: [
      {
        id: "f_debit_account",
        name: "debit_account_id",
        label: "Debit Account (Expense/Party)",
        type: "text",
        required: true,
      },
      {
        id: "f_credit_account",
        name: "credit_account_id",
        label: "Credit Account (Cash/Bank)",
        type: "text",
        required: true,
      },
      {
        id: "f_narration",
        name: "narration",
        label: "Narration",
        type: "text",
        required: false,
      },
    ],
    ledgerImpact: {
      moneyLedger: true,
      metalLedger: false,
      stockLedger: false,
      partyLedger: true,
      mfgLedger: false,
      taxLedger: false,
    },
    approvalRule: { mode: "auto" },
    isSystem: true,
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-08-16T00:00:00Z",
  },
  {
    id: "tx_journal_voucher",
    code: "JOURNAL_VOUCHER",
    name: "Journal Voucher",
    description: "Non-cash adjusting entry between two ledger accounts.",
    category: "treasury",
    prefix: "JNL-",
    partyRequirement: "none",
    movementDirection: "NONE",
    lineItemTypes: ["payment"],
    customFields: [
      {
        id: "f_debit_account",
        name: "debit_account_id",
        label: "Debit Account",
        type: "text",
        required: true,
      },
      {
        id: "f_credit_account",
        name: "credit_account_id",
        label: "Credit Account",
        type: "text",
        required: true,
      },
      {
        id: "f_narration",
        name: "narration",
        label: "Narration",
        type: "text",
        required: true,
      },
    ],
    ledgerImpact: {
      moneyLedger: true,
      metalLedger: false,
      stockLedger: false,
      partyLedger: false,
      mfgLedger: false,
      taxLedger: false,
    },
    approvalRule: { mode: "auto" },
    isSystem: true,
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-08-16T00:00:00Z",
  },
  {
    id: "tx_contra_voucher",
    code: "CONTRA_VOUCHER",
    name: "Contra Voucher",
    description: "Transfer between cash and bank accounts without a third party.",
    category: "treasury",
    prefix: "CTR-",
    partyRequirement: "none",
    movementDirection: "TRANSFER",
    lineItemTypes: ["payment"],
    customFields: [
      {
        id: "f_from_account",
        name: "from_account_id",
        label: "From Account",
        type: "text",
        required: true,
      },
      {
        id: "f_to_account",
        name: "to_account_id",
        label: "To Account",
        type: "text",
        required: true,
      },
      {
        id: "f_narration",
        name: "narration",
        label: "Narration",
        type: "text",
        required: false,
      },
    ],
    ledgerImpact: {
      moneyLedger: true,
      metalLedger: false,
      stockLedger: false,
      partyLedger: false,
      mfgLedger: false,
      taxLedger: false,
    },
    approvalRule: { mode: "auto" },
    isSystem: true,
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-08-16T00:00:00Z",
  },

  // 6. Custom Business Transactions
  {
    id: "tx_exhibition_consignment",
    code: "EXHIBITION_CONSIGNMENT",
    name: "Exhibition Consignment Note",
    description: "Temporary outward movement for jewelry shows, trade expos, or VIP trunk shows.",
    category: "custom",
    prefix: "EXH-",
    partyRequirement: "optional",
    movementDirection: "TRANSFER",
    lineItemTypes: ["metal", "stone"],
    customFields: [
      {
        id: "f_expo_name",
        name: "expo_name",
        label: "Exhibition / Event Name",
        type: "text",
        required: true,
      },
      {
        id: "f_booth_no",
        name: "booth_number",
        label: "Booth / Stall Number",
        type: "text",
        required: false,
      },
      {
        id: "f_security_escort",
        name: "security_escort",
        label: "Armored Transit Escort Name",
        type: "text",
        required: true,
      },
    ],
    ledgerImpact: {
      moneyLedger: false,
      metalLedger: true,
      stockLedger: true,
      partyLedger: false,
      mfgLedger: false,
      taxLedger: false,
    },
    approvalRule: { mode: "single", approverRole: "owner" },
    defaultTemplateId: "delivery_challan",
    isSystem: false,
    isActive: true,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-15T00:00:00Z",
  },
  {
    id: "tx_bullion_swap_chit",
    code: "BULLION_SWAP_CHIT",
    name: "Bullion Swap Chit",
    description:
      "Fine Gold 999 to 22K alloy bar exchange chit with touch adjustments and conversion charges.",
    category: "custom",
    prefix: "SWP-",
    partyRequirement: "supplier",
    movementDirection: "TRANSFER",
    lineItemTypes: ["metal", "charge"],
    customFields: [
      {
        id: "f_swap_touch",
        name: "source_touch",
        label: "Source Bar Purity (%)",
        type: "number",
        required: true,
        defaultValue: 99.9,
      },
      {
        id: "f_target_touch",
        name: "target_touch",
        label: "Target Bar Purity (%)",
        type: "number",
        required: true,
        defaultValue: 91.6,
      },
    ],
    ledgerImpact: {
      moneyLedger: true,
      metalLedger: true,
      stockLedger: true,
      partyLedger: true,
      mfgLedger: false,
      taxLedger: false,
    },
    approvalRule: { mode: "threshold", minWeightG: 50.0, approverRole: "manager" },
    defaultTemplateId: "purchase_voucher",
    isSystem: false,
    isActive: true,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-15T00:00:00Z",
  },
];

interface TxDefRow {
  id: string;
  code: string;
  name: string;
  category: string;
  counterparty_type: string;
  fields_schema: TransactionCustomField[] | null;
  posting_rules: Record<string, unknown> | null;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function toPostingRules(def: TransactionTypeDefinition): Record<string, unknown> {
  return {
    prefix: def.prefix,
    movementDirection: def.movementDirection,
    lineItemTypes: def.lineItemTypes,
    ledgerImpact: def.ledgerImpact,
    approvalRule: def.approvalRule,
    defaultTemplateId: def.defaultTemplateId,
    description: def.description,
  };
}

function fromTxDefRow(row: TxDefRow): TransactionTypeDefinition {
  const rules = row.posting_rules ?? {};
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: String(rules.description ?? ""),
    category: row.category as TransactionCategory,
    prefix: String(rules.prefix ?? "VCH-"),
    partyRequirement: row.counterparty_type as PartyRequirement,
    movementDirection: (rules.movementDirection as MovementDirection) ?? "NONE",
    lineItemTypes: (rules.lineItemTypes as LineItemType[]) ?? ["metal"],
    customFields: Array.isArray(row.fields_schema) ? row.fields_schema : [],
    ledgerImpact: (rules.ledgerImpact as LedgerImpactConfig) ?? {
      moneyLedger: true,
      metalLedger: true,
      stockLedger: true,
      partyLedger: true,
      mfgLedger: false,
      taxLedger: false,
    },
    approvalRule: (rules.approvalRule as ApprovalRuleConfig) ?? { mode: "auto" },
    defaultTemplateId: rules.defaultTemplateId as string | undefined,
    isSystem: row.is_system,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function seedStandardTransactionDefinitions(): Promise<void> {
  for (const def of STANDARD_TRANSACTION_PRESETS) {
    const { error } = await supabase.from("universal_transaction_definitions" as never).insert({
      code: def.code,
      name: def.name,
      category: def.category,
      counterparty_type: def.partyRequirement,
      fields_schema: def.customFields,
      posting_rules: toPostingRules(def),
      is_system: def.isSystem,
      is_active: def.isActive,
    } as never);
    if (error && !error.message.includes("duplicate")) {
      console.warn("[transaction-types] seed failed:", error.message);
    }
  }
}

interface TransactionTypesState {
  transactionTypes: TransactionTypeDefinition[];
  selectedCategory: TransactionCategory | "all";
  searchQuery: string;
  loading: boolean;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  setCategory: (category: TransactionCategory | "all") => void;
  setSearchQuery: (query: string) => void;
  addTransactionType: (
    definition: Omit<TransactionTypeDefinition, "id" | "createdAt" | "updatedAt">,
  ) => Promise<TransactionTypeDefinition | null>;
  updateTransactionType: (id: string, updates: Partial<TransactionTypeDefinition>) => Promise<void>;
  deleteTransactionType: (id: string) => Promise<boolean>;
  toggleTransactionActive: (id: string) => Promise<void>;
  resetToStandardPresets: () => Promise<void>;
  exportCustomSchemaBundle: () => string;
  importCustomSchemaBundle: (
    jsonString: string,
  ) => Promise<{ success: boolean; count: number; error?: string }>;
  getByCode: (code: string) => TransactionTypeDefinition | undefined;
}

export const useTransactionTypesStore = create<TransactionTypesState>()((set, get) => ({
  transactionTypes: [],
  selectedCategory: "all",
  searchQuery: "",
  loading: false,
  isHydrated: false,

  hydrate: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from("universal_transaction_definitions" as never)
        .select(
          "id,code,name,category,counterparty_type,fields_schema,posting_rules,is_system,is_active,created_at,updated_at",
        )
        .order("name", { ascending: true });
      if (error) throw error;

      let rows = (data ?? []) as unknown as TxDefRow[];
      if (rows.length === 0) {
        await seedStandardTransactionDefinitions();
        const retry = await supabase
          .from("universal_transaction_definitions" as never)
          .select(
            "id,code,name,category,counterparty_type,fields_schema,posting_rules,is_system,is_active,created_at,updated_at",
          )
          .order("name", { ascending: true });
        if (retry.error) throw retry.error;
        rows = (retry.data ?? []) as unknown as TxDefRow[];
      }

      set({
        transactionTypes: rows.map(fromTxDefRow),
        isHydrated: true,
        loading: false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load transaction types";
      console.warn("[transaction-types] hydrate failed:", message);
      set({ transactionTypes: STANDARD_TRANSACTION_PRESETS, isHydrated: true, loading: false });
    }
  },

  setCategory: (category) => set({ selectedCategory: category }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  addTransactionType: async (definition) => {
    const { data, error } = await supabase
      .from("universal_transaction_definitions" as never)
      .insert({
        code: definition.code,
        name: definition.name,
        category: definition.category,
        counterparty_type: definition.partyRequirement,
        fields_schema: definition.customFields,
        posting_rules: toPostingRules(definition as TransactionTypeDefinition),
        is_system: definition.isSystem,
        is_active: definition.isActive,
      } as never)
      .select(
        "id,code,name,category,counterparty_type,fields_schema,posting_rules,is_system,is_active,created_at,updated_at",
      )
      .single();
    if (error) {
      toast.error(error.message ?? "Could not create transaction type.");
      return null;
    }
    const created = fromTxDefRow(data as unknown as TxDefRow);
    set((state) => ({ transactionTypes: [created, ...state.transactionTypes] }));
    return created;
  },

  updateTransactionType: async (id, updates) => {
    const current = get().transactionTypes.find((t) => t.id === id);
    if (!current) return;
    const merged = { ...current, ...updates };
    const { error } = await supabase
      .from("universal_transaction_definitions" as never)
      .update({
        code: merged.code,
        name: merged.name,
        category: merged.category,
        counterparty_type: merged.partyRequirement,
        fields_schema: merged.customFields,
        posting_rules: toPostingRules(merged),
        is_active: merged.isActive,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id);
    if (error) {
      toast.error(error.message ?? "Could not update transaction type.");
      return;
    }
    set((state) => ({
      transactionTypes: state.transactionTypes.map((tx) =>
        tx.id === id ? { ...tx, ...updates, updatedAt: new Date().toISOString() } : tx,
      ),
    }));
  },

  deleteTransactionType: async (id) => {
    const tx = get().transactionTypes.find((t) => t.id === id);
    if (!tx || tx.isSystem) return false;
    const { error } = await supabase
      .from("universal_transaction_definitions" as never)
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message ?? "Could not delete transaction type.");
      return false;
    }
    set((state) => ({
      transactionTypes: state.transactionTypes.filter((t) => t.id !== id),
    }));
    return true;
  },

  toggleTransactionActive: async (id) => {
    const tx = get().transactionTypes.find((t) => t.id === id);
    if (!tx) return;
    await get().updateTransactionType(id, { isActive: !tx.isActive });
  },

  resetToStandardPresets: async () => {
    for (const def of STANDARD_TRANSACTION_PRESETS) {
      const existing = get().transactionTypes.find((t) => t.code === def.code);
      if (existing) {
        await get().updateTransactionType(existing.id, def);
      } else {
        await get().addTransactionType(def);
      }
    }
    await get().hydrate();
  },

  exportCustomSchemaBundle: () =>
    JSON.stringify(
      {
        schemaVersion: "3.1.0",
        exportedAt: new Date().toISOString(),
        transactionTypes: get().transactionTypes,
      },
      null,
      2,
    ),

  importCustomSchemaBundle: async (jsonString) => {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.transactionTypes || !Array.isArray(parsed.transactionTypes)) {
        return {
          success: false,
          count: 0,
          error: "Invalid JSON format: missing transactionTypes array",
        };
      }
      let count = 0;
      for (const tx of parsed.transactionTypes) {
        const def: Omit<TransactionTypeDefinition, "id" | "createdAt" | "updatedAt"> = {
          code: String(tx.code || "CUSTOM_TX")
            .toUpperCase()
            .replace(/[^A-Z0-9_]/g, "_"),
          name: String(tx.name || "Untitled Transaction"),
          description: String(tx.description || ""),
          category: tx.category || "custom",
          prefix: String(tx.prefix || "VCH-"),
          partyRequirement: tx.partyRequirement || "optional",
          movementDirection: tx.movementDirection || "NONE",
          lineItemTypes: Array.isArray(tx.lineItemTypes) ? tx.lineItemTypes : ["metal"],
          customFields: Array.isArray(tx.customFields) ? tx.customFields : [],
          ledgerImpact: tx.ledgerImpact ?? {
            moneyLedger: true,
            metalLedger: true,
            stockLedger: true,
            partyLedger: true,
            mfgLedger: false,
            taxLedger: false,
          },
          approvalRule: tx.approvalRule || { mode: "auto" },
          defaultTemplateId: tx.defaultTemplateId || "purchase_voucher",
          isSystem: !!tx.isSystem,
          isActive: tx.isActive !== false,
        };
        const existing = get().transactionTypes.find((t) => t.code === def.code);
        if (existing) await get().updateTransactionType(existing.id, def);
        else await get().addTransactionType(def);
        count++;
      }
      await get().hydrate();
      return { success: true, count };
    } catch (err: unknown) {
      return {
        success: false,
        count: 0,
        error: err instanceof Error ? err.message : "Failed to parse JSON",
      };
    }
  },

  getByCode: (code) => get().transactionTypes.find((t) => t.code === code),
}));

let hydrateOnce: Promise<void> | null = null;

export function ensureTransactionTypesLoaded(): Promise<void> {
  if (!hydrateOnce) hydrateOnce = useTransactionTypesStore.getState().hydrate();
  return hydrateOnce;
}

/** Post a universal transaction to the authoritative ledger via RPC. */
export async function postUniversalTransaction(params: {
  transactionCode: string;
  voucherNumber: string;
  counterpartyId?: string;
  counterpartyName?: string;
  grossWeightMg?: number;
  netWeightMg?: number;
  fineGoldDebitMg?: number;
  fineGoldCreditMg?: number;
  cashDebitPaise?: number;
  cashCreditPaise?: number;
  waitingOn?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ entryId: string | null; error?: string }> {
  const def = useTransactionTypesStore.getState().getByCode(params.transactionCode);
  if (!def || !def.isActive) {
    return { entryId: null, error: `Transaction type ${params.transactionCode} is not active.` };
  }

  const { data: profile } = await supabase
    .from("user_profiles" as never)
    .select("firm_id")
    .maybeSingle();
  const firmId = (profile as { firm_id?: string } | null)?.firm_id;
  if (!firmId) return { entryId: null, error: "Firm context required." };

  const { data, error } = await supabase.rpc(
    "rpc_post_universal_transaction" as never,
    {
      p_firm_id: firmId,
      p_branch_id: null,
      p_transaction_code: params.transactionCode,
      p_voucher_number: params.voucherNumber,
      p_counterparty_id: params.counterpartyId ?? null,
      p_counterparty_name: params.counterpartyName ?? null,
      p_gross_weight_mg: params.grossWeightMg ?? 0,
      p_net_weight_mg: params.netWeightMg ?? 0,
      p_fine_gold_debit_mg: params.fineGoldDebitMg ?? 0,
      p_fine_gold_credit_mg: params.fineGoldCreditMg ?? 0,
      p_cash_debit_paise: params.cashDebitPaise ?? 0,
      p_cash_credit_paise: params.cashCreditPaise ?? 0,
      p_waiting_on: params.waitingOn ?? null,
      p_metadata: params.metadata ?? {},
    } as never,
  );

  if (error) return { entryId: null, error: error.message };
  return { entryId: data as string };
}
