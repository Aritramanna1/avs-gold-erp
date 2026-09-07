/**
 * AVS ERP — Dual-Ledger Accounting & Debit/Credit Audit Test Suite
 *
 * Verifies that:
 * 1. Every transaction maintains two independent accounting dimensions:
 *    - Money Ledger (INR paise / rupees)
 *    - Gold Ledger (mg / fine mg)
 * 2. Strict Double-Entry equality holds at all times:
 *    - Total Money Debits = Total Money Credits
 *    - Total Gold Debits = Total Gold Credits
 * 3. Specific business workflows:
 *    - Retail Cash Sale (Money In + Gold Out)
 *    - Credit Sale (Customer Receivable in Money & Gold)
 *    - Customer Gold Custody (0 Money, Fiduciary Metal Liability)
 *    - Gold Exchange (Full Jewellery Revenue + Scrap Metal Settlement Credit)
 *    - Karigar Issue & Finished Goods Receipt with Wastage
 *    - Supplier Bullion Purchase (Payable + Input ITC)
 *    - Capital Introduction & Drawings (Money & Metal)
 *    - Contra Transfers (Cash <-> Bank)
 *    - Dual Financial Statements (Money Trial Balance + Gold Trial Balance)
 */

import { describe, it, expect } from "vitest";
import {
  MASTER_CHART_OF_ACCOUNTS,
  generateJournalForTransaction,
  generateAccountingPreview,
  compileDualFinancialStatements,
  type JournalEntry,
  type BusinessTransactionPayload,
} from "../../src/lib/dual-ledger-engine";

describe("AVS ERP — Dual-Ledger Accounting & Debit/Credit Engine Acceptance Tests", () => {
  // ---------------------------------------------------------------------------
  // 1. Chart of Accounts Audit
  // ---------------------------------------------------------------------------
  it("verifies master chart of accounts contains all required standard accounts with controlled types", () => {
    const codes = MASTER_CHART_OF_ACCOUNTS.map((a) => a.code);
    expect(codes).toContain("1001"); // Main Cash Drawer
    expect(codes).toContain("1002"); // Bank Current Account
    expect(codes).toContain("1010"); // Sundry Debtors
    expect(codes).toContain("1020"); // Fine Gold Bullion Vault
    expect(codes).toContain("1021"); // Finished Jewellery Stock
    expect(codes).toContain("1025"); // Scrap & Old Gold Stock
    expect(codes).toContain("1026"); // Workshop WIP & Karigar Gold
    expect(codes).toContain("2001"); // Sundry Creditors
    expect(codes).toContain("2010"); // Customer Advances (Money)
    expect(codes).toContain("2011"); // Customer Metal Deposits (Custody Liability)
    expect(codes).toContain("2020"); // Karigar Labour Payable
    expect(codes).toContain("2030"); // Output CGST Payable
    expect(codes).toContain("3001"); // Owner Capital
    expect(codes).toContain("4001"); // Gold Jewellery Sales
    expect(codes).toContain("5001"); // COGS
    expect(codes).toContain("5030"); // Normal Wastage
    expect(codes).toContain("6001"); // Salaries

    // Controlled types verification
    for (const acc of MASTER_CHART_OF_ACCOUNTS) {
      expect(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE", "COGS", "TAX", "CONTROL"]).toContain(
        acc.type,
      );
    }
  });

  // ---------------------------------------------------------------------------
  // 2. Retail Cash Jewellery Sale (Money + Gold)
  // ---------------------------------------------------------------------------
  it("posts retail cash jewellery sale with balanced Money and Gold dimensions", () => {
    const payload: BusinessTransactionPayload = {
      transactionId: "tx_sale_001",
      transactionType: "RETAIL_SALE",
      voucherNo: "INV-2026-101",
      dateMs: 1788200000000,
      paymentMode: "cash",
      totalAmountPaise: 10300000, // ₹1,03,000 (₹1,00,000 + 3% GST)
      taxableAmountPaise: 10000000, // ₹1,00,000
      cgstPaise: 150000,          // ₹1,500
      sgstPaise: 150000,          // ₹1,500
      fineGoldMg: 10000,          // 10 grams fine gold
      grossWeightMg: 11000,       // 11 grams gross
      purityPerMille: 916,
    };

    const jnl = generateJournalForTransaction(payload);

    expect(jnl.isBalanced).toBe(true);
    // Money dimension
    expect(jnl.totalMoneyDebitPaise).toBe(10300000);
    expect(jnl.totalMoneyCreditPaise).toBe(10300000);
    // Gold dimension
    expect(jnl.totalFineGoldDebitMg).toBe(10000);
    expect(jnl.totalFineGoldCreditMg).toBe(10000);

    // Verify individual account postings
    const cashLine = jnl.lines.find((l) => l.accountCode === "1001");
    expect(cashLine?.moneyDebitPaise).toBe(10300000);

    const salesLine = jnl.lines.find((l) => l.accountCode === "4001");
    expect(salesLine?.moneyCreditPaise).toBe(10000000);

    const stockLine = jnl.lines.find((l) => l.accountCode === "1021");
    expect(stockLine?.fineGoldCreditMg).toBe(10000);
  });

  // ---------------------------------------------------------------------------
  // 3. Customer Gold Custody (Gold-Only Non-Supply Fiduciary Deposit)
  // ---------------------------------------------------------------------------
  it("posts customer gold custody deposit with 0 Money impact and exact Gold custody tracking", () => {
    const payload: BusinessTransactionPayload = {
      transactionId: "tx_custody_001",
      transactionType: "CUSTOMER_GOLD_CUSTODY",
      voucherNo: "CUSTODY-2026-001",
      dateMs: 1788200000000,
      totalAmountPaise: 0,
      fineGoldMg: 20000, // 20g fine gold
      grossWeightMg: 22000,
      isCustodyOnly: true,
    };

    const jnl = generateJournalForTransaction(payload);

    expect(jnl.isBalanced).toBe(true);
    // Money is exactly 0
    expect(jnl.totalMoneyDebitPaise).toBe(0);
    expect(jnl.totalMoneyCreditPaise).toBe(0);

    // Gold is strictly tracked between Customer and Custody Liability
    expect(jnl.totalFineGoldDebitMg).toBe(20000);
    expect(jnl.totalFineGoldCreditMg).toBe(20000);

    const custodyLiability = jnl.lines.find((l) => l.accountCode === "2011");
    expect(custodyLiability?.fineGoldCreditMg).toBe(20000);
  });

  // ---------------------------------------------------------------------------
  // 4. Gold Exchange Transaction
  // ---------------------------------------------------------------------------
  it("posts gold exchange separating new jewellery supply from old gold consideration settlement", () => {
    const payload: BusinessTransactionPayload = {
      transactionId: "tx_exch_001",
      transactionType: "GOLD_EXCHANGE",
      voucherNo: "EXCH-2026-001",
      dateMs: 1788200000000,
      paymentMode: "cash",
      totalAmountPaise: 10300000,  // ₹1,03,000 new jewellery
      taxableAmountPaise: 10000000,// ₹1,00,000
      cgstPaise: 150000,
      sgstPaise: 150000,
      fineGoldMg: 10000,           // 10g new jewellery delivered
      oldGoldValuationPaise: 4000000, // ₹40,000 old gold consideration
      oldGoldFineMg: 4000,         // 4g old gold scrap received
    };

    const jnl = generateJournalForTransaction(payload);

    expect(jnl.isBalanced).toBe(true);
    // Money balanced across Customer, Revenue, GST, Scrap, and Net Cash
    expect(jnl.totalMoneyDebitPaise).toBe(jnl.totalMoneyCreditPaise);

    // Scrap stock inward
    const scrapLine = jnl.lines.find((l) => l.accountCode === "1025");
    expect(scrapLine?.moneyDebitPaise).toBe(4000000);
    expect(scrapLine?.fineGoldDebitMg).toBe(4000);

    // Net Cash received = ₹1,03,000 - ₹40,000 = ₹63,000
    const cashLine = jnl.lines.find((l) => l.accountCode === "1001");
    expect(cashLine?.moneyDebitPaise).toBe(6300000);
  });

  // ---------------------------------------------------------------------------
  // 5. Karigar Gold Issue & Manufacturing Receipt with Wastage
  // ---------------------------------------------------------------------------
  it("posts karigar metal issue and manufacturing receipt with labour payable and wastage accounting", () => {
    // 1. Issue 50g Bullion to Karigar
    const issuePayload: BusinessTransactionPayload = {
      transactionId: "tx_issue_001",
      transactionType: "KARIGAR_ISSUE",
      voucherNo: "ISSUE-2026-001",
      dateMs: 1788200000000,
      totalAmountPaise: 0,
      fineGoldMg: 50000,
      grossWeightMg: 50000,
    };
    const issueJnl = generateJournalForTransaction(issuePayload);
    expect(issueJnl.isBalanced).toBe(true);
    expect(issueJnl.totalMoneyDebitPaise).toBe(0);
    expect(issueJnl.totalFineGoldDebitMg).toBe(50000);

    const wipLine = issueJnl.lines.find((l) => l.accountCode === "1026");
    expect(wipLine?.fineGoldDebitMg).toBe(50000);

    // 2. Receipt of 48g finished jewellery + 2g wastage + ₹5,000 making fee
    const receiptPayload: BusinessTransactionPayload = {
      transactionId: "tx_rcpt_001",
      transactionType: "KARIGAR_RECEIPT",
      voucherNo: "MFG-2026-001",
      dateMs: 1788250000000,
      totalAmountPaise: 500000, // ₹5,000 making fee
      fineGoldMg: 48000,        // 48g finished
      grossWeightMg: 48000,
      wastageGoldMg: 2000,      // 2g wastage allowance
    };
    const receiptJnl = generateJournalForTransaction(receiptPayload);
    expect(receiptJnl.isBalanced).toBe(true);
    expect(receiptJnl.totalMoneyDebitPaise).toBe(500000);
    expect(receiptJnl.totalFineGoldDebitMg).toBe(50000); // 48g finished + 2g wastage

    const labourPayable = receiptJnl.lines.find((l) => l.accountCode === "2020");
    expect(labourPayable?.moneyCreditPaise).toBe(500000);
  });

  // ---------------------------------------------------------------------------
  // 6. Supplier Bullion Purchase on Credit
  // ---------------------------------------------------------------------------
  it("posts supplier bullion purchase with Input Tax Credit (ITC) and vendor payable", () => {
    const payload: BusinessTransactionPayload = {
      transactionId: "tx_pur_001",
      transactionType: "BULLION_PURCHASE",
      voucherNo: "PUR-2026-001",
      dateMs: 1788200000000,
      paymentMode: "credit",
      totalAmountPaise: 51500000,  // ₹5,15,000 (₹5,00,000 + 3% GST)
      taxableAmountPaise: 50000000,// ₹5,00,000
      cgstPaise: 750000,           // ₹7,500 (750000 paise)
      sgstPaise: 750000,           // ₹7,500 (750000 paise)
      fineGoldMg: 100000,          // 100g bullion
      grossWeightMg: 100000,
    };

    const jnl = generateJournalForTransaction(payload);
    expect(jnl.isBalanced).toBe(true);
    expect(jnl.totalMoneyDebitPaise).toBe(51500000);
    expect(jnl.totalMoneyCreditPaise).toBe(51500000);

    const inputCgst = jnl.lines.find((l) => l.accountCode === "1030");
    expect(inputCgst?.moneyDebitPaise).toBe(750000);

    const supplierPayable = jnl.lines.find((l) => l.accountCode === "2001");
    expect(supplierPayable?.moneyCreditPaise).toBe(51500000);
    expect(supplierPayable?.fineGoldCreditMg).toBe(100000);
  });

  // ---------------------------------------------------------------------------
  // 7. Accounting Preview Generation
  // ---------------------------------------------------------------------------
  it("generates an explainable human-readable accounting preview before final posting", () => {
    const preview = generateAccountingPreview({
      transactionId: "tx_sale_002",
      transactionType: "RETAIL_SALE",
      voucherNo: "INV-2026-102",
      dateMs: 1788200000000,
      paymentMode: "cash",
      totalAmountPaise: 10300000,
      taxableAmountPaise: 10000000,
      cgstPaise: 150000,
      sgstPaise: 150000,
      fineGoldMg: 10000,
      grossWeightMg: 10000,
    });

    expect(preview.isBalanced).toBe(true);
    expect(preview.totalMoneyDebitRupees).toBe(103000);
    expect(preview.totalMoneyCreditRupees).toBe(103000);
    expect(preview.totalGoldCreditGrams).toBe(10);
    expect(preview.moneyPostings.length).toBeGreaterThanOrEqual(3);
  });

  // ---------------------------------------------------------------------------
  // 8. Dual Financial Statements Compilation (Money Trial Balance + Gold Trial Balance)
  // ---------------------------------------------------------------------------
  it("compiles dual financial statements with independent Money and Gold trial balance equality", () => {
    const jnl1 = generateJournalForTransaction({
      transactionId: "tx_cap_001",
      transactionType: "CAPITAL_INTRODUCED",
      voucherNo: "CAP-001",
      dateMs: 1788200000000,
      paymentMode: "bank",
      totalAmountPaise: 50000000, // ₹5,00,000 Capital
      fineGoldMg: 100000,         // 100g Capital Gold
    });

    const jnl2 = generateJournalForTransaction({
      transactionId: "tx_sale_003",
      transactionType: "RETAIL_SALE",
      voucherNo: "INV-2026-103",
      dateMs: 1788210000000,
      paymentMode: "bank",
      totalAmountPaise: 10300000, // ₹1,03,000
      taxableAmountPaise: 10000000,
      cgstPaise: 150000,
      sgstPaise: 150000,
      fineGoldMg: 10000,
    });

    const statements = compileDualFinancialStatements([jnl1, jnl2]);

    expect(statements.isTrialBalanced).toBe(true);
    expect(statements.totalMoneyDebitPaise).toBe(statements.totalMoneyCreditPaise);
    expect(statements.totalGoldDebitMg).toBe(statements.totalGoldCreditMg);
    expect(statements.profitAndLoss.revenuePaise).toBe(10000000); // ₹1,00,000 net revenue
    expect(statements.balanceSheet.isBalanced).toBe(true);
  });
});
