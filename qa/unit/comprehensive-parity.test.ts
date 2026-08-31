import { describe, it, expect } from 'vitest';
import { useSettings, getDefaultPurityPermille, MTJ_DEFAULT_PURITY_PERMILLE } from '../../src/lib/settings-store';
import { defaultGoldCalculationRules, computeFineGold, effectiveJewelleryCalcFeatures } from '../../src/lib/gold-calculation-rules';
import { fineGoldMg, gramsToMg, mgToGrams } from '../../src/lib/gold';
import { computeInvoiceTotals, computeItemTotals, type InvoiceItem } from '../../src/lib/billing-store';
import { compileCustomerLedger } from '../../src/lib/customer-account-ledger';
import { compileBullionLedger, compileCashFlow, compileDayWise, compileFineRojmel, compileDarRojmel, compileAccountBalances } from '../../src/lib/jewellery-books-reports';
import { compileCompanyCashLedger } from '../../src/lib/company-cash-ledger';

describe('Comprehensive Side-by-Side Parity Suite', () => {
  // Domain 1: MTJ Purity & Calculation Rules
  describe('1. Purity & Calculation Engine Parity', () => {
    it('MTJ default purity is 995 and fineness basis is 999', () => {
      expect(getDefaultPurityPermille()).toBe(995);
      expect(defaultGoldCalculationRules().finenessBasis).toBe(999);
      expect(defaultGoldCalculationRules().calculationMode).toBe('basic');
    });

    it('Karigar fine calculation is OFF by default', () => {
      const flags = effectiveJewelleryCalcFeatures(defaultGoldCalculationRules());
      expect(flags.fineCalculation).toBe(false);
      expect(flags.purityCalculation).toBe(false);
    });

    it('Calculates exact fine on 22K (916) and 18K (750)', () => {
      expect(fineGoldMg(10_000, 916, 999)).toBe(9169);
      expect(fineGoldMg(10_000, 750, 999)).toBe(7508);
      expect(fineGoldMg(10_000, 995, 999)).toBe(9960);
    });
  });

  // Domain 2: Billing & Total Computations
  describe('2. Billing Calculation Chain Parity', () => {
    it('Computes item totals and invoice totals for full_value (ready stock)', () => {
      const item: Omit<InvoiceItem, 'id' | 'goldValuePaise' | 'lineTotalPaise'> = {
        itemName: 'Gold Ring 22K',
        category: 'Ring',
        purity: 916,
        grossMg: 5000,
        netMg: 5000,
        fineMg: 4585,
        goldRatePerGramPaise: 700000, // ₹7000/g
        makingChargesPaise: 250000,   // ₹2500 making
        stoneChargesPaise: 0,
        hallmarkChargesPaise: 4500,   // ₹45 hallmark
        otherChargesPaise: 0,
        discountPaise: 0,
        chargeMode: 'full_value',
      };
      const itemTotals = computeItemTotals(item);
      expect(itemTotals.goldValuePaise).toBe(3209500); // 4585mg * 700000 / 1000 = 3209500
      expect(itemTotals.lineTotalPaise).toBe(3209500 + 250000 + 4500); // 3464000

      const invoiceTotals = computeInvoiceTotals([itemTotals as InvoiceItem], 'gst3', undefined, [
        { id: 'p1', ts: Date.now(), mode: 'cash', amountPaise: 1000000 },
      ]);
      expect(invoiceTotals.subtotalPaise).toBe(itemTotals.lineTotalPaise);
      expect(invoiceTotals.gstPaise).toBe(Math.round(invoiceTotals.taxablePaise * 0.03));
      expect(invoiceTotals.paidPaise).toBe(1000000);
      expect(invoiceTotals.balancePaise).toBe(invoiceTotals.grandTotalPaise - 1000000);
    });

    it('Computes item totals for job_work (labour only, customer metal)', () => {
      const item: Omit<InvoiceItem, 'id' | 'goldValuePaise' | 'lineTotalPaise'> = {
        itemName: 'Bangle Making',
        category: 'Bangle',
        purity: 916,
        grossMg: 10000,
        netMg: 10000,
        fineMg: 9169,
        goldRatePerGramPaise: 700000,
        makingChargesPaise: 500000, // ₹5000 making
        stoneChargesPaise: 0,
        hallmarkChargesPaise: 4500,
        otherChargesPaise: 0,
        discountPaise: 0,
        chargeMode: 'job_work',
      };
      const itemTotals = computeItemTotals(item);
      expect(itemTotals.goldValuePaise).toBe(6418300); // reference only
      expect(itemTotals.lineTotalPaise).toBe(500000 + 4500); // 504500 billed to customer
    });
  });

  // Domain 3: Ledger & Book Compilers
  describe('3. Report & Ledger Compiler Parity', () => {
    const range = { from: '2026-01-01', to: '2026-12-31' };

    it('Compiles Fine Rojmel without error', () => {
      const result = compileFineRojmel(range);
      expect(result).toHaveProperty('rows');
      expect(result).toHaveProperty('openingMg');
      expect(result).toHaveProperty('closingMg');
    });

    it('Compiles Dar Rojmel (Cash) without error', () => {
      const result = compileDarRojmel(range);
      expect(result).toHaveProperty('rows');
      expect(result).toHaveProperty('openingPaise');
      expect(result).toHaveProperty('closingPaise');
    });

    it('Compiles Bullion Ledger without error', () => {
      const result = compileBullionLedger(range);
      expect(Array.isArray(result)).toBe(true);
    });

    it('Compiles Cash Flow without error', () => {
      const result = compileCashFlow(range);
      expect(result).toHaveProperty('rows');
      expect(result).toHaveProperty('openingPaise');
      expect(result).toHaveProperty('closingPaise');
    });

    it('Compiles Day-Wise Summary without error', () => {
      const result = compileDayWise(range);
      expect(Array.isArray(result)).toBe(true);
    });

    it('Compiles Account Balances without error', () => {
      const result = compileAccountBalances('1');
      expect(Array.isArray(result)).toBe(true);
    });

    it('Compiles Company Cash Ledger without error', () => {
      const result = compileCompanyCashLedger({ dateRange: range });
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
