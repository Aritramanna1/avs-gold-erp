export type OrnexaTransactionDomain =
  "commercial" | "manufacturing" | "inventory" | "finance" | "compliance" | "operations";

export type OrnexaTransactionStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "issued"
  | "received"
  | "partially_settled"
  | "settled"
  | "closed"
  | "cancelled"
  | "reversed";

export type OrnexaLedgerFamily =
  | "customer_gold"
  | "karigar_gold"
  | "stock_gold"
  | "vault_gold"
  | "cash_bank"
  | "gst_tax"
  | "labour"
  | "stone"
  | "wastage"
  | "loss"
  | "rounding";

export type OrnexaDocumentKind =
  | "estimate"
  | "order"
  | "issue_voucher"
  | "receipt_voucher"
  | "job_card"
  | "manufacturing_bill"
  | "tax_invoice"
  | "payment_receipt"
  | "settlement_note"
  | "transfer_challan"
  | "hallmark_memo"
  | "day_close_report";

export type OrnexaActorRole =
  | "platform_owner"
  | "tenant_owner"
  | "branch_manager"
  | "accountant"
  | "sales_user"
  | "manufacturing_manager"
  | "karigar"
  | "inventory_user"
  | "customer";

export interface OrnexaTransactionDimension {
  key: string;
  required: boolean;
  description: string;
}

export interface OrnexaPostingRule {
  ledgerFamily: OrnexaLedgerFamily;
  direction: "debit" | "credit" | "memo";
  basis: "gross_weight" | "net_weight" | "fine_gold" | "cash" | "tax" | "quantity";
  required: boolean;
}

export interface OrnexaTransitionRule {
  from: OrnexaTransactionStatus;
  to: OrnexaTransactionStatus;
  permission: OrnexaActorRole[];
  auditRequired: boolean;
}

export interface OrnexaTransactionContract {
  key: string;
  name: string;
  domain: OrnexaTransactionDomain;
  purpose: string;
  statuses: OrnexaTransactionStatus[];
  requiredDimensions: OrnexaTransactionDimension[];
  postingRules: OrnexaPostingRule[];
  documents: OrnexaDocumentKind[];
  transitions: OrnexaTransitionRule[];
  reversalRequired: boolean;
  approvalRequired: boolean;
  printRequired: boolean;
  portalVisibleTo: OrnexaActorRole[];
}

const COMMON_DIMENSIONS: OrnexaTransactionDimension[] = [
  { key: "tenant_id", required: true, description: "Tenant isolation boundary." },
  {
    key: "branch_id",
    required: true,
    description: "Branch-level operational and ledger boundary.",
  },
  { key: "financial_year_id", required: true, description: "Period lock and numbering boundary." },
  { key: "created_by", required: true, description: "User responsible for the command." },
];

const OWNER_APPROVAL: OrnexaActorRole[] = ["tenant_owner", "branch_manager"];
const MANUFACTURING_APPROVAL: OrnexaActorRole[] = [
  "tenant_owner",
  "branch_manager",
  "manufacturing_manager",
];

export const ORNEXA_TRANSACTION_CONTRACTS: Record<string, OrnexaTransactionContract> = {
  customer_order_to_cash: {
    key: "customer_order_to_cash",
    name: "Customer Order to Cash",
    domain: "commercial",
    purpose:
      "Captures customer order, advance, manufacturing handoff, delivery invoice, payment, and closure without losing gold or cash traceability.",
    statuses: [
      "draft",
      "submitted",
      "approved",
      "issued",
      "received",
      "settled",
      "closed",
      "cancelled",
      "reversed",
    ],
    requiredDimensions: [
      ...COMMON_DIMENSIONS,
      { key: "customer_id", required: true, description: "Customer ledger owner." },
      { key: "order_id", required: true, description: "Commercial demand source." },
      {
        key: "product_lines",
        required: true,
        description: "Ordered jewellery lines with purity and weight intent.",
      },
    ],
    postingRules: [
      { ledgerFamily: "customer_gold", direction: "debit", basis: "fine_gold", required: true },
      { ledgerFamily: "cash_bank", direction: "credit", basis: "cash", required: false },
      { ledgerFamily: "gst_tax", direction: "credit", basis: "tax", required: false },
    ],
    documents: ["order", "job_card", "manufacturing_bill", "tax_invoice", "payment_receipt"],
    transitions: [
      {
        from: "draft",
        to: "submitted",
        permission: ["sales_user", "tenant_owner"],
        auditRequired: true,
      },
      { from: "submitted", to: "approved", permission: OWNER_APPROVAL, auditRequired: true },
      { from: "approved", to: "closed", permission: OWNER_APPROVAL, auditRequired: true },
      { from: "approved", to: "cancelled", permission: OWNER_APPROVAL, auditRequired: true },
    ],
    reversalRequired: true,
    approvalRequired: true,
    printRequired: true,
    portalVisibleTo: ["tenant_owner", "branch_manager", "sales_user", "customer"],
  },
  manufacturing_issue: {
    key: "manufacturing_issue",
    name: "Manufacturing Issue",
    domain: "manufacturing",
    purpose:
      "Issues customer, vault, or stock gold to an internal department, karigar, or external worker with custody accountability.",
    statuses: ["draft", "approved", "issued", "cancelled", "reversed"],
    requiredDimensions: [
      ...COMMON_DIMENSIONS,
      {
        key: "custodian_party_id",
        required: true,
        description: "Worker, department, or external party receiving custody.",
      },
      {
        key: "source_ledger",
        required: true,
        description: "Vault, stock, or customer gold source.",
      },
      {
        key: "issue_lines",
        required: true,
        description: "Metal, purity, gross, net, stone, and fine-gold details.",
      },
    ],
    postingRules: [
      { ledgerFamily: "vault_gold", direction: "credit", basis: "fine_gold", required: true },
      { ledgerFamily: "karigar_gold", direction: "debit", basis: "fine_gold", required: true },
      { ledgerFamily: "stock_gold", direction: "memo", basis: "quantity", required: false },
    ],
    documents: ["issue_voucher", "job_card"],
    transitions: [
      { from: "draft", to: "approved", permission: MANUFACTURING_APPROVAL, auditRequired: true },
      {
        from: "approved",
        to: "issued",
        permission: ["manufacturing_manager", "tenant_owner"],
        auditRequired: true,
      },
      { from: "issued", to: "cancelled", permission: ["tenant_owner"], auditRequired: true },
    ],
    reversalRequired: true,
    approvalRequired: true,
    printRequired: true,
    portalVisibleTo: ["tenant_owner", "branch_manager", "manufacturing_manager", "karigar"],
  },
  manufacturing_receive: {
    key: "manufacturing_receive",
    name: "Manufacturing Receive",
    domain: "manufacturing",
    purpose:
      "Receives finished, semi-finished, scrap, dust, rejected, or loss quantities back from custody and posts the resulting settlement.",
    statuses: [
      "draft",
      "received",
      "approved",
      "partially_settled",
      "settled",
      "closed",
      "reversed",
    ],
    requiredDimensions: [
      ...COMMON_DIMENSIONS,
      { key: "issue_id", required: true, description: "Original issue being settled." },
      {
        key: "receive_lines",
        required: true,
        description: "Returned item, scrap, dust, loss, and purity lines.",
      },
      {
        key: "qc_result",
        required: true,
        description: "QC acceptance, rejection, or rework decision.",
      },
    ],
    postingRules: [
      { ledgerFamily: "karigar_gold", direction: "credit", basis: "fine_gold", required: true },
      { ledgerFamily: "stock_gold", direction: "debit", basis: "fine_gold", required: true },
      { ledgerFamily: "wastage", direction: "memo", basis: "fine_gold", required: true },
      { ledgerFamily: "loss", direction: "memo", basis: "fine_gold", required: true },
      { ledgerFamily: "labour", direction: "credit", basis: "cash", required: false },
    ],
    documents: ["receipt_voucher", "manufacturing_bill", "settlement_note"],
    transitions: [
      {
        from: "draft",
        to: "received",
        permission: ["manufacturing_manager", "inventory_user"],
        auditRequired: true,
      },
      { from: "received", to: "approved", permission: MANUFACTURING_APPROVAL, auditRequired: true },
      {
        from: "approved",
        to: "settled",
        permission: ["accountant", "tenant_owner"],
        auditRequired: true,
      },
      { from: "settled", to: "closed", permission: MANUFACTURING_APPROVAL, auditRequired: true },
    ],
    reversalRequired: true,
    approvalRequired: true,
    printRequired: true,
    portalVisibleTo: ["tenant_owner", "branch_manager", "manufacturing_manager", "karigar"],
  },
  karigar_settlement: {
    key: "karigar_settlement",
    name: "Karigar Settlement",
    domain: "finance",
    purpose:
      "Settles worker gold balance, labour charges, advances, deductions, rework, and payable amounts with full audit history.",
    statuses: ["draft", "submitted", "approved", "settled", "closed", "reversed"],
    requiredDimensions: [
      ...COMMON_DIMENSIONS,
      { key: "karigar_id", required: true, description: "Worker ledger owner." },
      {
        key: "settlement_period",
        required: true,
        description: "Date range covered by the settlement.",
      },
    ],
    postingRules: [
      { ledgerFamily: "karigar_gold", direction: "memo", basis: "fine_gold", required: true },
      { ledgerFamily: "labour", direction: "debit", basis: "cash", required: true },
      { ledgerFamily: "cash_bank", direction: "credit", basis: "cash", required: false },
    ],
    documents: ["settlement_note", "payment_receipt"],
    transitions: [
      {
        from: "draft",
        to: "submitted",
        permission: ["accountant", "manufacturing_manager"],
        auditRequired: true,
      },
      { from: "submitted", to: "approved", permission: OWNER_APPROVAL, auditRequired: true },
      {
        from: "approved",
        to: "settled",
        permission: ["accountant", "tenant_owner"],
        auditRequired: true,
      },
    ],
    reversalRequired: true,
    approvalRequired: true,
    printRequired: true,
    portalVisibleTo: ["tenant_owner", "branch_manager", "accountant", "karigar"],
  },
  old_gold_intake: {
    key: "old_gold_intake",
    name: "Old Gold Intake",
    domain: "commercial",
    purpose:
      "Records customer old gold purchase or exchange with melting, purity conversion, deduction, GST, and customer settlement traceability.",
    statuses: ["draft", "submitted", "approved", "settled", "closed", "reversed"],
    requiredDimensions: [
      ...COMMON_DIMENSIONS,
      { key: "customer_id", required: true, description: "Customer providing old gold." },
      {
        key: "purity_test",
        required: true,
        description: "Declared, tested, and accepted purity details.",
      },
    ],
    postingRules: [
      { ledgerFamily: "customer_gold", direction: "credit", basis: "fine_gold", required: true },
      { ledgerFamily: "stock_gold", direction: "debit", basis: "fine_gold", required: true },
      { ledgerFamily: "cash_bank", direction: "debit", basis: "cash", required: false },
    ],
    documents: ["receipt_voucher", "settlement_note"],
    transitions: [
      {
        from: "draft",
        to: "submitted",
        permission: ["sales_user", "tenant_owner"],
        auditRequired: true,
      },
      { from: "submitted", to: "approved", permission: OWNER_APPROVAL, auditRequired: true },
      {
        from: "approved",
        to: "settled",
        permission: ["accountant", "tenant_owner"],
        auditRequired: true,
      },
    ],
    reversalRequired: true,
    approvalRequired: true,
    printRequired: true,
    portalVisibleTo: ["tenant_owner", "branch_manager", "sales_user", "customer"],
  },
  hallmark_outward_return: {
    key: "hallmark_outward_return",
    name: "Hallmark Outward and Return",
    domain: "compliance",
    purpose:
      "Tracks pieces sent to hallmarking, receipt, HUID capture, rejection, rework, and final compliance document trail.",
    statuses: ["draft", "issued", "received", "approved", "closed", "reversed"],
    requiredDimensions: [
      ...COMMON_DIMENSIONS,
      { key: "hallmark_center_id", required: true, description: "External hallmarking party." },
      {
        key: "item_lines",
        required: true,
        description: "Piece, purity, weight, and HUID lifecycle details.",
      },
    ],
    postingRules: [
      { ledgerFamily: "stock_gold", direction: "memo", basis: "quantity", required: true },
      { ledgerFamily: "cash_bank", direction: "credit", basis: "cash", required: false },
    ],
    documents: ["hallmark_memo", "transfer_challan"],
    transitions: [
      {
        from: "draft",
        to: "issued",
        permission: ["manufacturing_manager", "tenant_owner"],
        auditRequired: true,
      },
      {
        from: "issued",
        to: "received",
        permission: ["inventory_user", "manufacturing_manager"],
        auditRequired: true,
      },
      { from: "received", to: "approved", permission: MANUFACTURING_APPROVAL, auditRequired: true },
    ],
    reversalRequired: true,
    approvalRequired: true,
    printRequired: true,
    portalVisibleTo: ["tenant_owner", "branch_manager", "manufacturing_manager"],
  },
  branch_transfer: {
    key: "branch_transfer",
    name: "Branch Transfer",
    domain: "inventory",
    purpose:
      "Moves gold, stock, documents, or operational custody between branches with source issue and destination receipt controls.",
    statuses: ["draft", "approved", "issued", "received", "closed", "reversed"],
    requiredDimensions: [
      ...COMMON_DIMENSIONS,
      { key: "source_branch_id", required: true, description: "Branch issuing the material." },
      {
        key: "destination_branch_id",
        required: true,
        description: "Branch receiving the material.",
      },
      {
        key: "transfer_lines",
        required: true,
        description: "Stock, gold, quantity, and document lines.",
      },
    ],
    postingRules: [
      { ledgerFamily: "stock_gold", direction: "credit", basis: "fine_gold", required: true },
      { ledgerFamily: "stock_gold", direction: "debit", basis: "fine_gold", required: true },
    ],
    documents: ["transfer_challan", "receipt_voucher"],
    transitions: [
      { from: "draft", to: "approved", permission: OWNER_APPROVAL, auditRequired: true },
      {
        from: "approved",
        to: "issued",
        permission: ["inventory_user", "branch_manager"],
        auditRequired: true,
      },
      {
        from: "issued",
        to: "received",
        permission: ["inventory_user", "branch_manager"],
        auditRequired: true,
      },
    ],
    reversalRequired: true,
    approvalRequired: true,
    printRequired: true,
    portalVisibleTo: ["tenant_owner", "branch_manager", "inventory_user"],
  },
  payment_allocation: {
    key: "payment_allocation",
    name: "Payment Allocation",
    domain: "finance",
    purpose:
      "Allocates cash, bank, UPI, card, gold paid, or credit note settlement to invoices, orders, workers, or vendors.",
    statuses: ["draft", "submitted", "approved", "settled", "reversed"],
    requiredDimensions: [
      ...COMMON_DIMENSIONS,
      { key: "party_id", required: true, description: "Party receiving or making payment." },
      {
        key: "allocation_lines",
        required: true,
        description: "Documents and amounts being adjusted.",
      },
    ],
    postingRules: [
      { ledgerFamily: "cash_bank", direction: "debit", basis: "cash", required: true },
      { ledgerFamily: "customer_gold", direction: "memo", basis: "fine_gold", required: false },
      { ledgerFamily: "rounding", direction: "memo", basis: "cash", required: false },
    ],
    documents: ["payment_receipt", "settlement_note"],
    transitions: [
      {
        from: "draft",
        to: "submitted",
        permission: ["accountant", "sales_user"],
        auditRequired: true,
      },
      { from: "submitted", to: "approved", permission: OWNER_APPROVAL, auditRequired: true },
      {
        from: "approved",
        to: "settled",
        permission: ["accountant", "tenant_owner"],
        auditRequired: true,
      },
    ],
    reversalRequired: true,
    approvalRequired: true,
    printRequired: true,
    portalVisibleTo: ["tenant_owner", "branch_manager", "accountant", "customer"],
  },
  day_close: {
    key: "day_close",
    name: "Day Close",
    domain: "operations",
    purpose:
      "Locks the operating day after cash, gold, inventory, pending approvals, print, and communication queues are reconciled.",
    statuses: ["draft", "submitted", "approved", "closed", "reversed"],
    requiredDimensions: [
      ...COMMON_DIMENSIONS,
      { key: "business_date", required: true, description: "Operational date being closed." },
      {
        key: "close_checks",
        required: true,
        description: "Cash, gold, stock, pending documents, and exception checklist.",
      },
    ],
    postingRules: [
      { ledgerFamily: "cash_bank", direction: "memo", basis: "cash", required: true },
      { ledgerFamily: "vault_gold", direction: "memo", basis: "fine_gold", required: true },
      { ledgerFamily: "stock_gold", direction: "memo", basis: "quantity", required: true },
    ],
    documents: ["day_close_report"],
    transitions: [
      {
        from: "draft",
        to: "submitted",
        permission: ["accountant", "branch_manager"],
        auditRequired: true,
      },
      { from: "submitted", to: "approved", permission: OWNER_APPROVAL, auditRequired: true },
      { from: "approved", to: "closed", permission: OWNER_APPROVAL, auditRequired: true },
    ],
    reversalRequired: true,
    approvalRequired: true,
    printRequired: true,
    portalVisibleTo: ["tenant_owner", "branch_manager", "accountant"],
  },
};

export const ORNEXA_TRANSACTION_CONTRACT_LIST = Object.values(ORNEXA_TRANSACTION_CONTRACTS);

export function getOrnexaTransactionContract(key: string): OrnexaTransactionContract | undefined {
  return ORNEXA_TRANSACTION_CONTRACTS[key];
}

export function listOrnexaContractsByDomain(
  domain: OrnexaTransactionDomain,
): OrnexaTransactionContract[] {
  return ORNEXA_TRANSACTION_CONTRACT_LIST.filter((contract) => contract.domain === domain);
}
