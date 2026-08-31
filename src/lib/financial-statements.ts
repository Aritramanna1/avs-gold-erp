/**
 * Financial statements compiled from chart of accounts (ledger_accounts).
 * Trial Balance, Trading Account, Profit & Loss, and Balance Sheet.
 */
import type { AccountNature, LedgerAccount } from "@/lib/chart-of-accounts-store";

export interface TrialBalanceLine {
  accountId: string;
  code: string;
  name: string;
  nature: AccountNature;
  debitPaise: number;
  creditPaise: number;
  goldDebitMg: number;
  goldCreditMg: number;
}

export interface FinancialStatementSection {
  title: string;
  lines: Array<{
    code: string;
    name: string;
    amountPaise: number;
    goldMg: number;
  }>;
  totalPaise: number;
  totalGoldMg: number;
}

export interface FinancialStatementsBundle {
  trialBalance: TrialBalanceLine[];
  trialDebitPaise: number;
  trialCreditPaise: number;
  tradingAccount: FinancialStatementSection;
  profitAndLoss: FinancialStatementSection;
  balanceSheet: {
    assets: FinancialStatementSection;
    liabilities: FinancialStatementSection;
    netWorthPaise: number;
  };
}

function signedMoneyPaise(account: LedgerAccount): number {
  const balance = account.currentBalancePaise;
  if (account.nature === "asset" || account.nature === "expense") return balance;
  return -balance;
}

function signedGoldMg(account: LedgerAccount): number {
  const balance = account.currentGoldMg;
  if (account.nature === "asset" || account.nature === "expense") return balance;
  return -balance;
}

export function compileFinancialStatements(accounts: LedgerAccount[]): FinancialStatementsBundle {
  const trialBalance: TrialBalanceLine[] = accounts
    .filter((a) => a.isActive)
    .map((account) => {
      const money = account.currentBalancePaise;
      const gold = account.currentGoldMg;
      const isDebitNature = account.nature === "asset" || account.nature === "expense";
      return {
        accountId: account.id,
        code: account.code,
        name: account.name,
        nature: account.nature,
        debitPaise: isDebitNature && money > 0 ? money : !isDebitNature && money < 0 ? -money : 0,
        creditPaise: !isDebitNature && money > 0 ? money : isDebitNature && money < 0 ? -money : 0,
        goldDebitMg: isDebitNature && gold > 0 ? gold : !isDebitNature && gold < 0 ? -gold : 0,
        goldCreditMg: !isDebitNature && gold > 0 ? gold : isDebitNature && gold < 0 ? -gold : 0,
      };
    });

  const trialDebitPaise = trialBalance.reduce((s, l) => s + l.debitPaise, 0);
  const trialCreditPaise = trialBalance.reduce((s, l) => s + l.creditPaise, 0);

  const tradingCodes = new Set([
    "PURCHASE_GOLD",
    "SALES_GOLD",
    "DIRECT_EXP",
    "FACTORY_OH",
    "GROSS_PROFIT",
  ]);

  const tradingLines = accounts
    .filter((a) => a.isActive && (a.nature === "income" || a.nature === "expense"))
    .filter((a) => tradingCodes.has(a.code) || a.code.startsWith("MFG_"))
    .map((a) => ({
      code: a.code,
      name: a.name,
      amountPaise: Math.abs(signedMoneyPaise(a)),
      goldMg: Math.abs(signedGoldMg(a)),
    }));

  const tradingAccount: FinancialStatementSection = {
    title: "Trading Account",
    lines: tradingLines,
    totalPaise: tradingLines.reduce((s, l) => s + l.amountPaise, 0),
    totalGoldMg: tradingLines.reduce((s, l) => s + l.goldMg, 0),
  };

  const plLines = accounts
    .filter((a) => a.isActive && (a.nature === "income" || a.nature === "expense"))
    .filter((a) => !tradingCodes.has(a.code) && !a.code.startsWith("MFG_"))
    .map((a) => ({
      code: a.code,
      name: a.name,
      amountPaise: Math.abs(signedMoneyPaise(a)),
      goldMg: Math.abs(signedGoldMg(a)),
    }));

  const profitAndLoss: FinancialStatementSection = {
    title: "Profit & Loss Account",
    lines: plLines,
    totalPaise: plLines.reduce((s, l) => s + l.amountPaise, 0),
    totalGoldMg: plLines.reduce((s, l) => s + l.goldMg, 0),
  };

  const assetLines = accounts
    .filter((a) => a.isActive && a.nature === "asset")
    .map((a) => ({
      code: a.code,
      name: a.name,
      amountPaise: Math.max(0, signedMoneyPaise(a)),
      goldMg: Math.max(0, signedGoldMg(a)),
    }));

  const liabilityLines = accounts
    .filter((a) => a.isActive && a.nature === "liability")
    .map((a) => ({
      code: a.code,
      name: a.name,
      amountPaise: Math.max(0, -signedMoneyPaise(a)),
      goldMg: Math.max(0, -signedGoldMg(a)),
    }));

  const assetsTotal = assetLines.reduce((s, l) => s + l.amountPaise, 0);
  const liabilitiesTotal = liabilityLines.reduce((s, l) => s + l.amountPaise, 0);

  return {
    trialBalance,
    trialDebitPaise,
    trialCreditPaise,
    tradingAccount,
    profitAndLoss,
    balanceSheet: {
      assets: {
        title: "Assets",
        lines: assetLines,
        totalPaise: assetsTotal,
        totalGoldMg: assetLines.reduce((s, l) => s + l.goldMg, 0),
      },
      liabilities: {
        title: "Liabilities",
        lines: liabilityLines,
        totalPaise: liabilitiesTotal,
        totalGoldMg: liabilityLines.reduce((s, l) => s + l.goldMg, 0),
      },
      netWorthPaise: assetsTotal - liabilitiesTotal,
    },
  };
}
