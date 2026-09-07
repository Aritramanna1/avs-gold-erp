/**
 * AVS ERP — Global Quick Command Palette (Ctrl+K)
 *
 * Fast, natural task discoverer for shop staff. Allows jump-starting any
 * business workflow without memorizing menu structures.
 */

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CommandItem {
  id: string;
  title: string;
  category: "Retail" | "Stock" | "Workshop" | "Accounts" | "Reports";
  to: string;
  icon: React.ReactNode;
  shortcut?: string;
  keywords: string[];
}

const COMMANDS: CommandItem[] = [
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
    id: "add_stock",
    title: "Add Ready Stock Item",
    category: "Stock",
    to: "/stock",
    icon: <Package className="h-4 w-4 text-gold" />,
    shortcut: "F3",
    keywords: ["stock", "ready stock", "barcode", "tag", "item", "necklace", "ring", "bangle", "inventory"],
  },
  {
    id: "karigar_gold_book",
    title: "Karigar Issue / Receive (Gold Book)",
    category: "Workshop",
    to: "/workshop/gold-book",
    icon: <Hammer className="h-4 w-4 text-amber-500" />,
    shortcut: "F4",
    keywords: ["karigar", "worker", "issue", "receive", "wastage", "over loss", "artisan", "workshop"],
  },
  {
    id: "manufacturing_jobs",
    title: "Production & Job Cards",
    category: "Workshop",
    to: "/manufacturing",
    icon: <Factory className="h-4 w-4 text-purple-500" />,
    keywords: ["production", "job card", "casting", "melting", "refining", "chain"],
  },
  {
    id: "add_customer",
    title: "Customer Directory & KYC",
    category: "Retail",
    to: "/people",
    icon: <Users className="h-4 w-4 text-blue-500" />,
    keywords: ["customer", "people", "party", "kyc", "phone", "pan", "aadhaar"],
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
    id: "gold_vault_position",
    title: "Gold Vault & Metal Position (995 Basis)",
    category: "Accounts",
    to: "/reports/gold-position",
    icon: <Coins className="h-4 w-4 text-gold" />,
    keywords: ["gold", "vault", "balance", "995", "metal position", "bullion", "pure gold"],
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
    id: "expenses_voucher",
    title: "Shop Expenses & Petty Cash",
    category: "Accounts",
    to: "/expenses",
    icon: <Receipt className="h-4 w-4 text-amber-600" />,
    keywords: ["expense", "petty cash", "tea", "electricity", "rent", "salary", "voucher"],
  },
];

export const QuickCommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

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

  const filteredCommands = COMMANDS.filter((cmd) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q) ||
      cmd.keywords.some((kw) => kw.includes(q))
    );
  });

  const handleSelect = (to: string) => {
    setIsOpen(false);
    setQuery("");
    navigate({ to: to as any });
  };

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === "Enter" && filteredCommands[selectedIndex]) {
      e.preventDefault();
      handleSelect(filteredCommands[selectedIndex].to);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-16 md:pt-24 px-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col"
        onKeyDown={handleListKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 border-b border-border/80 bg-background/50">
          <Search className="h-5 w-5 text-muted-foreground mr-3 shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Type what you want to do (e.g. sale, stock, karigar, pdf, gold)..."
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
            className="p-1 rounded-md text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredCommands.map((cmd, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={cmd.id}
                onClick={() => handleSelect(cmd.to)}
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
                      {cmd.category} · Jump directly to workflow
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
                  <ArrowRight
                    className={`h-4 w-4 ${isSelected ? "text-primary-foreground" : "text-muted-foreground"}`}
                  />
                </div>
              </div>
            );
          })}

          {filteredCommands.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">No matching action found</p>
              <p className="text-xs">Try searching for "sale", "stock", "karigar", "customer", or "report".</p>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-muted/40 border-t border-border/80 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Navigation:</span>
            <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono">↑↓</kbd> to move
            <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono">Enter</kbd> to open
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-gold" />
            <span>AVS Quick Navigator</span>
          </div>
        </div>
      </div>
    </div>
  );
};
