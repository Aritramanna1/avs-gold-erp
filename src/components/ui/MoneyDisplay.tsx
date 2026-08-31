import React from "react";
import { paiseToRupees } from "@/lib/billing-store";

interface MoneyDisplayProps {
  paise?: number | null;
  rupees?: number | string | null;
  className?: string;
  symbolClassName?: string;
  showSign?: boolean;
  showCrDr?: boolean;
  neutralZero?: boolean;
}

/**
 * Standardized MTJ ERP Money Display Primitive
 * Renders prominent, vertically aligned, proportional ₹ symbol with robust spacing
 * and readable positive/negative/credit/debit indicators without field overflow or collision.
 */
export function MoneyDisplay({
  paise,
  rupees,
  className = "",
  symbolClassName = "",
  showSign = false,
  showCrDr = false,
  neutralZero = false,
}: MoneyDisplayProps) {
  let paiseValue = 0;
  if (paise !== undefined && paise !== null) {
    paiseValue = Math.round(Number(paise) || 0);
  } else if (rupees !== undefined && rupees !== null) {
    paiseValue = Math.round(Number(rupees) * 100 || 0);
  }

  const isZero = paiseValue === 0;
  const isNegative = paiseValue < 0;
  const absPaise = Math.abs(paiseValue);
  const formattedAmount = paiseToRupees(absPaise);

  let colorClass = "";
  if (!neutralZero || !isZero) {
    if (isNegative) colorClass = "text-emerald-500 font-semibold"; // In credit/advance
    else if (paiseValue > 0) colorClass = "text-foreground font-semibold";
  }

  return (
    <span
      data-testid="money-display"
      className={`inline-flex items-baseline font-mono whitespace-nowrap tracking-tight ${colorClass} ${className}`}
    >
      {isNegative && showSign && <span className="mr-0.5 font-bold text-destructive">-</span>}
      <span
        className={`mr-1 font-sans text-[0.88em] font-bold text-muted-foreground/80 select-none ${symbolClassName}`}
      >
        ₹
      </span>
      <span className="tabular-nums">{formattedAmount}</span>
      {showCrDr && !isZero && (
        <span
          className={`ml-1 text-[0.75em] font-sans font-bold uppercase tracking-wider px-1 py-0.2 rounded ${
            isNegative
              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
              : "bg-rose-500/10 text-destructive border border-rose-500/20"
          }`}
        >
          {isNegative ? "Cr" : "Dr"}
        </span>
      )}
    </span>
  );
}
