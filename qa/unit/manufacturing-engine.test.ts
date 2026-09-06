import { describe, it, expect, beforeEach, vi } from "vitest";
import { useKarigarTransactionHub } from "@/lib/karigar-transaction-hub-store";
import { useKarigarAuthoritativeSettlement } from "@/lib/karigar-authoritative-settlement";
import { useOwnerTransactions } from "@/lib/owner-transactions-store";
import { useManufacturingProduction } from "@/lib/manufacturing-production-engine";
import { r2Storage } from "@/lib/storage/r2-storage-service";
import { useLedger, type GoldLedgerEntry } from "@/lib/ledger-store";
import { useStock, type StockItem } from "@/lib/stock-store";

describe("AVS ERP — Manufacturing Operational Engine & Separation", () => {
  beforeEach(() => {
    // Reset and mock ledger & stock writes for test isolation
    const mockEntries: GoldLedgerEntry[] = [];
    useLedger.setState({
      entries: mockEntries,
      append: vi.fn().mockImplementation(async (entry) => {
        const id = `ledger_${Date.now()}_${Math.random()}`;
        const newEntry = {
          ...entry,
          id,
          createdAt: Date.now(),
          branchId: "MAIN",
          version: 1,
        } as GoldLedgerEntry;
        mockEntries.push(newEntry);
        useLedger.setState({ entries: [...mockEntries] });
        return newEntry;
      }),
    });

    useStock.setState({
      addReadyStock: vi.fn().mockImplementation(async (item) => {
        return {
          id: `stock_${Date.now()}`,
          ...item,
          createdAt: Date.now(),
        } as StockItem;
      }),
    });
  });

  describe("1. Cloudflare R2 Performance & Caching Engine", () => {
    it("should validate file size and MIME types", () => {
      const validFile = new File(["sample image bytes"], "pendant.jpg", { type: "image/jpeg" });
      const validation = r2Storage.validateFile(validFile);
      expect(validation.valid).toBe(true);

      const invalidFile = new File(["malicious exe"], "script.exe", { type: "application/x-msdownload" });
      const badValidation = r2Storage.validateFile(invalidFile);
      expect(badValidation.valid).toBe(false);
      expect(badValidation.error).toContain("Unsupported file type");
    });
  });

  describe("2. Authoritative Karigar Transaction Hub & 'Record Over-Loss'", () => {
    it("should record an over-loss transaction and atomically post to the double-entry ledger", async () => {
      const overLossTx = await useKarigarTransactionHub.getState().addTransaction({
        karigarId: "kar_shyam_01",
        karigarName: "Shyam Sundar Karigar",
        type: "record_over_loss",
        date: "2026-09-06",
        grossMg: 450, // 0.45g
        purity: 916,
        fineMg: 412, // 0.412g fine gold over-loss
        cashAmountPaise: 0,
        laborChargesPaise: 0,
        reasonOrNarration: "Filigree wire breakage and unrecoverable laser loss",
        referenceDocNo: "OL-2026-001",
        createdBy: "Production Supervisor",
      });

      expect(overLossTx.id).toBeDefined();
      expect(overLossTx.type).toBe("record_over_loss");
      expect(overLossTx.transactionCode).toContain("KT-");
      expect(useLedger.getState().append).toHaveBeenCalled();
    });

    it("should support gold issue, return, wastage, and chain adjustment in the same engine", async () => {
      const issueTx = await useKarigarTransactionHub.getState().addTransaction({
        karigarId: "kar_ramesh_02",
        karigarName: "Ramesh Goldsmith",
        type: "gold_issue",
        date: "2026-09-06",
        grossMg: 50000,
        purity: 916,
        fineMg: 45800,
        cashAmountPaise: 0,
        laborChargesPaise: 0,
        reasonOrNarration: "Issue for hand-carved bangle batch",
        referenceDocNo: "ISS-2026-042",
        createdBy: "Workshop Admin",
      });

      const chainAdjTx = await useKarigarTransactionHub.getState().addTransaction({
        karigarId: "kar_ramesh_02",
        karigarName: "Ramesh Goldsmith",
        type: "chain_adjustment",
        date: "2026-09-06",
        grossMg: 2100,
        purity: 916,
        fineMg: 1923,
        cashAmountPaise: 0,
        laborChargesPaise: 0,
        chainWeightMg: 2100,
        chainDeductionMg: 350,
        reasonOrNarration: "Chain weight return and interlocking adjustment",
        referenceDocNo: "CHAIN-ADJ-001",
        createdBy: "Workshop Admin",
      });

      expect(issueTx.transactionCode).toBeDefined();
      expect(chainAdjTx.transactionCode).toBeDefined();

      const karigarHistory = useKarigarTransactionHub
        .getState()
        .getTransactionsByKarigar("kar_ramesh_02");
      expect(karigarHistory.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("3. Authoritative Karigar Settlement & Merged Withdrawals", () => {
    it("should confirm settlement with locked status and post to ledger", async () => {
      const confirmed = await useKarigarAuthoritativeSettlement.getState().confirmSettlement({
        karigarId: "kar_suresh_03",
        karigarName: "Suresh Art Jeweller",
        settlementPeriod: "2026-08-01 to 2026-08-31",
        grossSalaryEarnedPaise: 6500000, // ₹65,000
        totalCashWithdrawalsPaise: 1500000, // ₹15,000
        totalGoldWithdrawalsMg: 2000, // 2.0g
        advanceBalancePaise: 500000, // ₹5,000
        loanBalancePaise: 0,
        goldAdvanceMg: 1500,
        wastageDeductionMg: 400,
        chainDeductionMg: 200,
        netPayableCashPaise: 4500000,
        netGoldToBePaidMg: 3500,
        settlementMode: "CASH_AGAINST_GOLD",
        goldRateUsedPaisePerGram: 720000,
        cashPaidAgainstGoldPaise: 2520000,
        withdrawals: [
          {
            id: "w-01",
            withdrawalCode: "WTH-01",
            date: "2026-08-15",
            type: "Cash Withdrawal",
            amountPaise: 1500000,
            weightMg: 0,
            referenceDocNo: "KT-0815",
            createdAt: "2026-08-15T10:00:00Z",
          },
        ],
        notes: "Settled in Cash against 3.5g pure gold obligation",
      });

      expect(confirmed.status).toBe("CONFIRMED_LOCKED");
      expect(confirmed.settlementNumber).toContain("AVS-KST-");
      expect(useLedger.getState().append).toHaveBeenCalled();
    });
  });

  describe("4. Owner & Family Member Drawing Accounts", () => {
    it("should create dedicated family member accounts and track drawings", () => {
      const member = useOwnerTransactions.getState().addFamilyAccount({
        name: "Vikram Shah (Partner)",
        relation: "Owner / Partner",
        accountCode: "ACC-OWNER-VIKRAM",
        phone: "+91 98200 11223",
        active: true,
      });

      expect(member.id).toBeDefined();
      expect(member.accountCode).toBe("ACC-OWNER-VIKRAM");

      const accounts = useOwnerTransactions.getState().familyAccounts;
      const found = accounts.find((a) => a.id === member.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe("Vikram Shah (Partner)");
    });
  });

  describe("5. Manufacturing Production Engine & Auto-Ready Stock", () => {
    it("should automatically update Ready Stock and generate unique Barcode on receipt", async () => {
      const received = await useManufacturingProduction.getState().receiveProductionItem({
        sku: "AVS-CK-22K-990",
        name: "22K Traditional Bridal Choker",
        category: "Chokers",
        purity: 916,
        grossWeightGrams: 45.62,
        netGoldWeightGrams: 45.2,
        hallmarkRequired: true,
        huidNumber: "HUID-916-AB99",
        huidChargePaise: 4500,
        otherChargesPaise: 120000,
        otherChargeType: "Micro-Setting Fee",
        productionMode: "simple_production",
        karigarId: "kar_1",
        karigarName: "Master Karigar Bimal",
      });

      expect(received.status).toBe("RECEIVED_READY_STOCK");
      expect(received.barcode).toBeDefined();
      expect(received.barcode.startsWith("AVS-BAR-")).toBe(true);
      expect(useStock.getState().addReadyStock).toHaveBeenCalled();
    });

    it("should automatically create a delivery workflow when Invoice Delivery = ON", () => {
      const delivery = useManufacturingProduction.getState().createDeliveryFromInvoice({
        invoiceId: "INV-MFG-889",
        invoiceNo: "INV-MFG-2026-889",
        partyName: "Mahalaxmi Jewellers Wholesale",
        partyPhone: "+91 98980 00000",
        itemsCount: 1,
        totalWeightGrams: 45.62,
        deliveryAddress: "Showroom Annex, Zaveri Bazaar, Mumbai",
      });

      expect(delivery.status).toBe("Prepared");
      expect(delivery.deliveryCode).toContain("AVS-DEL-");

      useManufacturingProduction.getState().updateDeliveryStatus(delivery.id, "Delivered");
      const updated = useManufacturingProduction.getState().deliveries.find((d) => d.id === delivery.id);
      expect(updated?.status).toBe("Delivered");
    });
  });
});
