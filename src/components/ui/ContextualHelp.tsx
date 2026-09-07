/**
 * AVS ERP — Contextual Help & Plain-Language Terminology Tooltip
 *
 * Provides lightweight, easy-to-understand explanations for jewellery ERP terms
 * without altering accounting or manufacturing terminology.
 */

import React, { useState } from "react";
import { HelpCircle, Info, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const GLOSSARY: Record<string, { title: string; text: string; example?: string }> = {
  purity_995: {
    title: "995 Bullion Fineness",
    text: "Standard 99.50% pure gold bullion used as the baseline for gold accounting and valuation.",
    example: "100g of 995 bar = 99.500g of 100% fine gold.",
  },
  purity_916: {
    title: "916 Hallmarked Gold (22K)",
    text: "Standard 22-Karat jewellery gold alloyed for strength (91.6% pure gold).",
    example: "Commonly used for bridal necklaces, bangles, and chains.",
  },
  purity_750: {
    title: "750 Gold (18K)",
    text: "18-Karat gold alloy (75.0% pure gold) ideal for diamond-studded jewellery.",
  },
  over_loss: {
    title: "Karigar Over-Loss",
    text: "Extra gold lost during crafting that exceeds the permitted wastage allowance.",
    example: "If allowed loss is 1.0g but artisan loses 1.3g, the 0.3g is Over-Loss due from artisan.",
  },
  making_charges: {
    title: "Making Charges (Labour)",
    text: "Artisan and crafting fees charged per gram of gross weight or as a fixed charge.",
  },
  dual_dimension: {
    title: "Dual-Ledger Accounting",
    text: "Independent, strict tracking of Money (₹) and Physical Gold (grams) in separate ledgers.",
    example: "Cash and Gold are never collapsed into a single speculative rupee number.",
  },
  rcm_gst: {
    title: "Reverse Charge Mechanism (RCM)",
    text: "GST liability where the buyer pays tax directly to the government instead of the seller.",
  },
  trial_balance: {
    title: "Trial Balance",
    text: "Summary listing of all account debit and credit balances to verify accounting integrity.",
  },
  general_ledger: {
    title: "General Ledger",
    text: "Authoritative double-entry register recording every monetary and metal transaction.",
  },
  itc_gst: {
    title: "Input Tax Credit (ITC)",
    text: "GST paid on purchases that can be deducted from GST collected on sales.",
  },
  job_card: {
    title: "Manufacturing Job Card",
    text: "A tracked production order assigned to an artisan with metal issue, stage work, and recovery.",
  },
};

export interface ContextualHelpProps {
  glossaryKey?: keyof typeof GLOSSARY | string;
  title?: string;
  text?: string;
  example?: string;
  className?: string;
  size?: "sm" | "md";
}

export const ContextualHelp: React.FC<ContextualHelpProps> = ({
  glossaryKey,
  title: customTitle,
  text: customText,
  example: customExample,
  className = "",
  size = "sm",
}) => {
  const [open, setOpen] = useState(false);
  const entry = glossaryKey && GLOSSARY[glossaryKey] ? GLOSSARY[glossaryKey] : null;

  const title = customTitle || entry?.title || "Help & Information";
  const text = customText || entry?.text || "Click for details on this field or operation.";
  const example = customExample || entry?.example;

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition-colors ${className}`}
            onClick={(e) => {
              e.preventDefault();
              setOpen(!open);
            }}
            aria-label={title}
          >
            <HelpCircle className={`${iconSize} text-muted-foreground/70 hover:text-primary cursor-pointer`} />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          className="max-w-xs p-3 text-xs bg-popover text-popover-foreground border shadow-md rounded-lg space-y-1 z-50"
        >
          <div className="font-semibold text-foreground flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-primary" /> {title}
            </span>
          </div>
          <p className="text-muted-foreground leading-relaxed text-[11px]">{text}</p>
          {example && (
            <div className="mt-1 pt-1 border-t border-border/50 text-[10px] text-primary/90 font-mono">
              💡 {example}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
