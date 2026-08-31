/**
 * MTJ ERP — Trade Credit Note Engine
 *
 * Pure functional helpers for validating and building credit note payloads.
 *
 * CRITICAL SEPARATION: This file is for TRADE credit notes (issued to a
 * customer/party when a billing obligation needs to be corrected). It has
 * NOTHING to do with `credit-service.ts`, which is the ORNEXA platform
 * credit wallet for AI/WhatsApp usage billing.
 *
 * AUTHORITATIVE SEQUENCE:
 *   1. Original invoice is IMMUTABLE — never modified.
 *   2. A credit note invoice record is created (isCreditNote: true).
 *   3. A corrective ledger entry reduces the obligation.
 *   4. Original invoice is patched ONLY with linkage metadata.
 *   5. Audit trail is recorded.
 *
 * The signed closing balance on the party ledger is the source of truth.
 * A partial credit leaves the balance partially negative; full credit → 0.
 * Balances must NEVER be force-zeroed — the sign is a required business signal.
 */

import type { Invoice } from "@/lib/billing-store";

// ── TYPES ──────────────────────────────────────────────────────────────────

export interface CreditNoteParams {
  originalInvoice: Invoice;
  reason: string;
  /** Cash value of the credit in paise. Omit for gold-only credits. */
  amountPaise?: number;
  /** Gold fine weight of the credit in mg. Omit for cash-only credits. */
  goldFineMg?: number;
  issuedByUserId?: string;
  issuedByName?: string;
}

export interface CreditNoteValidationResult {
  valid: boolean;
  errors: string[];
}

export interface CreditNoteEffect {
  /**
   * The net paise change to the party's cash obligation.
   * Negative = obligation decreases (firm owes less / credits party).
   */
  cashEffectPaise: number;
  /**
   * The net mg change to the party's gold obligation.
   * Negative = gold obligation decreases.
   */
  goldEffectMg: number;
  /**
   * Whether this credit note fully closes the original obligation.
   */
  isFullCredit: boolean;
  /**
   * Remaining obligation after credit in paise.
   * Negative = firm now owes party (over-credit).
   */
  residualPaise: number;
  /**
   * Remaining gold obligation after credit in mg.
   */
  residualGoldMg: number;
}

// ── VALIDATION ─────────────────────────────────────────────────────────────

/**
 * Validates credit note parameters before persistence.
 * Returns { valid: true } when all checks pass,
 * { valid: false, errors: [...] } listing every violation otherwise.
 */
export function validateCreditNoteParams(params: CreditNoteParams): CreditNoteValidationResult {
  const errors: string[] = [];

  if (!params.originalInvoice) {
    errors.push("Original invoice is required.");
  } else {
    if (params.originalInvoice.isCreditNote) {
      errors.push("Cannot issue a credit note against another credit note.");
    }
    if (params.originalInvoice.status === "cancelled") {
      errors.push("Cannot issue a credit note against a cancelled invoice.");
    }
    if (params.originalInvoice.creditNoteId) {
      errors.push(
        `A credit note (${params.originalInvoice.creditNoteNo}) has already been issued against this invoice. ` +
          "Cancel the existing credit note first if this is an error.",
      );
    }
  }

  if (!params.reason?.trim()) {
    errors.push("A reason / narration is required for the credit note.");
  }

  if ((params.amountPaise ?? 0) === 0 && (params.goldFineMg ?? 0) === 0) {
    errors.push("At least one of amountPaise or goldFineMg must be non-zero.");
  }

  if ((params.amountPaise ?? 0) < 0) {
    errors.push("Credit amount cannot be negative.");
  }

  if ((params.goldFineMg ?? 0) < 0) {
    errors.push("Credit gold weight cannot be negative.");
  }

  return { valid: errors.length === 0, errors };
}

// ── EFFECT CALCULATION ─────────────────────────────────────────────────────

/**
 * Calculates the net ledger effect of issuing this credit note against
 * the party's current signed balances.
 *
 * Signed balance rules:
 *   Cash:  Positive (Dr) = party owes firm.
 *          Negative (Cr) = firm owes party.
 *   Gold:  Positive (Dr) = party owes firm metal.
 *          Negative (Cr) = firm holds excess metal for party.
 *
 * These values are NEVER clamped — the sign is a required business signal.
 */
export function calculateCreditNoteEffect(
  params: CreditNoteParams,
  currentSignedCashBalancePaise: number,
  currentSignedGoldBalanceMg: number,
): CreditNoteEffect {
  const cashCredit = params.amountPaise ?? 0;
  const goldCredit = params.goldFineMg ?? 0;

  const residualPaise = currentSignedCashBalancePaise - cashCredit;
  const residualGoldMg = currentSignedGoldBalanceMg - goldCredit;

  const isFullCredit =
    cashCredit >= currentSignedCashBalancePaise && goldCredit >= currentSignedGoldBalanceMg;

  return {
    cashEffectPaise: -cashCredit,
    goldEffectMg: -goldCredit,
    isFullCredit,
    residualPaise,
    residualGoldMg,
  };
}

// ── SIGNED BALANCE DISPLAY HELPERS ────────────────────────────────────────
//
// These helpers enforce the signed-balance display rule enterprise-wide:
//   Positive (Dr) = party owes firm  → normal text, "(Dr)" suffix
//   Negative (Cr) = firm owes party  → red text, "(Cr)" suffix
//   NEVER use Math.abs() without the direction label.
//
// Import these from wherever you format ledger balance cells.

/**
 * Formats a signed cash closing balance (paise) for UI display.
 */
export function formatSignedBalance(
  paise: number,
  options: { currency?: boolean } = {},
): { text: string; direction: "Dr" | "Cr" | "Nil"; isNegative: boolean } {
  if (paise === 0) return { text: "Nil", direction: "Nil", isNegative: false };

  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const paisePart = String(abs % 100).padStart(2, "0");
  const formatted = options.currency
    ? `\u20b9${rupees.toLocaleString("en-IN")}.${paisePart}`
    : `${rupees.toLocaleString("en-IN")}.${paisePart}`;

  if (paise > 0) {
    return { text: `${formatted} (Dr)`, direction: "Dr", isNegative: false };
  } else {
    return { text: `${formatted} (Cr)`, direction: "Cr", isNegative: true };
  }
}

/**
 * Formats a signed gold balance (mg) for UI display.
 * Negative = Cr (firm holds metal for party); Positive = Dr (party owes metal).
 */
export function formatSignedGoldBalance(
  mg: number,
  options: { unit?: "g" | "mg" } = {},
): { text: string; direction: "Dr" | "Cr" | "Nil"; isNegative: boolean } {
  if (mg === 0) return { text: "Nil", direction: "Nil", isNegative: false };

  const abs = Math.abs(mg);
  const unit = options.unit ?? "g";
  const formatted = unit === "g" ? `${(abs / 1000).toFixed(3)} g` : `${abs} mg`;

  if (mg > 0) {
    return { text: `${formatted} (Dr)`, direction: "Dr", isNegative: false };
  } else {
    return { text: `${formatted} (Cr)`, direction: "Cr", isNegative: true };
  }
}
