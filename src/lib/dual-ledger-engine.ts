/**
 * AVS ERP — Authoritative Dual-Ledger Accounting & Debit/Credit Engine
 *
 * Implements the core Gold-First dual-ledger architecture:
 * 1. Every account and party maintains TWO independent ledger dimensions:
 *    - MONEY LEDGER (INR paise / rupees: Debit, Credit, Balance)
 *    - GOLD LEDGER (mg / fine mg: Debit Quantity, Credit Quantity, Balance)
 * 2. Strict Double-Entry validation:
 *    - Total Money Debits = Total Money Credits
 *    - Total Gold Debits = Total Gold Credits (for gold movements)
 * 3. Complete Transaction-to-Accounting Mapping Matrix for all supported business workflows.
 * 4. Transparent Accounting Preview and Audit Trail.
 * 5. Dual Financial Statements (Money Trial Balance + Gold Trial Balance, P&L, Balance Sheet).
 *
 * Invariant: Gold is never treated as cash. Market Bhav never silently replaces carrying cost.
 */

export type AccountType =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "INCOME"
  | "EXPENSE"
  | "COGS"
  | "TAX"
  | "CONTROL";

export interface MasterAccountDefinition {
  code: string;
  name: string;
  type: AccountType;
  groupCode: string;
  isCashOrBank?: boolean;
  supportsGold?: boolean;
  description: string;
}

/**
 * Standard Master Chart of Accounts with explicit types and dual-ledger capabilities.
 */
export const MASTER_CHART_OF_ACCOUNTS: MasterAccountDefinition[] = [
  // ── ASSETS ────────────────────────────────────────────────────────────────
  { code: "1001", name: "Main Cash Drawer", type: "ASSET", groupCode: "CASH_BANK", isCashOrBank: true, description: "Physical cash in showroom register" },
  { code: "1002", name: "Bank Current Account (HDFC/ICICI)", type: "ASSET", groupCode: "CASH_BANK", isCashOrBank: true, description: "Primary operational bank account" },
  { code: "1003", name: "UPI / QR Settlement Account", type: "ASSET", groupCode: "CASH_BANK", isCashOrBank: true, description: "Instant digital UPI payment receipts" },
  { code: "1004", name: "Card / POS Gateway Receivables", type: "ASSET", groupCode: "CASH_BANK", isCashOrBank: true, description: "Credit/Debit card POS machine settlements" },
  { code: "1010", name: "Sundry Debtors (Customer Receivables)", type: "ASSET", groupCode: "SUNDRY_DEBTORS", supportsGold: true, description: "Trade customer balances (Money & Metal)" },
  { code: "1020", name: "Fine Gold Bullion Vault (999)", type: "ASSET", groupCode: "STOCK_VAULT", supportsGold: true, description: "Pure gold bars & bullion inventory" },
  { code: "1021", name: "Finished Jewellery Stock (22K/18K/14K)", type: "ASSET", groupCode: "STOCK_VAULT", supportsGold: true, description: "Ready-to-sell showroom jewellery" },
  { code: "1022", name: "Silver & Precious Metals Stock", type: "ASSET", groupCode: "STOCK_VAULT", supportsGold: true, description: "Silver articles and bullion" },
  { code: "1023", name: "Raw Materials & Alloy Stock", type: "ASSET", groupCode: "STOCK_VAULT", supportsGold: true, description: "Alloy metals (copper, silver alloy) for melting" },
  { code: "1024", name: "Stones & Diamonds Inventory", type: "ASSET", groupCode: "STOCK_VAULT", description: "Loose diamonds, pearls, precious gemstones" },
  { code: "1025", name: "Scrap & Old Gold Stock", type: "ASSET", groupCode: "STOCK_VAULT", supportsGold: true, description: "Old gold purchased from customers/dealers" },
  { code: "1026", name: "Workshop WIP & Karigar Gold", type: "ASSET", groupCode: "WIP_KARIGAR", supportsGold: true, description: "Metal issued to artisans under manufacturing" },
  { code: "1030", name: "Input CGST", type: "ASSET", groupCode: "DUTIES_TAXES", description: "Input Tax Credit (Central GST)" },
  { code: "1031", name: "Input SGST", type: "ASSET", groupCode: "DUTIES_TAXES", description: "Input Tax Credit (State GST)" },
  { code: "1032", name: "Input IGST", type: "ASSET", groupCode: "DUTIES_TAXES", description: "Input Tax Credit (Integrated GST)" },
  { code: "1040", name: "Fixed Assets (Showroom, Machinery, Scales)", type: "ASSET", groupCode: "FIXED_ASSETS", description: "Physical machinery, computers, precision scales" },
  { code: "1041", name: "Accumulated Depreciation", type: "ASSET", groupCode: "FIXED_ASSETS", description: "Cumulative depreciation contra-asset" },
  { code: "1050", name: "Security Deposits & Staff Advances", type: "ASSET", groupCode: "CURR_ASSETS", description: "Rent deposits and temporary employee advances" },

  // ── LIABILITIES ───────────────────────────────────────────────────────────
  { code: "2001", name: "Sundry Creditors (Suppliers / Bullion Dealers)", type: "LIABILITY", groupCode: "SUNDRY_CREDITORS", supportsGold: true, description: "Vendor payables (Money & Metal)" },
  { code: "2010", name: "Customer Advances (Money)", type: "LIABILITY", groupCode: "CUST_ADVANCES", description: "Unadjusted cash/bank advances from customers" },
  { code: "2011", name: "Customer Metal Deposits (Custody Liability)", type: "LIABILITY", groupCode: "CUST_GOLD_DEP", supportsGold: true, description: "Fiduciary custody safe-deposit gold" },
  { code: "2020", name: "Karigar Labour Payable", type: "LIABILITY", groupCode: "KARIGAR_PAYABLE", description: "Artisan making charges due for settlement" },
  { code: "2030", name: "Output CGST Payable", type: "LIABILITY", groupCode: "DUTIES_TAXES", description: "Central GST collected on sales" },
  { code: "2031", name: "Output SGST Payable", type: "LIABILITY", groupCode: "DUTIES_TAXES", description: "State GST collected on sales" },
  { code: "2032", name: "Output IGST Payable", type: "LIABILITY", groupCode: "DUTIES_TAXES", description: "Integrated GST collected on interstate sales" },
  { code: "2033", name: "RCM Tax Payable", type: "LIABILITY", groupCode: "DUTIES_TAXES", description: "Reverse Charge Mechanism liability" },
  { code: "2034", name: "TDS Payable (Section 194Q / 194C)", type: "LIABILITY", groupCode: "DUTIES_TAXES", description: "Tax deducted at source to be remitted" },
  { code: "2040", name: "Bank Overdraft & Working Capital Loans", type: "LIABILITY", groupCode: "LOANS_LIAB", description: "Bank borrowing and credit lines" },
  { code: "2050", name: "Expenses Payable", type: "LIABILITY", groupCode: "CURR_LIAB", description: "Accrued rent, electricity, salaries payable" },

  // ── EQUITY ────────────────────────────────────────────────────────────────
  { code: "3001", name: "Owner Capital Account", type: "EQUITY", groupCode: "CAPITAL", supportsGold: true, description: "Promoter capital introduced (Money / Metal)" },
  { code: "3002", name: "Additional Capital Introduced", type: "EQUITY", groupCode: "CAPITAL", supportsGold: true, description: "Subsequent partner/owner investments" },
  { code: "3010", name: "Owner Drawings", type: "EQUITY", groupCode: "CAPITAL", supportsGold: true, description: "Capital withdrawals by proprietor" },
  { code: "3020", name: "Retained Earnings", type: "EQUITY", groupCode: "RESERVES", description: "Accumulated prior year reserves" },
  { code: "3030", name: "Current Year Profit / Loss", type: "EQUITY", groupCode: "RESERVES", description: "Net operational result for current period" },

  // ── INCOME ────────────────────────────────────────────────────────────────
  { code: "4001", name: "Gold Jewellery Sales", type: "INCOME", groupCode: "SALES_REV", supportsGold: true, description: "Revenue from retail gold jewellery sales" },
  { code: "4002", name: "Bullion & Pure Metal Sales", type: "INCOME", groupCode: "SALES_REV", supportsGold: true, description: "Revenue from pure bullion/bar sales" },
  { code: "4003", name: "Silver & Diamond Jewellery Sales", type: "INCOME", groupCode: "SALES_REV", description: "Revenue from silver and diamond articles" },
  { code: "4010", name: "Making & Labour Charges Income", type: "INCOME", groupCode: "MAKING_REV", description: "Making charges billed to customers" },
  { code: "4020", name: "Repair & Polishing Services Income", type: "INCOME", groupCode: "OTHER_INCOME", description: "Jewellery repair and servicing fees" },
  { code: "4030", name: "Scrap Refining & Metal Gain", type: "INCOME", groupCode: "OTHER_INCOME", supportsGold: true, description: "Operational recovery gain from melting/refining" },
  { code: "4040", name: "Other Operating Income", type: "INCOME", groupCode: "OTHER_INCOME", description: "Hallmarking fee pass-through, interest, misc" },

  // ── COGS & DIRECT COSTS ───────────────────────────────────────────────────
  { code: "5001", name: "Cost of Goods Sold (Gold Jewellery)", type: "COGS", groupCode: "COGS_DIRECT", supportsGold: true, description: "Carrying cost of finished inventory sold" },
  { code: "5002", name: "Bullion Purchase Account", type: "COGS", groupCode: "COGS_DIRECT", supportsGold: true, description: "Purchases of raw gold bullion" },
  { code: "5003", name: "Scrap Gold Purchase Account", type: "COGS", groupCode: "COGS_DIRECT", supportsGold: true, description: "Purchases of old gold from customers/traders" },
  { code: "5010", name: "Karigar Making & Manufacturing Cost", type: "COGS", groupCode: "KARIGAR_COST", description: "Labour fees paid to manufacturing artisans" },
  { code: "5020", name: "Hallmarking & Testing Charges", type: "COGS", groupCode: "COGS_DIRECT", description: "BIS hallmarking and assaying center fees" },
  { code: "5030", name: "Normal Production Wastage Allowance", type: "COGS", groupCode: "COGS_DIRECT", supportsGold: true, description: "Agreed manufacturing wastage allowance" },
  { code: "5031", name: "Abnormal Production Metal Loss", type: "COGS", groupCode: "COGS_DIRECT", supportsGold: true, description: "Unrecovered over-loss in workshop processes" },

  // ── EXPENSES ──────────────────────────────────────────────────────────────
  { code: "6001", name: "Staff Salaries & Employee Wages", type: "EXPENSE", groupCode: "ADMIN_EXP", description: "Showroom and office staff remuneration" },
  { code: "6002", name: "Showroom Rent & Rates", type: "EXPENSE", groupCode: "ADMIN_EXP", description: "Commercial premise rental" },
  { code: "6003", name: "Electricity & Utility Charges", type: "EXPENSE", groupCode: "ADMIN_EXP", description: "Power, backup generator, water charges" },
  { code: "6004", name: "Transport & Courier Logistics", type: "EXPENSE", groupCode: "ADMIN_EXP", description: "Secure transit of bullion and jewellery" },
  { code: "6005", name: "Packaging, Boxes & Display Materials", type: "EXPENSE", groupCode: "ADMIN_EXP", description: "Jewellery presentation boxes and bags" },
  { code: "6006", name: "Marketing, Advertising & Branding", type: "EXPENSE", groupCode: "ADMIN_EXP", description: "Festive promotions, digital ads, hoardings" },
  { code: "6007", name: "Bank Charges & POS Gateway Commissions", type: "EXPENSE", groupCode: "ADMIN_EXP", description: "Card swipe fees and bank transaction charges" },
  { code: "6008", name: "Repairs & Showroom Maintenance", type: "EXPENSE", groupCode: "ADMIN_EXP", description: "CCTV, AC, security systems maintenance" },
  { code: "6009", name: "Professional & Audit Fees", type: "EXPENSE", groupCode: "ADMIN_EXP", description: "CA retainer, legal, GST return filing fees" },
  { code: "6010", name: "Depreciation on Machinery & Assets", type: "EXPENSE", groupCode: "ADMIN_EXP", description: "Non-cash asset wear and tear write-off" },
  { code: "6020", name: "Discount Allowed to Customers", type: "EXPENSE", groupCode: "ADMIN_EXP", description: "Promotional concessions granted on sales" },
];

// ── Dual-Ledger Posting Line & Journal Interfaces ────────────────────────────

export interface JournalPostingLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;

  // 1. Monetary Dimension
  moneyDebitPaise: number;
  moneyCreditPaise: number;

  // 2. Physical Gold Dimension
  goldDebitMg: number;
  goldCreditMg: number;
  fineGoldDebitMg: number;
  fineGoldCreditMg: number;
  purityPerMille?: number;

  partyId?: string;
  partyType?: "customer" | "supplier" | "karigar" | "bank" | "vault";
  narration?: string;
}

export interface JournalEntry {
  id: string;
  transactionId: string;
  transactionType: string;
  voucherNo: string;
  dateMs: number;
  dateStr: string;
  lines: JournalPostingLine[];

  totalMoneyDebitPaise: number;
  totalMoneyCreditPaise: number;
  totalGoldDebitMg: number;
  totalGoldCreditMg: number;
  totalFineGoldDebitMg: number;
  totalFineGoldCreditMg: number;

  isBalanced: boolean;
  auditRecord: {
    createdBy: string;
    createdAt: string;
    sourceReference: string;
  };
}

export interface AccountingPreview {
  voucherNo: string;
  transactionType: string;
  moneyPostings: Array<{
    accountCode: string;
    accountName: string;
    debitRupees: number;
    creditRupees: number;
  }>;
  goldPostings: Array<{
    accountCode: string;
    accountName: string;
    debitGrams: number;
    creditGrams: number;
    fineGrams: number;
  }>;
  totalMoneyDebitRupees: number;
  totalMoneyCreditRupees: number;
  totalGoldDebitGrams: number;
  totalGoldCreditGrams: number;
  isBalanced: boolean;
}

// ── Master Lookup Helpers ────────────────────────────────────────────────────

export function getAccountByCode(code: string): MasterAccountDefinition {
  const found = MASTER_CHART_OF_ACCOUNTS.find((a) => a.code === code);
  if (!found) {
    throw new Error(`Master account code "${code}" not found in Chart of Accounts.`);
  }
  return found;
}

// ── Universal Debit/Credit Transaction Mapper ────────────────────────────────

export interface BusinessTransactionPayload {
  transactionId: string;
  transactionType: string;
  voucherNo: string;
  dateMs: number;
  partyId?: string;
  partyName?: string;
  paymentMode?: "cash" | "bank" | "upi" | "card" | "credit" | "gold_exchange" | "advance";
  
  // Monetary Amounts (in Paise)
  totalAmountPaise: number;
  taxableAmountPaise?: number;
  cgstPaise?: number;
  sgstPaise?: number;
  igstPaise?: number;
  advanceAdjustedPaise?: number;
  discountPaise?: number;
  cogsPaise?: number;

  // Physical Gold Amounts (in mg)
  grossWeightMg?: number;
  netWeightMg?: number;
  fineGoldMg?: number;
  purityPerMille?: number;
  wastageGoldMg?: number;

  // Gold Exchange Specific
  oldGoldValuationPaise?: number;
  oldGoldFineMg?: number;
  
  // Custody Specific
  isCustodyOnly?: boolean;

  user?: string;
}

/**
 * Maps any supported business transaction into its authoritative Dual-Ledger Journal Entry.
 */
export function generateJournalForTransaction(tx: BusinessTransactionPayload): JournalEntry {
  const lines: JournalPostingLine[] = [];
  const dateStr = new Date(tx.dateMs).toISOString().split("T")[0]!;

  const addLine = (
    accountCode: string,
    moneyDebitPaise = 0,
    moneyCreditPaise = 0,
    goldDebitMg = 0,
    goldCreditMg = 0,
    fineGoldDebitMg = 0,
    fineGoldCreditMg = 0,
    narration?: string,
    partyType?: JournalPostingLine["partyType"],
  ) => {
    const acc = getAccountByCode(accountCode);
    lines.push({
      accountId: `acc_${accountCode}`,
      accountCode: acc.code,
      accountName: acc.name,
      accountType: acc.type,
      moneyDebitPaise,
      moneyCreditPaise,
      goldDebitMg,
      goldCreditMg,
      fineGoldDebitMg,
      fineGoldCreditMg,
      purityPerMille: tx.purityPerMille,
      partyId: tx.partyId,
      partyType,
      narration: narration || tx.voucherNo,
    });
  };

  const gstTotalPaise = (tx.cgstPaise || 0) + (tx.sgstPaise || 0) + (tx.igstPaise || 0);
  const netRevenuePaise = (tx.taxableAmountPaise ?? (tx.totalAmountPaise - gstTotalPaise));
  const fineMg = tx.fineGoldMg ?? 0;
  const grossMg = tx.grossWeightMg ?? fineMg;

  // ── 1. RETAIL JEWELLERY SALES (Cash / Bank / Card / Credit / Advance) ──────
  if (
    tx.transactionType === "RETAIL_SALE" ||
    tx.transactionType === "JEWELLERY_SALE" ||
    tx.transactionType === "retail_sale"
  ) {
    // A. Debit Payment / Receivable
    if (tx.paymentMode === "credit") {
      addLine("1010", tx.totalAmountPaise, 0, fineMg, 0, fineMg, 0, `Credit Sale to ${tx.partyName || "Customer"}`, "customer");
    } else if (tx.paymentMode === "bank") {
      addLine("1002", tx.totalAmountPaise, 0, 0, 0, 0, 0, "Bank Collection on Sale", "bank");
    } else if (tx.paymentMode === "upi") {
      addLine("1003", tx.totalAmountPaise, 0, 0, 0, 0, 0, "UPI QR Collection on Sale");
    } else if (tx.paymentMode === "card") {
      addLine("1004", tx.totalAmountPaise, 0, 0, 0, 0, 0, "Card POS Collection on Sale");
    } else {
      addLine("1001", tx.totalAmountPaise, 0, 0, 0, 0, 0, "Cash Collection on Sale");
    }

    // B. Credit Revenue
    addLine("4001", 0, netRevenuePaise, 0, 0, 0, 0, "Jewellery Sales Revenue");

    // C. Credit Output GST (if applicable)
    if (tx.cgstPaise && tx.cgstPaise > 0) {
      addLine("2030", 0, tx.cgstPaise, 0, 0, 0, 0, "Output CGST 1.5%");
    }
    if (tx.sgstPaise && tx.sgstPaise > 0) {
      addLine("2031", 0, tx.sgstPaise, 0, 0, 0, 0, "Output SGST 1.5%");
    }
    if (tx.igstPaise && tx.igstPaise > 0) {
      addLine("2032", 0, tx.igstPaise, 0, 0, 0, 0, "Output IGST 3.0%");
    }

    // D. Gold Movement (Inventory reduction)
    if (fineMg > 0) {
      if (tx.paymentMode !== "credit") {
        addLine("4001", 0, 0, 0, 0, fineMg, 0, "Gold Volume Sold");
      }
      addLine("1021", 0, 0, 0, grossMg, 0, fineMg, "Stock Outward from Showroom", "vault");
    }

    // E. Advance adjustment if applied
    if (tx.advanceAdjustedPaise && tx.advanceAdjustedPaise > 0) {
      addLine("2010", tx.advanceAdjustedPaise, 0, 0, 0, 0, 0, "Customer Advance Consumed", "customer");
      addLine("1010", 0, tx.advanceAdjustedPaise, 0, 0, 0, 0, "Receivable Offset by Advance", "customer");
    }
  }

  // ── 2. GOLD EXCHANGE SALE ─────────────────────────────────────────────────
  else if (tx.transactionType === "GOLD_EXCHANGE" || tx.transactionType === "gold_exchange") {
    const oldGoldValuation = tx.oldGoldValuationPaise || 0;
    const oldGoldFine = tx.oldGoldFineMg || 0;
    const netCashDue = tx.totalAmountPaise - oldGoldValuation;

    // Full Jewellery Sale Liability
    addLine("1010", tx.totalAmountPaise, 0, fineMg, 0, fineMg, 0, "New Jewellery Supplied (Gross)", "customer");
    addLine("4001", 0, netRevenuePaise, 0, 0, 0, 0, "Jewellery Sales Revenue");
    if (tx.cgstPaise) addLine("2030", 0, tx.cgstPaise, 0, 0, 0, 0, "Output CGST");
    if (tx.sgstPaise) addLine("2031", 0, tx.sgstPaise, 0, 0, 0, 0, "Output SGST");
    if (tx.igstPaise) addLine("2032", 0, tx.igstPaise, 0, 0, 0, 0, "Output IGST");
    addLine("1021", 0, 0, 0, grossMg, 0, fineMg, "Finished Jewellery Delivered", "vault");

    // Old Gold Inward Settlement
    if (oldGoldValuation > 0 || oldGoldFine > 0) {
      addLine("1025", oldGoldValuation, 0, oldGoldFine, 0, oldGoldFine, 0, "Old Gold Scrap Received in Exchange", "vault");
      addLine("1010", 0, oldGoldValuation, 0, oldGoldFine, 0, oldGoldFine, "Settlement from Old Gold Exchange", "customer");
    }

    // Net Payment Received
    if (netCashDue > 0) {
      const cashAcc = tx.paymentMode === "bank" ? "1002" : "1001";
      addLine(cashAcc, netCashDue, 0, 0, 0, 0, 0, "Net Cash/Bank Balance Settled");
      addLine("1010", 0, netCashDue, 0, 0, 0, 0, "Receivable Cleared", "customer");
    }
  }

  // ── 3. CUSTOMER GOLD CUSTODY (Non-Supply Fiduciary Deposit) ───────────────
  else if (
    tx.transactionType === "CUSTOMER_GOLD_CUSTODY" ||
    tx.transactionType === "customer_gold_received" ||
    tx.isCustodyOnly
  ) {
    // 0 Monetary effect, Gold Ledger custody movement only
    addLine("1010", 0, 0, grossMg, 0, fineMg, 0, "Customer Gold Custody Safe Deposit", "customer");
    addLine("2011", 0, 0, 0, grossMg, 0, fineMg, "Custody Safe Deposit Liability", "customer");
  }

  // ── 4. OLD GOLD PURCHASE (Personal Customer / Unregistered / Registered) ──
  else if (tx.transactionType === "OLD_GOLD_PURCHASE" || tx.transactionType === "old_gold_purchase") {
    // Scrap Inventory Inward
    addLine("1025", tx.totalAmountPaise, 0, grossMg, 0, fineMg, 0, "Old Gold Scrap Stock Inward", "vault");
    // Settlement to Customer / Supplier
    if (tx.paymentMode === "bank") {
      addLine("1002", 0, tx.totalAmountPaise, 0, 0, 0, 0, "Bank Payment for Old Gold", "bank");
    } else if (tx.paymentMode === "credit") {
      addLine("2001", 0, tx.totalAmountPaise, 0, grossMg, 0, fineMg, "Payable for Scrap Purchase", "supplier");
    } else {
      addLine("1001", 0, tx.totalAmountPaise, 0, 0, 0, 0, "Cash Payout for Old Gold");
    }
    // Balance Gold dimension if cash payout
    if (tx.paymentMode !== "credit") {
      addLine("1010", 0, 0, 0, grossMg, 0, fineMg, "Customer Metal Transferred", "customer");
    }
  }

  // ── 5. SUPPLIER BULLION / JEWELLERY PURCHASE ───────────────────────────────
  else if (
    tx.transactionType === "PURCHASE" ||
    tx.transactionType === "BULLION_PURCHASE" ||
    tx.transactionType === "supplier_purchase"
  ) {
    // Debit Bullion Inventory
    addLine("1020", netRevenuePaise, 0, grossMg, 0, fineMg, 0, "Pure Bullion Inventory Inward", "vault");
    // Debit Input GST (ITC) if charged
    if (tx.cgstPaise) addLine("1030", tx.cgstPaise, 0, 0, 0, 0, 0, "Input CGST ITC");
    if (tx.sgstPaise) addLine("1031", tx.sgstPaise, 0, 0, 0, 0, 0, "Input SGST ITC");
    if (tx.igstPaise) addLine("1032", tx.igstPaise, 0, 0, 0, 0, 0, "Input IGST ITC");

    // Credit Supplier Payable
    if (tx.paymentMode === "bank") {
      addLine("1002", 0, tx.totalAmountPaise, 0, 0, 0, 0, "Bank Payment to Bullion Supplier", "bank");
      addLine("2001", 0, 0, 0, grossMg, 0, fineMg, "Supplier Metal Delivery Cleared", "supplier");
    } else {
      addLine("2001", 0, tx.totalAmountPaise, 0, grossMg, 0, fineMg, "Supplier Payable for Bullion", "supplier");
    }
  }

  // ── 6. CUSTOMER RECEIPT / ADVANCE RECEIPT ──────────────────────────────────
  else if (tx.transactionType === "CUSTOMER_RECEIPT" || tx.transactionType === "payment_receipt") {
    const cashAcc = tx.paymentMode === "bank" ? "1002" : tx.paymentMode === "upi" ? "1003" : "1001";
    addLine(cashAcc, tx.totalAmountPaise, 0, 0, 0, 0, 0, "Money Received from Customer");
    addLine("1010", 0, tx.totalAmountPaise, 0, 0, 0, 0, "Customer Receivable Cleared", "customer");
  } else if (tx.transactionType === "CUSTOMER_ADVANCE" || tx.transactionType === "advance_receipt") {
    const cashAcc = tx.paymentMode === "bank" ? "1002" : "1001";
    addLine(cashAcc, tx.totalAmountPaise, 0, 0, 0, 0, 0, "Advance Received from Customer");
    addLine("2010", 0, tx.totalAmountPaise, 0, 0, 0, 0, "Customer Advance Liability Recorded", "customer");
    if (fineMg > 0) {
      addLine("1020", 0, 0, grossMg, 0, fineMg, 0, "Advance Metal Vault Inward", "vault");
      addLine("2011", 0, 0, 0, grossMg, 0, fineMg, "Advance Metal Deposit Liability", "customer");
    }
  }

  // ── 7. SUPPLIER PAYMENT ───────────────────────────────────────────────────
  else if (tx.transactionType === "SUPPLIER_PAYMENT" || tx.transactionType === "supplier_payment") {
    addLine("2001", tx.totalAmountPaise, 0, 0, 0, 0, 0, "Supplier Payable Cleared", "supplier");
    const cashAcc = tx.paymentMode === "cash" ? "1001" : "1002";
    addLine(cashAcc, 0, tx.totalAmountPaise, 0, 0, 0, 0, "Payment Dispatched to Supplier", "bank");
  }

  // ── 8. KARIGAR ISSUE & RETURN (Manufacturing) ─────────────────────────────
  else if (tx.transactionType === "KARIGAR_ISSUE" || tx.transactionType === "karigar_issue") {
    // 0 Money effect, Gold transfer from Vault to Karigar WIP
    addLine("1026", 0, 0, grossMg, 0, fineMg, 0, "Issued to Artisan for Manufacturing", "karigar");
    addLine("1020", 0, 0, 0, grossMg, 0, fineMg, "Outward from Bullion Vault", "vault");
  } else if (tx.transactionType === "KARIGAR_RECEIPT" || tx.transactionType === "manufacturing_bill") {
    const makingFeePaise = tx.totalAmountPaise || 0;
    const wastageMg = tx.wastageGoldMg || 0;

    // Finished Goods Inward + Wastage
    addLine("1021", 0, 0, grossMg, 0, fineMg, 0, "Finished Jewellery from Artisan", "vault");
    if (wastageMg > 0) {
      addLine("5030", 0, 0, wastageMg, 0, wastageMg, 0, "Normal Artisan Wastage Allowance");
    }
    addLine("1026", 0, 0, 0, grossMg + wastageMg, 0, fineMg + wastageMg, "Karigar WIP Settled", "karigar");

    // Making Charges Labour Payable
    if (makingFeePaise > 0) {
      addLine("5010", makingFeePaise, 0, 0, 0, 0, 0, "Karigar Manufacturing Cost");
      addLine("2020", 0, makingFeePaise, 0, 0, 0, 0, "Karigar Labour Payable", "karigar");
    }
  }

  // ── 9. EXPENSE PAYMENT ────────────────────────────────────────────────────
  else if (tx.transactionType === "EXPENSE" || tx.transactionType === "expense_payment") {
    addLine("6001", netRevenuePaise, 0, 0, 0, 0, 0, "Operational Expense Incurred");
    if (tx.cgstPaise) addLine("1030", tx.cgstPaise, 0, 0, 0, 0, 0, "Input CGST");
    if (tx.sgstPaise) addLine("1031", tx.sgstPaise, 0, 0, 0, 0, 0, "Input SGST");
    const cashAcc = tx.paymentMode === "bank" ? "1002" : "1001";
    addLine(cashAcc, 0, tx.totalAmountPaise, 0, 0, 0, 0, "Expense Paid via Cash/Bank");
  }

  // ── 10. CAPITAL & DRAWINGS ────────────────────────────────────────────────
  else if (tx.transactionType === "CAPITAL_INTRODUCED" || tx.transactionType === "capital") {
    const cashAcc = tx.paymentMode === "bank" ? "1002" : "1001";
    addLine(cashAcc, tx.totalAmountPaise, 0, 0, 0, 0, 0, "Promoter Capital Inward");
    addLine("3001", 0, tx.totalAmountPaise, 0, 0, 0, 0, "Owner Capital Account");
    if (fineMg > 0) {
      addLine("1020", 0, 0, grossMg, 0, fineMg, 0, "Promoter Bullion Capital Inward", "vault");
      addLine("3001", 0, 0, 0, grossMg, 0, fineMg, "Owner Capital Metal Account");
    }
  } else if (tx.transactionType === "DRAWINGS" || tx.transactionType === "drawings") {
    addLine("3010", tx.totalAmountPaise, 0, 0, 0, 0, 0, "Proprietor Drawings");
    const cashAcc = tx.paymentMode === "bank" ? "1002" : "1001";
    addLine(cashAcc, 0, tx.totalAmountPaise, 0, 0, 0, 0, "Drawings Payout");
  }

  // ── 11. CONTRA (Cash <-> Bank Transfer) ───────────────────────────────────
  else if (tx.transactionType === "CONTRA" || tx.transactionType === "contra") {
    // Deposit cash into bank
    addLine("1002", tx.totalAmountPaise, 0, 0, 0, 0, 0, "Bank Inward from Cash Drawer", "bank");
    addLine("1001", 0, tx.totalAmountPaise, 0, 0, 0, 0, "Cash Drawer Outward to Bank");
  }

  // Calculate totals and verify dual-ledger balancing
  const totalMoneyDebitPaise = lines.reduce((s, l) => s + l.moneyDebitPaise, 0);
  const totalMoneyCreditPaise = lines.reduce((s, l) => s + l.moneyCreditPaise, 0);
  const totalGoldDebitMg = lines.reduce((s, l) => s + l.goldDebitMg, 0);
  const totalGoldCreditMg = lines.reduce((s, l) => s + l.goldCreditMg, 0);
  const totalFineGoldDebitMg = lines.reduce((s, l) => s + l.fineGoldDebitMg, 0);
  const totalFineGoldCreditMg = lines.reduce((s, l) => s + l.fineGoldCreditMg, 0);

  const isMoneyBalanced = totalMoneyDebitPaise === totalMoneyCreditPaise;
  const isGoldBalanced = totalFineGoldDebitMg === totalFineGoldCreditMg;
  const isBalanced = isMoneyBalanced && isGoldBalanced;

  return {
    id: `jnl_${tx.transactionId || tx.voucherNo}`,
    transactionId: tx.transactionId,
    transactionType: tx.transactionType,
    voucherNo: tx.voucherNo,
    dateMs: tx.dateMs,
    dateStr,
    lines,
    totalMoneyDebitPaise,
    totalMoneyCreditPaise,
    totalGoldDebitMg,
    totalGoldCreditMg,
    totalFineGoldDebitMg,
    totalFineGoldCreditMg,
    isBalanced,
    auditRecord: {
      createdBy: tx.user || "system_operator",
      createdAt: new Date().toISOString(),
      sourceReference: tx.voucherNo,
    },
  };
}

/**
 * Produces an explainable, human-readable preview of Money & Gold postings prior to final posting.
 */
export function generateAccountingPreview(tx: BusinessTransactionPayload): AccountingPreview {
  const journal = generateJournalForTransaction(tx);

  const moneyPostings = journal.lines
    .filter((l) => l.moneyDebitPaise > 0 || l.moneyCreditPaise > 0)
    .map((l) => ({
      accountCode: l.accountCode,
      accountName: l.accountName,
      debitRupees: l.moneyDebitPaise / 100,
      creditRupees: l.moneyCreditPaise / 100,
    }));

  const goldPostings = journal.lines
    .filter((l) => l.goldDebitMg > 0 || l.goldCreditMg > 0 || l.fineGoldDebitMg > 0 || l.fineGoldCreditMg > 0)
    .map((l) => ({
      accountCode: l.accountCode,
      accountName: l.accountName,
      debitGrams: l.goldDebitMg / 1000,
      creditGrams: l.goldCreditMg / 1000,
      fineGrams: (l.fineGoldDebitMg || l.fineGoldCreditMg) / 1000,
    }));

  return {
    voucherNo: journal.voucherNo,
    transactionType: journal.transactionType,
    moneyPostings,
    goldPostings,
    totalMoneyDebitRupees: journal.totalMoneyDebitPaise / 100,
    totalMoneyCreditRupees: journal.totalMoneyCreditPaise / 100,
    totalGoldDebitGrams: journal.totalGoldDebitMg / 1000,
    totalGoldCreditGrams: journal.totalGoldCreditMg / 1000,
    isBalanced: journal.isBalanced,
  };
}

// ── Dual Financial Statements & Reports Compiler ─────────────────────────────

export interface DualTrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  moneyDebitPaise: number;
  moneyCreditPaise: number;
  goldDebitMg: number;
  goldCreditMg: number;
}

export interface DualFinancialStatements {
  trialBalance: DualTrialBalanceRow[];
  totalMoneyDebitPaise: number;
  totalMoneyCreditPaise: number;
  totalGoldDebitMg: number;
  totalGoldCreditMg: number;
  isTrialBalanced: boolean;

  profitAndLoss: {
    revenuePaise: number;
    cogsPaise: number;
    grossProfitPaise: number;
    expensesPaise: number;
    netProfitPaise: number;
    goldTurnoverFineMg: number;
    goldWastageFineMg: number;
  };

  balanceSheet: {
    assetsMoneyPaise: number;
    liabilitiesMoneyPaise: number;
    equityMoneyPaise: number;
    assetsGoldMg: number;
    liabilitiesGoldMg: number;
    equityGoldMg: number;
    isBalanced: boolean;
  };
}

/**
 * Compiles Dual Financial Statements from posted journal entries.
 */
export function compileDualFinancialStatements(journals: JournalEntry[]): DualFinancialStatements {
  const accountTotals = new Map<
    string,
    {
      def: MasterAccountDefinition;
      moneyDebit: number;
      moneyCredit: number;
      goldDebit: number;
      goldCredit: number;
    }
  >();

  // Initialize accounts
  for (const acc of MASTER_CHART_OF_ACCOUNTS) {
    accountTotals.set(acc.code, {
      def: acc,
      moneyDebit: 0,
      moneyCredit: 0,
      goldDebit: 0,
      goldCredit: 0,
    });
  }

  // Accumulate journal lines
  for (const jnl of journals) {
    for (const l of jnl.lines) {
      const entry = accountTotals.get(l.accountCode);
      if (entry) {
        entry.moneyDebit += l.moneyDebitPaise;
        entry.moneyCredit += l.moneyCreditPaise;
        entry.goldDebit += l.fineGoldDebitMg;
        entry.goldCredit += l.fineGoldCreditMg;
      }
    }
  }

  const trialBalance: DualTrialBalanceRow[] = Array.from(accountTotals.values())
    .filter(
      (a) =>
        a.moneyDebit > 0 ||
        a.moneyCredit > 0 ||
        a.goldDebit > 0 ||
        a.goldCredit > 0,
    )
    .map((a) => ({
      accountCode: a.def.code,
      accountName: a.def.name,
      accountType: a.def.type,
      moneyDebitPaise: a.moneyDebit,
      moneyCreditPaise: a.moneyCredit,
      goldDebitMg: a.goldDebit,
      goldCreditMg: a.goldCredit,
    }));

  const totalMoneyDebitPaise = trialBalance.reduce((s, r) => s + r.moneyDebitPaise, 0);
  const totalMoneyCreditPaise = trialBalance.reduce((s, r) => s + r.moneyCreditPaise, 0);
  const totalGoldDebitMg = trialBalance.reduce((s, r) => s + r.goldDebitMg, 0);
  const totalGoldCreditMg = trialBalance.reduce((s, r) => s + r.goldCreditMg, 0);

  // Profit & Loss compilation
  let revenuePaise = 0;
  let cogsPaise = 0;
  let expensesPaise = 0;
  let goldTurnoverFineMg = 0;
  let goldWastageFineMg = 0;

  for (const row of trialBalance) {
    if (row.accountType === "INCOME") {
      revenuePaise += (row.moneyCreditPaise - row.moneyDebitPaise);
      goldTurnoverFineMg += (row.goldDebitMg - row.goldCreditMg);
    } else if (row.accountType === "COGS") {
      cogsPaise += (row.moneyDebitPaise - row.moneyCreditPaise);
      goldWastageFineMg += (row.goldDebitMg - row.goldCreditMg);
    } else if (row.accountType === "EXPENSE") {
      expensesPaise += (row.moneyDebitPaise - row.moneyCreditPaise);
    }
  }

  const grossProfitPaise = revenuePaise - cogsPaise;
  const netProfitPaise = grossProfitPaise - expensesPaise;

  // Balance Sheet compilation
  let assetsMoneyPaise = 0;
  let liabilitiesMoneyPaise = 0;
  let equityMoneyPaise = 0;
  let assetsGoldMg = 0;
  let liabilitiesGoldMg = 0;
  let equityGoldMg = 0;

  for (const row of trialBalance) {
    if (row.accountType === "ASSET") {
      assetsMoneyPaise += (row.moneyDebitPaise - row.moneyCreditPaise);
      assetsGoldMg += (row.goldDebitMg - row.goldCreditMg);
    } else if (row.accountType === "LIABILITY") {
      liabilitiesMoneyPaise += (row.moneyCreditPaise - row.moneyDebitPaise);
      liabilitiesGoldMg += (row.goldCreditMg - row.goldDebitMg);
    } else if (row.accountType === "EQUITY") {
      equityMoneyPaise += (row.moneyCreditPaise - row.moneyDebitPaise);
      equityGoldMg += (row.goldCreditMg - row.goldDebitMg);
    }
  }

  // Include current net profit into equity
  equityMoneyPaise += netProfitPaise;

  return {
    trialBalance,
    totalMoneyDebitPaise,
    totalMoneyCreditPaise,
    totalGoldDebitMg,
    totalGoldCreditMg,
    isTrialBalanced:
      totalMoneyDebitPaise === totalMoneyCreditPaise &&
      totalGoldDebitMg === totalGoldCreditMg,
    profitAndLoss: {
      revenuePaise,
      cogsPaise,
      grossProfitPaise,
      expensesPaise,
      netProfitPaise,
      goldTurnoverFineMg,
      goldWastageFineMg,
    },
    balanceSheet: {
      assetsMoneyPaise,
      liabilitiesMoneyPaise,
      equityMoneyPaise,
      assetsGoldMg,
      liabilitiesGoldMg,
      equityGoldMg,
      isBalanced: Math.abs(assetsMoneyPaise - (liabilitiesMoneyPaise + equityMoneyPaise)) === 0,
    },
  };
}
