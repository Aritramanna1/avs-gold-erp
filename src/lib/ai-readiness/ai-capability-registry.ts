/**
 * AVS ERP — Centralized AI Capability Registry
 *
 * Defines and activates all standard AI capabilities across the ERP:
 * - Read, Prepare, Recommend, and Execute classifications
 * - Strict role-based and permission-based access controls
 * - High-risk operation approval gates (discounts, large adjustments, settlements)
 * - Tenant and branch boundaries
 * - Audit requirements
 *
 * AI sits ON TOP OF the ERP service layer and never bypasses RLS or the Double-Entry Ledger.
 */

export type AICapabilityClassification = "READ" | "PREPARE" | "RECOMMEND" | "EXECUTE";

export type AICapabilityModule =
  | "core"
  | "customers"
  | "crm"
  | "retail"
  | "inventory"
  | "manufacturing"
  | "karigar"
  | "payroll"
  | "owner"
  | "finance"
  | "production"
  | "barcode"
  | "hallmark"
  | "documents"
  | "reports"
  | "system";

export interface AICapabilityDefinition {
  id: string;
  name: string;
  description: string;
  module: AICapabilityModule;
  allowedRoles: string[];
  requiredPermissions: string[];
  allowedOperations: AICapabilityClassification[];
  classification: AICapabilityClassification;
  approvalRequired: boolean;
  tenantScoped: boolean;
  branchScoped: boolean;
  auditRequired: boolean;
  enabled: boolean;
}

export const AI_CAPABILITY_REGISTRY: Record<string, AICapabilityDefinition> = {
  // ── READ CAPABILITIES ───────────────────────────────────────────────────────
  AI_READ_CUSTOMER: {
    id: "AI_READ_CUSTOMER",
    name: "Read Customer Profiles & 360",
    description: "Search and read customer profiles, contact info, purchase history, and balances.",
    module: "customers",
    allowedRoles: ["owner", "admin", "retail_sales", "supervisor", "accountant", "saas_admin"],
    requiredPermissions: ["customers.view"],
    allowedOperations: ["READ"],
    classification: "READ",
    approvalRequired: false,
    tenantScoped: true,
    branchScoped: false,
    auditRequired: true,
    enabled: true,
  },
  AI_READ_PRODUCT: {
    id: "AI_READ_PRODUCT",
    name: "Read Product Catalog & Templates",
    description: "Search product catalog, design templates, and specifications.",
    module: "retail",
    allowedRoles: ["owner", "admin", "retail_sales", "supervisor", "accountant", "worker", "saas_admin"],
    requiredPermissions: ["catalog.view"],
    allowedOperations: ["READ"],
    classification: "READ",
    approvalRequired: false,
    tenantScoped: true,
    branchScoped: false,
    auditRequired: false,
    enabled: true,
  },
  AI_READ_STOCK: {
    id: "AI_READ_STOCK",
    name: "Read Inventory & Ready Stock",
    description: "Query live ready stock, vault fine gold balances, tags, and category weights.",
    module: "inventory",
    allowedRoles: ["owner", "admin", "retail_sales", "supervisor", "accountant", "saas_admin"],
    requiredPermissions: ["stock.view"],
    allowedOperations: ["READ"],
    classification: "READ",
    approvalRequired: false,
    tenantScoped: true,
    branchScoped: true,
    auditRequired: true,
    enabled: true,
  },
  AI_READ_KARIGAR: {
    id: "AI_READ_KARIGAR",
    name: "Read Karigar Profiles & Balances",
    description: "Read artisan accounts, fine gold custody balances, active dhadis, and transaction history.",
    module: "karigar",
    allowedRoles: ["owner", "admin", "supervisor", "accountant", "saas_admin"],
    requiredPermissions: ["workshop.view"],
    allowedOperations: ["READ"],
    classification: "READ",
    approvalRequired: false,
    tenantScoped: true,
    branchScoped: false,
    auditRequired: true,
    enabled: true,
  },
  AI_READ_SETTLEMENT: {
    id: "AI_READ_SETTLEMENT",
    name: "Read Karigar & Customer Settlements",
    description: "View pending and confirmed settlements, metal rate locks, and deductions.",
    module: "karigar",
    allowedRoles: ["owner", "admin", "supervisor", "accountant", "saas_admin"],
    requiredPermissions: ["settlement.view"],
    allowedOperations: ["READ"],
    classification: "READ",
    approvalRequired: false,
    tenantScoped: true,
    branchScoped: false,
    auditRequired: true,
    enabled: true,
  },
  AI_READ_LEDGER: {
    id: "AI_READ_LEDGER",
    name: "Read Double-Entry & Gold Ledgers",
    description: "Read authoritative money accounts, gold metal accounts, vouchers, and statements.",
    module: "finance",
    allowedRoles: ["owner", "admin", "accountant", "saas_admin"],
    requiredPermissions: ["ledger.view"],
    allowedOperations: ["READ"],
    classification: "READ",
    approvalRequired: false,
    tenantScoped: true,
    branchScoped: false,
    auditRequired: true,
    enabled: true,
  },
  AI_READ_REPORTS: {
    id: "AI_READ_REPORTS",
    name: "Read Financial & Operational Reports",
    description: "Generate and view daily sales, gross profit, stock valuation, and tax summaries.",
    module: "reports",
    allowedRoles: ["owner", "admin", "accountant", "supervisor", "saas_admin"],
    requiredPermissions: ["reports.view"],
    allowedOperations: ["READ"],
    classification: "READ",
    approvalRequired: false,
    tenantScoped: true,
    branchScoped: true,
    auditRequired: true,
    enabled: true,
  },
  AI_READ_PAYROLL: {
    id: "AI_READ_PAYROLL",
    name: "Read Attendance & Payroll Status",
    description: "Read employee attendance, stay records, salary rules, and advance ledger balances.",
    module: "payroll",
    allowedRoles: ["owner", "admin", "accountant", "saas_admin"],
    requiredPermissions: ["payroll.view"],
    allowedOperations: ["READ"],
    classification: "READ",
    approvalRequired: false,
    tenantScoped: true,
    branchScoped: true,
    auditRequired: true,
    enabled: true,
  },

  // ── CREATE / DRAFT CAPABILITIES ─────────────────────────────────────────────
  AI_CREATE_CUSTOMER: {
    id: "AI_CREATE_CUSTOMER",
    name: "Create Customer Profile",
    description: "Create customer contact records with KYC validation.",
    module: "customers",
    allowedRoles: ["owner", "admin", "retail_sales", "supervisor", "saas_admin"],
    requiredPermissions: ["customers.edit"],
    allowedOperations: ["PREPARE", "EXECUTE"],
    classification: "PREPARE",
    approvalRequired: false,
    tenantScoped: true,
    branchScoped: false,
    auditRequired: true,
    enabled: true,
  },
  AI_CREATE_ENQUIRY: {
    id: "AI_CREATE_ENQUIRY",
    name: "Create CRM Lead & Enquiry",
    description: "Log customer interest, item preferences, and budget parameters.",
    module: "crm",
    allowedRoles: ["owner", "admin", "retail_sales", "supervisor", "saas_admin"],
    requiredPermissions: ["crm.edit"],
    allowedOperations: ["PREPARE", "EXECUTE"],
    classification: "PREPARE",
    approvalRequired: false,
    tenantScoped: true,
    branchScoped: true,
    auditRequired: true,
    enabled: true,
  },
  AI_CREATE_APPOINTMENT: {
    id: "AI_CREATE_APPOINTMENT",
    name: "Schedule Showroom Appointment",
    description: "Book showroom appointment slot and assign sales executive.",
    module: "crm",
    allowedRoles: ["owner", "admin", "retail_sales", "supervisor", "saas_admin"],
    requiredPermissions: ["crm.edit"],
    allowedOperations: ["PREPARE", "EXECUTE"],
    classification: "PREPARE",
    approvalRequired: false,
    tenantScoped: true,
    branchScoped: true,
    auditRequired: true,
    enabled: true,
  },
  AI_CREATE_QUOTATION: {
    id: "AI_CREATE_QUOTATION",
    name: "Create Draft Quotation",
    description: "Calculate draft price estimates using current live gold rate, purity, and making charges.",
    module: "retail",
    allowedRoles: ["owner", "admin", "retail_sales", "supervisor", "saas_admin"],
    requiredPermissions: ["quotations.create"],
    allowedOperations: ["PREPARE"],
    classification: "PREPARE",
    approvalRequired: false,
    tenantScoped: true,
    branchScoped: true,
    auditRequired: true,
    enabled: true,
  },
  AI_CREATE_TASK: {
    id: "AI_CREATE_TASK",
    name: "Create Operational Task",
    description: "Assign follow-up, stock verification, or customer communication tasks to staff.",
    module: "core",
    allowedRoles: ["owner", "admin", "supervisor", "saas_admin"],
    requiredPermissions: ["tasks.edit"],
    allowedOperations: ["PREPARE", "EXECUTE"],
    classification: "PREPARE",
    approvalRequired: false,
    tenantScoped: true,
    branchScoped: true,
    auditRequired: true,
    enabled: true,
  },

  // ── PREPARE CAPABILITIES (DRAFT-FIRST) ──────────────────────────────────────

  AI_OPEN_ROUTE: {
    id: "AI_OPEN_ROUTE",
    name: "Open AVS-4 Nav Route",
    description:
      "Map NL intents to existing Sell/Stock/Make/Money hubs and return navigate/openRoute { href, title }. No writes.",
    module: "core",
    allowedRoles: ["owner", "admin", "supervisor", "retail_sales", "karigar", "worker", "accountant", "saas_admin"],
    requiredPermissions: [],
    allowedOperations: ["READ"],
    classification: "READ",
    approvalRequired: false,
    tenantScoped: true,
    branchScoped: false,
    auditRequired: true,
    enabled: true,
  },

  AI_PREPARE_SALE: {
    id: "AI_PREPARE_SALE",
    name: "Prepare Retail Sale Draft",
    description: "Draft retail invoice with gross/net weights, 3% GST calculation, and payment split.",
    module: "retail",
    allowedRoles: ["owner", "admin", "retail_sales", "supervisor", "saas_admin"],
    requiredPermissions: ["billing.create"],
    allowedOperations: ["PREPARE"],
    classification: "PREPARE",
    approvalRequired: false,
    tenantScoped: true,
    branchScoped: true,
    auditRequired: true,
    enabled: true,
  },
  AI_PREPARE_SETTLEMENT: {
    id: "AI_PREPARE_SETTLEMENT",
    name: "Prepare Karigar Settlement Draft",
    description: "Calculate pending metal and cash settlement including wastage allowance and over-loss deductions.",
    module: "karigar",
    allowedRoles: ["owner", "admin", "supervisor", "accountant", "saas_admin"],
    requiredPermissions: ["settlement.create"],
    allowedOperations: ["PREPARE"],
    classification: "PREPARE",
    approvalRequired: true,
    tenantScoped: true,
    branchScoped: false,
    auditRequired: true,
    enabled: true,
  },
  AI_PREPARE_STOCK_TRANSFER: {
    id: "AI_PREPARE_STOCK_TRANSFER",
    name: "Prepare Inter-Branch Stock Transfer",
    description: "Draft inventory movement between showroom counters, vaults, or branches.",
    module: "inventory",
    allowedRoles: ["owner", "admin", "supervisor", "saas_admin"],
    requiredPermissions: ["stock.transfer"],
    allowedOperations: ["PREPARE"],
    classification: "PREPARE",
    approvalRequired: true,
    tenantScoped: true,
    branchScoped: true,
    auditRequired: true,
    enabled: true,
  },
  AI_PREPARE_SALARY_SETTLEMENT: {
    id: "AI_PREPARE_SALARY_SETTLEMENT",
    name: "Prepare Monthly Salary Settlement",
    description: "Compute gross pay, attendance deductions, and advance offsets for review.",
    module: "payroll",
    allowedRoles: ["owner", "admin", "accountant", "saas_admin"],
    requiredPermissions: ["payroll.create"],
    allowedOperations: ["PREPARE"],
    classification: "PREPARE",
    approvalRequired: true,
    tenantScoped: true,
    branchScoped: true,
    auditRequired: true,
    enabled: true,
  },
  AI_PREPARE_PAYMENT: {
    id: "AI_PREPARE_PAYMENT",
    name: "Prepare Payment Voucher Draft",
    description: "Draft inward/outward payment voucher for human review. Never auto-posts.",
    module: "finance",
    allowedRoles: ["owner", "admin", "accountant", "saas_admin"],
    requiredPermissions: ["payments.execute"],
    allowedOperations: ["PREPARE"],
    classification: "PREPARE",
    approvalRequired: true,
    tenantScoped: true,
    branchScoped: true,
    auditRequired: true,
    enabled: true,
  },

  // ── RECOMMEND CAPABILITIES ──────────────────────────────────────────────────
  AI_RECOMMEND_REORDER: {
    id: "AI_RECOMMEND_REORDER",
    name: "Recommend Fast-Moving Reorders",
    description: "Analyze stock turnover and recommend manufacturing dhadi batches for low-stock items.",
    module: "inventory",
    allowedRoles: ["owner", "admin", "supervisor", "saas_admin"],
    requiredPermissions: ["stock.view"],
    allowedOperations: ["RECOMMEND"],
    classification: "RECOMMEND",
    approvalRequired: false,
    tenantScoped: true,
    branchScoped: true,
    auditRequired: false,
    enabled: true,
  },
  AI_RECOMMEND_FOLLOWUP: {
    id: "AI_RECOMMEND_FOLLOWUP",
    name: "Recommend CRM Follow-ups",
    description: "Identify high-value leads and overdue quotation follow-ups.",
    module: "crm",
    allowedRoles: ["owner", "admin", "retail_sales", "supervisor", "saas_admin"],
    requiredPermissions: ["crm.view"],
    allowedOperations: ["RECOMMEND"],
    classification: "RECOMMEND",
    approvalRequired: false,
    tenantScoped: true,
    branchScoped: true,
    auditRequired: false,
    enabled: true,
  },

  // ── EXECUTE CAPABILITIES (HIGH-RISK / APPROVAL-GATED) ───────────────────────
  AI_EXECUTE_PAYMENT: {
    id: "AI_EXECUTE_PAYMENT",
    name: "Post Payment Voucher",
    description: "Commit verified payment inward or outward into the dual ledger.",
    module: "finance",
    allowedRoles: ["owner", "admin", "accountant", "saas_admin"],
    requiredPermissions: ["payments.execute"],
    allowedOperations: ["EXECUTE"],
    classification: "EXECUTE",
    approvalRequired: true,
    tenantScoped: true,
    branchScoped: true,
    auditRequired: true,
    enabled: true,
  },
  AI_EXECUTE_SETTLEMENT: {
    id: "AI_EXECUTE_SETTLEMENT",
    name: "Finalize Karigar Period Settlement",
    description: "Commit approved artisan settlement into double-entry ledger and update closing balances.",
    module: "karigar",
    allowedRoles: ["owner", "admin", "accountant", "saas_admin"],
    requiredPermissions: ["settlement.execute"],
    allowedOperations: ["EXECUTE"],
    classification: "EXECUTE",
    approvalRequired: true,
    tenantScoped: true,
    branchScoped: false,
    auditRequired: true,
    enabled: true,
  },
};

/**
 * Validates if a user role is permitted to execute the specified AI capability.
 */
export function isCapabilityAllowedForRole(
  capabilityId: string,
  userRole: string,
  operation: AICapabilityClassification = "READ"
): boolean {
  const cap = AI_CAPABILITY_REGISTRY[capabilityId];
  if (!cap || !cap.enabled) return false;
  if (!cap.allowedRoles.includes(userRole)) return false;
  return cap.allowedOperations.includes(operation);
}

/**
 * Returns all active capabilities grouped by module.
 */
export function listCapabilities(filter?: {
  module?: AICapabilityModule;
  role?: string;
  classification?: AICapabilityClassification;
}): AICapabilityDefinition[] {
  let list = Object.values(AI_CAPABILITY_REGISTRY);

  if (filter?.module) {
    list = list.filter((c) => c.module === filter.module);
  }
  if (filter?.role) {
    list = list.filter((c) => c.allowedRoles.includes(filter.role!));
  }
  if (filter?.classification) {
    list = list.filter((c) => c.classification === filter.classification);
  }

  return list;
}
