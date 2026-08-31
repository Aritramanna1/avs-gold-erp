/**
 * Jewellery ERP Trade & System Configuration Types
 * Extracted from production reference configuration architectures (Features, General, Master, Tagging, Vouchers)
 */

export interface LegacyFeaturesConfig {
  disableDiamondStoneFeature: boolean;
  useAgent: boolean;
  useSalesman: boolean;
  useSubAccounts: boolean;
  companyNo: string;
  enableAppPurchase: boolean;
  enableAppSale: boolean;
  enablePurchaseOrder: boolean;
  enableHindiDate: boolean;
  autoInsureAmount: number;
  defaultCurrency: string;
}

export interface LegacyGeneralConfig {
  displaySoftwareBackground: boolean;
  dailyRatesAtStart: "yes" | "no" | "restrict_feeding" | "last_rate";
  acStartDate: string;
  sessionLogoutMinutes: number;
  openReminderAtStartup: boolean;
  remindBeforeDays: number;
  dayEndPolicy: "none" | "restrict" | "upload_ho_balance";
  duplicateLoginPolicy: "allow" | "warn" | "block";
  printPdfSettings: "modern_upe" | "compact_a5" | "thermal" | "foxy_previewer";
  restrictFeedingByAcYear: boolean;
  allowFeedingByChangeYear: boolean;
  restrictFeedingInFutureDate: boolean;
  americanDateFormat: boolean;
  disableOutfileCommand: boolean;
  dataDoubleCheckOnSave: boolean;
  stampWiseAccounting: boolean;
  transferVoucherDetailInClosing: boolean;
  dontCreateBackup: boolean;
  loginRightBySetupType: boolean;
  tallyDataTransfer: boolean;
  tallyDataTransferId: string;
}

export interface LegacyMasterConfig {
  shortNameInItems: "none" | "same_prefix" | "diff_prefix" | "serial_no";
  designPrefixInItems: "none" | "same_prefix" | "diff_prefix";
  categoryInItems: boolean;
  askUnitInItem: boolean;
  askGCodeInItem: boolean;
  labourTypeInItem: boolean;
  itemStockValuation: boolean;
  issueReceiveByGrossWeight: boolean;
  defaultStampBy: "group" | "item" | "none" | "item_multi";
  displayGroupWithAccount: boolean;
  shortNameInAccount: "short" | "none" | "ac_no" | "auto" | "group";
  prefixInAccount: boolean;
  printNameInAccount: boolean;
  printNameInItem: boolean;
  panNoCaption: string;
  uidnoCaption: string;
  tanNoCaption: string;
  displayAccountBalanceInList: boolean;
  otpVerificationInAccountCreation: boolean;
  restrictDuplicateMobileInAccounts: boolean;
}

export interface LegacyTaggingConfig {
  tagNumberingMode: "auto_serial" | "lot_wise" | "job_card_no" | "manual";
  generalTagPrefix: string;
  branchTagPrefix: string;
  generateTagLotwise: boolean;
  tagPrintWithGeneration: boolean;
  generateTagAsJobNo: boolean;
  supplierInGeneration: boolean;
  restrictDuplicateHuid: boolean;
  restrictSupplierInTagGen: boolean;
  dontRepeatItem: boolean;
  studdedGridSettingTypeWise: boolean;
  dontPickTagLabourInWholesale: boolean;
  enableTagWiseCommission: boolean;
  enableAutoReorderLabel: boolean;
  useProfitAsDiscountInStudded: boolean;
  checkTagNetWeightOnSave: boolean;
  dontSaveKatanRemarks: boolean;
  updateMrpByDailyRates: boolean;
  tagScanLength: number;
  repeatInTagging: {
    saleLabour: boolean;
    remarks: boolean;
    tunchWastage: boolean;
    tagCode: boolean;
    shape: boolean;
    quality: boolean;
    size: boolean;
    colour: boolean;
    clarity: boolean;
    hallmark: boolean;
    otherAmount: boolean;
    lessWeight: boolean;
    otherRemarks: boolean;
    discount: boolean;
    otherPercent: boolean;
    packetLess: boolean;
    design: boolean;
    pieceWeight: boolean;
    certNo: boolean;
    polishWeightPercent: boolean;
    supplier: boolean;
  };
  reorderLevelBy: {
    item: boolean;
    site: boolean;
    remarks: boolean;
  };
}

export interface LegacyVoucherConfig {
  defaultCursorInSale: "grid" | "party_name" | "cash_party" | "repeat_party" | "narration";
  pickDailyBhavBy: "item_group" | "stamp_purity" | "none";
  decimalInAmount: boolean;
  salePurchaseMode: "none" | "combined" | "urd_purchase";
  cashPartyBalancePolicy: "dont_save" | "save_as_cash_customer" | "require_ledger_account";
  stockInVoucher: "none" | "display" | "sale_by_stock" | "current_date" | "with_valuation";
  creditDebitInTransfer: boolean;
  bullionTypeInBhav: boolean;
  reverseAmountIn: "other" | "labour" | "discount" | "discount_with_tax" | "diamond_labour";
  saveLastSeries: boolean;
  divideColInIssueReceive: boolean;
  batchPrefix: string;
  polyWireWeightMode: "none" | "poly_wire" | "poly_weight";
  disableWeightTunchInBhav: boolean;
  disableRateTunchInBhav: boolean;
  qrCodeScanPrefix: string;
  dontPickAccountByCashPartyMobile: boolean;
  openOptionContainerByKeypress: boolean;
  receiveFineInCashBook: boolean;
  pickSundryInSaleReturn: boolean;
  usePacketLessAsPieceUnitInSale: boolean;
  updateItemNameAsRemarkInStockJournal: boolean;
  maintainSeparateKachiBalance: boolean;
  showRsInWordsInVoucher: boolean;
  enableRateCode: boolean;
  saveKarigarFullName: boolean;
  interestOnAmountOnly: boolean;
  calcPacketLessByGrossWeight: boolean;
  badlaWithBhavCut: boolean;
  tdsTcsInBhavCut: boolean;
  pickCashCustomerByMobile: boolean;
  adjustRateBookInSale: boolean;
  calculateLessWeightByNetWeight: boolean;
  transactionIdInBankEntries: boolean;
  quotationTags: "stock" | "stock_and_as" | "all_stock";
  silverBadlaMode: "nil" | "grams" | "rupees" | "both" | "party_wise";
  defaultBadlaRate: number;
  issueKachiByTestTunch: boolean;
  roundOffKachchi: "none" | "weight" | "fine" | "zero_decimal" | "fourth_digit" | "integer";
  adjustDepositPurity: "same_purity" | "any_purity" | "stock_tunch" | "weight_polish";
}

export const DEFAULT_LEGACY_FEATURES: LegacyFeaturesConfig = {
  disableDiamondStoneFeature: false,
  useAgent: false,
  useSalesman: false,
  useSubAccounts: false,
  companyNo: "1001",
  enableAppPurchase: false,
  enableAppSale: true,
  enablePurchaseOrder: false,
  enableHindiDate: false,
  autoInsureAmount: 0,
  defaultCurrency: "RS.",
};

export const DEFAULT_LEGACY_GENERAL: LegacyGeneralConfig = {
  displaySoftwareBackground: true,
  dailyRatesAtStart: "no",
  acStartDate: "01/04/2026",
  sessionLogoutMinutes: 0,
  openReminderAtStartup: false,
  remindBeforeDays: 2,
  dayEndPolicy: "none",
  duplicateLoginPolicy: "allow",
  printPdfSettings: "modern_upe",
  restrictFeedingByAcYear: false,
  allowFeedingByChangeYear: true,
  restrictFeedingInFutureDate: false,
  americanDateFormat: false,
  disableOutfileCommand: false,
  dataDoubleCheckOnSave: false,
  stampWiseAccounting: false,
  transferVoucherDetailInClosing: false,
  dontCreateBackup: false,
  loginRightBySetupType: false,
  tallyDataTransfer: false,
  tallyDataTransferId: "",
};

export const DEFAULT_LEGACY_MASTER: LegacyMasterConfig = {
  shortNameInItems: "none",
  designPrefixInItems: "none",
  categoryInItems: false,
  askUnitInItem: false,
  askGCodeInItem: false,
  labourTypeInItem: true,
  itemStockValuation: false,
  issueReceiveByGrossWeight: false,
  defaultStampBy: "none",
  displayGroupWithAccount: true,
  shortNameInAccount: "none",
  prefixInAccount: false,
  printNameInAccount: false,
  printNameInItem: false,
  panNoCaption: "PAN No",
  uidnoCaption: "Aadhaar / UID",
  tanNoCaption: "GSTIN / TAN",
  displayAccountBalanceInList: true,
  otpVerificationInAccountCreation: true,
  restrictDuplicateMobileInAccounts: false,
};

export const DEFAULT_LEGACY_TAGGING: LegacyTaggingConfig = {
  tagNumberingMode: "auto_serial",
  generalTagPrefix: "TG",
  branchTagPrefix: "",
  generateTagLotwise: false,
  tagPrintWithGeneration: true,
  generateTagAsJobNo: false,
  supplierInGeneration: false,
  restrictDuplicateHuid: true,
  restrictSupplierInTagGen: false,
  dontRepeatItem: false,
  studdedGridSettingTypeWise: false,
  dontPickTagLabourInWholesale: false,
  enableTagWiseCommission: false,
  enableAutoReorderLabel: false,
  useProfitAsDiscountInStudded: false,
  checkTagNetWeightOnSave: true,
  dontSaveKatanRemarks: false,
  updateMrpByDailyRates: false,
  tagScanLength: 0,
  repeatInTagging: {
    saleLabour: true,
    remarks: false,
    tunchWastage: true,
    tagCode: false,
    shape: false,
    quality: true,
    size: true,
    colour: false,
    clarity: false,
    hallmark: false,
    otherAmount: false,
    lessWeight: false,
    otherRemarks: false,
    discount: false,
    otherPercent: false,
    packetLess: true,
    design: false,
    pieceWeight: false,
    certNo: false,
    polishWeightPercent: true,
    supplier: true,
  },
  reorderLevelBy: {
    item: false,
    site: false,
    remarks: false,
  },
};

export const DEFAULT_LEGACY_VOUCHERS: LegacyVoucherConfig = {
  defaultCursorInSale: "party_name",
  pickDailyBhavBy: "stamp_purity",
  decimalInAmount: false,
  salePurchaseMode: "none",
  cashPartyBalancePolicy: "dont_save",
  stockInVoucher: "none",
  creditDebitInTransfer: false,
  bullionTypeInBhav: false,
  reverseAmountIn: "other",
  saveLastSeries: false,
  divideColInIssueReceive: false,
  batchPrefix: "Manual",
  polyWireWeightMode: "none",
  disableWeightTunchInBhav: true,
  disableRateTunchInBhav: true,
  qrCodeScanPrefix: "/TGNO/",
  dontPickAccountByCashPartyMobile: false,
  openOptionContainerByKeypress: false,
  receiveFineInCashBook: false,
  pickSundryInSaleReturn: false,
  usePacketLessAsPieceUnitInSale: false,
  updateItemNameAsRemarkInStockJournal: false,
  maintainSeparateKachiBalance: false,
  showRsInWordsInVoucher: false,
  enableRateCode: false,
  saveKarigarFullName: false,
  interestOnAmountOnly: false,
  calcPacketLessByGrossWeight: false,
  badlaWithBhavCut: false,
  tdsTcsInBhavCut: false,
  pickCashCustomerByMobile: false,
  adjustRateBookInSale: false,
  calculateLessWeightByNetWeight: false,
  transactionIdInBankEntries: false,
  quotationTags: "stock",
  silverBadlaMode: "both",
  defaultBadlaRate: 0,
  issueKachiByTestTunch: true,
  roundOffKachchi: "none",
  adjustDepositPurity: "same_purity",
};

// ── 6. VALUATION 1 ────────────────────────────────────────────────────────

export interface LegacyValuation1Config {
  /** Stock valuation method for loose/tagged stock */
  looseStockMethod: "fifo" | "avg_cost" | "group_rate" | "last_rate" | "fixed_rate";
  /** Whether to value issue/receive at today's rate or purchase cost */
  issueReceiveBasis: "todays_rate" | "purchase_cost" | "average";
  /** Whether to consolidate stock across all branches for valuation */
  consolidateBranchesForValuation: boolean;
  /** Whether to show unrealised profit/loss in balance sheet */
  showUnrealisedProfitLoss: boolean;
  /** Whether closing stock is valued at cost or market (whichever is lower) */
  closingStockAtCostOrMarket: "cost" | "market" | "lower_of_cost_or_market";
  /** Old gold valuation basis */
  oldGoldValuationBasis: "purchase_rate" | "todays_rate" | "fixed_rate";
  /** Purity correction method for recycled/used gold */
  purityCorrectionMode: "percentage" | "direct_fine" | "assay_report";
  /** Include metal wastage in cost of production */
  includeWastageInCost: boolean;
  /** Include hallmarking charges in valuation */
  includeHallmarkInValuation: boolean;
  /** Weight basis for valuation reports */
  valuationWeightBasis: "gross" | "net" | "fine";
  /** Per-unit valuation in multi-piece items */
  perUnitValuation: boolean;
}

export const DEFAULT_LEGACY_VALUATION1: LegacyValuation1Config = {
  looseStockMethod: "fifo",
  issueReceiveBasis: "todays_rate",
  consolidateBranchesForValuation: false,
  showUnrealisedProfitLoss: false,
  closingStockAtCostOrMarket: "cost",
  oldGoldValuationBasis: "todays_rate",
  purityCorrectionMode: "percentage",
  includeWastageInCost: true,
  includeHallmarkInValuation: false,
  valuationWeightBasis: "fine",
  perUnitValuation: false,
};

// ── 7. VALUATION 2 ────────────────────────────────────────────────────────

export interface LegacyValuation2Config {
  /** Tagged stock valuation basis */
  taggedStockValuationBasis: "cost" | "todays_rate" | "mrp" | "retail";
  /** Customer balance basis for opening balance migration */
  customerBalanceBasis: "cash" | "fine" | "both";
  /** Whether to compute GST / RCM on purchase of old gold from unregistered dealers */
  gstRcmOnOldGoldPurchase: boolean;
  /** TDS on gold purchase above threshold */
  tdsOnGoldPurchaseEnabled: boolean;
  /** TDS account name */
  tdsAccountName: string;
  /** Whether to apply interest on outstanding customer balances */
  interestOnOutstandingEnabled: boolean;
  /** Interest rate on outstanding (annual %) */
  interestOnOutstandingRatePct: number;
  /** Interest calculation basis */
  interestCalculationBasis: "simple" | "compound" | "daily";
  /** Days after which interest kicks in */
  interestGraceDays: number;
  /** Whether to split stock into fine and making for valuation */
  splitFineAndMakingInValuation: boolean;
  /** Whether to deduct scrap/kacchi from closing balance */
  deductKacchiFromClosingBalance: boolean;
  /** Commission basis */
  commissionBasis: "amount" | "fine" | "net_weight";
}

export const DEFAULT_LEGACY_VALUATION2: LegacyValuation2Config = {
  taggedStockValuationBasis: "cost",
  customerBalanceBasis: "both",
  gstRcmOnOldGoldPurchase: false,
  tdsOnGoldPurchaseEnabled: false,
  tdsAccountName: "TDS Payable",
  interestOnOutstandingEnabled: false,
  interestOnOutstandingRatePct: 18,
  interestCalculationBasis: "simple",
  interestGraceDays: 30,
  splitFineAndMakingInValuation: false,
  deductKacchiFromClosingBalance: false,
  commissionBasis: "amount",
};

// ── 8. DEFAULT VALUE ──────────────────────────────────────────────────────

export interface LegacyDefaultValueConfig {
  /** Default account group for new cash customers */
  defaultCashCustomerGroup: string;
  /** Default account group for new credit customers */
  defaultCreditCustomerGroup: string;
  /** Default bullion purchase account */
  defaultBullionPurchaseAccount: string;
  /** Default bullion sale account */
  defaultBullionSaleAccount: string;
  /** Default interest income account */
  defaultInterestIncomeAccount: string;
  /** Default discount allowed account */
  defaultDiscountAllowedAccount: string;
  /** Default discount received account */
  defaultDiscountReceivedAccount: string;
  /** Default commission account */
  defaultCommissionAccount: string;
  /** Default bank charges account */
  defaultBankChargesAccount: string;
  /** Default freight / transport charges account */
  defaultFreightAccount: string;
  /** Default labour/making income account */
  defaultLabourIncomeAccount: string;
  /** Default stone / diamond income account */
  defaultStoneDiamondAccount: string;
  /** Default wastage account */
  defaultWastageAccount: string;
  /** Default opening balance type for new parties */
  defaultOpeningBalanceType: "debit" | "credit";
  /** Default gold purity (permille) for transactions when not specified */
  defaultGoldPurityPermille: number;
  /** Default silver purity (permille) */
  defaultSilverPurityPermille: number;
  /** Default credit limit for new customer accounts */
  defaultCreditLimitPaise: number;
}

export const DEFAULT_LEGACY_DEFAULT_VALUE: LegacyDefaultValueConfig = {
  defaultCashCustomerGroup: "Sundry Debtors",
  defaultCreditCustomerGroup: "Sundry Debtors",
  defaultBullionPurchaseAccount: "Gold Purchase",
  defaultBullionSaleAccount: "Gold Sales",
  defaultInterestIncomeAccount: "Interest Received",
  defaultDiscountAllowedAccount: "Discount Allowed",
  defaultDiscountReceivedAccount: "Discount Received",
  defaultCommissionAccount: "Commission Paid",
  defaultBankChargesAccount: "Bank Charges",
  defaultFreightAccount: "Freight & Cartage",
  defaultLabourIncomeAccount: "Labour Charges",
  defaultStoneDiamondAccount: "Stone Income",
  defaultWastageAccount: "Wastage Income",
  defaultOpeningBalanceType: "debit",
  defaultGoldPurityPermille: 916,
  defaultSilverPurityPermille: 925,
  defaultCreditLimitPaise: 0,
};

// ── 9. EXPORT ─────────────────────────────────────────────────────────────

export interface LegacyExportConfig {
  /** Tally XML export enabled */
  tallyXmlExportEnabled: boolean;
  /** Tally company name as configured in Tally.ERP9 / Prime */
  tallyCompanyName: string;
  /** Tally ledger group mapping for gold sales */
  tallyGoldSalesGroup: string;
  /** Tally ledger group mapping for making charges */
  tallyMakingGroup: string;
  /** Export stock transactions to Tally */
  exportStockToTally: boolean;
  /** Export ledger opening balances to Tally */
  exportOpeningBalancesToTally: boolean;
  /** Excel export column order */
  excelColumnOrder: string[];
  /** Auto-export schedule: none, daily, weekly */
  autoExportSchedule: "none" | "daily" | "weekly";
  /** Export directory path (local) */
  exportDirectoryPath: string;
  /** Include cancelled vouchers in export */
  includeCancelledVouchersInExport: boolean;
  /** Date format for exported files */
  exportDateFormat: "dd/mm/yyyy" | "mm/dd/yyyy" | "yyyy-mm-dd";
}

export const DEFAULT_LEGACY_EXPORT: LegacyExportConfig = {
  tallyXmlExportEnabled: false,
  tallyCompanyName: "",
  tallyGoldSalesGroup: "Sales Accounts",
  tallyMakingGroup: "Sales Accounts",
  exportStockToTally: false,
  exportOpeningBalancesToTally: false,
  excelColumnOrder: ["date", "party", "type", "gross", "purity", "fine", "rate", "amount"],
  autoExportSchedule: "none",
  exportDirectoryPath: "",
  includeCancelledVouchersInExport: false,
  exportDateFormat: "dd/mm/yyyy",
};

// ── 10. MEMBERS ───────────────────────────────────────────────────────────

export interface LegacyMembersConfig {
  /** Gold savings scheme / kitty plan enabled */
  goldSavingsSchemeEnabled: boolean;
  /** Default scheme duration in months */
  defaultSchemeDurationMonths: number;
  /** Default monthly instalment amount (paise) */
  defaultMonthlyInstalmentPaise: number;
  /** Bonus instalment count (e.g., 12 + 1 free) */
  bonusInstalmentCount: number;
  /** Bonus type: free instalment or discount on final purchase */
  bonusType: "free_instalment" | "discount_on_purchase" | "both";
  /** Bonus discount percentage when bonusType is discount_on_purchase */
  bonusDiscountPct: number;
  /** Whether to allow early withdrawal/redemption */
  allowEarlyWithdrawal: boolean;
  /** Early withdrawal penalty percentage */
  earlyWithdrawalPenaltyPct: number;
  /** Whether to notify members on instalment due dates */
  notifyOnInstalmentDue: boolean;
  /** Days before due to send notification */
  notifyDaysBeforeDue: number;
  /** Whether scheme accounts are tracked in a separate ledger group */
  separateLedgerGroupForSchemes: boolean;
  /** Default scheme name prefix */
  schemePrefixName: string;
}

export const DEFAULT_LEGACY_MEMBERS: LegacyMembersConfig = {
  goldSavingsSchemeEnabled: false,
  defaultSchemeDurationMonths: 12,
  defaultMonthlyInstalmentPaise: 100000,
  bonusInstalmentCount: 1,
  bonusType: "free_instalment",
  bonusDiscountPct: 0,
  allowEarlyWithdrawal: false,
  earlyWithdrawalPenaltyPct: 5,
  notifyOnInstalmentDue: false,
  notifyDaysBeforeDue: 3,
  separateLedgerGroupForSchemes: false,
  schemePrefixName: "SCHEME-",
};

// ── 11. SALARY ────────────────────────────────────────────────────────────

export interface LegacySalaryConfig {
  /** Attendance tracking method */
  attendanceMethod: "biometric" | "manual" | "app_checkin" | "none";
  /** Standard working hours per day */
  standardWorkingHoursPerDay: number;
  /** Overtime calculation basis */
  overtimeBasis: "per_hour" | "flat_rate" | "none";
  /** Overtime multiplier (e.g. 1.5x) */
  overtimeMultiplier: number;
  /** PF contribution enabled */
  pfEnabled: boolean;
  /** Employee PF rate % */
  pfEmployeeRatePct: number;
  /** Employer PF rate % */
  pfEmployerRatePct: number;
  /** ESI enabled */
  esiEnabled: boolean;
  /** ESI rate % */
  esiRatePct: number;
  /** TDS on salary enabled */
  tdsSalaryEnabled: boolean;
  /** Salary payment account */
  salaryPaymentAccount: string;
  /** PF payable account */
  pfPayableAccount: string;
  /** ESI payable account */
  esiPayableAccount: string;
  /** Salary slip generation: monthly or fortnightly */
  salarySlipCycle: "monthly" | "fortnightly";
  /** Whether to allow advance salary deduction */
  allowAdvanceSalaryDeduction: boolean;
}

export const DEFAULT_LEGACY_SALARY: LegacySalaryConfig = {
  attendanceMethod: "manual",
  standardWorkingHoursPerDay: 9,
  overtimeBasis: "per_hour",
  overtimeMultiplier: 1.5,
  pfEnabled: false,
  pfEmployeeRatePct: 12,
  pfEmployerRatePct: 12,
  esiEnabled: false,
  esiRatePct: 3.25,
  tdsSalaryEnabled: false,
  salaryPaymentAccount: "Salaries & Wages",
  pfPayableAccount: "PF Payable",
  esiPayableAccount: "ESI Payable",
  salarySlipCycle: "monthly",
  allowAdvanceSalaryDeduction: true,
};

// ── 12. BULLION ───────────────────────────────────────────────────────────

export interface LegacyBullionConfig {
  /** Gold purchase account in Chart of Accounts */
  goldPurchaseAccount: string;
  /** Gold sales account */
  goldSalesAccount: string;
  /** Silver purchase account */
  silverPurchaseAccount: string;
  /** Silver sales account */
  silverSalesAccount: string;
  /** Gold vault / custody account */
  goldVaultAccount: string;
  /** Whether to track silver separately from gold ledger */
  separateSilverLedger: boolean;
  /** Import duty rate on bullion (%) */
  importDutyRatePct: number;
  /** GST rate on bullion purchase (%) */
  gstOnBullionPct: number;
  /** Sauda (forward contract) entry enabled */
  saudaEnabled: boolean;
  /** Badla (carry forward charge) mode */
  badlaMode: "nil" | "auto" | "manual";
  /** Default badla rate (₹ per 10g) */
  defaultBadlaRatePerTola: number;
  /** Kacchi (impure) gold separate account */
  kacchiGoldAccount: string;
  /** Refining / smelting charges account */
  refiningChargesAccount: string;
  /** Whether hallmark purity is mandatory in bullion purchase */
  requireHallmarkPurityInPurchase: boolean;
  /** Lock bullion purity entry to certified values only */
  lockBullionPurityToCertifiedValues: boolean;
}

export const DEFAULT_LEGACY_BULLION: LegacyBullionConfig = {
  goldPurchaseAccount: "Gold Purchase",
  goldSalesAccount: "Gold Sales",
  silverPurchaseAccount: "Silver Purchase",
  silverSalesAccount: "Silver Sales",
  goldVaultAccount: "Gold Vault",
  separateSilverLedger: true,
  importDutyRatePct: 0,
  gstOnBullionPct: 3,
  saudaEnabled: false,
  badlaMode: "auto",
  defaultBadlaRatePerTola: 0,
  kacchiGoldAccount: "Kacchi Gold",
  refiningChargesAccount: "Refining Charges",
  requireHallmarkPurityInPurchase: false,
  lockBullionPurityToCertifiedValues: false,
};

// ── 13. MANUFACTURING ─────────────────────────────────────────────────────

export interface LegacyManufacturingConfig {
  /** Manufacturing mode */
  manufacturingMode: "order_based" | "direct_issue" | "job_work" | "subcontract";
  /** Gold issue basis to karigar */
  goldIssueBasis: "order_quantity" | "gross_weight" | "fine_weight" | "manual";
  /** Loss (ghata) accounting basis */
  lossBasis: "percentage" | "fine_weight" | "gross_weight";
  /** Default loss percentage */
  defaultLossPct: number;
  /** Whether karigar requires approval before gold issue */
  requireApprovalBeforeGoldIssue: boolean;
  /** Whether to enforce receipt slip before gold return */
  enforceReceiptSlipOnReturn: boolean;
  /** Job card mandatory fields */
  jobCardMandatoryFields: string[];
  /** Allow partial gold return against an order */
  allowPartialGoldReturn: boolean;
  /** Karigar wage basis */
  karigarWageBasis: "piece_rate" | "weight_rate" | "daily_rate" | "fixed";
  /** Making charges ledger account */
  makingChargesAccount: string;
  /** Labour charges ledger account */
  labourChargesAccount: string;
  /** Loss account */
  lossAccount: string;
  /** Defect / rejection account */
  defectAccount: string;
  /** Whether to auto-generate job cards from confirmed orders */
  autoGenerateJobCardFromOrder: boolean;
  /** Maximum days gold can stay with karigar without return trigger */
  maxKarigarGoldHoldingDays: number;
}

export const DEFAULT_LEGACY_MANUFACTURING: LegacyManufacturingConfig = {
  manufacturingMode: "order_based",
  goldIssueBasis: "fine_weight",
  lossBasis: "percentage",
  defaultLossPct: 2,
  requireApprovalBeforeGoldIssue: false,
  enforceReceiptSlipOnReturn: false,
  jobCardMandatoryFields: ["karigar", "item", "gross_weight", "purity"],
  allowPartialGoldReturn: true,
  karigarWageBasis: "piece_rate",
  makingChargesAccount: "Making Charges Income",
  labourChargesAccount: "Labour Charges",
  lossAccount: "Manufacturing Loss",
  defectAccount: "Defect / Rejection",
  autoGenerateJobCardFromOrder: false,
  maxKarigarGoldHoldingDays: 30,
};

// ── 14. WEB UPLOAD ────────────────────────────────────────────────────────

export interface LegacyWebUploadConfig {
  /** Web/cloud sync enabled */
  webSyncEnabled: boolean;
  /** Sync endpoint URL */
  syncEndpointUrl: string;
  /** API key for sync */
  syncApiKey: string;
  /** Whether to sync stock/inventory data */
  syncStock: boolean;
  /** Whether to sync customer accounts */
  syncCustomers: boolean;
  /** Whether to sync daily rates */
  syncDailyRates: boolean;
  /** Whether to sync invoices / sales */
  syncInvoices: boolean;
  /** Whether to sync karigar book entries */
  syncKarigarBook: boolean;
  /** Auto-sync interval in minutes (0 = manual only) */
  autoSyncIntervalMinutes: number;
  /** Maximum records per sync batch */
  syncBatchSize: number;
  /** Whether to enable offline-first mode with queue */
  offlineQueueEnabled: boolean;
  /** Whether customers can view their ledger via mobile app */
  customerMobileLedgerEnabled: boolean;
}

export const DEFAULT_LEGACY_WEB_UPLOAD: LegacyWebUploadConfig = {
  webSyncEnabled: false,
  syncEndpointUrl: "",
  syncApiKey: "",
  syncStock: false,
  syncCustomers: false,
  syncDailyRates: true,
  syncInvoices: false,
  syncKarigarBook: false,
  autoSyncIntervalMinutes: 0,
  syncBatchSize: 100,
  offlineQueueEnabled: true,
  customerMobileLedgerEnabled: false,
};

// ── 15. GIRVI (Gold Loan / Pawn) ──────────────────────────────────────────

export interface LegacyGirviConfig {
  /** Gold loan / Girvi module enabled */
  girviEnabled: boolean;
  /** Girvi loan ledger account */
  girviLoanAccount: string;
  /** Interest income account */
  girviInterestAccount: string;
  /** Default interest rate per month (%) */
  defaultInterestRatePerMonth: number;
  /** Interest calculation method */
  interestCalculationMethod: "flat" | "reducing_balance" | "simple_per_day";
  /** Grace period before interest starts (days) */
  interestGracePeriodDays: number;
  /** Maximum loan-to-value ratio (%) */
  maxLtvPct: number;
  /** Whether to allow partial redemption */
  allowPartialRedemption: boolean;
  /** Penalty on overdue (% per month) */
  overduePenaltyRatePct: number;
  /** Auction trigger days after due date */
  auctionTriggerDays: number;
  /** Whether to auto-transfer to auction account on trigger */
  autoTransferToAuction: boolean;
  /** Girvi receipt numbering prefix */
  girviReceiptPrefix: string;
}

export const DEFAULT_LEGACY_GIRVI: LegacyGirviConfig = {
  girviEnabled: false,
  girviLoanAccount: "Girvi Loan (Gold Pledge)",
  girviInterestAccount: "Girvi Interest Income",
  defaultInterestRatePerMonth: 1.5,
  interestCalculationMethod: "flat",
  interestGracePeriodDays: 0,
  maxLtvPct: 75,
  allowPartialRedemption: true,
  overduePenaltyRatePct: 2,
  auctionTriggerDays: 90,
  autoTransferToAuction: false,
  girviReceiptPrefix: "GRV-",
};

// ── 16. PRINT SETUP ───────────────────────────────────────────────────────

export interface LegacyPrintSetupConfig {
  /** Company/firm name on printed documents */
  printCompanyName: string;
  /** Company address line 1 */
  printAddressLine1: string;
  /** Company address line 2 */
  printAddressLine2: string;
  /** City, State, PIN */
  printCityStatePIN: string;
  /** GSTIN on printed documents */
  printGstin: string;
  /** PAN on printed documents */
  printPan: string;
  /** Phone numbers on printed documents */
  printPhone: string;
  /** Email on printed documents */
  printEmail: string;
  /** Website on printed documents */
  printWebsite: string;
  /** Bank name for cheque/NEFT details on invoice */
  printBankName: string;
  /** Bank account number */
  printBankAccountNo: string;
  /** IFSC code */
  printIfscCode: string;
  /** Signatory name */
  printSignatoryName: string;
  /** Signatory designation */
  printSignatoryDesignation: string;
  /** Terms and conditions text */
  printTermsAndConditions: string;
  /** Whether to print company logo */
  printLogo: boolean;
  /** Whether to print BIS / hallmark certification details */
  printHallmarkDetails: boolean;
  /** Default paper size for print */
  defaultPaperSize: "A4" | "A5" | "thermal_3inch" | "thermal_4inch";
  /** Whether to print watermark on draft/cancelled documents */
  printWatermarkOnDraft: boolean;
  /** Header colour (hex) */
  printHeaderColor: string;
}

export const DEFAULT_LEGACY_PRINT_SETUP: LegacyPrintSetupConfig = {
  printCompanyName: "",
  printAddressLine1: "",
  printAddressLine2: "",
  printCityStatePIN: "",
  printGstin: "",
  printPan: "",
  printPhone: "",
  printEmail: "",
  printWebsite: "",
  printBankName: "",
  printBankAccountNo: "",
  printIfscCode: "",
  printSignatoryName: "",
  printSignatoryDesignation: "Authorised Signatory",
  printTermsAndConditions: "Goods once sold will not be taken back. E. & O.E.",
  printLogo: true,
  printHallmarkDetails: true,
  defaultPaperSize: "A4",
  printWatermarkOnDraft: true,
  printHeaderColor: "#c9a84c",
};

// ── 17. OTHER SETUPS ──────────────────────────────────────────────────────

export interface LegacyOtherSetupsConfig {
  /** Whether to enforce daily rate entry before any voucher */
  requireDailyRateEntry: boolean;
  /** Whether to allow vouchers without today's gold rate */
  allowVoucherWithoutRate: boolean;
  /** Auto-lock books at day-end */
  autoDayEndLock: boolean;
  /** Day-end lock time (24h format, e.g., "19:00") */
  autoDayEndLockTime: string;
  /** Whether to enable user activity log */
  enableUserActivityLog: boolean;
  /** Audit trail retention days */
  auditRetentionDays: number;
  /** Whether to show live gold rate ticker */
  showGoldRateTicker: boolean;
  /** Ticker rate source URL */
  goldRateTickerUrl: string;
  /** Whether to enable two-factor authentication for critical actions */
  twoFactorForCriticalActions: boolean;
  /** Session idle timeout in minutes */
  sessionIdleTimeoutMinutes: number;
  /** Maximum failed login attempts before lockout */
  maxFailedLoginAttempts: number;
  /** Whether to send daily summary report by email */
  dailySummaryEmailEnabled: boolean;
  /** Daily summary email recipients */
  dailySummaryEmailRecipients: string[];
  /** SMS alert for high-value transactions above threshold */
  smsAlertThresholdPaise: number;
  /** WhatsApp alert enabled for critical events */
  whatsappAlertsEnabled: boolean;
}

export const DEFAULT_LEGACY_OTHER_SETUPS: LegacyOtherSetupsConfig = {
  requireDailyRateEntry: false,
  allowVoucherWithoutRate: true,
  autoDayEndLock: false,
  autoDayEndLockTime: "21:00",
  enableUserActivityLog: true,
  auditRetentionDays: 365,
  showGoldRateTicker: true,
  goldRateTickerUrl: "",
  twoFactorForCriticalActions: false,
  sessionIdleTimeoutMinutes: 60,
  maxFailedLoginAttempts: 5,
  dailySummaryEmailEnabled: false,
  dailySummaryEmailRecipients: [],
  smsAlertThresholdPaise: 10000000,
  whatsappAlertsEnabled: false,
};

// ── 18. JEWEL DESK ────────────────────────────────────────────────────────

export interface LegacyJewelDeskConfig {
  /** Jewel Desk POS module enabled */
  jewelDeskEnabled: boolean;
  /** Quick-sale mode (bypasses order workflow for ready stock) */
  quickSaleModeEnabled: boolean;
  /** Default customer for quick sales (cash party name) */
  defaultCashCustomerName: string;
  /** Whether to show stock images on POS screen */
  showStockImagesOnPos: boolean;
  /** POS screen layout */
  posScreenLayout: "grid" | "list" | "compact";
  /** Touch-optimised mode */
  touchOptimisedMode: boolean;
  /** Whether to print receipt automatically after each sale */
  autoPrintReceiptAfterSale: boolean;
  /** Default receipt type */
  defaultReceiptType: "A4" | "thermal";
  /** Whether to show customer balance on POS */
  showCustomerBalanceOnPos: boolean;
  /** Whether to display real-time gold rate on POS screen */
  showGoldRateOnPos: boolean;
  /** Barcode scanner mode */
  barcodeScannerMode: "usb_hid" | "serial" | "camera" | "none";
  /** Display currency symbol on POS */
  displayCurrencySymbol: "RS." | "₹" | "INR";
  /** Whether to allow discount on quick sale */
  allowDiscountOnQuickSale: boolean;
  /** Maximum discount allowed on quick sale (%) */
  maxDiscountOnQuickSalePct: number;
  /** Require manager PIN for large discounts */
  requireManagerPinForDiscount: boolean;
  /** Discount threshold requiring manager PIN (paise) */
  discountManagerPinThresholdPaise: number;
}

export const DEFAULT_LEGACY_JEWEL_DESK: LegacyJewelDeskConfig = {
  jewelDeskEnabled: false,
  quickSaleModeEnabled: false,
  defaultCashCustomerName: "Cash Customer",
  showStockImagesOnPos: true,
  posScreenLayout: "grid",
  touchOptimisedMode: false,
  autoPrintReceiptAfterSale: false,
  defaultReceiptType: "thermal",
  showCustomerBalanceOnPos: true,
  showGoldRateOnPos: true,
  barcodeScannerMode: "usb_hid",
  displayCurrencySymbol: "₹",
  allowDiscountOnQuickSale: false,
  maxDiscountOnQuickSalePct: 10,
  requireManagerPinForDiscount: true,
  discountManagerPinThresholdPaise: 500000,
};

