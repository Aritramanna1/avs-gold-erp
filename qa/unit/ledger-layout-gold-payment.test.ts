import { describe, it, expect, vi, beforeEach } from "vitest";
import { useBilling, type Invoice } from "@/lib/billing-store";
import { useLedger } from "@/lib/ledger-store";
import { compileCustomerLedger } from "@/lib/customer-account-ledger";
import { paiseToRupees, rupeesToPaise } from "@/lib/billing-store";
import { fineGoldMg, mgToGrams, gramsToMg } from "@/lib/gold";
import { renderToString } from "react-dom/server";
import React from "react";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { GoldWeightDisplay } from "@/components/ui/GoldWeightDisplay";
import { CashGoldPaymentSummary } from "@/components/billing/CashGoldPaymentSummary";

// Mock base repository to operate in-memory for unit tests
vi.mock("@/lib/repositories/base-repository", () => ({
  createRepository: (tableName: string) => {
    const memory = new Map<string, any>();
    return {
      get: vi.fn(async (id: string) => memory.get(id) ?? null),
      list: vi.fn(async () => Array.from(memory.values())),
      save: vi.fn(async (entity: any) => {
        memory.set(entity.id, entity);
        return entity;
      }),
      delete: vi.fn(async (id: string) => {
        memory.delete(id);
      }),
    };
  },
}));

vi.mock("@/lib/sequence-manager", () => ({
  getNextSequenceNumber: vi.fn(async (docType: string) => `${docType.toUpperCase()}-001`),
}));

vi.mock("@/lib/email-service", () => ({
  sendGenericEmail: vi.fn().mockImplementation(async () => ({
    success: true,
    emailId: `mock_${Date.now()}`,
  })),
}));

describe("MTJ ERP — Ledger Layout & Gold Payment Presentation Test Suite", () => {
  beforeEach(() => {
    useBilling.setState({ invoices: [], payments: [] });
    useLedger.setState({ entries: [] });
  });

  describe("1. Three Canonical Payment Cases", () => {
    it("CASE A — GOLD: Gold paid 10.000g hides cash field and sets truthful narration & gold balance", async () => {
      const goldRatePaise = 750000; // ₹7,500/g
      const goldGrams = 10.0;
      const fineMg = 9160; // 10g @ 91.6% purity

      const summaryHtml = renderToString(
        React.createElement(CashGoldPaymentSummary, {
          method: "gold",
          goldPaidGrams: goldGrams,
          fineGoldMg: fineMg,
          purity: 916,
          goldRatePerGramPaise: goldRatePaise,
        }),
      );

      // Verify Gold-first elements
      expect(summaryHtml).toContain("Payment Method: Gold");
      expect(summaryHtml).toContain("PAID IN GOLD");
      expect(summaryHtml).toContain("10.000");
      expect(summaryHtml).toContain("9.160");
      // Must NOT display confusing cash paid as actual cash
      expect(summaryHtml).not.toContain("Payment Method: Cash");
      expect(summaryHtml).toContain("Payment done in Gold");
    });

    it("CASE B — CASH: Cash paid ₹10,000 shows cash payment + calculated gold equivalent at rate", () => {
      const cashPaidPaise = 1000000; // ₹10,000
      const goldRatePaise = 1000000; // ₹10,000/g
      const goldEquivMg = Math.round((cashPaidPaise * 1000) / goldRatePaise); // 1,000 mg = 1.000 g

      const summaryHtml = renderToString(
        React.createElement(CashGoldPaymentSummary, {
          method: "cash",
          cashPaidPaise: cashPaidPaise,
          goldRatePerGramPaise: goldRatePaise,
          cashGoldEquivMg: goldEquivMg,
        }),
      );

      expect(summaryHtml).toContain("Payment Method: Cash");
      expect(summaryHtml).toContain("10,000.00");
      expect(summaryHtml).toContain("Gold Rate Used");
      expect(summaryHtml).toContain("1.000");
      expect(summaryHtml).toContain("Gold-First Equivalent");
    });

    it("CASE C — MIXED: 11g Invoice - 10g Gold Paid auto-calculates 1g Cash at transaction-time rate", () => {
      const goldPaidGrams = 10.0;
      const goldRatePaise = 750000; // ₹7,500/g
      const remainingFineMg = 1000; // 1.000 g
      const cashPaidPaise = Math.round((remainingFineMg * goldRatePaise) / 1000); // ₹7,500

      const summaryHtml = renderToString(
        React.createElement(CashGoldPaymentSummary, {
          method: "mixed",
          goldPaidGrams: goldPaidGrams,
          fineGoldMg: 9160,
          purity: 916,
          cashPaidPaise: cashPaidPaise,
          goldRatePerGramPaise: goldRatePaise,
          cashGoldEquivMg: remainingFineMg,
          remainingFineMg: 0,
        }),
      );

      expect(summaryHtml).toContain("Payment Method: Mixed");
      expect(summaryHtml).toContain("10.000");
      expect(summaryHtml).toContain("7,500.00");
      expect(summaryHtml).toContain("1.000");
      expect(summaryHtml).toContain("Total Fine Settled");
    });
  });

  describe("2. MoneyDisplay & Rupee Symbol Typography", () => {
    it("renders proportional ₹ symbol separated from amount without clipping", () => {
      const html = renderToString(
        React.createElement(MoneyDisplay, {
          paise: 2500000,
        }),
      );

      expect(html).toContain("₹");
      expect(html).toContain("25,000.00");
      expect(html).toContain("tabular-nums");
    });

    it("renders negative amounts and Credit / Debit badges clearly", () => {
      const html = renderToString(
        React.createElement(MoneyDisplay, {
          paise: -2500000,
          showSign: true,
          showCrDr: true,
        }),
      );

      expect(html).toContain("-");
      expect(html).toContain("25,000.00");
      expect(html).toContain("Cr");
    });
  });

  describe("3. GoldWeightDisplay Component", () => {
    it("renders 3-decimal gold weight with units and fine badge", () => {
      const html = renderToString(
        React.createElement(GoldWeightDisplay, {
          mg: 12345,
          kind: "fine",
        }),
      );

      expect(html).toContain("12.345");
      expect(html).toContain("fine");
    });

    it("renders credit/debit balance indicators without clipping", () => {
      const html = renderToString(
        React.createElement(GoldWeightDisplay, {
          mg: -11350,
          showSign: true,
          showCrDr: true,
        }),
      );

      expect(html).toContain("-");
      expect(html).toContain("11.350");
      expect(html).toContain("Cr");
    });
  });
});
