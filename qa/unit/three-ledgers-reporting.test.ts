import { describe, it, expect, beforeEach } from "vitest";
import { usePeople } from "@/lib/people-store";
import { useOrders } from "@/lib/orders-store";
import { useBilling } from "@/lib/billing-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { useWorkers } from "@/lib/workers-store";
import { compilePartyLedger } from "@/lib/customer-account-ledger";

describe("AVS ERP — Three Ledgers (Cash, Gold, Mixed) & Worker Salary Accounting Test", () => {
  beforeEach(() => {
    usePeople.setState({ people: [] });
    useOrders.setState({ orders: [] });
    useBilling.setState({ invoices: [] });
    useGoldSettlement.setState({ settlements: [] });
    useWorkerGoldBook.setState({ entries: [] });
    useWorkers.setState({
      attendance: [],
      stays: [],
      rules: [],
      withdrawals: [],
      loans: [],
      advances: [],
      allowances: [],
      goldAdvances: [],
      wastageReturns: [],
      settlements: [],
    });
  });

  it("compiles Customer Cash, Gold, and Mixed ledgers with dual non-clamping balances", () => {
    const customer = {
      id: "cust-001",
      name: "Radha Jewellers",
      fullName: "Radha Jewellers",
      type: "customer" as const,
      active: true,
      roles: ["customer", "jeweller"],
      goldOpeningFineMg: 10000, // 10g opening gold advance sitting in shop
      goldOpeningType: "payable" as const,
      cashOpeningBalancePaise: 500000, // ₹5,000 opening debit (receivable)
      cashOpeningType: "receivable" as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    usePeople.setState({ people: [customer as any] });

    // 1. Direct Gold Deposit (Jama)
    useGoldSettlement.setState({
      settlements: [
        {
          id: "set-001",
          party_id: customer.id,
          party_type: "customer",
          settlement_type: "gold_received",
          settlement_date: "2026-03-01T10:00:00Z",
          gross_mg: 20000,
          net_mg: 20000,
          purity: 999,
          gold_entry_mg: 20000,
          notes: "Fine gold bar deposited",
          created_at: Date.now(),
        },
        {
          id: "set-002",
          party_id: customer.id,
          party_type: "customer",
          settlement_type: "cash_received_against_gold",
          settlement_date: "2026-03-02T11:00:00Z",
          amount_paise: 100000, // ₹1,000 paid by customer
          rate_per_gram_paise: 700000,
          cash_entry_paise: 100000,
          notes: "Cash payment received",
          created_at: Date.now(),
        },
      ] as any,
    });

    const ledger = compilePartyLedger(customer.id);
    expect(ledger.rows.length).toBe(4); // Opening cash, opening gold, gold deposit, cash payment

    // Verify Opening
    expect(ledger.openingGoldMg).toBe(10000);
    expect(ledger.openingMoneyPaise).toBe(500000);

    // Verify Totals
    expect(ledger.totalGoldInMg).toBe(30000); // 10,000 opening + 20,000 deposit
    expect(ledger.totalCreditPaise).toBe(100000);

    // Verify Closing Balances
    // Gold: 10000 (advance) + 20000 (deposit) = 30000 mg
    expect(ledger.closingGoldMg).toBe(30000);
    // Cash: 500000 (debit due) - 100000 (credit paid) = 400000 paise (₹4,000 due)
    expect(ledger.closingMoneyPaise).toBe(400000);
  });

  it("compiles Worker/Employee Salary Advances, Loans, Allowances, and Metal issues into Worker Ledgers", () => {
    const worker = {
      id: "wrk-001",
      name: "Gopal Karigar",
      fullName: "Gopal Karigar",
      type: "karigar" as const,
      active: true,
      roles: ["karigar", "worker"],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    usePeople.setState({ people: [worker as any] });

    // 1. Issue fine metal to worker
    useWorkerGoldBook.setState({
      entries: [
        {
          id: "wgb-101",
          workerId: worker.id,
          type: "given",
          date: "2026-03-01",
          grossMg: 50000,
          netMg: 50000,
          fineMg: 45800, // 916 purity fine
          purity: 916,
          particulars: "Issued 22K gold for bangle work",
          createdAt: 1000,
        },
        {
          id: "wgb-102",
          workerId: worker.id,
          type: "return",
          date: "2026-03-03",
          grossMg: 48000,
          netMg: 48000,
          fineMg: 43968,
          purity: 916,
          particulars: "Returned finished bangles",
          createdAt: 3000,
        },
      ] as any,
    });

    // 2. Worker Financial Events: Salary Advance + Food Allowance
    useWorkers.setState({
      advances: [
        {
          id: "adv-001",
          workerId: worker.id,
          date: "2026-03-02",
          amountPaise: 250000, // ₹2,500 advance
          mode: "cash",
          notes: "Holi festival salary advance",
          createdAt: 2000,
        },
      ],
      allowances: [
        {
          id: "al-001",
          workerId: worker.id,
          date: "2026-03-04",
          amountPaise: 50000, // ₹500 food allowance
          kind: "weekly_food",
          mode: "cash",
          notes: "Weekly food pocket money",
          createdAt: 4000,
        },
      ],
      attendance: [],
      stays: [],
      rules: [],
      withdrawals: [],
      loans: [],
      goldAdvances: [],
      wastageReturns: [],
      settlements: [],
    });

    const ledger = compilePartyLedger(worker.id);
    expect(ledger.rows.length).toBe(4);

    // Verify chronological ordering
    expect(ledger.rows[0].type).toBe("Gold Issued (Karigar)");
    expect(ledger.rows[1].type).toBe("Salary Advance");
    expect(ledger.rows[2].type).toBe("Gold Returned (Karigar)");
    expect(ledger.rows[3].type).toBe("Worker Allowance");

    // Verify Gold balance: 0 - 45800 (given out) + 43968 (returned) = -1832 mg (Karigar owes 1.832g)
    expect(ledger.closingGoldMg).toBe(-1832);

    // Verify Cash balance: +250000 (advance debited) + 50000 (allowance debited) = 300000 paise (Worker owes ₹3,000)
    expect(ledger.closingMoneyPaise).toBe(300000);
  });
});
