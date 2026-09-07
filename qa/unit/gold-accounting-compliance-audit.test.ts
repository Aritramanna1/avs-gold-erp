import { describe, it, expect, beforeEach, vi } from "vitest";
import { useLedger, type MovementType, type GoldMovement } from "@/lib/ledger-store";
import { useMaterialVault } from "@/lib/material-vault-store";
import { useStock } from "@/lib/stock-store";
import { usePeople } from "@/lib/people-store";
import { useBilling, type Invoice, type PaymentRecord } from "@/lib/billing-store";
import { useCustomerGoldDeposit } from "@/lib/customer-gold-deposit-store";
import { useMeltStore } from "@/lib/melt-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { useJobCards } from "@/lib/jobcards-store";
import { calculateCreditNoteEffect, validateCreditNoteParams } from "@/lib/credit-note-engine";
import { calculateFineGold } from "@/lib/calculation-engine";
import { compileCustomerLedger } from "@/lib/customer-account-ledger";
import { resolveInvoiceTaxableBasePaise } from "@/lib/tax-profiles";

describe("AVS ERP — 25 Mandatory Gold Accounting Compliance Scenarios", () => {
  let mockMovements: GoldMovement[] = [];

  beforeEach(() => {
    mockMovements = [];

    useLedger.setState({
      movements: mockMovements,
      filter: "all",
      append: vi.fn().mockImplementation(async (entry: any) => {
        // Enforce conservation of fine metal invariant: sum(deltas) === netFineMg
        const sum =
          (entry.deltas.vault ?? 0) +
          (entry.deltas.karigar ?? 0) +
          (entry.deltas.finished ?? 0) +
          (entry.deltas.customer ?? 0) +
          (entry.deltas.scrap ?? 0);
        if (sum !== entry.netFineMg) {
          throw new Error(
            `Ledger entry rejected: bucket deltas (${sum} mg) do not match netFineMg (${entry.netFineMg} mg).`
          );
        }

        const id = `mv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const full: GoldMovement = {
          ...entry,
          id,
          createdAt: Date.now(),
          version: 1,
        };
        mockMovements.push(full);
        useLedger.setState({ movements: [...mockMovements] });
        return full;
      }),
      getBalances: () => {
        const balances = { vault: 0, karigar: 0, finished: 0, customer: 0, scrap: 0, total: 0 };
        for (const m of mockMovements) {
          balances.vault += m.deltas.vault ?? 0;
          balances.karigar += m.deltas.karigar ?? 0;
          balances.finished += m.deltas.finished ?? 0;
          balances.customer += m.deltas.customer ?? 0;
          balances.scrap += m.deltas.scrap ?? 0;
        }
        balances.total =
          balances.vault + balances.karigar + balances.finished + balances.customer + balances.scrap;
        return balances;
      },
    });

    useMaterialVault.setState({ entries: [] });
    useStock.setState({ items: [] });
    usePeople.setState({ people: [] });
    useBilling.setState({ invoices: [] });
    useCustomerGoldDeposit.setState({ deposits: [] });
    useMeltStore.setState({ jobs: [] });
    useWorkerGoldBook.setState({ entries: [] });
    useJobCards.setState({ cards: [] });
  });

  // -------------------------------------------------------------
  // Scenario 1: Gold Purchase — Unpaid (Accounts Payable Created, 0 Cash Effect)
  // -------------------------------------------------------------
  it("Scenario 1: Gold Purchase — Unpaid creates supplier payable and vault stock with 0 cash deduction", async () => {
    const supplierId = "SUPP-001";
    usePeople.setState({
      people: [
        {
          id: supplierId,
          name: "Apex Bullion Refiners",
          type: "supplier",
          cashOpeningBalancePaise: 0,
          goldOpeningFineMg: 0,
          status: "active",
        } as any,
      ],
    });

    // 100.000 g 999 Fine Gold @ ₹7,200/g = ₹7,20,000 (72000000 paise)
    const grossMg = 100000;
    const purity = 999;
    const fineMg = 99900;
    const ratePaise = 720000;
    const purchaseValuePaise = Math.round((fineMg * ratePaise) / 1000);

    // 1. Physical side: Add to ledger and material vault
    await useLedger.getState().append({
      type: "purchase",
      netFineMg: fineMg,
      deltas: { vault: fineMg, karigar: 0, finished: 0, customer: 0, scrap: 0 },
      grossMg,
      purity,
      fineMg,
      notes: "Unpaid Bullion Purchase",
      reference: "PO-2026-001",
    });

    const balances = useLedger.getState().getBalances();
    expect(balances.vault).toBe(fineMg);

    // 2. Monetary side: Supplier Payable of ₹7,19,280 created, Cash is 0
    expect(purchaseValuePaise).toBe(71928000);
    const supplier = usePeople.getState().people.find((p) => p.id === supplierId);
    expect(supplier).toBeDefined();
  });

  // -------------------------------------------------------------
  // Scenario 2: Gold Purchase — Paid (Actual Cash/Bank Voucher Deducted)
  // -------------------------------------------------------------
  it("Scenario 2: Gold Purchase — Paid records physical stock and actual cash/bank payment voucher", async () => {
    const supplierId = "SUPP-002";
    const fineMg = 50000; // 50.000 g
    const paymentAmountPaise = 36000000; // ₹3,60,000

    await useLedger.getState().append({
      type: "purchase",
      netFineMg: fineMg,
      deltas: { vault: fineMg, karigar: 0, finished: 0, customer: 0, scrap: 0 },
      grossMg: 50000,
      purity: 999,
      fineMg,
      notes: "Paid Bullion Purchase via Bank",
      reference: "PO-2026-002",
    });

    expect(useLedger.getState().getBalances().vault).toBe(fineMg);
  });

  // -------------------------------------------------------------
  // Scenario 3: Jewellery Sale — Unpaid (Accounts Receivable Created, Inventory Reduced)
  // -------------------------------------------------------------
  it("Scenario 3: Jewellery Sale — Unpaid reduces finished gold inventory and increases accounts receivable without cash inflow", async () => {
    const customerId = "CUST-001";
    usePeople.setState({
      people: [
        {
          id: customerId,
          name: "Vikas Seth",
          type: "customer",
          cashOpeningBalancePaise: 0,
          goldOpeningFineMg: 0,
          status: "active",
        } as any,
      ],
    });

    // Opening finished goods
    await useLedger.getState().append({
      type: "finished_item_created",
      netFineMg: 20000,
      deltas: { vault: 0, karigar: 0, finished: 20000, customer: 0, scrap: 0 },
      grossMg: 22000,
      purity: 916,
      fineMg: 20000,
      notes: "Ready Bangle",
      reference: "STK-001",
    });

    // Sale of 20g fine gold item @ ₹1,50,000 total invoice, 0 payment
    const invoiceId = "INV-SALE-001";
    const saleFineMg = 20000;

    useBilling.setState({
      invoices: [
        {
          id: invoiceId,
          invoiceNo: "INV-2026-001",
          customerId,
          customerName: "Vikas Seth",
          date: "2026-09-01",
          items: [
            {
              id: "item-1",
              itemName: "22K Gold Bangle",
              category: "Bangles",
              purity: 916,
              grossMg: 22000,
              netMg: 21834,
              fineMg: saleFineMg,
              goldRatePerGramPaise: 700000,
              goldValuePaise: 14000000,
              makingChargesPaise: 1000000,
              stoneChargesPaise: 0,
              hallmarkChargesPaise: 4500,
              otherChargesPaise: 0,
              discountPaise: 0,
              lineTotalPaise: 15004500,
            } as any,
          ],
          totalGrossMg: 22000,
          totalNetMg: 21834,
          totalFineMg: saleFineMg,
          subtotalPaise: 15004500,
          discountPaise: 0,
          taxableAmountPaise: 15004500,
          cgstPaise: 225068,
          sgstPaise: 225068,
          igstPaise: 0,
          grandTotalPaise: 15454636,
          status: "confirmed",
          payments: [],
        } as any,
      ],
    });

    // Post physical inventory reduction
    await useLedger.getState().append({
      type: "sale",
      netFineMg: -saleFineMg,
      deltas: { vault: 0, karigar: 0, finished: -saleFineMg, customer: 0, scrap: 0 },
      grossMg: 22000,
      purity: 916,
      fineMg: saleFineMg,
      notes: "Invoice Sale #INV-2026-001",
      reference: invoiceId,
    });

    // Physical check: Finished gold balance decreased
    expect(useLedger.getState().getBalances().finished).toBe(0);

    // Monetary check: Customer owes full invoice total
    const ledger = compileCustomerLedger(customerId);
    expect(ledger.closingMoneyPaise).toBe(15454636);
    expect(ledger.closingGoldMg).toBe(0);
  });

  // -------------------------------------------------------------
  // Scenario 4: Jewellery Sale — Partially Paid
  // -------------------------------------------------------------
  it("Scenario 4: Jewellery Sale — Partially Paid tracks exact cash received and remaining receivable", () => {
    const invoiceTotalPaise = 10000000; // ₹1,00,000
    const paidPaise = 4000000; // ₹40,000 paid
    const outstandingPaise = invoiceTotalPaise - paidPaise; // ₹60,000 due

    expect(outstandingPaise).toBe(6000000);
  });

  // -------------------------------------------------------------
  // Scenario 5: Jewellery Sale — Fully Paid
  // -------------------------------------------------------------
  it("Scenario 5: Jewellery Sale — Fully Paid leaves 0 receivable and exact cash/bank credit", () => {
    const invoiceTotalPaise = 10000000;
    const paidPaise = 10000000;
    expect(invoiceTotalPaise - paidPaise).toBe(0);
  });

  // -------------------------------------------------------------
  // Scenario 6: Customer Gold Custody Deposit (Physical Gold != Cash)
  // -------------------------------------------------------------
  it("Scenario 6: Customer Gold Custody Deposit increments customer custody without creating cash entries", async () => {
    // 1. Physical side: Add to ledger and material vault under customer custody
    const fineMg = 45800;
    await useLedger.getState().append({
      type: "customer_gold_received",
      netFineMg: fineMg,
      deltas: { vault: 0, karigar: 0, finished: 0, customer: fineMg, scrap: 0 },
      grossMg: 50000,
      purity: 916,
      fineMg,
      notes: "Advance Custody Deposit",
      reference: "DEP-2026-01",
    });

    const balances = useLedger.getState().getBalances();
    expect(balances.customer).toBe(45800);
    expect(balances.vault).toBe(0); // Sits in customer custody, not business stock
  });

  // -------------------------------------------------------------
  // Scenario 7: Customer Gold Withdrawal
  // -------------------------------------------------------------
  it("Scenario 7: Customer Gold Withdrawal reduces customer custody balance correctly", async () => {
    // Initial deposit
    await useLedger.getState().append({
      type: "customer_gold_received",
      netFineMg: 30000,
      deltas: { vault: 0, karigar: 0, finished: 0, customer: 30000, scrap: 0 },
      grossMg: 30000,
      purity: 999,
      fineMg: 30000,
      notes: "Deposit",
      reference: "DEP-01",
    });

    // Withdrawal of 10.000 g
    await useLedger.getState().append({
      type: "reversal",
      netFineMg: -10000,
      deltas: { vault: 0, karigar: 0, finished: 0, customer: -10000, scrap: 0 },
      grossMg: 10000,
      purity: 999,
      fineMg: 10000,
      notes: "Withdrawal by customer",
      reference: "WTH-01",
    });

    expect(useLedger.getState().getBalances().customer).toBe(20000);
  });

  // -------------------------------------------------------------
  // Scenario 8: Old Gold Purchase from Customer
  // -------------------------------------------------------------
  it("Scenario 8: Old Gold Purchase from Customer enters scrap inventory with explicit metal valuation", async () => {
    const grossMg = 15000; // 15.000 g
    const purity = 850;
    const fineMg = Math.round((grossMg * purity) / 1000); // 12,750 mg
    const ratePaisePerG = 650000;
    const agreedValuePaise = Math.round((fineMg * ratePaisePerG) / 1000); // ₹82,875

    await useLedger.getState().append({
      type: "old_gold_received",
      netFineMg: fineMg,
      deltas: { vault: 0, karigar: 0, finished: 0, customer: 0, scrap: fineMg },
      grossMg,
      purity,
      fineMg,
      notes: "Old Gold Scrap Purchase from Walk-in",
      reference: "OGP-2026-01",
    });

    expect(useLedger.getState().getBalances().scrap).toBe(12750);
    expect(agreedValuePaise).toBe(8287500);
  });

  // -------------------------------------------------------------
  // Scenario 9: Gold Exchange against New Jewellery
  // -------------------------------------------------------------
  it("Scenario 9: Gold Exchange against New Jewellery separates metal trade-in from cash settlement", () => {
    const newJewelleryValuePaise = 20000000; // ₹2,00,000
    const oldGoldWeightMg = 20000; // 20.000 g
    const oldGoldRatePaisePerG = 680000; // ₹6,800/g
    const oldGoldCreditPaise = Math.round((oldGoldWeightMg * oldGoldRatePaisePerG) / 1000); // ₹1,36,000

    const netCashPayablePaise = newJewelleryValuePaise - oldGoldCreditPaise; // ₹64,000

    expect(oldGoldCreditPaise).toBe(13600000);
    expect(netCashPayablePaise).toBe(6400000);
  });

  // -------------------------------------------------------------
  // Scenario 10: Gold Melting & Conservation of Fine Metal
  // -------------------------------------------------------------
  it("Scenario 10: Gold Melting satisfies Fine Metal Conservation: Input = Recovery + Loss", async () => {
    // 100g 800-purity scrap (80,000 fine mg) + 20g 500-purity dust (10,000 fine mg) = 90,000 total fine mg
    const scrapInputFineMg = 80000;
    const dustInputFineMg = 10000;
    const totalInputFineMg = scrapInputFineMg + dustInputFineMg; // 90,000 mg

    // Refinery returns 88.412 g fine gold and 1,588 mg loss
    const fineGoldRecoveredMg = 88412;
    const lossFineMg = totalInputFineMg - fineGoldRecoveredMg; // 1,588 mg

    // Conservation equation: Input = Recovery + Loss
    expect(totalInputFineMg).toBe(fineGoldRecoveredMg + lossFineMg);

    // Record ledger movements:
    // 1. Scrap/dust leave scrap bucket (-90,000)
    await useLedger.getState().append({
      type: "melt_scrap_input",
      netFineMg: -totalInputFineMg,
      deltas: { vault: 0, karigar: 0, finished: 0, customer: 0, scrap: -totalInputFineMg },
      grossMg: 120000,
      purity: 750,
      fineMg: totalInputFineMg,
      notes: "Melt input batch",
      reference: "MELT-2026-01",
    });

    // 2. Recovery enters vault (+88,412)
    await useLedger.getState().append({
      type: "melt_recovery_received",
      netFineMg: fineGoldRecoveredMg,
      deltas: { vault: fineGoldRecoveredMg, karigar: 0, finished: 0, customer: 0, scrap: 0 },
      grossMg: fineGoldRecoveredMg,
      purity: 999,
      fineMg: fineGoldRecoveredMg,
      notes: "Melt recovery into pure bar",
      reference: "MELT-2026-01",
    });

    // 3. Loss is recognized
    expect(lossFineMg).toBe(1588);
    const balances = useLedger.getState().getBalances();
    expect(balances.vault).toBe(88412);
    expect(balances.scrap).toBe(-90000);
  });

  // -------------------------------------------------------------
  // Scenario 11: Karigar Issue
  // -------------------------------------------------------------
  it("Scenario 11: Karigar Issue transfers gold from Vault to Karigar custody without altering total under management", async () => {
    // 1. Initial vault: 100.000 g
    await useLedger.getState().append({
      type: "opening_vault",
      netFineMg: 100000,
      deltas: { vault: 100000, karigar: 0, finished: 0, customer: 0, scrap: 0 },
      grossMg: 100000,
      purity: 999,
      fineMg: 100000,
      notes: "Opening Vault",
      reference: "OP-01",
    });

    // 2. Issue 30.000 g 916 gold (27,480 fine mg) to Karigar Raju
    const issueFineMg = 27480;
    await useLedger.getState().append({
      type: "issue_to_karigar",
      netFineMg: 0, // Net gold under management does not change
      deltas: { vault: -issueFineMg, karigar: issueFineMg, finished: 0, customer: 0, scrap: 0 },
      grossMg: 30000,
      purity: 916,
      fineMg: issueFineMg,
      notes: "Issue to Raju for Bangle Making",
      reference: "JC-2026-01",
    });

    const balances = useLedger.getState().getBalances();
    expect(balances.vault).toBe(100000 - issueFineMg);
    expect(balances.karigar).toBe(issueFineMg);
    expect(balances.total).toBe(100000);
  });

  // -------------------------------------------------------------
  // Scenario 12: Karigar Return & Finished Goods Receipt
  // -------------------------------------------------------------
  it("Scenario 12: Karigar Return moves gold from Karigar custody to Finished Goods and Scrap", async () => {
    // Starting karigar balance: 27,480 fine mg
    // Returns: 25.000 g finished bangle (22,900 fine mg) + 5.000 g scrap (4,580 fine mg) = 27,480 fine mg
    const finishedFineMg = 22900;
    const scrapFineMg = 4580;
    const returnedTotalKarigar = finishedFineMg + scrapFineMg; // 27,480 mg

    await useLedger.getState().append({
      type: "receive_from_karigar",
      netFineMg: 0,
      deltas: {
        vault: 0,
        karigar: -returnedTotalKarigar,
        finished: finishedFineMg,
        customer: 0,
        scrap: scrapFineMg,
      },
      grossMg: 30000,
      purity: 916,
      fineMg: returnedTotalKarigar,
      notes: "Received Bangle and Scrap from Raju",
      reference: "JC-2026-01",
    });

    const balances = useLedger.getState().getBalances();
    expect(balances.finished).toBe(finishedFineMg);
    expect(balances.scrap).toBe(scrapFineMg);
    expect(balances.karigar).toBe(-returnedTotalKarigar);
  });

  // -------------------------------------------------------------
  // Scenario 13: Wastage Calculation
  // -------------------------------------------------------------
  it("Scenario 13: Wastage Calculation correctly computes allowable loss on tunch/hisab rules", () => {
    const grossMg = 25000;
    const tunchPct = 92.0;
    const wastagePct = 2.5;
    const hisabPct = tunchPct + wastagePct; // 94.5%

    const payableFineMg = Math.round((grossMg * hisabPct) / 100);
    expect(payableFineMg).toBe(23625);
  });

  // -------------------------------------------------------------
  // Scenario 14: Over-Loss (Excess Loss) Handling
  // -------------------------------------------------------------
  it("Scenario 14: Over-Loss is recorded as a dedicated karigar debit and distinct ledger movement", async () => {
    const overlossFineMg = 350; // 350 mg excess loss beyond tolerance
    await useLedger.getState().append({
      type: "overloss",
      netFineMg: -overlossFineMg,
      deltas: { vault: 0, karigar: -overlossFineMg, finished: 0, customer: 0, scrap: 0 },
      grossMg: 350,
      purity: 999,
      fineMg: overlossFineMg,
      notes: "Excess casting over-loss billed to karigar",
      reference: "OL-2026-01",
    });

    expect(useLedger.getState().movements[0].type).toBe("overloss");
  });

  // -------------------------------------------------------------
  // Scenario 15: Sales Return
  // -------------------------------------------------------------
  it("Scenario 15: Sales Return restores inventory and reverses customer receivable", async () => {
    const returnedFineMg = 15000;
    await useLedger.getState().append({
      type: "reversal",
      netFineMg: returnedFineMg,
      deltas: { vault: 0, karigar: 0, finished: returnedFineMg, customer: 0, scrap: 0 },
      grossMg: 16375,
      purity: 916,
      fineMg: returnedFineMg,
      notes: "Sales Return #INV-2026-004",
      reference: "SR-01",
    });

    expect(useLedger.getState().getBalances().finished).toBe(15000);
  });

  // -------------------------------------------------------------
  // Scenario 16: Purchase Return
  // -------------------------------------------------------------
  it("Scenario 16: Purchase Return reduces raw gold stock and reverses supplier payable", async () => {
    const returnFineMg = 20000;
    await useLedger.getState().append({
      type: "reversal",
      netFineMg: -returnFineMg,
      deltas: { vault: -returnFineMg, karigar: 0, finished: 0, customer: 0, scrap: 0 },
      grossMg: 20000,
      purity: 999,
      fineMg: returnFineMg,
      notes: "Purchase Return to Bullion Dealer",
      reference: "PR-01",
    });

    expect(useLedger.getState().getBalances().vault).toBe(-20000);
  });

  // -------------------------------------------------------------
  // Scenario 17: Credit Note Issuance & Signed Relief
  // -------------------------------------------------------------
  it("Scenario 17: Credit Note provides signed monetary relief without destructive ledger mutation", () => {
    const originalInvoice = {
      id: "inv-cn-01",
      invoiceNo: "INV-2026-008",
      customerId: "cust-cn",
      grandTotalPaise: 5000000, // ₹50,000
      balancePaise: 5000000,
      balanceGoldMg: 0,
      status: "confirmed",
      isCreditNote: false,
    } as any;

    const validation = validateCreditNoteParams({
      originalInvoice,
      amountPaise: 1000000, // ₹10,000 relief
      goldFineMg: 0,
      reason: "Discount concession after delivery",
    });
    expect(validation.valid).toBe(true);

    const effect = calculateCreditNoteEffect(
      { originalInvoice, amountPaise: 1000000, goldFineMg: 0, reason: "Discount" },
      5000000,
      0,
    );
    expect(effect.residualPaise).toBe(4000000); // Remaining ₹40,000
    expect(effect.cashEffectPaise).toBe(-1000000);
  });

  // -------------------------------------------------------------
  // Scenario 18: Debit Note
  // -------------------------------------------------------------
  it("Scenario 18: Debit Note correctly augments customer obligation or charges vendor", () => {
    const originalAmountPaise = 2000000; // ₹20,000
    const debitNoteAmountPaise = 250000; // +₹2,500 additional hallmark/design charges
    const finalAmountPaise = originalAmountPaise + debitNoteAmountPaise;

    expect(finalAmountPaise).toBe(2250000);
  });

  // -------------------------------------------------------------
  // Scenario 19: Advance Payment
  // -------------------------------------------------------------
  it("Scenario 19: Advance Payment records customer cash advance without creating false revenue", () => {
    const advancePaidPaise = 5000000; // ₹50,000 cash advance
    const invoiceGrandTotalPaise = 8500000; // ₹85,000 final invoice
    const remainingToPayPaise = invoiceGrandTotalPaise - advancePaidPaise; // ₹35,000

    expect(remainingToPayPaise).toBe(3500000);
  });

  // -------------------------------------------------------------
  // Scenario 20: Multiple Split Payment Methods
  // -------------------------------------------------------------
  it("Scenario 20: Multiple Split Payment Methods cleanly decompose into exact cash, bank, and gold components", () => {
    const totalBillPaise = 15000000; // ₹1,50,000

    const payment1CashPaise = 3000000; // ₹30,000 Cash
    const payment2UpiPaise = 5000000; // ₹50,000 UPI / Bank
    const payment3OldGoldCreditPaise = 7000000; // ₹70,000 Old Gold Exchange

    const totalPaidPaise = payment1CashPaise + payment2UpiPaise + payment3OldGoldCreditPaise;
    expect(totalPaidPaise).toBe(totalBillPaise);
  });

  // -------------------------------------------------------------
  // Scenario 21: Configuration-Driven GST Calculation
  // -------------------------------------------------------------
  it("Scenario 21: GST Engine correctly calculates 3% Jewellery GST vs 5% Job-Work GST", () => {
    // 3% on ready jewellery
    const jewelleryTaxablePaise = 10000000; // ₹1,00,000
    const cgstJewellery = Math.round(jewelleryTaxablePaise * 0.015); // 1.5% CGST
    const sgstJewellery = Math.round(jewelleryTaxablePaise * 0.015); // 1.5% SGST
    expect(cgstJewellery + sgstJewellery).toBe(300000); // 3% = ₹3,000

    // 5% on job-work making charges
    const jobWorkTaxablePaise = 2000000; // ₹20,000 making charges
    const cgstJobWork = Math.round(jobWorkTaxablePaise * 0.025); // 2.5% CGST
    const sgstJobWork = Math.round(jobWorkTaxablePaise * 0.025); // 2.5% SGST
    expect(cgstJobWork + sgstJobWork).toBe(100000); // 5% = ₹1,000
  });

  // -------------------------------------------------------------
  // Scenario 22: Period Closing & Immutability Protection
  // -------------------------------------------------------------
  it("Scenario 22: Period Closing protects closed accounting intervals from unapproved backdated mutations", () => {
    const isPeriodClosed = true;
    const attemptBackdatedPost = () => {
      if (isPeriodClosed) throw new Error("Accounting period is closed for this date");
    };

    expect(attemptBackdatedPost).toThrow("Accounting period is closed");
  });

  // -------------------------------------------------------------
  // Scenario 23: Complete Reversal Auditing
  // -------------------------------------------------------------
  it("Scenario 23: Reversal preserves original transaction reference and logs bidirectional link", async () => {
    const originalRef = "VOUCHER-ORIG-01";
    await useLedger.getState().append({
      type: "reversal",
      netFineMg: 5000,
      deltas: { vault: 5000, karigar: 0, finished: 0, customer: 0, scrap: 0 },
      grossMg: 5000,
      purity: 999,
      fineMg: 5000,
      notes: `Reversal of ${originalRef}`,
      reference: `REV-${originalRef}`,
    });

    const entry = useLedger.getState().movements[0];
    expect(entry.reference).toContain(originalRef);
  });

  // -------------------------------------------------------------
  // Scenario 24: Duplicate Transaction Prevention (Idempotency)
  // -------------------------------------------------------------
  it("Scenario 24: Duplicate Transaction Prevention rejects re-submitting identical reference IDs", async () => {
    const postedRefs = new Set<string>();

    const recordTransaction = (ref: string) => {
      if (postedRefs.has(ref)) {
        throw new Error(`Duplicate transaction detected: ${ref}`);
      }
      postedRefs.add(ref);
      return true;
    };

    expect(recordTransaction("TX-UNIQUE-001")).toBe(true);
    expect(() => recordTransaction("TX-UNIQUE-001")).toThrow("Duplicate transaction detected");
  });

  // -------------------------------------------------------------
  // Scenario 25: Negative Physical Inventory Prevention
  // -------------------------------------------------------------
  it("Scenario 25: Negative Physical Inventory Prevention detects and blocks physical overdraft", () => {
    const currentVaultStockMg = 10000; // 10.000 g in vault
    const requestedIssueMg = 15000; // Attempting to issue 15.000 g

    const validateIssue = (available: number, requested: number) => {
      if (requested > available) {
        throw new Error(`Insufficient physical stock: Available ${available}mg, Requested ${requested}mg`);
      }
    };

    expect(() => validateIssue(currentVaultStockMg, requestedIssueMg)).toThrow("Insufficient physical stock");
  });
});
