/**
 * AVS ERP â€” Authoritative 60+ Module Workspace Registry
 *
 * Establishes a scalable, 4-tier Information Architecture:
 * Layer 1: Global Shell (Calm Header Only: Logo/Home, Omnisearch, +New, User/Branch)
 * Layer 2: MVP primary chrome (Sell, Customers, Stock, Make, Money, Reports, More) - AVS-4 / AVS-32
 * Layer 3: Contextual Workspace Navigation (Consistent sub-routes strictly within the workspace)
 * Layer 4: Function (Contextual tabs/filters/actions inside the specific screen)
 */

export interface WorkspaceSubItem {
  id: string;
  title: string;
  to: string;
  search?: Record<string, unknown>;
  params?: Record<string, string>;
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
    title: "Sell",
    subtitle: "Showroom & POS",
    description: "New sale, quotes, orders, and delivery - customers live under Customers.",
    iconName: "ShoppingCart",
    accentColor: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    baseRoute: "/billing",
    items: [
      { id: "invoices", title: "Invoices Register", to: "/billing", description: "All sales bills, tax invoices and history" },
      { id: "new_sale", title: "POS Billing", to: "/billing/new", badge: "F2", description: "Fast retail checkout and invoice generator" },
      { id: "estimates", title: "Quotations & Estimates", to: "/billing/estimates", description: "Proforma quotes and price approvals" },
      { id: "orders", title: "Customer Orders", to: "/orders", description: "Custom jewellery bookings and status" },
      
      { id: "catalog", title: "Design Catalogue", to: "/catalog", description: "Jewellery design collections and showcase" },
      { id: "challans", title: "Delivery Challans", to: "/billing/delivery-challans", description: "Consignment and delivery slips" },
      { id: "credit_notes", title: "Credit & Debit Notes", to: "/billing/credit-notes", description: "Sales returns and price adjustments" },
    ],
  },
  workshop: {
    id: "workshop",
    title: "Make",
    subtitle: "Jobs & karigars",
    description: "Karigar gold book, active job cards, outside work, polishing, Meena, and refining.",
    iconName: "Hammer",
    accentColor: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    baseRoute: "/workshop",
    items: [
      { id: "cockpit", title: "Workshop Cockpit", to: "/workshop", description: "Active WIP orders and bench overview" },
      { id: "gold_book", title: "Karigar Gold Book", to: "/workshop/gold-book", badge: "F4", description: "Purity-wise metal issue and return ledger" },
      { id: "job_cards", title: "Production Job Cards", to: "/orders", description: "Manufacturing specs and artisan allocation" },
      { id: "outside_work", title: "Outside Work", to: "/workshop/outside-work", description: "Outsourced hallmarking, casting, plating" },
      { id: "polishing", title: "Polishing & Processes", to: "/workshop/polishing", description: "Vibrator, tumbling and ultrasonic cleaning" },
      { id: "meena", title: "Meena", to: "/workshop/process/$type", params: { type: "meena" }, description: "Meena / enameling process book (issue and return)" },
      { id: "dhadi", title: "Dhadi Groups", to: "/workshop/dhadi-groups", description: "Artisan wage groups and piece rates" },
      { id: "melts", title: "Melt & Assay", to: "/melt", description: "Melting batches, refining and purity tests" },
      { id: "settlements", title: "Artisan Settlements", to: "/settlement/new", description: "Final gold and cash account reconciliation" },
    ],
  },
  stock: {
    id: "stock",
    title: "Stock",
    subtitle: "Gold first",
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
    title: "Money",
    subtitle: "Cash | Gold @995",
    description: "Cash and gold money books - Who owes, receipts, vault @995.",
    iconName: "Scale",
    accentColor: "text-gold bg-gold/10 border-gold/20",
    baseRoute: "/ledger",
    items: [
      { id: "vault_ledger", title: "Gold vault", to: "/ledger", description: "Authoritative 995 bullion balance and history" },
      { id: "cash_book", title: "Cash Book", to: "/treasury/cash-book", description: "Daily cash receipts (Jama) and payments (Nave)" },
      { id: "bank_reconcile", title: "Bank Reconciliation", to: "/treasury/bank-reconciliation", description: "Statement matching and bank feeds" },
      { id: "vouchers", title: "Payment & Receipt Vouchers", to: "/treasury/vouchers", description: "Cash and bullion transaction slips" },
      { id: "expenses", title: "Shop Expenses", to: "/expenses", description: "Petty cash, operating expenses and drawings" },
      { id: "sub_accounts", title: "Account heads", to: "/control/accounts", description: "Ledger heads, groups and sub-accounts" },
      { id: "financials", title: "Financial Statements", to: "/reports/financial-statements", description: "Trial Balance, P&L, Balance Sheet" },
      { id: "conversions", title: "Metal Conversions", to: "/conversion/index", description: "Old gold and scrap conversions" },
    ],
  },
  people: {
    id: "people",
    title: "Customers",
    subtitle: "Grahak",
    description: "Find customers - gold balance and cash balance stay separate.",
    iconName: "Users",
    accentColor: "text-teal-500 bg-teal-500/10 border-teal-500/20",
    baseRoute: "/people",
    items: [
      { id: "customers", title: "Customers", to: "/people", search: { tab: "customers" }, description: "Grahak search and profiles" },
      { id: "suppliers", title: "Suppliers", to: "/people", search: { tab: "suppliers" }, description: "Supplier directory" },
      { id: "who_owes", title: "Who owes", to: "/ledger", description: "Gold and cash outstanding" },
    ],
  },
  reports: {
    id: "reports",
    title: "Reports",
    subtitle: "Day done & registers",
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
    title: "More",
    subtitle: "Company & tools",
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
      { id: "team_attendance", title: "Attendance", to: "/attendance", description: "Daily staff attendance" },
      { id: "team_payroll", title: "Payroll", to: "/attendance", search: { tab: "payroll" }, description: "Salary slips and payouts" },
    ],
  },
};

/**
 * Resolves the active workspace from a given pathname.
 */
export function getActiveWorkspace(pathname: string): WorkspaceDefinition | null {
  if (!pathname || pathname === "/app" || pathname === "/") return null;

  // 1. Sell & Customers
  if (
    pathname.startsWith("/billing") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/catalog") ||
    pathname.startsWith("/crm") ||
    pathname.startsWith("/scheme") ||
    pathname.startsWith("/repair")
  ) {
    return WORKSPACES.retail;
  }

  // 2. Workshop & Manufacturing
  if (
    pathname.startsWith("/workshop") ||
    pathname.startsWith("/melt") ||
    pathname.startsWith("/settlement") ||
    pathname.startsWith("/manufacturing") ||
    pathname.startsWith("/refinery") ||
    pathname.startsWith("/mtg")
  ) {
    return WORKSPACES.workshop;
  }

  // 3. Inventory & Stock
  if (
    pathname.startsWith("/stock") ||
    pathname.startsWith("/barcode")
  ) {
    return WORKSPACES.stock;
  }

  // 4. Accounts & Treasury
  if (
    pathname.startsWith("/ledger") ||
    pathname.startsWith("/treasury") ||
    pathname.startsWith("/expenses") ||
    pathname.startsWith("/conversion") ||
    pathname.startsWith("/control/accounts") ||
    pathname.startsWith("/utilities")
  ) {
    return WORKSPACES.accounts;
  }

  // 5. Customers (grahak)
  if (pathname.startsWith("/people")) {
    return WORKSPACES.people;
  }

  // 6. Reports
  if (pathname.startsWith("/reports") || pathname.startsWith("/dashboard")) {
    return WORKSPACES.reports;
  }

  // 7. More (company, tools, team)
  if (
    pathname.startsWith("/settings") ||
    pathname.startsWith("/control") ||
    pathname.startsWith("/hardware") ||
    pathname.startsWith("/communications") ||
    pathname.startsWith("/whatsapp") ||
    pathname.startsWith("/branches") ||
    pathname.startsWith("/ai-center") ||
    pathname.startsWith("/notifications") ||
    pathname.startsWith("/attendance")
  ) {
    return WORKSPACES.settings;
  }

  return null;
}
