/**
 * AVS ERP — Consumer-Grade Global Command & Search Palette (Ctrl+K)
 *
 * Fast, natural task and record search (YouTube / Gmail / WhatsApp model).
 * Allows instant search across:
 * 1. Business workflows and quick navigation destinations
 * 2. Real customer & party records (by name, phone, city)
 * 3. Invoices & bills (by invoice number, customer)
 * 4. Ready Stock items & barcodes (by tag/barcode, item name)
 * 5. Karigars / Artisans
 * 6. Recent searches & actions
 */

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Search,
  ShoppingCart,
  Package,
  Hammer,
  Factory,
  Users,
  FileSpreadsheet,
  Coins,
  Receipt,
  X,
  ArrowRight,
  Sparkles,
  User,
  Clock,
  Barcode,
} from "lucide-react";
import { usePeople } from "@/lib/people-store";
import { useStock } from "@/lib/stock-store";
import { useBilling } from "@/lib/billing-store";
import { useWorkers } from "@/lib/workers-store";

interface CommandItem {
  id: string;
  title: string;
  category: "Retail" | "Stock" | "Manufacturing" | "Accounts" | "Payroll" | "Reports" | "Settings" | "Customer" | "Invoice" | "Inventory" | "Karigar" | "Recent";
  to: string;
  icon: React.ReactNode;
  subtitle?: string;
  shortcut?: string;
  keywords: string[];
}

const STATIC_COMMANDS: CommandItem[] = [
  {
    id: "new_sale",
    title: "New Retail Sale Bill",
    category: "Retail",
    to: "/billing/new",
    icon: <ShoppingCart className="h-4 w-4 text-emerald-500" />,
    shortcut: "F2",
    keywords: ["sale", "bill", "invoice", "pos", "sell", "customer sale", "billing"],
  },
  {
    id: "new_estimate",
    title: "New Quotation / Estimate",
    category: "Retail",
    to: "/billing/estimates",
    icon: <Receipt className="h-4 w-4 text-emerald-400" />,
    keywords: ["quote", "quotation", "estimate", "proforma", "price"],
  },
  {
    id: "add_customer",
    title: "Customers Directory & KYC",
    category: "Retail",
    to: "/people?tab=customers",
    icon: <Users className="h-4 w-4 text-blue-500" />,
    keywords: ["customer", "people", "party", "kyc", "phone", "pan", "aadhaar"],
  },
  {
    id: "product_catalogue",
    title: "Product Design Catalogue",
    category: "Retail",
    to: "/catalog",
    icon: <Sparkles className="h-4 w-4 text-gold" />,
    keywords: ["catalogue", "catalog", "design", "jewellery", "ring", "necklace"],
  },
  {
    id: "add_stock",
    title: "Ready Stock & Inventory",
    category: "Stock",
    to: "/stock",
    icon: <Package className="h-4 w-4 text-gold" />,
    shortcut: "F3",
    keywords: ["stock", "ready stock", "barcode", "tag", "item", "necklace", "ring", "bangle", "inventory"],
  },
  {
    id: "barcode_scanner",
    title: "Barcode Scanner & Search",
    category: "Stock",
    to: "/workshop/barcode-scanner",
    icon: <Barcode className="h-4 w-4 text-indigo-400" />,
    keywords: ["barcode", "scan", "scanner", "tag", "lookup"],
  },
  {
    id: "karigar_gold_book",
    title: "Karigar Issue / Receive (Gold Book)",
    category: "Manufacturing",
    to: "/workshop/gold-book",
    icon: <Hammer className="h-4 w-4 text-amber-500" />,
    shortcut: "F4",
    keywords: ["karigar", "worker", "issue", "receive", "wastage", "over loss", "artisan", "workshop"],
  },
  {
    id: "karigar_settlement",
    title: "Karigar / Bullion Settlement",
    category: "Manufacturing",
    to: "/settlement/new",
    icon: <Coins className="h-4 w-4 text-gold" />,
    keywords: ["settlement", "karigar settlement", "bullion", "payment", "purity"],
  },
  {
    id: "manufacturing_jobs",
    title: "Production Orders & Job Cards",
    category: "Manufacturing",
    to: "/orders",
    icon: <Factory className="h-4 w-4 text-purple-500" />,
    keywords: ["production", "job card", "casting", "melting", "refining", "orders"],
  },
  {
    id: "financial_statements",
    title: "Trial Balance & Financial Statements",
    category: "Accounts",
    to: "/reports/financial-statements",
    icon: <Receipt className="h-4 w-4 text-blue-600" />,
    keywords: ["trial balance", "p&l", "balance sheet", "general ledger", "accounts", "journal"],
  },
  {
    id: "general_ledger",
    title: "General Ledger (Double-Entry)",
    category: "Accounts",
    to: "/ledger",
    icon: <Receipt className="h-4 w-4 text-blue-500" />,
    keywords: ["ledger", "account ledger", "audit", "journal", "debit", "credit"],
  },
  {
    id: "day_book",
    title: "Daily Summary & Day Book",
    category: "Accounts",
    to: "/reports/daily-summary",
    icon: <Receipt className="h-4 w-4 text-indigo-500" />,
    keywords: ["day book", "daily summary", "cash book", "register"],
  },
  {
    id: "expenses_voucher",
    title: "Shop Expenses & Petty Cash",
    category: "Accounts",
    to: "/expenses",
    icon: <Receipt className="h-4 w-4 text-amber-600" />,
    keywords: ["expense", "petty cash", "tea", "electricity", "rent", "salary", "voucher"],
  },
  {
    id: "attendance_sheet",
    title: "Staff Attendance & Payroll",
    category: "Payroll",
    to: "/attendance",
    icon: <Users className="h-4 w-4 text-teal-500" />,
    keywords: ["attendance", "staff", "employee", "salary", "advance", "shift"],
  },
  {
    id: "ca_report_pack",
    title: "CA / Accountant Export Pack (PDF / Excel)",
    category: "Reports",
    to: "/reports/ca-pack",
    icon: <FileSpreadsheet className="h-4 w-4 text-emerald-600" />,
    keywords: ["ca", "accountant", "pdf", "excel", "trial balance", "gst", "audit", "pack", "tax"],
  },
  {
    id: "gst_returns_report",
    title: "GST Returns & Tax Compliance",
    category: "Reports",
    to: "/reports/gst-returns",
    icon: <FileSpreadsheet className="h-4 w-4 text-blue-600" />,
    keywords: ["gst", "gstr1", "gstr3b", "tax", "hsn", "summary"],
  },
  {
    id: "reconciliation_hub",
    title: "Bank & Accounting Reconciliation",
    category: "Accounts",
    to: "/reports/reconciliation-center",
    icon: <Receipt className="h-4 w-4 text-indigo-600" />,
    keywords: ["reconciliation", "bank", "statement", "reconcile"],
  },
  {
    id: "workflow_settings",
    title: "Workflow Engine & Configuration",
    category: "Settings",
    to: "/settings/workflow",
    icon: <Factory className="h-4 w-4 text-muted-foreground" />,
    keywords: ["workflow", "settings", "pipeline", "configuration"],
  },
  {
    id: "customization_hub",
    title: "Customization & Feature Toggles",
    category: "Settings",
    to: "/control/customization",
    icon: <Sparkles className="h-4 w-4 text-gold" />,
    keywords: ["customization", "rates", "charges", "options"],
  },
];

const RECENTS_KEY = "ornexa_recent_searches_v2";

export const QuickCommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  // Live entity stores
  const people = usePeople((s) => s.people);
  const stockItems = useStock((s) => s.items);
  const invoices = useBilling((s) => s.invoices);

  // Recents state
  const [recents, setRecents] = useState<Array<{ id: string; title: string; to: string; category: string }>>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(RECENTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const saveRecent = (item: { id: string; title: string; to: string; category: string }) => {
    const updated = [item, ...recents.filter((r) => r.to !== item.to)].slice(0, 5);
    setRecents(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(RECENTS_KEY, JSON.stringify(updated));
      } catch {
        /* Ignore */
      }
    }
  };

  // Listen for Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Combine static commands and live entity search
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Return recents if any, plus high-priority static commands
      const recentCommands: CommandItem[] = recents.map((r) => ({
        id: `recent_${r.id}`,
        title: r.title,
        category: "Recent",
        to: r.to,
        icon: <Clock className="h-4 w-4 text-muted-foreground" />,
        keywords: [],
      }));
      return [...recentCommands, ...STATIC_COMMANDS.slice(0, 8)];
    }

    const matchedStatic = STATIC_COMMANDS.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q) ||
        cmd.keywords.some((kw) => kw.includes(q)),
    );

    // Live Customers
    const matchedPeople: CommandItem[] = Object.values(people)
      .filter((p) => p.fullName?.toLowerCase().includes(q) || p.phone?.includes(q) || (p.villageCity && p.villageCity.toLowerCase().includes(q)) || (p.area && p.area.toLowerCase().includes(q)))
      .slice(0, 5)
      .map((p) => ({
        id: `person_${p.id}`,
        title: p.fullName,
        category: "Customer",
        subtitle: `${p.phone || "No phone"} · ${p.villageCity || p.area || p.partyCode || "Customer"} (${p.type})`,
        to: `/people?tab=customers&selected=${p.id}`,
        icon: <User className="h-4 w-4 text-blue-500" />,
        keywords: [p.fullName, p.phone || "", p.villageCity || p.area || ""],
      }));

    // Live Ready Stock / Barcode
    const matchedStock: CommandItem[] = (Array.isArray(stockItems) ? stockItems : Object.values(stockItems || {}))
      .filter((s: any) => s.barcode?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q))
      .slice(0, 5)
      .map((s: any) => ({
        id: `stock_${s.id || s.barcode}`,
        title: `${s.barcode || "Item"} - ${s.name || "Stock"}`,
        category: "Stock",
        subtitle: `${s.karat || "22"}K · Gross: ${s.grossWeight || 0}g · Net: ${s.netWeight || 0}g`,
        to: `/stock?search=${encodeURIComponent(s.barcode || s.name || "")}`,
        icon: <Barcode className="h-4 w-4 text-gold" />,
        keywords: [s.barcode || "", s.name || ""],
      }));

    // Live Invoices
    const matchedInvoices: CommandItem[] = Object.values(invoices)
      .filter((inv) => inv.invoiceNo?.toLowerCase().includes(q) || inv.customerName?.toLowerCase().includes(q))
      .slice(0, 5)
      .map((inv) => ({
        id: `invoice_${inv.id}`,
        title: `Bill ${inv.invoiceNo}`,
        category: "Invoice",
        subtitle: `${inv.customerName || "Walk-in"} · ₹${((inv.grandTotalPaise || 0) / 100).toLocaleString("en-IN")}`,
        to: `/billing?selected=${inv.id}`,
        icon: <Receipt className="h-4 w-4 text-emerald-500" />,
        keywords: [inv.invoiceNo, inv.customerName || ""],
      }));

    // Live Karigars (Artisans in people store)
    const matchedWorkers: CommandItem[] = Object.values(people)
      .filter(
        (p) =>
          (p.type === "karigar" || p.type === "worker" || p.type === "outside_karigar" || p.roles?.includes("karigar")) &&
          (p.fullName?.toLowerCase().includes(q) || p.phone?.includes(q)),
      )
      .slice(0, 4)
      .map((p) => ({
        id: `worker_${p.id}`,
        title: p.fullName,
        category: "Karigar",
        subtitle: `Artisan / ${p.type} · ${p.phone || ""}`,
        to: `/workshop/gold-book?workerId=${p.id}`,
        icon: <Hammer className="h-4 w-4 text-amber-500" />,
        keywords: [p.fullName, p.phone || ""],
      }));

    return [...matchedStatic, ...matchedPeople, ...matchedStock, ...matchedInvoices, ...matchedWorkers];
  }, [query, people, stockItems, invoices, recents]);

  const handleSelect = (item: CommandItem) => {
    saveRecent({ id: item.id, title: item.title, to: item.to, category: item.category });
    setIsOpen(false);
    setQuery("");
    navigate({ to: item.to as any });
  };

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === "Enter" && filteredItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(filteredItems[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-16 md:pt-24 px-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col"
        onKeyDown={handleListKeyDown}
      >
        {/* Omnisearch Input Bar */}
        <div className="flex items-center px-4 border-b border-border/80 bg-background/50">
          <Search className="h-5 w-5 text-muted-foreground mr-3 shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Search anything: 'New sale', customer name, invoice #, barcode tag, karigar..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full h-14 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {filteredItems.map((cmd, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={cmd.id}
                onClick={() => handleSelect(cmd)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                  isSelected ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted/60 text-foreground"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {cmd.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{cmd.title}</div>
                    <div
                      className={`text-[11px] truncate ${
                        isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                      }`}
                    >
                      {cmd.subtitle || `${cmd.category} · Jump directly to workflow`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {cmd.shortcut && (
                    <kbd
                      className={`hidden sm:inline-flex px-2 py-0.5 rounded text-[10px] font-mono ${
                        isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground border"
                      }`}
                    >
                      {cmd.shortcut}
                    </kbd>
                  )}
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wider font-semibold ${
                      isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {cmd.category}
                  </span>
                  <ArrowRight
                    className={`h-4 w-4 ${isSelected ? "text-primary-foreground" : "text-muted-foreground"}`}
                  />
                </div>
              </div>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">No matching action, customer, or record found</p>
              <p className="text-xs">Try searching for a customer name, phone number, barcode tag, or task name.</p>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-muted/40 border-t border-border/80 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Navigate:</span>
            <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono">↑↓</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono">Enter</kbd> to open
            <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono">Esc</kbd> to dismiss
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-gold" />
            <span>AVS Global Search & Navigator</span>
          </div>
        </div>
      </div>
    </div>
  );
};

