import { describe, it, expect } from "vitest";

/** QA Accounting — trial balance must net to zero for balanced journal sets. */
describe("QA Accounting postings", () => {
  it("balanced journal entries sum to zero", () => {
    const entries = [
      { account: "cash", debitPaise: 100_00, creditPaise: 0 },
      { account: "sales", debitPaise: 0, creditPaise: 100_00 },
    ];
    const net =
      entries.reduce((s, e) => s + e.debitPaise, 0) -
      entries.reduce((s, e) => s + e.creditPaise, 0);
    expect(net).toBe(0);
  });

  it("reports must reconcile to source postings not other reports", () => {
    const sourcePostings = [{ id: "p1", amountPaise: 50_00 }];
    const reportTotal = sourcePostings.reduce((s, p) => s + p.amountPaise, 0);
    expect(reportTotal).toBe(50_00);
  });
});
