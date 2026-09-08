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
import { KEYBOARD_EVENTS } from "@/lib/keyboard/keyboard-events";
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
  Settings,
} from "lucide-react";
import { usePeople } from "@/lib/people-store";
import { useStock } from "@/lib/stock-store";
import { useBilling } from "@/lib/billing-store";
import { useWorkers } from "@/lib/workers-store";
import { useOrders } from "@/lib/orders-store";

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
  // Retail & Sell
  {
    id: "new_sale",
    title: "New Retail Sale Bill (POS)",
    category: "Retail",
    to: "/billing/new",
    icon: <ShoppingCart className="h-4 w-4 text-emerald-500" />,
    shortcut: "F2",
    keywords: ["sale", "bill", "invoice", "pos", "sell", "customer sale", "billing", "checkout"],
  },
  {
    id: "invoices_register",
    title: "Invoices & Sales Register",
    category: "Retail",
    to: "/billing",
    icon: <Receipt className="h-4 w-4 text-emerald-500" />,
    keywords: ["invoices", "bills", "sales register", "receipts", "history"],
  },
  {
    id: "new_estimate",
    title: "New Quotation / Estimate",
    category: "Retail",
    to: "/billing/estimates",
    icon: <Receipt className="h-4 w-4 text-emerald-400" />,
    keywords: ["quote", "quotation", "estimate", "proforma", "price", "approval"],
  },
  {
    id: "customer_orders",
    title: "Customer Orders & Bookings",
    category: "Retail",
    to: "/orders",
    icon: <ShoppingCart className="h-4 w-4 text-emerald-400" />,
    keywords: ["order", "booking", "custom jewellery", "advance", "due date"],
  },
  {
    id: "add_customer",
    title: "Customers Directory & KYC",
    category: "Customer",
    to: "/people?tab=customers",
    icon: <Users className="h-4 w-4 text-blue-500" />,
    keywords: ["customer", "people", "party", "kyc", "phone", "pan", "aadhaar", "address"],
  },
  {
    id: "product_catalogue",
    title: "Product Design Catalogue",
    category: "Retail",
    to: "/catalog",
    icon: <Sparkles className="h-4 w-4 text-gold" />,
    keywords: ["catalogue", "catalog", "design", "jewellery", "ring", "necklace", "bangle", "earring"],
  },
  {
    id: "delivery_challans",
    title: "Delivery Challans & Consignment",
    category: "Retail",
    to: "/billing/delivery-challans",
    icon: <Package className="h-4 w-4 text-emerald-600" />,
    keywords: ["challan", "delivery", "consignment", "dispatch", "gate pass"],
  },
  {
    id: "credit_debit_notes",
    title: "Credit & Debit Notes (Sales Returns)",
    category: "Retail",
    to: "/billing/credit-notes",
    icon: <Receipt className="h-4 w-4 text-emerald-500" />,
    keywords: ["credit note", "debit note", "return", "sales return", "refund", "adjustment"],
  },

  // Stock & Inventory
  {
    id: "ready_stock",
    title: "Ready Stock & Inventory",
    category: "Stock",
    to: "/stock",
    icon: <Package className="h-4 w-4 text-blue-500" />,
    shortcut: "F3",
    keywords: ["stock", "ready stock", "barcode", "tag", "item", "necklace", "ring", "bangle", "inventory"],
  },
  {
    id: "stock_tagging",
    title: "Stock Tagging & Entry",
    category: "Stock",
    to: "/stock/entry",
    icon: <Package className="h-4 w-4 text-blue-400" />,
    keywords: ["stock entry", "tagging", "new item", "add stock", "barcode generator", "label print"],
  },
  {
    id: "barcode_scanner",
    title: "Barcode Scanner & Instant Lookup",
    category: "Stock",
    to: "/workshop/barcode-scanner",
    icon: <Barcode className="h-4 w-4 text-indigo-400" />,
    keywords: ["barcode", "scan", "scanner", "tag", "lookup", "camera scan"],
  },
  {
    id: "metal_lots",
    title: "Metal Lots & Raw Bullion",
    category: "Stock",
    to: "/stock/lots",
    icon: <Coins className="h-4 w-4 text-blue-500" />,
    keywords: ["lots", "metal lots", "raw gold", "bullion packet", "batch", "ingot"],
  },
  {
    id: "stock_transfers",
    title: "Stock Transfers (Branch-to-Branch)",
    category: "Stock",
    to: "/stock/transfers",
    icon: <ArrowRight className="h-4 w-4 text-blue-400" />,
    keywords: ["transfer", "branch transfer", "transit", "receive stock", "send stock"],
  },
  {
    id: "safe_boxes",
    title: "Safe Boxes & Showcase Trays",
    category: "Stock",
    to: "/stock/boxes",
    icon: <Package className="h-4 w-4 text-blue-500" />,
    keywords: ["tray", "box", "safe", "counter", "showcase", "location"],
  },
  {
    id: "stone_inventory",
    title: "Stone & Gemstone Inventory",
    category: "Stock",
    to: "/stock/stones",
    icon: <Sparkles className="h-4 w-4 text-purple-400" />,
    keywords: ["diamond", "stone", "gemstone", "ruby", "emerald", "carat", "cent", "grading"],
  },
  {
    id: "bis_hallmarking",
    title: "BIS Hallmarking & HUID",
    category: "Stock",
    to: "/stock/hallmark",
    icon: <Sparkles className="h-4 w-4 text-gold" />,
    keywords: ["hallmark", "huid", "bis", "purity mark", "assay center"],
  },
  {
    id: "physical_audit",
    title: "Physical Stock Audit & Verification",
    category: "Stock",
    to: "/stock/verification",
    icon: <Package className="h-4 w-4 text-amber-500" />,
    keywords: ["audit", "verification", "physical count", "discrepancy", "scan match"],
  },

  // Workshop & Manufacturing
  {
    id: "workshop_cockpit",
    title: "Workshop Cockpit & Overview",
    category: "Manufacturing",
    to: "/workshop",
    icon: <Hammer className="h-4 w-4 text-amber-500" />,
    keywords: ["workshop", "bench", "wip", "manufacturing cockpit", "in progress"],
  },
  {
    id: "karigar_gold_book",
    title: "Karigar Gold Book (Issue / Receive)",
    category: "Manufacturing",
    to: "/workshop/gold-book",
    icon: <Hammer className="h-4 w-4 text-amber-500" />,
    shortcut: "F4",
    keywords: ["karigar", "worker", "issue", "receive", "wastage", "over loss", "artisan", "workshop", "gold book", "jama", "nave"],
  },
  {
    id: "manufacturing_jobs",
    title: "Production Job Cards",
    category: "Manufacturing",
    to: "/orders",
    icon: <Factory className="h-4 w-4 text-purple-500" />,
    keywords: ["production", "job card", "casting", "melting", "refining", "orders", "spec"],
  },
  {
    id: "outside_work",
    title: "Outside Jobwork (Setting, Plating, Laser)",
    category: "Manufacturing",
    to: "/workshop/outside-work",
    icon: <Factory className="h-4 w-4 text-amber-400" />,
    keywords: ["outside work", "jobwork", "setting", "micro setting", "rhodium", "plating", "enamel", "laser"],
  },
  {
    id: "polishing_processes",
    title: "Polishing & Finishing Processes",
    category: "Manufacturing",
    to: "/workshop/polishing",
    icon: <Sparkles className="h-4 w-4 text-amber-500" />,
    keywords: ["polishing", "tumble", "ultrasonic", "magnetic", "cleaning", "finish"],
  },
  {
    id: "dhadi_groups",
    title: "Dhadi Groups & Piece Wages",
    category: "Manufacturing",
    to: "/workshop/dhadi-groups",
    icon: <Users className="h-4 w-4 text-amber-500" />,
    keywords: ["dhadi", "group", "piece rate", "karigar wage", "artisan rate"],
  },
  {
    id: "melt_assay",
    title: "Melt & Assay (Refining)",
    category: "Manufacturing",
    to: "/melt",
    icon: <Coins className="h-4 w-4 text-amber-600" />,
    keywords: ["melt", "assay", "refining", "melting batch", "scrap", "fire assay", "xrf"],
  },
  {
    id: "karigar_settlement",
    title: "Artisan / Karigar Settlement",
    category: "Manufacturing",
    to: "/settlement/new",
    icon: <Coins className="h-4 w-4 text-gold" />,
    keywords: ["settlement", "karigar settlement", "bullion", "payment", "purity", "final reconcile"],
  },

  // Accounts & Treasury
  {
    id: "vault_ledger",
    title: "Fine Gold Bullion Vault Ledger",
    category: "Accounts",
    to: "/ledger",
    icon: <Coins className="h-4 w-4 text-gold" />,
    keywords: ["vault", "bullion", "995", "fine gold", "gold ledger", "metal balance", "pure gold"],
  },
  {
    id: "cash_book",
    title: "Daily Cash Book (Jama / Nave)",
    category: "Accounts",
    to: "/treasury/cash-book",
    icon: <Receipt className="h-4 w-4 text-emerald-500" />,
    keywords: ["cash book", "jama", "nave", "cash in hand", "cash register", "drawer"],
  },
  {
    id: "bank_reconcile",
    title: "Bank Reconciliation & Matching",
    category: "Accounts",
    to: "/treasury/bank-reconciliation",
    icon: <Receipt className="h-4 w-4 text-blue-500" />,
    keywords: ["bank", "statement", "reconcile", "neft", "rtgs", "upi", "cheque"],
  },
  {
    id: "vouchers",
    title: "Payment & Receipt Vouchers",
    category: "Accounts",
    to: "/treasury/vouchers",
    icon: <Receipt className="h-4 w-4 text-indigo-500" />,
    keywords: ["voucher", "payment voucher", "receipt voucher", "contra", "journal voucher"],
  },
  {
    id: "expenses_voucher",
    title: "Shop Expenses & Petty Cash",
    category: "Accounts",
    to: "/expenses",
    icon: <Receipt className="h-4 w-4 text-amber-600" />,
    keywords: ["expense", "petty cash", "tea", "electricity", "rent", "salary", "voucher", "drawings"],
  },
  {
    id: "chart_of_accounts",
    title: "Chart of Accounts & Ledger Heads",
    category: "Accounts",
    to: "/control/accounts",
    icon: <Receipt className="h-4 w-4 text-indigo-600" />,
    keywords: ["chart of accounts", "ledger head", "group", "sundry debtors", "sundry creditors"],
  },
  {
    id: "financial_statements",
    title: "Financial Statements (Trial Balance, P&L, Balance Sheet)",
    category: "Accounts",
    to: "/reports/financial-statements",
    icon: <FileSpreadsheet className="h-4 w-4 text-blue-600" />,
    keywords: ["trial balance", "p&l", "profit and loss", "balance sheet", "general ledger", "accounts", "journal"],
  },
  {
    id: "metal_conversions",
    title: "Metal Conversions & Old Gold Scrap",
    category: "Accounts",
    to: "/conversion/index",
    icon: <Coins className="h-4 w-4 text-gold" />,
    keywords: ["conversion", "old gold", "scrap", "exchange", "melting conversion"],
  },

  // People & HR
  {
    id: "attendance_sheet",
    title: "Daily Staff Attendance",
    category: "Payroll",
    to: "/attendance",
    icon: <Users className="h-4 w-4 text-teal-500" />,
    keywords: ["attendance", "staff", "employee", "biometric", "shift", "check in", "present"],
  },
  {
    id: "staff_directory",
    title: "Staff & Worker Directory",
    category: "Payroll",
    to: "/people?tab=workers",
    icon: <Users className="h-4 w-4 text-teal-400" />,
    keywords: ["staff", "worker", "employee", "directory", "hr", "artisan list"],
  },

  // Reports & Analytics
  {
    id: "reports_hub",
    title: "Reports & Analytics Cockpit",
    category: "Reports",
    to: "/reports",
    icon: <FileSpreadsheet className="h-4 w-4 text-purple-500" />,
    keywords: ["reports", "analytics", "business intelligence", "summary", "audit"],
  },
  {
    id: "day_book_daily_close",
    title: "Daily Close & Day Book (EOD)",
    category: "Reports",
    to: "/reports/daily-close",
    icon: <FileSpreadsheet className="h-4 w-4 text-purple-400" />,
    keywords: ["daily close", "day book", "eod", "closing balance", "drawer balance", "metal closing"],
  },
  {
    id: "sales_register",
    title: "GST Sales Register",
    category: "Reports",
    to: "/reports/sales-register",
    icon: <FileSpreadsheet className="h-4 w-4 text-emerald-600" />,
    keywords: ["sales register", "b2b", "b2c", "tax invoice register", "gst sales"],
  },
  {
    id: "purchase_register",
    title: "Purchase Register & URD Purchases",
    category: "Reports",
    to: "/reports/purchase-register",
    icon: <FileSpreadsheet className="h-4 w-4 text-blue-500" />,
    keywords: ["purchase register", "bullion purchase", "urd purchase", "vendor bills"],
  },
  {
    id: "metal_position",
    title: "Metal Position & Gold Exposure",
    category: "Reports",
    to: "/reports/metal-position",
    icon: <Coins className="h-4 w-4 text-gold" />,
    keywords: ["metal position", "gold exposure", "unhedged", "fine balance", "holding"],
  },
  {
    id: "karigar_wastage_report",
    title: "Karigar Wastage & Loss Audit",
    category: "Reports",
    to: "/reports/worker",
    icon: <Hammer className="h-4 w-4 text-amber-500" />,
    keywords: ["wastage", "loss %", "karigar efficiency", "dust recovery", "artisan audit"],
  },
  {
    id: "ca_report_pack",
    title: "CA / Accountant Export Pack (ZIP)",
    category: "Reports",
    to: "/reports/ca-pack",
    icon: <FileSpreadsheet className="h-4 w-4 text-emerald-600" />,
    keywords: ["ca", "accountant", "pdf", "excel", "trial balance", "gst", "audit", "pack", "tax", "zip export"],
  },
  {
    id: "gst_returns_report",
    title: "Statutory Tax Returns (GSTR-1, 3B, ITC-04)",
    category: "Reports",
    to: "/reports/gst-returns",
    icon: <FileSpreadsheet className="h-4 w-4 text-blue-600" />,
    keywords: ["gst", "gstr1", "gstr3b", "itc04", "job work return", "tax", "hsn", "summary"],
  },
  {
    id: "stock_valuation",
    title: "Stock Valuation & Ageing Analysis",
    category: "Reports",
    to: "/reports/stock-valuation",
    icon: <Package className="h-4 w-4 text-indigo-500" />,
    keywords: ["stock valuation", "inventory valuation", "ageing", "dead stock", "fast moving"],
  },

  // Settings & Admin
  {
    id: "firm_profile",
    title: "Firm Profile, Branches & Identity",
    category: "Settings",
    to: "/settings",
    icon: <Settings className="h-4 w-4 text-zinc-400" />,
    keywords: ["settings", "firm", "store name", "gstin", "branch", "logo", "address"],
  },
  {
    id: "automation_engine",
    title: "Automation Engine & Triggers",
    category: "Settings",
    to: "/settings/automation",
    icon: <Sparkles className="h-4 w-4 text-indigo-500" />,
    keywords: ["automation", "triggers", "rules", "background jobs", "sweeps", "alerts"],
  },
  {
    id: "live_bullion_rates",
    title: "Live Bullion Rates (24K, 22K, 18K)",
    category: "Settings",
    to: "/control/rates",
    icon: <Coins className="h-4 w-4 text-gold" />,
    keywords: ["rate", "rates", "gold rate", "silver rate", "24k", "22k", "18k", "board rate"],
  },
  {
    id: "customization_hub",
    title: "Customization & Print Templates",
    category: "Settings",
    to: "/control/customization",
    icon: <Sparkles className="h-4 w-4 text-gold" />,
    keywords: ["customization", "print template", "invoice print", "tag print", "fields"],
  },
  {
    id: "hardware_hub",
    title: "Hardware Devices & Thermal Printers",
    category: "Settings",
    to: "/hardware",
    icon: <Settings className="h-4 w-4 text-zinc-400" />,
    keywords: ["hardware", "printer", "scale", "weighing scale", "thermal printer", "tsc", "zebra"],
  },
  {
    id: "security_audit",
    title: "Security Center & Audit Log",
    category: "Settings",
    to: "/settings/security-center",
    icon: <Settings className="h-4 w-4 text-zinc-400" />,
    keywords: ["security", "audit log", "login history", "permissions", "access control"],
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
  const orders = useOrders((s) => s.orders);

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

  // Listen for Ctrl+K, Cmd+K, and COMMAND_PALETTE bus events
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

    const handleCustomOpen = () => {
      setIsOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener(KEYBOARD_EVENTS.COMMAND_PALETTE, handleCustomOpen);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener(KEYBOARD_EVENTS.COMMAND_PALETTE, handleCustomOpen);
    };
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

    // Live Customers (Direct 360 profile opening)
    const matchedPeople: CommandItem[] = Object.values(people)
      .filter((p) => p.fullName?.toLowerCase().includes(q) || p.phone?.includes(q) || (p.villageCity && p.villageCity.toLowerCase().includes(q)) || (p.area && p.area.toLowerCase().includes(q)))
      .slice(0, 5)
      .map((p) => ({
        id: `person_${p.id}`,
        title: p.fullName,
        category: "Customer",
        subtitle: `${p.phone || "No phone"} · ${p.villageCity || p.area || p.partyCode || "Customer"} (${p.type})`,
        to: `/people/${p.id}`,
        icon: <User className="h-4 w-4 text-blue-500" />,
        keywords: [p.fullName, p.phone || "", p.villageCity || p.area || ""],
      }));

    // Live Orders & Job Cards (Direct Order opening)
    const matchedOrders: CommandItem[] = Object.values(orders)
      .filter((o) => {
        const custName = people.find((p) => p.id === o.customerId)?.fullName || "";
        const itemType = o.items?.[0]?.itemName || o.item?.itemName || o.productionType || o.items?.[0]?.category || "";
        return o.orderNo?.toLowerCase().includes(q) || custName.toLowerCase().includes(q) || itemType.toLowerCase().includes(q);
      })
      .slice(0, 5)
      .map((o) => {
        const custName = people.find((p) => p.id === o.customerId)?.fullName || "Customer";
        const itemType = o.items?.[0]?.itemName || o.item?.itemName || o.productionType || o.items?.[0]?.category || "Jewellery";
        return {
          id: `order_${o.id}`,
          title: `Order ${o.orderNo} — ${itemType}`,
          category: "Manufacturing",
          subtitle: `${custName} · Status: ${o.status || "In Progress"}`,
          to: `/orders/${o.id}`,
          icon: <Factory className="h-4 w-4 text-purple-500" />,
          keywords: [o.orderNo || "", custName, itemType],
        };
      });

    // Live Ready Stock / Barcode (Direct Stock Item opening)
    const matchedStock: CommandItem[] = (Array.isArray(stockItems) ? stockItems : Object.values(stockItems || {}))
      .filter((s: any) => s.barcode?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q))
      .slice(0, 5)
      .map((s: any) => ({
        id: `stock_${s.id || s.barcode}`,
        title: `${s.barcode || "Item"} - ${s.name || "Stock"}`,
        category: "Stock",
        subtitle: `${s.karat || "22"}K · Gross: ${s.grossWeight || 0}g · Net: ${s.netWeight || 0}g`,
        to: `/stock/${s.id || s.barcode}`,
        icon: <Barcode className="h-4 w-4 text-gold" />,
        keywords: [s.barcode || "", s.name || ""],
      }));

    // Live Invoices (Direct Invoice opening)
    const matchedInvoices: CommandItem[] = Object.values(invoices)
      .filter((inv) => inv.invoiceNo?.toLowerCase().includes(q) || inv.customerName?.toLowerCase().includes(q))
      .slice(0, 5)
      .map((inv) => ({
        id: `invoice_${inv.id}`,
        title: `Bill ${inv.invoiceNo}`,
        category: "Invoice",
        subtitle: `${inv.customerName || "Walk-in"} · ₹${((inv.grandTotalPaise || 0) / 100).toLocaleString("en-IN")}`,
        to: `/billing/${inv.id}`,
        icon: <Receipt className="h-4 w-4 text-emerald-500" />,
        keywords: [inv.invoiceNo, inv.customerName || ""],
      }));

    // Live Karigars (Artisans in people store - Direct Gold Book opening)
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

    return [...matchedStatic, ...matchedPeople, ...matchedOrders, ...matchedStock, ...matchedInvoices, ...matchedWorkers];
  }, [query, people, stockItems, invoices, orders, recents]);

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
    <div
      data-testid="quick-command-palette-modal"
      id="quick-command-palette-modal"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-16 md:pt-24 px-4 animate-in fade-in duration-150"
    >
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
            data-testid="quick-command-palette-input"
            id="quick-command-palette-input"
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
            data-testid="quick-command-palette-close"
            id="quick-command-palette-close"
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

