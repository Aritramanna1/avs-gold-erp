import React from "react";
import { mgToGrams } from "@/lib/gold";

interface GoldWeightDisplayProps {
  mg?: number | null;
  grams?: number | string | null;
  className?: string;
  unitClassName?: string;
  purity?: number | null;
  kind?: "fine" | "gross" | "net" | null;
  showSign?: boolean;
  showCrDr?: boolean;
  neutralZero?: boolean;
}

/**
 * Standardized MTJ ERP Gold Weight Display Primitive
 * Renders consistent 3-decimal gold weights with prominent units and
 * overflow-protected layout across screen and print layouts.
 */
export function GoldWeightDisplay({
  mg,
  grams,
  className = "",
  unitClassName = "",
  purity,
  kind,
  showSign = false,
  showCrDr = false,
  neutralZero = false,
}: GoldWeightDisplayProps) {
  let mgValue = 0;
  if (mg !== undefined && mg !== null) {
    mgValue = Math.round(Number(mg) || 0);
  } else if (grams !== undefined && grams !== null) {
    mgValue = Math.round(Number(grams) * 1000 || 0);
  }

  const isZero = mgValue === 0;
  const isNegative = mgValue < 0;
  const absMg = Math.abs(mgValue);
  const formattedGrams = mgToGrams(absMg);

  let colorClass = "text-gold font-bold";
  if (!neutralZero || !isZero) {
    if (isNegative) colorClass = "text-rose-500 font-bold";
  }

  return (
    <span
      data-testid="gold-weight-display"
      className={`inline-flex items-baseline font-mono whitespace-nowrap tracking-tight ${colorClass} ${className}`}
    >
      {isNegative && showSign && <span className="mr-0.5 font-bold text-destructive">-</span>}
      <span className="tabular-nums">{formattedGrams}</span>
      <span
        className={`ml-1 font-sans text-[0.82em] font-medium text-muted-foreground ${unitClassName}`}
      >
        g{kind ? ` ${kind}` : ""}
      </span>
      {purity && (
        <span className="ml-1 text-[0.75em] font-mono px-1 py-0.2 rounded bg-gold/10 text-gold border border-gold/20">
          {purity}
        </span>
      )}
      {showCrDr && !isZero && (
        <span
          className={`ml-1 text-[0.75em] font-sans font-bold uppercase tracking-wider px-1 py-0.2 rounded ${
            isNegative
              ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
              : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
          }`}
        >
          {isNegative ? "Cr" : "Dr"}
        </span>
      )}
    </span>
  );
}
