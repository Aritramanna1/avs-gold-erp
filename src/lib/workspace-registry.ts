/**
 * AVS ERP — Authoritative 60+ Module Workspace Registry
 *
 * Establishes a scalable, 4-tier Information Architecture:
 * Layer 1: Global Shell (Calm Header Only: Logo/Home, Omnisearch, +New, User/Branch)
 * Layer 2: 7 Coherent Business Workspaces (Sell, Workshop, Stock, Accounts, People, Reports, Admin)
 * Layer 3: Contextual Workspace Navigation (Consistent sub-routes strictly within the workspace)
 * Layer 4: Function (Contextual tabs/filters/actions inside the specific screen)
 */

export interface WorkspaceSubItem {
  id: string;
  title: string;
  to: string;
  search?: Record<string, unknown>;
  badge?: string;
  description?: string;
}

export interface WorkspaceDefinition {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  iconName: string;
  accentColor: string;
  baseRoute: string;
  items: WorkspaceSubItem[];
}

export const WORKSPACES: Record<string, WorkspaceDefinition> = {
  retail: {
    id: "retail",
    title: "Sell & Customers",
    subtitle: "Showroom & POS",
    description: "POS billing, customer orders, design catalogue, delivery challans, and customer KYC.",
    iconName: "ShoppingCart",
    accentColor: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    baseRoute: "/billing",
    items: [
      { id: "invoices", title: "Invoices Register", to: "/billing", description: "All sales bills, tax invoices and history" },
      { id: "new_sale", title: "POS Billing", to: "/billing/new", badge: "F2", description: "Fast retail checkout and invoice generator" },
      { id: "estimates", title: "Quotations & Estimates", to: "/billing/estimates", description: "Proforma quotes and price approvals" },
      { id: "orders", title: "Customer Orders", to: "/orders", description: "Custom jewellery bookings and status" },
      { id: "customers", title: "Customers & KYC", to: "/people", search: { tab: "customers" }, description: "Customer phone, PAN, Aadhaar and ledger" },
      { id: "catalog", title: "Design Catalogue", to: "/catalog", description: "Jewellery design collections and showcase" },
      { id: "challans", title: "Delivery Challans", to: "/billing/delivery-challans", description: "Consignment and delivery slips" },
      { id: "credit_notes", title: "Credit & Debit Notes", to: "/billing/credit-notes", description: "Sales returns and price adjustments" },
    ],
  },
  workshop: {
    id: "workshop",
    title: "Workshop & Manufacturing",
    subtitle: "Production & Karigars",
    description: "Karigar gold book, active job cards, outside work, polishing, and refining.",
    iconName: "Hammer",
    accentColor: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    baseRoute: "/workshop",
    items: [
      { id: "cockpit", title: "Workshop Cockpit", to: "/workshop", description: "Active WIP orders and bench overview" },
      { id: "gold_book", title: "Karigar Gold Book", to: "/workshop/gold-book", badge: "F4", description: "Purity-wise metal issue and return ledger" },
      { id: "job_cards", title: "Production Job Cards", to: "/orders", description: "Manufacturing specs and artisan allocation" },
      { id: "outside_work", title: "Outside Work", to: "/workshop/outside-work", description: "Outsourced hallmarking, casting, plating" },
      { id: "polishing", title: "Polishing & Processes", to: "/workshop/polishing", description: "Vibrator, tumbling and ultrasonic cleaning" },
      { id: "dhadi", title: "Dhadi Groups", to: "/workshop/dhadi-groups", description: "Artisan wage groups and piece rates" },
      { id: "melts", title: "Melt & Assay", to: "/melt", description: "Melting batches, refining and purity tests" },
      { id: "settlements", title: "Artisan Settlements", to: "/settlement/new", description: "Final gold and cash account reconciliation" },
    ],
  },
  stock: {
    id: "stock",
    title: "Inventory & Stock",
    subtitle: "Ready Stock & Barcodes",
    description: "Ready stock, barcode search, metal lots, stock transfers, and physical audit.",
    iconName: "Package",
    accentColor: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    baseRoute: "/stock",
    items: [
      { id: "ready_stock", title: "Ready Stock", to: "/stock", badge: "F3", description: "Finished jewellery inventory with gross/net" },
      { id: "stock_entry", title: "Stock Tagging & Entry", to: "/stock/entry", description: "Rapid barcode generation and tagging" },
      { id: "barcode_scanner", title: "Barcode Search", to: "/workshop/barcode-scanner", description: "Instant camera and hardware barcode scan" },
      { id: "lots", title: "Metal Lots", to: "/stock/lots", description: "Wholesale bullion packets and raw stock" },
      { id: "transfers", title: "Stock Transfers", to: "/stock/transfers", description: "Branch-to-branch inventory movement" },
      { id: "boxes", title: "Safe Boxes & Trays", to: "/stock/boxes", description: "Physical showcase and safe trays" },
      { id: "stones", title: "Stone & Gemstones", to: "/stock/stones", description: "Diamonds, precious stones and carats" },
      { id: "hallmark", title: "BIS Hallmarking", to: "/stock/hallmark", description: "HUID verification and batch status" },
      { id: "verification", title: "Physical Audit", to: "/stock/verification", description: "Barcode scan count vs system balance" },
    ],
  },
  accounts: {
    id: "accounts",
    title: "Accounts & Treasury",
    subtitle: "Vault, Cash & Ledgers",
    description: "Fine gold bullion vault, cash book, bank reconciliation, vouchers, and financials.",
    iconName: "Scale",
    accentColor: "text-gold bg-gold/10 border-gold/20",
    baseRoute: "/ledger",
    items: [
      { id: "vault_ledger", title: "Vault Bullion Ledger", to: "/ledger", description: "Authoritative 995 bullion balance and history" },
      { id: "cash_book", title: "Cash Book", to: "/treasury/cash-book", description: "Daily cash receipts (Jama) and payments (Nave)" },
      { id: "bank_reconcile", title: "Bank Reconciliation", to: "/treasury/bank-reconciliation", description: "Statement matching and bank feeds" },
      { id: "vouchers", title: "Payment & Receipt Vouchers", to: "/treasury/vouchers", description: "Cash and bullion transaction slips" },
      { id: "expenses", title: "Shop Expenses", to: "/expenses", description: "Petty cash, operating expenses and drawings" },
      { id: "sub_accounts", title: "Chart of Accounts", to: "/control/accounts", description: "Ledger heads, groups and sub-accounts" },
      { id: "financials", title: "Financial Statements", to: "/reports/financial-statements", description: "Trial Balance, P&L, Balance Sheet" },
      { id: "conversions", title: "Metal Conversions", to: "/conversion/index", description: "Old gold and scrap conversions" },
    ],
  },
  people: {
    id: "people",
    title: "People & HR",
    subtitle: "Staff & Attendance",
    description: "Employee registry, daily attendance, salary rules, advances, and payroll.",
    iconName: "Users",
    accentColor: "text-teal-500 bg-teal-500/10 border-teal-500/20",
    baseRoute: "/attendance",
    items: [
      { id: "attendance", title: "Daily Attendance", to: "/attendance", description: "Biometric and daily staff attendance" },
      { id: "staff_directory", title: "Staff Directory", to: "/people", search: { tab: "workers" }, description: "Employee profiles, KYC and contact info" },
      { id: "salary_rules", title: "Salary & Wage Rules", to: "/attendance", search: { tab: "rules" }, description: "Monthly wages, overtime and incentives" },
      { id: "advances", title: "Salary Advances", to: "/attendance", search: { tab: "advances" }, description: "Staff loans and advance adjustments" },
      { id: "payroll", title: "Monthly Payroll", to: "/attendance", search: { tab: "payroll" }, description: "Salary slips and payout summaries" },
    ],
  },
  reports: {
    id: "reports",
    title: "Reports & Analytics",
    subtitle: "Business Intelligence",
    description: "Daily Day Book, GST sales register, metal position, karigar wastage, and CA pack.",
    iconName: "FileSpreadsheet",
    accentColor: "text-purple-500 bg-purple-500/10 border-purple-500/20",
    baseRoute: "/reports",
    items: [
      { id: "reports_overview", title: "Reports Cockpit", to: "/reports", description: "All business reports and audit tools" },
      { id: "day_book", title: "Daily Close (Day Book)", to: "/reports/daily-close", description: "EOD closing, drawer cash and bullion reconciliation" },
      { id: "sales_register", title: "Sales Register", to: "/reports/sales-register", description: "GST invoice breakdowns, B2B and B2C sales" },
      { id: "purchase_register", title: "Purchase Register", to: "/reports/purchase-register", description: "Bullion, ornament and URD purchases" },
      { id: "metal_position", title: "Metal Position", to: "/reports/metal-position", description: "Net unhedged gold exposure and balances" },
      { id: "karigar_wastage", title: "Karigar Wastage Audit", to: "/reports/worker", description: "Loss %, dust recovery and karigar efficiency" },
      { id: "ca_pack", title: "CA Export Pack", to: "/reports/ca-pack", description: "Monthly ZIP export of journals, ledger and tax" },
      { id: "gst_returns", title: "Statutory Returns (GSTR / ITC-04)", to: "/reports/gst-returns", description: "GSTR-1, GSTR-3B and job-worker ITC-04" },
      { id: "valuation", title: "Stock Valuation", to: "/reports/stock-valuation", description: "Inventory valuation and ageing analysis" },
    ],
  },
  settings: {
    id: "settings",
    title: "Administration & Tools",
    subtitle: "System Setup",
    description: "Firm profile, automation rules, hardware devices, bullion rates, and customization.",
    iconName: "Settings",
    accentColor: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
    baseRoute: "/settings",
    items: [
      { id: "firm_profile", title: "Firm Profile & Branch", to: "/settings", description: "Store name, GST, branch identity and invoices" },
      { id: "automation", title: "Automation Engine", to: "/settings/automation", description: "Native rules, exceptions and background sweeps" },
      { id: "rates", title: "Live Bullion Rates", to: "/control/rates", description: "24K, 22K, 18K live rate feeds and markup" },
      { id: "customization", title: "Customization & Print", to: "/control/customization", description: "Custom fields and print templates" },
      { id: "hardware", title: "Hardware & Devices", to: "/hardware", description: "Thermal printers, scales and barcode scanners" },
      { id: "communications", title: "WhatsApp & Email", to: "/settings/whatsapp", description: "Automated billing messages and templates" },
      { id: "security", title: "Security & Audit", to: "/settings/security-center", description: "Login logs, staff permissions and backups" },
      { id: "support", title: "System Diagnostics", to: "/settings/support", description: "Database status, licence and cloud diagnostics" },
    ],
  },
};

/**
 * Resolves the active workspace from a given pathname.
 */
export function getActiveWorkspace(pathname: string): WorkspaceDefinition | null {
  if (!pathname || pathname === "/app" || pathname === "/") return null;

  if (pathname.startsWith("/billing") || pathname.startsWith("/orders") || pathname.startsWith("/catalog") || pathname.startsWith("/crm")) {
    return WORKSPACES.retail;
  }
  if (pathname.startsWith("/workshop") || pathname.startsWith("/melt") || pathname.startsWith("/settlement")) {
    return WORKSPACES.workshop;
  }
  if (pathname.startsWith("/stock") || pathname.startsWith("/barcode")) {
    return WORKSPACES.stock;
  }
  if (pathname.startsWith("/ledger") || pathname.startsWith("/treasury") || pathname.startsWith("/expenses") || pathname.startsWith("/conversion") || pathname.startsWith("/control/accounts")) {
    return WORKSPACES.accounts;
  }
  if (pathname.startsWith("/attendance")) {
    return WORKSPACES.people;
  }
  if (pathname.startsWith("/people")) {
    // If people route, check query or default to retail if customers, else people
    return WORKSPACES.retail;
  }
  if (pathname.startsWith("/reports")) {
    return WORKSPACES.reports;
  }
  if (pathname.startsWith("/settings") || pathname.startsWith("/control") || pathname.startsWith("/hardware") || pathname.startsWith("/communications")) {
    return WORKSPACES.settings;
  }

  return null;
}
