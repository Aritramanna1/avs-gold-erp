/**
 * Business Rule Toggle Registry — "do NOT hardcode major business rules."
 *
 * Every entry here is a real, currently-hardcoded-or-implicit behavior
 * this session built or found (gold-first accounting, auto PDF/email/
 * WhatsApp attachment, provider enablement,
 * approval gates, mandatory-field enforcement) turned into a named,
 * described, permissioned, audited ON/OFF switch. This file is PURE
 * METADATA — name/description/default/permission — no behavior lives
 * here. business-rules-store.ts holds the current value of each and
 * exposes `isEnabled(key)`; a module then reads that instead of assuming
 * a hardcoded default.
 */

export type BusinessRuleKey =
  | "gold_first_accounting"
  | "manufacturing_uses_gold"
  | "allow_cash_settlement"
  | "allow_partial_gold_settlement"
  | "gold_credit_tracking"
  | "automatic_gold_reconciliation"
  | "manual_gold_reconciliation"
  | "auto_generate_pdf"
  | "auto_attach_pdf_to_email"
  | "auto_attach_pdf_to_whatsapp"
  | "auto_send_secure_document_link"
  | "enable_email"
  | "enable_whatsapp"
  | "enable_openwa"
  | "enable_meta_whatsapp"
  | "enable_automatic_reports"
  | "enable_customer_portal"
  | "enable_dealer_portal"
  | "enable_karigar_portal"
  | "enable_audit_logging"
  | "enable_device_lock"
  | "enable_session_timeout"
  | "require_approval_before_printing"
  | "require_approval_before_delivery"
  | "require_approval_for_gold_adjustment"
  | "mandatory_kyc"
  | "mandatory_huid"
  | "mandatory_hallmark"
  | "mandatory_barcode"
  | "enable_polishing_module"
  | "require_approval_before_sending_polishing"
  | "require_approval_before_receiving_polishing"
  | "auto_timeline_entries_polishing"
  | "enable_barcode_module"
  | "auto_generate_barcode"
  | "auto_print_after_generation"
  | "require_polishing_before_barcode"
  | "require_approval_before_printing_barcode";

/** Who may change a given rule. Mirrors the coarse Super Owner/Owner/Administrator tier already used elsewhere (escalation.ts, financial-lock-store.ts) rather than inventing a parallel permission system. */
export type RulePermissionTier = "owner_or_admin" | "super_owner_only";

export interface BusinessRuleDefinition {
  key: BusinessRuleKey;
  name: string;
  description: string;
  defaultValue: boolean;
  permissionRequired: RulePermissionTier;
  category:
    "gold_accounting" | "communication" | "automation" | "security" | "portals" | "compliance";
}

export const BUSINESS_RULE_REGISTRY: Record<BusinessRuleKey, BusinessRuleDefinition> = {
  gold_first_accounting: {
    key: "gold_first_accounting",
    name: "Gold-First Accounting",
    description:
      "Manufacturing transactions are accounted for in gold weight first; currency values are shown as a reference only, never the primary balance.",
    defaultValue: true,
    permissionRequired: "owner_or_admin",
    category: "gold_accounting",
  },
  manufacturing_uses_gold: {
    key: "manufacturing_uses_gold",
    name: "Manufacturing Uses Gold Instead of Cash",
    description:
      "Manufacturing orders and settlements are denominated in gold weight rather than currency.",
    defaultValue: true,
    permissionRequired: "owner_or_admin",
    category: "gold_accounting",
  },
  allow_cash_settlement: {
    key: "allow_cash_settlement",
    name: "Allow Cash Settlement",
    description:
      "Permits labour, stone, GST, transport, or other commercial charges to be settled in cash alongside gold-first accounting.",
    defaultValue: true,
    permissionRequired: "owner_or_admin",
    category: "gold_accounting",
  },
  allow_partial_gold_settlement: {
    key: "allow_partial_gold_settlement",
    name: "Allow Partial Gold Settlement",
    description:
      "Permits a manufacturing order to be settled with less gold than required, recording the shortfall as gold credit owed.",
    defaultValue: true,
    permissionRequired: "owner_or_admin",
    category: "gold_accounting",
  },
  gold_credit_tracking: {
    key: "gold_credit_tracking",
    name: "Gold Credit Tracking",
    description:
      "Tracks outstanding gold owed by (or credited to) customers and dealers until settled.",
    defaultValue: true,
    permissionRequired: "owner_or_admin",
    category: "gold_accounting",
  },
  automatic_gold_reconciliation: {
    key: "automatic_gold_reconciliation",
    name: "Automatic Gold Reconciliation",
    description:
      "Runs the gold reconciliation engine automatically (daily) and flags exceptions without manual initiation.",
    defaultValue: true,
    permissionRequired: "owner_or_admin",
    category: "gold_accounting",
  },
  manual_gold_reconciliation: {
    key: "manual_gold_reconciliation",
    name: "Manual Gold Reconciliation",
    description:
      "Allows a user to trigger gold reconciliation on demand, independent of the automatic schedule.",
    defaultValue: true,
    permissionRequired: "owner_or_admin",
    category: "gold_accounting",
  },
  auto_generate_pdf: {
    key: "auto_generate_pdf",
    name: "Auto Generate PDF",
    description:
      "Automatically generates a PDF whenever a physical printer is unavailable or a document is finalized.",
    defaultValue: true,
    permissionRequired: "owner_or_admin",
    category: "automation",
  },
  auto_attach_pdf_to_email: {
    key: "auto_attach_pdf_to_email",
    name: "Auto Attach PDF to Email",
    description:
      "Automatically attaches the generated PDF to outgoing emails for the related document.",
    defaultValue: false,
    permissionRequired: "owner_or_admin",
    category: "communication",
  },
  auto_attach_pdf_to_whatsapp: {
    key: "auto_attach_pdf_to_whatsapp",
    name: "Auto Attach PDF to WhatsApp",
    description:
      "Automatically attaches the generated PDF to outgoing WhatsApp messages for the related document.",
    defaultValue: false,
    permissionRequired: "owner_or_admin",
    category: "communication",
  },
  auto_send_secure_document_link: {
    key: "auto_send_secure_document_link",
    name: "Auto Send Secure Document Link",
    description:
      "Automatically includes a secure customer-portal document link in automated communications.",
    defaultValue: false,
    permissionRequired: "owner_or_admin",
    category: "communication",
  },
  enable_email: {
    key: "enable_email",
    name: "Enable Email",
    description:
      "Master switch for the email communication channel. Off by default for Workshop V1.1 — Email Automation is marked Coming Soon in the UI; WhatsApp is the production channel.",
    defaultValue: false,
    permissionRequired: "owner_or_admin",
    category: "communication",
  },
  enable_whatsapp: {
    key: "enable_whatsapp",
    name: "Enable WhatsApp",
    description: "Master switch for the WhatsApp communication channel (any provider).",
    defaultValue: true,
    permissionRequired: "owner_or_admin",
    category: "communication",
  },
  enable_openwa: {
    key: "enable_openwa",
    name: "Enable OpenWA",
    description:
      "Enables the self-hosted OpenWA WhatsApp provider. Remains disabled until server credentials are supplied.",
    defaultValue: false,
    permissionRequired: "owner_or_admin",
    category: "communication",
  },
  enable_meta_whatsapp: {
    key: "enable_meta_whatsapp",
    name: "Enable Meta WhatsApp",
    description:
      "Enables the official Meta WhatsApp Cloud API provider. Remains disabled until API credentials are supplied.",
    defaultValue: false,
    permissionRequired: "owner_or_admin",
    category: "communication",
  },
  enable_automatic_reports: {
    key: "enable_automatic_reports",
    name: "Enable Automatic Reports",
    description:
      "Runs daily/weekly/monthly business report generation and distribution on the background scheduler.",
    defaultValue: false,
    permissionRequired: "owner_or_admin",
    category: "automation",
  },
  enable_customer_portal: {
    key: "enable_customer_portal",
    name: "Enable Customer Portal (Future)",
    description:
      "Reserved switch for the future Customer Portal. No portal is built yet — enabling this has no effect today.",
    defaultValue: false,
    permissionRequired: "super_owner_only",
    category: "portals",
  },
  enable_dealer_portal: {
    key: "enable_dealer_portal",
    name: "Enable Dealer Portal (Future)",
    description:
      "Reserved switch for the future Dealer Portal. No portal is built yet — enabling this has no effect today.",
    defaultValue: false,
    permissionRequired: "super_owner_only",
    category: "portals",
  },
  enable_karigar_portal: {
    key: "enable_karigar_portal",
    name: "Enable Karigar Portal (Future)",
    description:
      "Reserved switch for the future Karigar Portal. No portal is built yet — enabling this has no effect today.",
    defaultValue: false,
    permissionRequired: "super_owner_only",
    category: "portals",
  },
  enable_audit_logging: {
    key: "enable_audit_logging",
    name: "Enable Audit Logging",
    description:
      "Records financial/gold/permission actions to the immutable, hash-chained audit log.",
    defaultValue: true,
    permissionRequired: "super_owner_only",
    category: "security",
  },
  enable_device_lock: {
    key: "enable_device_lock",
    name: "Enable Device Lock",
    description: "Restricts the app to registered, trusted devices.",
    defaultValue: false,
    permissionRequired: "super_owner_only",
    category: "security",
  },
  enable_session_timeout: {
    key: "enable_session_timeout",
    name: "Enable Session Timeout",
    description: "Locks the app after a period of inactivity, requiring the password to resume.",
    defaultValue: true,
    permissionRequired: "owner_or_admin",
    category: "security",
  },
  require_approval_before_printing: {
    key: "require_approval_before_printing",
    name: "Require Approval Before Printing",
    description: "Requires an approved request before a financial document may be printed.",
    defaultValue: false,
    permissionRequired: "owner_or_admin",
    category: "compliance",
  },
  require_approval_before_delivery: {
    key: "require_approval_before_delivery",
    name: "Require Approval Before Delivery",
    description: "Requires an approved request before an order/repair may be marked delivered.",
    defaultValue: false,
    permissionRequired: "owner_or_admin",
    category: "compliance",
  },
  require_approval_for_gold_adjustment: {
    key: "require_approval_for_gold_adjustment",
    name: "Require Approval For Gold Adjustment",
    description:
      "Requires an approved request before any manual gold weight/balance adjustment takes effect.",
    defaultValue: true,
    permissionRequired: "owner_or_admin",
    category: "compliance",
  },
  mandatory_kyc: {
    key: "mandatory_kyc",
    name: "Mandatory KYC",
    description:
      "Requires KYC documents on file before a customer/karigar record can be finalized.",
    defaultValue: false,
    permissionRequired: "owner_or_admin",
    category: "compliance",
  },
  mandatory_huid: {
    key: "mandatory_huid",
    name: "Mandatory HUID",
    description:
      "Requires a HUID (hallmark unique ID) before a finished item can be marked available for sale.",
    defaultValue: false,
    permissionRequired: "owner_or_admin",
    category: "compliance",
  },
  mandatory_hallmark: {
    key: "mandatory_hallmark",
    name: "Mandatory Hallmark",
    description:
      "Requires hallmark details before a finished item can be marked available for sale.",
    defaultValue: false,
    permissionRequired: "owner_or_admin",
    category: "compliance",
  },
  mandatory_barcode: {
    key: "mandatory_barcode",
    name: "Mandatory Barcode",
    description:
      "Requires a barcode assigned before a stock item can be marked available for sale.",
    defaultValue: false,
    permissionRequired: "owner_or_admin",
    category: "compliance",
  },
  enable_polishing_module: {
    key: "enable_polishing_module",
    name: "Enable Polishing Module",
    description:
      "Turns the Polishing workflow (Send to Polishing / Receive from Polishing) on or off across the ERP. Polishing is an optional business process, not every workshop uses an external polisher.",
    defaultValue: false,
    permissionRequired: "owner_or_admin",
    category: "automation",
  },
  require_approval_before_sending_polishing: {
    key: "require_approval_before_sending_polishing",
    name: "Require Approval Before Sending to Polishing",
    description:
      "Requires a named approver before gold/product can be sent out to an external polisher.",
    defaultValue: false,
    permissionRequired: "owner_or_admin",
    category: "automation",
  },
  require_approval_before_receiving_polishing: {
    key: "require_approval_before_receiving_polishing",
    name: "Require Approval Before Receiving from Polishing",
    description:
      "Requires a named approver before a polishing return can be recorded and posted to the Gold Ledger.",
    defaultValue: false,
    permissionRequired: "owner_or_admin",
    category: "automation",
  },
  auto_timeline_entries_polishing: {
    key: "auto_timeline_entries_polishing",
    name: "Auto Timeline Entries for Polishing",
    description:
      "Automatically appends Send/Receive Polishing events to a linked Production Order's timeline. Turning this off still updates the Gold Ledger and Polishing Ledger — only the order timeline note is skipped.",
    defaultValue: true,
    permissionRequired: "owner_or_admin",
    category: "automation",
  },
  enable_barcode_module: {
    key: "enable_barcode_module",
    name: "Enable Barcode Module (Manufacturing)",
    description:
      "Turns the finished-product Barcode & Tagging identity system on or off. This is the post-polishing product identity workflow, not retail stock barcoding.",
    defaultValue: true,
    permissionRequired: "owner_or_admin",
    category: "automation",
  },
  auto_generate_barcode: {
    key: "auto_generate_barcode",
    name: "Auto Generate Barcode",
    description:
      "Automatically generates a barcode/QR/product identity the moment a Production Order becomes eligible (Worker Return + Polishing complete), instead of requiring a manual click.",
    defaultValue: false,
    permissionRequired: "owner_or_admin",
    category: "automation",
  },
  auto_print_after_generation: {
    key: "auto_print_after_generation",
    name: "Auto Print After Generation",
    description:
      "Automatically opens the tag print dialog immediately after a barcode is generated.",
    defaultValue: false,
    permissionRequired: "owner_or_admin",
    category: "automation",
  },
  require_polishing_before_barcode: {
    key: "require_polishing_before_barcode",
    name: "Require Polishing Before Barcode",
    description:
      "Blocks barcode generation until Worker Return and Polishing are both complete for the Production Order. Turning this off allows generating a barcode as soon as Worker Return is complete, skipping the polishing gate — for workshops that don't send every item out for polishing.",
    defaultValue: true,
    permissionRequired: "owner_or_admin",
    category: "compliance",
  },
  require_approval_before_printing_barcode: {
    key: "require_approval_before_printing_barcode",
    name: "Require Approval Before Printing Barcode/Tag",
    description:
      "Requires a named approver before a jewellery tag, barcode label, or QR label can be printed.",
    defaultValue: false,
    permissionRequired: "owner_or_admin",
    category: "automation",
  },
};

export const BUSINESS_RULE_KEYS = Object.keys(BUSINESS_RULE_REGISTRY) as BusinessRuleKey[];
