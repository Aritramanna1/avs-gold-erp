import { describe, it, expect, beforeEach } from "vitest";
import { useBilling } from "../../src/lib/billing-store";
import { useExpensesStore } from "../../src/lib/expenses-store";
import { compileTotalProfitReport } from "../../src/lib/total-profit-engine";

describe("MTJ ERP — Profit/Loss + Business Expense + Owner Drawings System", () => {
  beforeEach(() => {
    // Reset Zustand stores
    useBilling.setState({ invoices: [] });
    useExpensesStore.setState({
      people: [
        {
          id: "p-owner",
          fullName: "Aritra Manna",
          relationship: "owner",
          active: true,
          compensationMode: "drawing",
        },
        {
          id: "p-home",
          fullName: "Home / Family Pool",
          relationship: "home",
          active: true,
          compensationMode: "drawing",
        },
      ],
      withdrawals: [],
      expenses: [],
    });
  });

  it("calculates Business Gross Margin and deducts ONLY Business Expenses for Operating Profit", () => {
    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);

    // 1. Seed Customer Invoice with 3.000% Gross Work Earning (Making Charges)
    // 50.000 g pure gold at ₹11,000/g = ₹5,50,000 gold value
    // Making charges = ₹16,500 (3.000%)
    useBilling.setState({
      invoices: [
        {
          id: "inv-test-1",
          invoiceNo: "INV-2026-001",
          customerName: "Jeweller Partner A",
          customerPhone: "9800000000",
          customerId: "c1",
          branchId: "MAIN",
          createdAt: new Date(now).toISOString(),
          status: "confirmed",
          items: [
            {
              id: "item-1",
              itemName: "22K Gold Bangles",
              category: "Bangles",
              purity: "22k",
              grossMg: 50000,
              netMg: 50000,
              fineMg: 45800,
              goldRatePerGramPaise: 1100000,
              goldValuePaise: 50380000,
              makingChargesPaise: 1650000, // 3%
              stoneChargesPaise: 0,
              otherChargesPaise: 0,
              discountPaise: 0,
              lineTotalPaise: 52030000,
            },
          ],
          subtotalPaise: 52030000,
          cgstPaise: 0,
          sgstPaise: 0,
          grandTotalPaise: 52030000,
          paidPaise: 52030000,
          balancePaise: 0,
          payments: [],
          gst: "none",
        } as any,
      ],
    });

    // 2. Add Business Operating Expenses (Rent, Electricity, Tea/Snacks = ₹5,000)
    useExpensesStore.setState({
      ...useExpensesStore.getState(),
      expenses: [
        {
          id: "exp-rent",
          date: today,
          type: "business",
          category: "Shop Rent",
          businessPurpose: "Monthly showroom rent",
          amountPaise: 500000, // ₹5,000
          paymentMode: "bank",
          branchId: "MAIN",
        },
      ],
    });

    // 3. Record Home / Owner Personal Drawing = ₹10,000
    useExpensesStore.setState({
      ...useExpensesStore.getState(),
      withdrawals: [
        {
          id: "wd-home-1",
          date: today,
          personId: "p-home",
          personName: "Home / Family Pool",
          relationship: "home",
          amountPaise: 1000000, // ₹10,000
          paymentMode: "cash",
          purpose: "Family grocery and domestic expenses",
          branchId: "MAIN",
          goldRatePerGramPaise: 1100000,
          goldEquivalentMg: 909,
        },
      ],
    });

    const report = compileTotalProfitReport(now - 86400000, now + 86400000);

    // Assertions:
    // Revenue making = ₹16,500
    // Direct Karigar/Carrier Cost = ₹8,250 (1.5%)
    // Gross Business Margin = ₹16,500 - ₹8,250 = ₹8,250
    // Business Operating Expense = ₹5,000
    // Net Operating Profit = Gross Margin (or Gross Profit - Overheads)
    expect(report.grossRevenuePaise).toBe(52030000);
    expect(report.makingChargesPaise).toBe(1650000);
    expect(report.directWorkCostPaise).toBe(825000); // 1.5% Karigar cost
    expect(report.businessExpensesPaise).toBe(500000); // ₹5,000 rent

    // Net Business Profit must NOT be reduced by personal ₹10,000 withdrawal!
    expect(report.netBusinessProfitPaise).toBe(report.grossProfitPaise - 500000);
    expect(report.netBusinessProfitPaise).toBeGreaterThan(0);
    expect(report.isLoss).toBe(false);

    // Owner Drawings are strictly tracked under Equity
    expect(report.ownerDrawingsPaise).toBe(1000000); // ₹10,000
    expect(report.netEquityImpactPaise).toBe(report.netBusinessProfitPaise - 1000000);

    // Gold Equivalents are calculated and preserved
    expect(report.ownerDrawingsFineMg).toBeGreaterThan(0);
    expect(report.businessExpensesFineMg).toBeGreaterThan(0);
  });

  it("correctly handles Family Member Master with Drawing vs Salary treatment", async () => {
    const store = useExpensesStore.getState();
    const person = await store.addPerson({
      fullName: "Pooja Manna",
      relationship: "spouse",
      role: "Family Member",
      compensationMode: "drawing",
      active: true,
    });

    expect(person.id).toBeDefined();
    expect(person.fullName).toBe("Pooja Manna");
    expect(person.relationship).toBe("spouse");
    expect(person.compensationMode).toBe("drawing");
  });
});
