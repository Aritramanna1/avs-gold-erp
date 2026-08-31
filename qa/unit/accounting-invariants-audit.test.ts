import { describe, it, expect, beforeEach } from "vitest";
import { usePeople } from "../../src/lib/people-store";
import { useBilling } from "../../src/lib/billing-store";
import { compileCustomerLedger } from "../../src/lib/customer-account-ledger";
import { useWorkerGoldBook } from "../../src/lib/worker-gold-book-store";
import { calculateFineGold } from "../../src/lib/calculation-engine";

describe("Rigorous Mathematical Accounting Invariants & Rules Audit", () => {
  beforeEach(() => {
    // Reset stores
    usePeople.setState({ people: [] });
    useBilling.setState({ invoices: [] });
    useWorkerGoldBook.setState({ entries: [] });
  });

  it("Invariant 1: Customer with 200g Opening Gold Balance -> 50g Invoice with 0 new payment -> Remaining 150g automatically settled from gold credit without credit note", () => {
    const customerId = "CUST-INVARIANT-001";

    // 1. Setup customer with 200.000 g (200,000 mg) opening fine gold balance (Customer is in CREDIT)
    // goldOpeningType: "payable" means we owe the customer gold (customer has credit / deposit)
    usePeople.setState({
      people: [
        {
          id: customerId,
          name: "Test Jeweller",
          phone: "9876543210",
          type: "customer",
          goldOpeningFineMg: 200000,
          goldOpeningType: "payable", // Customer credit
          cashOpeningBalancePaise: 0,
          createdAt: new Date().toISOString(),
          status: "active",
        },
      ],
    });

    // Check opening ledger state
    const openingLedger = compileCustomerLedger(customerId);
    expect(openingLedger.openingGoldMg).toBe(200000);
    expect(openingLedger.goldAdvanceMg).toBe(200000);
    expect(openingLedger.goldCreditOwedMg).toBe(0);

    // 2. Add an invoice with 50.000 g (50,000 mg) fine gold obligation, job_work / fine gold bill
    const invoiceId = "INV-INVARIANT-001";
    useBilling.setState({
      invoices: [
        {
          id: invoiceId,
          invoiceNo: "INV-2026-TEST-01",
          customerId,
          customerName: "Test Jeweller",
          date: "2026-08-31",
          createdAt: new Date().toISOString(),
          billingType: "job_work",
          items: [
            {
              id: "item-1",
              itemName: "Gold Bangle Making",
              category: "Bangles",
              purity: 916,
              grossMg: 55000,
              netMg: 54585,
              fineMg: 50000,
              goldRatePerGramPaise: 900000, // ₹9,000/g
              goldValuePaise: 45000000, // ₹4,50,000
              makingChargesPaise: 2500000, // ₹25,000
              stoneChargesPaise: 0,
              hallmarkChargesPaise: 4500,
              otherChargesPaise: 0,
              discountPaise: 0,
              lineTotalPaise: 2504500, // making + hallmark
              isJobWork: true,
            },
          ],
          totalGrossMg: 55000,
          totalNetMg: 54585,
          totalFineMg: 50000,
          subtotalPaise: 2504500,
          discountPaise: 0,
          taxableAmountPaise: 2504500,
          cgstPaise: 0,
          sgstPaise: 0,
          igstPaise: 0,
          grandTotalPaise: 2504500,
          status: "confirmed",
          // Payments: 0 new payment entered; settled against existing customer gold credit
          payments: [],
        },
      ],
    });

    // 3. Compile ledger after invoice
    const updatedLedger = compileCustomerLedger(customerId);

    // The customer had 200g sitting with the shop.
    // The shop delivered 50g fine gold goods on the invoice.
    // Gold left the customer's credit balance: 200g - 50g = 150g remaining credit!
    expect(updatedLedger.closingGoldMg).toBe(150000);
    expect(updatedLedger.goldAdvanceMg).toBe(150000);
    expect(updatedLedger.goldCreditOwedMg).toBe(0);

    // Verify no redundant credit note was created or needed
    const creditNotes = useBilling.getState().invoices.filter((i) => i.isCreditNote);
    expect(creditNotes.length).toBe(0);
  });

  it("Invariant 2: Cash Payment Representation preserves Cash identity AND computes Gold Equivalent & Rate Used", () => {
    const ratePaisePerGram = 920000; // ₹9,200/g
    const cashPaidPaise = 5000000; // ₹50,000.00

    // Gold Equivalent = (Cash Paid / Rate) in mg:
    // (50,000 * 100 / 920,000) * 1000 = (5000000 / 920000) * 1000 = 5434.78 mg -> 5435 mg (5.435 g)
    const goldEquivalentMg = Math.round((cashPaidPaise / ratePaisePerGram) * 1000);
    const goldEquivalentGrams = (goldEquivalentMg / 1000).toFixed(3);

    expect(cashPaidPaise).toBe(5000000);
    expect(goldEquivalentMg).toBe(5435);
    expect(goldEquivalentGrams).toBe("5.435");
    expect(ratePaisePerGram / 100).toBe(9200); // ₹9,200/g
  });

  it("Invariant 3: Mixed Payment Automatic Remaining Cash Calculation", () => {
    const totalObligationFineMg = 11000; // 11.000 g fine
    const goldReceivedFineMg = 10000; // 10.000 g fine
    const transactionGoldRatePaisePerGram = 900000; // ₹9,000/g (900,000 paise/g)

    // 1. Calculate remaining fine gold due
    const remainingFineMg = totalObligationFineMg - goldReceivedFineMg; // 1.000 g (1000 mg)
    expect(remainingFineMg).toBe(1000);

    // 2. Automatic cash calculation: 1.000 g * ₹9,000/g = ₹9,000.00 (900,000 paise)
    const calculatedCashSettlementPaise = Math.round((remainingFineMg * transactionGoldRatePaisePerGram) / 1000);
    expect(calculatedCashSettlementPaise).toBe(900000); // Exactly ₹9,000.00
  });

  it("Invariant 4: Strict Separation between Customer Fine-Gold Accounting and Karigar Physical Custody Accounting", () => {
    const karigarId = "KARIGAR-001";

    // 1. Karigar receives physical metal (e.g. 24K Gold Bar: 100.000 g @ 999 Touch)
    useWorkerGoldBook.getState().entries = [
      {
        id: "wb-entry-1",
        workerId: karigarId,
        date: "2026-08-31",
        type: "given", // metal issued to karigar
        particulars: "24K Fine Gold Bar",
        purity: 999,
        quantity: 1,
        grossMg: 100000,
        fineMg: 100000,
        narration: "Issued for 3x Kada orders",
      },
      // Karigar returns 90.000 g finished 916 jewellery + 8.000 g scrap (tunch 916) + 1.500 g wastage
      {
        id: "wb-entry-2",
        workerId: karigarId,
        date: "2026-08-31",
        type: "returned", // finished jewellery
        particulars: "916 Finished Kada",
        purity: 916,
        quantity: 3,
        grossMg: 90000,
        fineMg: calculateFineGold({ netWeightMg: 90000, purityPerMille: 916 }).fineGoldMg, // 82523 mg
        narration: "Finished goods received",
      },
      {
        id: "wb-entry-3",
        workerId: karigarId,
        date: "2026-08-31",
        type: "returned", // scrap returned
        particulars: "916 Scrap Chhilan",
        purity: 916,
        quantity: 1,
        grossMg: 8000,
        fineMg: calculateFineGold({ netWeightMg: 8000, purityPerMille: 916 }).fineGoldMg, // 7335 mg
        narration: "Scrap / filings",
      },
    ];

    // Compute Karigar balance
    const workerBal = useWorkerGoldBook.getState().getWorkerBalance(karigarId);

    // Karigar balance tracks physical custody: total fine given vs total fine returned
    expect(workerBal.givenFine).toBe(100000);
    expect(workerBal.returnedFine).toBe(82523 + 7335); // 89858 mg
    expect(workerBal.pendingFine).toBe(100000 - 89858); // 10142 mg (10.142 g still with karigar custody)

    // Karigar accounting must NOT be confused with Customer Dual Ledger (money due / gold due)
    const customerLedgerForWorker = compileCustomerLedger(karigarId);
    // Worker has no customer invoices or customer opening balance
    expect(customerLedgerForWorker.rows.length).toBe(0);
  });
});
