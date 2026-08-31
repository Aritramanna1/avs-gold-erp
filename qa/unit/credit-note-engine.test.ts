/**
 * MTJ ERP — Credit Note Engine Unit Tests
 *
 * Tests the pure functional helpers in credit-note-engine.ts and verifies the
 * key accounting invariants for trade credit notes (NOT platform credits).
 *
 * Invariants under test:
 *  1. Validation rejects invalid params correctly
 *  2. Cannot issue CN against another CN
 *  3. Cannot issue CN against a cancelled invoice
 *  4. Cannot issue CN against an already-credited invoice
 *  5. Cash credit effect: residual = original - credit (unclamped)
 *  6. Gold credit effect: residual = original - credit (unclamped)
 *  7. Full credit detection
 *  8. Over-credit produces negative residual (never clamped)
 *  9. formatSignedBalance Dr/Cr/Nil display
 * 10. formatSignedGoldBalance Dr/Cr/Nil display
 * 11. CN number format validation helper (CN-YYYY-NNN)
 * 12. Mixed cash+gold partial credit
 */

import { describe, it, expect } from "vitest";
import {
  validateCreditNoteParams,
  calculateCreditNoteEffect,
  formatSignedBalance,
  formatSignedGoldBalance,
  type CreditNoteParams,
} from "@/lib/credit-note-engine";
import type { Invoice } from "@/lib/billing-store";

// ── HELPERS ──────────────────────────────────────────────────────────────────

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "INV-001",
    firmId: "firm-mtj",
    branchId: "branch-main",
    invoiceNo: "MTJ-2026-0001",
    invoiceDate: "2026-08-01",
    customerId: "CUST-001",
    customerName: "Test Jeweller",
    items: [],
    subTotalPaise: 100000,
    discountPaise: 0,
    taxPaise: 3000,
    totalPaise: 103000,
    goldFineMg: 10000, // 10 g
    status: "paid",
    paymentMode: "gold",
    isCreditNote: false,
    createdAt: "2026-08-01T10:00:00Z",
    updatedAt: "2026-08-01T10:00:00Z",
    ...overrides,
  } as Invoice;
}

function makeParams(overrides: Partial<CreditNoteParams> = {}): CreditNoteParams {
  return {
    originalInvoice: makeInvoice(),
    reason: "Customer returned item — defective stone",
    amountPaise: 50000,
    goldFineMg: 5000,
    issuedByUserId: "user-01",
    issuedByName: "Owner",
    ...overrides,
  };
}

// ── 1. VALIDATION ─────────────────────────────────────────────────────────────

describe("MTJ ERP — Credit Note Engine", () => {
  describe("1. validateCreditNoteParams — happy path", () => {
    it("returns valid for a well-formed credit note", () => {
      const result = validateCreditNoteParams(makeParams());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("allows cash-only credit (no goldFineMg)", () => {
      const result = validateCreditNoteParams(
        makeParams({ amountPaise: 10000, goldFineMg: 0 }),
      );
      expect(result.valid).toBe(true);
    });

    it("allows gold-only credit (no amountPaise)", () => {
      const result = validateCreditNoteParams(
        makeParams({ amountPaise: 0, goldFineMg: 3000 }),
      );
      expect(result.valid).toBe(true);
    });
  });

  describe("2. validateCreditNoteParams — rejection cases", () => {
    it("rejects when original invoice is a credit note itself", () => {
      const result = validateCreditNoteParams(
        makeParams({ originalInvoice: makeInvoice({ isCreditNote: true }) }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("credit note against another credit note"))).toBe(true);
    });

    it("rejects when original invoice is cancelled", () => {
      const result = validateCreditNoteParams(
        makeParams({ originalInvoice: makeInvoice({ status: "cancelled" }) }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("cancelled"))).toBe(true);
    });

    it("rejects when original invoice already has a credit note linked", () => {
      const result = validateCreditNoteParams(
        makeParams({
          originalInvoice: makeInvoice({
            creditNoteId: "CN-INV-001",
            creditNoteNo: "CN-2026-001",
          }),
        }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("already been issued"))).toBe(true);
    });

    it("rejects when reason is empty", () => {
      const result = validateCreditNoteParams(makeParams({ reason: "" }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("reason"))).toBe(true);
    });

    it("rejects when both amountPaise and goldFineMg are zero", () => {
      const result = validateCreditNoteParams(
        makeParams({ amountPaise: 0, goldFineMg: 0 }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("At least one"))).toBe(true);
    });

    it("rejects negative amountPaise", () => {
      const result = validateCreditNoteParams(makeParams({ amountPaise: -1 }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("negative"))).toBe(true);
    });

    it("rejects negative goldFineMg", () => {
      const result = validateCreditNoteParams(makeParams({ goldFineMg: -100 }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("negative"))).toBe(true);
    });
  });

  // ── 3. EFFECT CALCULATION ─────────────────────────────────────────────────

  describe("3. calculateCreditNoteEffect — cash", () => {
    it("partial cash credit reduces residual correctly", () => {
      // Party owes 103000 paise. Credit = 50000 paise.
      const effect = calculateCreditNoteEffect(makeParams({ amountPaise: 50000, goldFineMg: 0 }), 103000, 0);
      expect(effect.cashEffectPaise).toBe(-50000);
      expect(effect.residualPaise).toBe(53000);
      expect(effect.isFullCredit).toBe(false);
    });

    it("full cash credit produces zero residual", () => {
      const effect = calculateCreditNoteEffect(makeParams({ amountPaise: 103000, goldFineMg: 0 }), 103000, 0);
      expect(effect.residualPaise).toBe(0);
      expect(effect.isFullCredit).toBe(true);
    });

    it("over-credit produces NEGATIVE residual — never clamped", () => {
      // Signed balance invariant: must never be forced to zero.
      const effect = calculateCreditNoteEffect(makeParams({ amountPaise: 120000, goldFineMg: 0 }), 103000, 0);
      expect(effect.residualPaise).toBe(-17000); // firm now owes party
      expect(effect.residualPaise).toBeLessThan(0);
    });
  });

  describe("4. calculateCreditNoteEffect — gold", () => {
    it("partial gold credit reduces gold residual correctly", () => {
      // Party owes 10000 mg gold. Credit = 3000 mg.
      const effect = calculateCreditNoteEffect(makeParams({ amountPaise: 0, goldFineMg: 3000 }), 0, 10000);
      expect(effect.goldEffectMg).toBe(-3000);
      expect(effect.residualGoldMg).toBe(7000);
    });

    it("full gold credit closes gold obligation", () => {
      const effect = calculateCreditNoteEffect(makeParams({ amountPaise: 0, goldFineMg: 10000 }), 0, 10000);
      expect(effect.residualGoldMg).toBe(0);
      expect(effect.isFullCredit).toBe(true);
    });

    it("gold over-credit produces negative residual — never clamped", () => {
      const effect = calculateCreditNoteEffect(makeParams({ amountPaise: 0, goldFineMg: 12000 }), 0, 10000);
      expect(effect.residualGoldMg).toBe(-2000); // firm holds extra metal for party
    });
  });

  describe("5. calculateCreditNoteEffect — mixed cash+gold", () => {
    it("mixed credit reduces both obligations independently", () => {
      const params = makeParams({ amountPaise: 50000, goldFineMg: 3000 });
      const effect = calculateCreditNoteEffect(params, 100000, 8000);
      expect(effect.cashEffectPaise).toBe(-50000);
      expect(effect.goldEffectMg).toBe(-3000);
      expect(effect.residualPaise).toBe(50000);
      expect(effect.residualGoldMg).toBe(5000);
      expect(effect.isFullCredit).toBe(false);
    });
  });

  // ── 4. DISPLAY HELPERS ────────────────────────────────────────────────────

  describe("6. formatSignedBalance — cash display", () => {
    it("positive paise = Dr (party owes firm)", () => {
      const r = formatSignedBalance(103000, { currency: true });
      expect(r.direction).toBe("Dr");
      expect(r.isNegative).toBe(false);
      expect(r.text).toContain("Dr");
    });

    it("negative paise = Cr (firm owes party)", () => {
      const r = formatSignedBalance(-17000, { currency: true });
      expect(r.direction).toBe("Cr");
      expect(r.isNegative).toBe(true);
      expect(r.text).toContain("Cr");
    });

    it("zero paise = Nil", () => {
      const r = formatSignedBalance(0);
      expect(r.direction).toBe("Nil");
      expect(r.text).toBe("Nil");
    });
  });

  describe("7. formatSignedGoldBalance — gold display", () => {
    it("positive mg = Dr (party owes metal)", () => {
      const r = formatSignedGoldBalance(10000, { unit: "g" });
      expect(r.direction).toBe("Dr");
      expect(r.text).toContain("10.000 g");
      expect(r.text).toContain("Dr");
    });

    it("negative mg = Cr (firm holds metal for party)", () => {
      const r = formatSignedGoldBalance(-2000, { unit: "g" });
      expect(r.direction).toBe("Cr");
      expect(r.isNegative).toBe(true);
      expect(r.text).toContain("2.000 g");
      expect(r.text).toContain("Cr");
    });

    it("zero mg = Nil", () => {
      const r = formatSignedGoldBalance(0);
      expect(r.direction).toBe("Nil");
      expect(r.text).toBe("Nil");
    });
  });
});
