/**
 * AVS-70 — High-risk EXECUTE gate (payment + settlement)
 *
 * NEVER auto-posts money or invents ledger movements.
 * An EXECUTE stub may proceed past this gate only when:
 *   1) explicit human confirm (`isConfirmed === true`)
 *   2) all required fields are present
 * Even then, stubs do not commit the dual ledger.
 */

export type HighRiskExecuteKind = "payment" | "settlement";

export interface HighRiskGateInput {
  kind: HighRiskExecuteKind;
  isConfirmed?: unknown;
  fields: Record<string, unknown>;
  requiredKeys: string[];
}

export interface HighRiskGateRefuse {
  ok: false;
  committed: false;
  refused: true;
  reason: "NOT_CONFIRMED" | "MISSING_FIELDS";
  message: string;
  missingFields?: string[];
  approvalRequired: true;
}

export interface HighRiskGateAccept {
  ok: true;
  committed: false;
  refused: false;
  status: "confirm_accepted_no_auto_post";
  message: string;
  approvalRequired: true;
}

export type HighRiskGateResult = HighRiskGateRefuse | HighRiskGateAccept;

export const PAYMENT_EXECUTE_REQUIRED = ["partyId", "amountPaise", "paymentType"] as const;
export const SETTLEMENT_EXECUTE_REQUIRED = ["karigarId"] as const;

export function isExplicitHumanConfirm(value: unknown): boolean {
  return value === true;
}

export function listMissingRequiredFields(
  fields: Record<string, unknown>,
  requiredKeys: string[],
): string[] {
  return requiredKeys.filter((key) => {
    const v = fields[key];
    if (v === undefined || v === null) return true;
    if (typeof v === "string" && v.trim() === "") return true;
    if (typeof v === "number" && !Number.isFinite(v)) return true;
    return false;
  });
}

/** Settlement also needs a real metal or cash amount — never invent one. */
export function settlementHasAmount(fields: Record<string, unknown>): boolean {
  const gold = Number(fields.settlementGoldMg);
  const cash = Number(fields.settlementCashPaise);
  return (Number.isFinite(gold) && gold > 0) || (Number.isFinite(cash) && cash > 0);
}

export function gateHighRiskExecute(input: HighRiskGateInput): HighRiskGateResult {
  if (!isExplicitHumanConfirm(input.isConfirmed)) {
    return {
      ok: false,
      committed: false,
      refused: true,
      reason: "NOT_CONFIRMED",
      approvalRequired: true,
      message:
        input.kind === "payment"
          ? "AI_EXECUTE_PAYMENT refused: explicit human confirm (isConfirmed) is required. Never auto-posts."
          : "AI_EXECUTE_SETTLEMENT refused: explicit human confirm (isConfirmed) is required. Never auto-posts.",
    };
  }

  const missing = listMissingRequiredFields(input.fields, input.requiredKeys);
  if (input.kind === "settlement" && !settlementHasAmount(input.fields)) {
    missing.push("settlementGoldMg|settlementCashPaise");
  }
  if (missing.length > 0) {
    return {
      ok: false,
      committed: false,
      refused: true,
      reason: "MISSING_FIELDS",
      missingFields: missing,
      approvalRequired: true,
      message: `EXECUTE refused: missing required fields (${missing.join(", ")}). No money movement invented.`,
    };
  }

  return {
    ok: true,
    committed: false,
    refused: false,
    status: "confirm_accepted_no_auto_post",
    approvalRequired: true,
    message:
      input.kind === "payment"
        ? "Human confirm accepted. Payment is NOT auto-posted — open Accounts to commit the voucher. No ledger invented."
        : "Human confirm accepted. Settlement is NOT auto-posted — open Settlement to commit. No ledger invented.",
  };
}
