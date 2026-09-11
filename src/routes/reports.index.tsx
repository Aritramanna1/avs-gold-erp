import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  ArrowRight,
  ClipboardList,
  Scale,
  Users,
  Package,
  FileSpreadsheet,
  Receipt,
  ShieldAlert,
  Building2,
  Factory,
  AlertTriangle,
  Calendar,
  Gem,
  BookOpen,
  Bell,
  CheckCircle,
  ClipboardCheck,
  TrendingDown,
  Search,
  Wrench,
  Download,
  Percent,
  FileText,
  ShieldCheck,
  Coins,
  History,
  Briefcase,
  Layers,
} from "lucide-react";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";
import { ModuleWorkspace } from "@/components/module-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useReportSnapshots } from "@/lib/report-snapshots-store";
import { OFFLINE_PARITY_CATALOG, searchOfflineParity } from "@/lib/offline-parity-catalog";
import { toast } from "sonner";

export const Route = createFileRoute("/reports/")({ component: ReportsWorkspace });

export interface ReportItem {
  label: string;
  description: string;
  to: string;
  icon: any;
  status: "READY" | "PARTIAL" | "DRAFT" | "NOT APPLICABLE";
  search?: Record<string, any>;
  statutoryRef?: string;
  offlineName?: string;
}

export interface ReportCategoryGroup {
  id: string;
  title: string;
  categoryCode: string;
  description: string;
  items: ReportItem[];
}

const REPORT_CATEGORIES: ReportCategoryGroup[] = [
  {
    id: "mis_dashboard",
    categoryCode: "A",
    title: "1. Dashboard / MIS",
    description: "Executive and management performance metrics across revenue, gold custody, cash, and margins.",
    items: [
      {
        label: "Executive MIS & Daily Summary",
        description: "Day totals — gold turnover, cash, receivables, and retail sales.",
        to: "/reports/daily-summary",
        icon: Calendar,
        status: "READY",
        statutoryRef: "Internal Management MIS",
      },
      {
        label: "Total Profit & Loss (Business P&L)",
        description: "Accurate business profit separating direct job work margins, operating overheads, and owner drawings.",
        to: "/reports/total-profit",
        icon: BarChart3,
        status: "READY",
        statutoryRef: "ICAI AS-1 / AS-5",
      },
      {
        label: "Where Is My Gold? (Custody Matrix)",
        description: "Real-time physical custody traceability across vault, karigar, customer deposits, and WIP.",
        to: "/reports/gold-position",
        icon: Gem,
        status: "READY",
        statutoryRef: "Metal Custody Audit",
      },
      {
        label: "Fine Margin & Making Analysis",
        description: "Making charge realisation and net fine profit margin on sold jewellery.",
        to: "/reports/fine-margin",
        icon: TrendingDown,
        status: "READY",
        search: { view: "profit" },
        statutoryRef: "Margin Analysis",
      },
      {
        label: "Branch Operational Rollup",
        description: "Multi-branch sales, stock, and gold balance comparison.",
        to: "/reports/branch",
        icon: Building2,
        status: "READY",
        statutoryRef: "Branch Accounts",
      },
    ],
  },
  {
    id: "sales_reports",
    categoryCode: "B",
    title: "2. Sales Reports",
    description: "Detailed registers of customer outward supplies, invoice taxes, discount allowed, and returns.",
    items: [
      {
        label: "Sales Register",
        description: "Invoice-wise metal weight, making charges, GST rate, TCS, and HSN codes.",
        to: "/reports/sales-register",
        icon: Receipt,
        status: "READY",
        statutoryRef: "GST Rule 56(1) / GSTR-1 Outward",
      },
      {
        label: "Sale Fine vs Billed Value",
        description: "Invoice fine gold weight against total billed consideration.",
        to: "/reports/fine-margin",
        icon: Scale,
        status: "READY",
        search: { view: "sale-fine" },
        statutoryRef: "Bullion Sales Audit",
      },
      {
        label: "Item Jama / Nave (Metal In/Out)",
        description: "Item-wise sale and purchase metal movements across categories.",
        to: "/reports/item-jama-nave",
        icon: Package,
        status: "READY",
        search: { mode: "item" },
        statutoryRef: "Stock Ledger Register",
      },
      {
        label: "Account-wise Sale / Purchase",
        description: "Party Jama/Nave metal weight + monetary consideration.",
        to: "/reports/item-jama-nave",
        icon: Receipt,
        status: "READY",
        search: { mode: "account" },
        statutoryRef: "Party Sales Ledger",
      },
      {
        label: "City-wise Sales & Outstanding",
        description: "Geographic sales rollup and customer balances by city.",
        to: "/reports/city-wise",
        icon: Building2,
        status: "READY",
        statutoryRef: "Regional MIS",
      },
      {
        label: "Discount Report",
        description: "Audit register of discounts allowed on billing invoices, gold equivalents, and tax impacts.",
        to: "/reports/discount-report",
        icon: Percent,
        status: "READY",
        statutoryRef: "Discount Transparency Register",
      },
      {
        label: "Deleted / Cancelled Bills Register",
        description: "Cancelled sales invoices preserved for statutory audit integrity.",
        to: "/reports/deleted-bills",
        icon: ShieldAlert,
        status: "READY",
        statutoryRef: "Audit / GSTR-1 Doc Table",
      },
    ],
  },
  {
    id: "purchase_reports",
    categoryCode: "C",
    title: "3. Purchase Reports",
    description: "Inward supply registers, bullion dealer purchases, URD receipts, and ITC eligibility tracking.",
    items: [
      {
        label: "Purchase Register",
        description: "Supplier bullion and finished jewellery purchases with GST, RCM, and tax breakdowns.",
        to: "/reports/purchase-register",
        icon: FileSpreadsheet,
        status: "READY",
        statutoryRef: "GST Rule 56(1) / GSTR-2B Recon",
      },
      {
        label: "Dealer Bullion Purchase Register",
        description: "Dealer-wise fine gold purchases, purity 995 basis, and cash/metal settlement.",
        to: "/reports/dealer",
        icon: Package,
        status: "READY",
        statutoryRef: "Bullion Inward Register",
      },
      {
        label: "Dhadi Book (Melting & Refining Inward)",
        description: "Old gold URD purchase, melting batches, and fine recovery verification.",
        to: "/reports/dhadi-book",
        icon: BookOpen,
        status: "READY",
        statutoryRef: "URD Melting Inward",
      },
    ],
  },
  {
    id: "inventory_reports",
    categoryCode: "D",
    title: "4. Inventory Reports",
    description: "Physical and book stock tracking, gold purity classification, valuation, and barcode traceability.",
    items: [
      {
        label: "Stock Valuation Report",
        description: "On-hand tags at cost vs live bullion bhav (AS-2 valuation).",
        to: "/reports/stock-valuation",
        icon: Scale,
        status: "READY",
        statutoryRef: "ICAI AS-2 (Valuation of Inventories)",
      },
      {
        label: "Gold Stock by Purity",
        description: "Vault, scrap, and showroom purity lines (24K/995, 22K/916, 18K/750).",
        to: "/reports/gold-stock",
        icon: Gem,
        status: "READY",
        statutoryRef: "Physical Gold Register",
      },
      {
        label: "Inventory Ageing Analysis",
        description: "Ready stock broken into ageing buckets (0-30, 31-60, 61-90, 91-180, 180+ days).",
        to: "/reports/inventory-ageing",
        icon: Package,
        status: "READY",
        statutoryRef: "Inventory Ageing Standard",
      },
      {
        label: "Barcode Stock Register",
        description: "Barcode-to-tag stock listing with gross wt, net wt, and current status.",
        to: "/reports/barcode-stock",
        icon: ClipboardList,
        status: "READY",
        statutoryRef: "Tag Traceability Ledger",
      },
      {
        label: "Item Movement Transaction Register",
        description: "Complete movement history per inventory item from tagging to invoice.",
        to: "/reports/item-transaction",
        icon: ClipboardList,
        status: "READY",
        statutoryRef: "Stock Ledger Movement",
      },
    ],
  },
  {
    id: "customer_receivables",
    categoryCode: "E",
    title: "5. Customer / Receivable Reports",
    description: "Customer sub-ledgers, outstanding balances, ageing analysis, and party statements.",
    items: [
      {
        label: "Customer Annual Statement & Reconciliation",
        description: "Year-end CA reconciliation: chronological ledger, invoice-wise debits, payment credits, and automatic allocations.",
        to: "/reports/customer-statement",
        icon: FileSpreadsheet,
        status: "READY",
        statutoryRef: "Customer Annual Audit",
      },
      {
        label: "Party Ledgers (Customer Books)",
        description: "Authoritative customer sub-ledgers with dual dimensions (₹ consideration + fine gold g).",
        to: "/reports/ledgers",
        icon: BookOpen,
        status: "READY",
        statutoryRef: "Debtors Subsidiary Ledger",
      },
      {
        label: "Account Balance (Standard Offline PDF)",
        description: "Offline column layout: Jama Wt, Return Wt, Nave Wt, Cash, Anamat, Fine.",
        to: "/reports/account-balance",
        icon: Users,
        status: "READY",
        search: { variant: "1" },
        statutoryRef: "Party Balance Register",
      },
      {
        label: "Account Balance (Sorted by Fine Due)",
        description: "Same offline columns sorted in descending order of fine gold receivable.",
        to: "/reports/account-balance",
        icon: Users,
        status: "READY",
        search: { variant: "2" },
        statutoryRef: "Overdue Receivables",
      },
      {
        label: "Gold Outstanding (Customer / Workshop)",
        description: "Customer gold dues requiring action, follow-up, or settlement.",
        to: "/reports/gold-outstanding",
        icon: Users,
        status: "READY",
        statutoryRef: "Gold Receivables Book",
      },
    ],
  },
  {
    id: "supplier_payables",
    categoryCode: "F",
    title: "6. Supplier / Payable Reports",
    description: "Bullion dealer accounts, supplier payables, advance payments, and purchase returns.",
    items: [
      {
        label: "Supplier & Dealer Ledgers",
        description: "Authoritative bullion dealer statements showing fine gold owed and monetary dues.",
        to: "/reports/ledgers",
        icon: BookOpen,
        status: "READY",
        search: { role: "dealer" },
        statutoryRef: "Creditors Subsidiary Ledger",
      },
      {
        label: "Bullion Ledger (Dealer Accounts)",
        description: "Bullion accounts and spot purchase delivery registers.",
        to: "/reports/bullion-ledger",
        icon: Gem,
        status: "READY",
        statutoryRef: "Bullion Accounts",
      },
    ],
  },
  {
    id: "karigar_manufacturing",
    categoryCode: "G",
    title: "7. Karigar & Manufacturing Reports",
    description: "Workshop artisan custody, purity books, wastage calculation, over-loss audits, and job work.",
    items: [
      {
        label: "Worker / Karigar Books",
        description: "Per-artisan physical gold custody, purity balances, and labour charges earned.",
        to: "/reports/worker",
        icon: Users,
        status: "READY",
        statutoryRef: "Artisan Metal Book",
      },
      {
        label: "Karigar Settlement Register",
        description: "Authoritative settlement history separating gold returned, wastage, over-loss, and cash labour.",
        to: "/reports/settlements",
        icon: Receipt,
        status: "READY",
        statutoryRef: "Settlement Audit Ledger",
      },
      {
        label: "Gold Loss & Over-Loss Audit",
        description: "Process wastage and person-level metal loss across workshop operations.",
        to: "/reports/gold-loss",
        icon: AlertTriangle,
        status: "READY",
        statutoryRef: "Manufacturing Loss Control",
      },
      {
        label: "Manufacturing Movement Register",
        description: "Production batch movement, issue, complete, and delay tracking.",
        to: "/reports/manufacturing",
        icon: ClipboardList,
        status: "READY",
        statutoryRef: "Job Card Ledger",
      },
      {
        label: "Outside Work / Subcontractor Challans",
        description: "Setting, polishing, and casting job work challans and metal turnaround.",
        to: "/reports/outside-work",
        icon: Factory,
        status: "READY",
        statutoryRef: "GST Job Work Register",
      },
      {
        label: "Tanch Hishob (Touch / Purity Testing)",
        description: "Assay test results and fire assay verification records.",
        to: "/reports/tanch-hishob",
        icon: Scale,
        status: "READY",
        statutoryRef: "Purity Testing Log",
      },
    ],
  },
  {
    id: "payroll_reports",
    categoryCode: "H",
    title: "8. Payroll & Staff Reports",
    description: "Employee attendance, monthly salary registers, advances, weekly allowances, and karigar wages.",
    items: [
      {
        label: "Employee Ledger & Advances",
        description: "Authoritative staff salary accounts and advance recovery ledger lines.",
        to: "/reports/ledgers",
        icon: Users,
        status: "READY",
        search: { role: "staff" },
        statutoryRef: "Payroll Sub-ledger",
      },
      {
        label: "Settlement Reconciliation (Wages & Deductions)",
        description: "Artisan gross salary vs advance deductions and net disbursement.",
        to: "/reports/settlement-reconciliation",
        icon: CheckCircle,
        status: "READY",
        statutoryRef: "Payment of Wages Register",
      },
    ],
  },
  {
    id: "accounting_books",
    categoryCode: "I",
    title: "9. Accounting & Daily Books",
    description: "Chronological day books, cash books, bank books, journal entries, and general ledger postings.",
    items: [
      {
        label: "Fine Rojmel (Daily Fine Gold Book)",
        description: "Canonical daily fine gold book — opening, issue, receipt, and closing balance.",
        to: "/reports/fine-rojmel",
        icon: Gem,
        status: "READY",
        statutoryRef: "Daily Metal Day Book",
      },
      {
        label: "Dar Rojmel (Cash Day Book)",
        description: "Cash Jama/Nave daily journal with party narrations and running cash total.",
        to: "/reports/dar-rojmel",
        icon: BookOpen,
        status: "READY",
        statutoryRef: "Cash Day Book",
      },
      {
        label: "Company Cash Book",
        description: "Canonical cash register — Dr/Cr, running balance, narration, party, source.",
        to: "/treasury/cash-book",
        icon: BookOpen,
        status: "READY",
        statutoryRef: "Cash Book (Rule 56)",
      },
      {
        label: "Bank Transactions Register",
        description: "Bank account voucher lines, RTGS/NEFT/Cheque entries, and running bank balances.",
        to: "/reports/bank-transactions",
        icon: Building2,
        status: "READY",
        statutoryRef: "Bank Book",
      },
      {
        label: "Receipts & Payments Register",
        description: "All treasury vouchers posted across cash, bank, and digital payment modes.",
        to: "/treasury/vouchers",
        icon: Receipt,
        status: "READY",
        statutoryRef: "Receipt & Payment Journal",
      },
      {
        label: "Expenses Register (Canonical Cash View)",
        description: "All operational overheads posted to Chart of Accounts (excluding owner drawings).",
        to: "/treasury/cash-book",
        icon: TrendingDown,
        status: "READY",
        search: { source: "expense" },
        statutoryRef: "Expense Ledger",
      },
      {
        label: "Daily Gold Flow Register",
        description: "Daily bullion inflow and outflow movements reconciled with the vault.",
        to: "/reports/daily-gold-flow",
        icon: BookOpen,
        status: "READY",
        statutoryRef: "Bullion Movement Register",
      },
    ],
  },
  {
    id: "financial_statements",
    categoryCode: "J",
    title: "10. Financial Statements",
    description: "Trial Balance, Trading Account, Profit & Loss Account, Balance Sheet, and Cash Flow Statement.",
    items: [
      {
        label: "Financial Statements Hub",
        description: "Authoritative Trial Balance (detailed/grouped), Trading Account, P&L, and Balance Sheet.",
        to: "/reports/financial-statements",
        icon: FileSpreadsheet,
        status: "READY",
        statutoryRef: "ICAI AS-1 / Schedule III",
      },
      {
        label: "Cash Flow Statement",
        description: "Operating, investing, and financing cash flows under ICAI AS-3.",
        to: "/reports/cash-flow",
        icon: Receipt,
        status: "READY",
        statutoryRef: "ICAI AS-3 (Cash Flow)",
      },
      {
        label: "Metal Position (Short / Long)",
        description: "Physical gold on-hand vs customer deposit obligations and open sales contracts.",
        to: "/reports/metal-position",
        icon: Scale,
        status: "READY",
        statutoryRef: "Metal Position Statement",
      },
    ],
  },
  {
    id: "gst_tax_reports",
    categoryCode: "K",
    title: "11. GST & Statutory Tax Reports",
    description: "Preparation and reconciliation reports for GSTR-1, GSTR-3B, GSTR-9, HSN Table 12, and ITC-04.",
    items: [
      {
        label: "GST Returns Preparation & Export",
        description: "GSTR-1 (B2B, B2CS), GSTR-3B summary, and GSTR-9 preparation exports.",
        to: "/reports/gst-returns",
        icon: Receipt,
        status: "READY",
        statutoryRef: "CGST Act Sec 37, 39, 44 / Rule 59",
      },
      {
        label: "HSN / SAC Summary (GSTR-1 Table 12)",
        description: "HSN code wise taxable turnover, quantity, rate, CGST, SGST, IGST, and total tax.",
        to: "/reports/hsn-summary",
        icon: Receipt,
        status: "READY",
        statutoryRef: "GSTR-1 Table 12 / CBIC Notif 78/2020",
      },
      {
        label: "ITC-04 (Job Work Movement Register)",
        description: "Quarterly statement of goods sent to and received back from job workers/karigars.",
        to: "/reports/itc04",
        icon: Receipt,
        status: "READY",
        statutoryRef: "CGST Sec 143 / Form GST ITC-04",
      },
    ],
  },
  {
    id: "tds_tcs_reports",
    categoryCode: "L",
    title: "12. TDS / TCS Reports",
    description: "Tax deducted at source and tax collected at source on high-value jewellery transactions.",
    items: [
      {
        label: "TCS on Sale of Goods (Sec 206C(1H))",
        description: "TCS collection registers for customer sales exceeding statutory threshold.",
        to: "/reports/sales-register",
        icon: Receipt,
        status: "READY",
        search: { taxType: "tcs" },
        statutoryRef: "Income Tax Act Sec 206C",
      },
      {
        label: "TDS on Job Work & Purchases (Sec 194C / 194Q)",
        description: "TDS ledger lines for karigar contractor payments and high-value bullion purchases.",
        to: "/reports/purchase-register",
        icon: FileSpreadsheet,
        status: "READY",
        search: { taxType: "tds" },
        statutoryRef: "Income Tax Act Sec 194C / 194Q",
      },
    ],
  },
  {
    id: "reconciliation_center",
    categoryCode: "M",
    title: "13. Reconciliation Center",
    description: "Unified cross-system verification: Sales vs Ledger, Stock vs Books, Vault Custody, and Bank Statements.",
    items: [
      {
        label: "Reconciliation Center",
        description: "Unified balance checks — gold integrity, cash vs CoA, physical stock, and expense reconciliation.",
        to: "/reports/reconciliation-center",
        icon: CheckCircle,
        status: "READY",
        statutoryRef: "Internal Control & Audit",
      },
      {
        label: "Vault Custody Reconciliation",
        description: "Physical vault count vs gold ledger custody proof.",
        to: "/reports/vault-reconciliation",
        icon: Scale,
        status: "READY",
        statutoryRef: "Custody Audit",
      },
      {
        label: "Settlement Posting Reconciliation",
        description: "Karigar settlement calculation vouchers vs ledger journal postings.",
        to: "/reports/settlement-reconciliation",
        icon: CheckCircle,
        status: "READY",
        statutoryRef: "Wage & Metal Proof",
      },
      {
        label: "Gold Reconciliation (All Books)",
        description: "Cross-checks Rojmel, Worker books, Vault, and General Ledger metal totals.",
        to: "/reports/gold-reconciliation",
        icon: Gem,
        status: "READY",
        statutoryRef: "Metal Integrity Audit",
      },
      {
        label: "Manufacturing Metal Reconciliation",
        description: "Job card metal vs issued/received proof across production stages.",
        to: "/reports/manufacturing-reconciliation",
        icon: Factory,
        status: "READY",
        statutoryRef: "WIP Reconciliation",
      },
      {
        label: "Bank Statement Reconciliation",
        description: "Bank statement lines vs Cash/Bank book entries.",
        to: "/treasury/bank-reconciliation",
        icon: Building2,
        status: "READY",
        statutoryRef: "Bank Reconciliation Statement",
      },
    ],
  },
  {
    id: "owner_equity",
    categoryCode: "N",
    title: "14. Owner / Equity Reports",
    description: "Proprietor capital accounts, family drawings, cash/gold withdrawals strictly isolated from operating expenses.",
    items: [
      {
        label: "Owner Drawings & Personal Accounts",
        description: "Owner and family member drawings tracked against equity without reducing business operating profit.",
        to: "/reports/owner-drawings",
        icon: Users,
        status: "READY",
        statutoryRef: "Proprietor Capital Account",
      },
    ],
  },
  {
    id: "audit_controls",
    categoryCode: "O",
    title: "15. Audit / Control Reports",
    description: "Administrative action logs, period locks, anomalous transactions, approval queues, and ERP integrity.",
    items: [
      {
        label: "ERP Audit Report (PASS / FAIL)",
        description: "Evaluation of books, portals, calculations, RLS, and ledger integrity with evidence.",
        to: "/reports/erp-audit",
        icon: ClipboardCheck,
        status: "READY",
        statutoryRef: "ERP System Audit",
      },
      {
        label: "Auditor Workspace & Period Freeze",
        description: "Audit logs, financial year locks, and period freeze status.",
        to: "/reports/auditor",
        icon: ShieldAlert,
        status: "READY",
        statutoryRef: "Period Lock Controls",
      },
      {
        label: "Operational Exceptions",
        description: "Operational anomalies, unposted vouchers, and negative balance alerts.",
        to: "/reports/exceptions",
        icon: AlertTriangle,
        status: "READY",
        statutoryRef: "Exception Register",
      },
      {
        label: "Administrative Audit Log",
        description: "Immutable log of all user logins, settings modifications, and financial overrides.",
        to: "/reports/audit-log",
        icon: ShieldAlert,
        status: "READY",
        statutoryRef: "Audit Trail (MCA Rule 3)",
      },
      {
        label: "Approvals Queue",
        description: "Pending high-value discounts, gold adjustments, and supervisor authorizations.",
        to: "/reports/approvals",
        icon: CheckCircle,
        status: "READY",
        statutoryRef: "Internal Authorization",
      },
      {
        label: "Daily Close Verification",
        description: "End-of-day cash and gold physical verification sign-off.",
        to: "/reports/daily-close",
        icon: Calendar,
        status: "READY",
        statutoryRef: "Day Close Register",
      },
      {
        label: "Month-end Close Checklist",
        description: "Monthly accounting checklist, stock valuation freeze, and period lock.",
        to: "/reports/month-end-close",
        icon: Calendar,
        status: "READY",
        statutoryRef: "Period End Close",
      },
      {
        label: "Tally ERP Export (XML)",
        description: "Sales, purchase, payment, and receipt vouchers formatted for Tally Prime import.",
        to: "/reports/tally-export",
        icon: FileSpreadsheet,
        status: "READY",
        statutoryRef: "Accounting System Bridge",
      },
    ],
  },
  {
    id: "ca_export_pack",
    categoryCode: "P",
    title: "16. CA / Accountant Export Pack",
    description: "Structured multi-report export center for Chartered Accountants, Tax Practitioners, and Statutory Auditors.",
    items: [
      {
        label: "CA / Accountant Export Pack Center",
        description: "One-click export of Trial Balance, General Ledger, Day Book, Sales/Purchase Registers, GST, and Stock in CSV/Excel/PDF.",
        to: "/reports/ca-pack",
        icon: FileSpreadsheet,
        status: "READY",
        statutoryRef: "Auditor Package Suite",
      },
    ],
  },
];

function ReportsWorkspace() {
  const { snapshots, loading, hydrate, saveSnapshot, verifySnapshot } = useReportSnapshots();
  const [verifierName, setVerifierName] = useState("");
  const [parityQ, setParityQ] = useState("");
  const [reportSearchQ, setReportSearchQ] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  const parityHits = useMemo(() => searchOfflineParity(parityQ).slice(0, 24), [parityQ]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Filter groups and items
  const filteredCategories = useMemo(() => {
    let list = REPORT_CATEGORIES;

    if (selectedCategory !== "ALL") {
      list = list.filter((cat) => cat.id === selectedCategory);
    }

    if (!reportSearchQ.trim()) {
      return list;
    }

    const q = reportSearchQ.toLowerCase().trim();
    return list
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q) ||
            (item.statutoryRef && item.statutoryRef.toLowerCase().includes(q))
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [selectedCategory, reportSearchQ]);

  const totalReportsCount = useMemo(() => {
    return REPORT_CATEGORIES.reduce((acc, cat) => acc + cat.items.length, 0);
  }, []);

  return (
    <ModuleWorkspace
      eyebrow="Decision Support & Compliance"
      title="Accounting & Statutory Report Center"
      description="Authoritative reporting suite for Owner, Management, Accountant, and Chartered Accountant. Derived strictly from General Ledger and double-entry transaction books."
      icon={BarChart3}
      metrics={[
        { label: "Report Categories", value: "16 Suites" },
        { label: "Authoritative Reports", value: `${totalReportsCount} Active` },
        { label: "Fineness Standard", value: "995 / 99.50%" },
      ]}
      actions={[
        <Link key="ca-pack-btn" to="/reports/ca-pack">
          <Button size="sm" className="gap-2 bg-gold hover:bg-gold/90 text-primary-foreground font-semibold">
            <Download className="h-4 w-4" /> CA Export Pack
          </Button>
        </Link>,
      ]}
    >
      <div className="mb-4">
        <SourceOfTruthBadge variant="report" />
      </div>

      {/* Statutory Preparation Notice */}
      <div className="rounded-lg border border-gold/40 bg-gold/5 p-4 mb-6 text-xs text-muted-foreground space-y-1">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4 text-gold" />
          <span>Authoritative Reporting Principle: TRANSACTION → LEDGER → SUBLEDGER → REPORT</span>
        </div>
        <p>
          Every report in this suite derives from immutable double-entry database records and reconciles with the General Ledger, Trial Balance, Stock Ledger, and Gold Books. Statutory GST and accounting reports are calibrated to current official GST Portal structures (GSTR-1, GSTR-3B, GSTR-9 Table 8A 2B-aligned) and ICAI standards.
        </p>
      </div>

      {/* Search & Category Filter Toolbar */}
      <section className="erp-surface rounded-md p-4 mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 text-sm"
              placeholder="Search reports, registers, statutory standards (e.g., Trial Balance, GSTR-1, AS-2)..."
              value={reportSearchQ}
              onChange={(e) => setReportSearchQ(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="ALL">All 16 Report Categories ({totalReportsCount})</option>
              {REPORT_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.title} ({cat.items.length})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Offline Parity Finder Accordion / Quick Lookup */}
        <div className="pt-2 border-t border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Offline Gujarati / Traditional Book Name Lookup:
            </span>
            <Badge variant="outline" className="text-[10px]">{OFFLINE_PARITY_CATALOG.length} Mapped</Badge>
          </div>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-xs"
              placeholder="Type traditional name: Fine Rojmel, Dar Rojmel, Jama/Nave, Dhadi..."
              value={parityQ}
              onChange={(e) => setParityQ(e.target.value)}
            />
          </div>
          {parityQ.trim() ? (
            <div className="grid gap-1 md:grid-cols-2 mt-2 bg-muted/30 p-2 rounded-md">
              {parityHits.map((e) => (
                <Link
                  key={`${e.offlineName}-${e.to}`}
                  to={e.to}
                  search={e.search}
                  className="text-xs px-2 py-1.5 rounded hover:bg-muted/70 flex justify-between gap-2"
                >
                  <span>
                    <span className="font-semibold text-foreground">{e.offlineName}</span>
                    <span className="text-muted-foreground"> → {e.avsName}</span>
                  </span>
                  <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                </Link>
              ))}
              {parityHits.length === 0 ? (
                <p className="text-xs text-muted-foreground p-1">No matching traditional name found.</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {/* Saved Report Snapshots Section */}
      <section className="erp-surface rounded-md p-4 mb-8 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-sm">Saved Report Snapshots & Sign-offs</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Verified snapshots serve as immutable audit evidence for CA and tax reviews.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              void saveSnapshot({
                reportCode: "reports_hub_16",
                reportName: "16-Category Reporting Suite Snapshot",
                filters: { savedFrom: "reports.index", categoryCount: 16 },
                snapshotData: { totalReportsCount },
              }).then((s) => {
                if (s) toast.success("Reporting snapshot saved successfully.");
                else toast.error("Could not save snapshot.");
              })
            }
          >
            Save Suite Snapshot
          </Button>
        </div>
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Verifier name (CA / Auditor) for QA sign-off"
            value={verifierName}
            onChange={(e) => setVerifierName(e.target.value)}
            className="max-w-xs h-8 text-xs"
          />
        </div>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading snapshots…</p>
        ) : snapshots.length === 0 ? (
          <p className="text-xs text-muted-foreground">No saved report snapshots yet.</p>
        ) : (
          <div className="divide-y text-xs">
            {snapshots.slice(0, 4).map((s) => (
              <div key={s.id} className="flex items-center justify-between py-1.5 gap-3">
                <div>
                  <span className="font-medium text-foreground">{s.reportName}</span>
                  <span className="text-[11px] text-muted-foreground ml-2">
                    {new Date(s.savedAt).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
                  {s.status === "saved" && verifierName.trim() && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2"
                      onClick={() =>
                        void verifySnapshot(s.id, verifierName.trim()).then((ok) => {
                          if (ok) toast.success("Report verified by auditor.");
                          else toast.error("Verification failed.");
                        })
                      }
                    >
                      Sign Off
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 16 Report Category Sections */}
      <div className="space-y-8">
        {filteredCategories.map((group) => (
          <section key={group.id} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-2">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <span className="text-gold font-mono text-xs px-1.5 py-0.5 rounded bg-gold/10 border border-gold/20">
                    {group.categoryCode}
                  </span>
                  {group.title}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">{group.description}</p>
              </div>
              <Badge variant="secondary" className="text-xs">
                {group.items.length} Reports
              </Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {group.items.map(({ label, description, to, icon: Icon, search, status, statutoryRef }) => (
                <Link
                  className="erp-surface group rounded-xl p-4 hover:border-primary/50 flex flex-col justify-between gap-3 min-h-[110px] transition-all hover:shadow-sm"
                  key={`${to}-${label}`}
                  to={to}
                  search={search}
                >
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors">
                          {label}
                        </h3>
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase font-mono shrink-0 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        >
                          {status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{description}</p>
                    </div>
                  </div>

                  {statutoryRef ? (
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/40 mt-auto">
                      <span className="truncate">
                        Ref: <strong className="font-medium text-foreground">{statutoryRef}</strong>
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
                    </div>
                  ) : null}
                </Link>
              ))}
            </div>
          </section>
        ))}

        {filteredCategories.length === 0 ? (
          <div className="text-center py-12 erp-surface rounded-xl p-6">
            <Search className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <h3 className="font-semibold text-sm">No reports matching your search</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Try adjusting your search terms or select "All 16 Report Categories".
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setReportSearchQ("");
                setSelectedCategory("ALL");
              }}
            >
              Reset Filters
            </Button>
          </div>
        ) : null}
      </div>
    </ModuleWorkspace>
  );
}
