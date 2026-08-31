import React from "react";
import { Coins, Banknote, Sparkles, CheckCircle2, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { GoldWeightDisplay } from "@/components/ui/GoldWeightDisplay";
import { mgToGrams, gramsToMg } from "@/lib/gold";
import { paiseToRupees } from "@/lib/billing-store";

export type PaymentMethodPresentation = "gold" | "cash" | "mixed" | "other";

interface CashGoldPaymentSummaryProps {
  method: PaymentMethodPresentation;
  // Gold metrics
  goldPaidGrams?: number;
  fineGoldMg?: number;
  purity?: number;
  // Cash metrics
  cashPaidPaise?: number;
  goldRatePerGramPaise?: number;
  cashGoldEquivMg?: number;
  // Mixed remainder
  remainingFineMg?: number;
  // Optional custom narration
  narration?: string;
  className?: string;
}

export function CashGoldPaymentSummary({
  method,
  goldPaidGrams = 0,
  fineGoldMg = 0,
  purity = 916,
  cashPaidPaise = 0,
  goldRatePerGramPaise = 0,
  cashGoldEquivMg = 0,
  remainingFineMg = 0,
  narration,
  className = "",
}: CashGoldPaymentSummaryProps) {
  const ratePaise = goldRatePerGramPaise || 750000;
  const computedCashEquivPaise =
    fineGoldMg > 0 && ratePaise > 0 ? Math.round((fineGoldMg * ratePaise) / 1000) : 0;

  // Auto-generate truthful Gold payment narration
  const defaultGoldNarration = `Payment done in Gold (${goldPaidGrams.toFixed(3)}g, Touch ${purity} → ${mgToGrams(fineGoldMg)}g fine) — equivalent value ₹ ${paiseToRupees(computedCashEquivPaise)} at ₹ ${paiseToRupees(ratePaise)}/g.`;
  // Auto-generate truthful Cash payment narration
  const defaultCashNarration = `Payment done in Cash (₹ ${paiseToRupees(cashPaidPaise)}) — Gold Equivalent ${mgToGrams(cashGoldEquivMg)}g at ₹ ${paiseToRupees(ratePaise)}/g.`;

  if (method === "gold") {
    return (
      <div
        data-testid="gold-payment-summary-card"
        className={`rounded-xl border border-gold/40 bg-gradient-to-br from-gold/15 via-gold/5 to-background p-4 shadow-sm space-y-3 ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-gold" />
            <span className="font-bold text-xs uppercase tracking-wider text-gold">
              Payment Method: Gold
            </span>
          </div>
          <Badge
            variant="outline"
            className="border-gold/40 text-gold bg-gold/10 text-[10px] font-mono font-bold"
          >
            <CheckCircle2 className="h-3 w-3 mr-1 text-gold" />
            PAID IN GOLD
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-2.5 rounded-lg bg-background/80 border border-gold/20">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground">
              Gold Paid (Gross)
            </div>
            <div className="text-base font-mono font-bold text-gold mt-0.5">
              <GoldWeightDisplay grams={goldPaidGrams} kind="gross" />
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-background/80 border border-gold/20">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground">
              Purity &amp; Fine Gold
            </div>
            <div className="text-base font-mono font-bold text-amber-400 mt-0.5">
              <GoldWeightDisplay mg={fineGoldMg} purity={purity} kind="fine" />
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-background/80 border border-gold/20">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground">
              Transaction Gold Rate
            </div>
            <div className="text-base font-mono font-bold text-foreground mt-0.5">
              <MoneyDisplay paise={ratePaise} /> <span className="text-xs font-sans text-muted-foreground">/ g</span>
            </div>
          </div>
        </div>

        <div className="p-2 rounded-lg bg-gold/10 border border-gold/20 text-[11px] text-muted-foreground flex items-start gap-2">
          <Sparkles className="h-3.5 w-3.5 text-gold shrink-0 mt-0.5" />
          <span>{narration || defaultGoldNarration}</span>
        </div>
      </div>
    );
  }

  if (method === "cash") {
    return (
      <div
        data-testid="cash-payment-summary-card"
        className={`rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-background p-4 shadow-sm space-y-3 ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-emerald-500" />
            <span className="font-bold text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Payment Method: Cash
            </span>
          </div>
          <Badge
            variant="outline"
            className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-[10px] font-mono"
          >
            Actual Payment: Cash
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-2.5 rounded-lg bg-background/80 border border-emerald-500/20">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground">
              Cash Paid
            </div>
            <div className="text-lg font-mono font-bold text-foreground mt-0.5">
              <MoneyDisplay paise={cashPaidPaise} />
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-background/80 border border-border">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground">
              Gold Rate Used
            </div>
            <div className="text-base font-mono font-bold text-gold mt-0.5">
              <MoneyDisplay paise={ratePaise} /> <span className="text-xs font-sans text-muted-foreground">/ g</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-background/80 border border-emerald-500/20">
            <div className="text-[10px] uppercase font-semibold text-emerald-600 dark:text-emerald-400">
              Gold-First Equivalent
            </div>
            <div className="text-base font-mono font-bold text-emerald-500 mt-0.5">
              <GoldWeightDisplay mg={cashGoldEquivMg} kind="fine" />
            </div>
          </div>
        </div>

        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-muted-foreground flex items-start gap-2">
          <Sparkles className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
          <span>{narration || defaultCashNarration}</span>
        </div>
      </div>
    );
  }

  // Mixed Payment
  return (
    <div
      data-testid="mixed-payment-summary-card"
      className={`rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-background p-4 shadow-sm space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-amber-500" />
          <span className="font-bold text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Payment Method: Mixed (Gold + Cash)
          </span>
        </div>
        <Badge
          variant="outline"
          className="border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-[10px] font-mono"
        >
          Gold + Cash Settle
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs font-mono">
        <div className="p-2 rounded-lg bg-background/80 border border-gold/20">
          <div className="text-[10px] text-muted-foreground uppercase">Gold Paid</div>
          <div className="font-bold text-gold text-sm mt-0.5">
            <GoldWeightDisplay grams={goldPaidGrams} kind="gross" />
          </div>
        </div>

        <div className="p-2 rounded-lg bg-background/80 border border-emerald-500/20">
          <div className="text-[10px] text-muted-foreground uppercase">Cash Paid</div>
          <div className="font-bold text-foreground text-sm mt-0.5">
            <MoneyDisplay paise={cashPaidPaise} />
          </div>
        </div>

        <div className="p-2 rounded-lg bg-background/80 border border-border">
          <div className="text-[10px] text-muted-foreground uppercase">Cash Gold Equiv</div>
          <div className="font-bold text-emerald-500 text-sm mt-0.5">
            <GoldWeightDisplay mg={cashGoldEquivMg} kind="fine" />
          </div>
        </div>

        <div className="p-2 rounded-lg bg-background/80 border border-border">
          <div className="text-[10px] text-muted-foreground uppercase">Remaining Fine</div>
          <div className="font-bold text-sky-400 text-sm mt-0.5">
            <GoldWeightDisplay mg={remainingFineMg} kind="fine" />
          </div>
        </div>
      </div>

      <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-muted-foreground flex items-center justify-between">
        <span className="font-mono">Gold Rate Used: <MoneyDisplay paise={ratePaise} />/g</span>
        <span className="font-semibold text-emerald-500 font-mono">
          Total Fine Settled: {mgToGrams(fineGoldMg + cashGoldEquivMg)} g
        </span>
      </div>
    </div>
  );
}
