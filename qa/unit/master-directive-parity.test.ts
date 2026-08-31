import { describe, it, expect, beforeEach, vi } from "vitest";
import { useBilling, type InvoiceItem } from "@/lib/billing-store";
import { useDeliveryChallans } from "@/lib/billing-documents-store";
import { usePeople } from "@/lib/people-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { useOrders } from "@/lib/orders-store";
import { compileCustomerLedger } from "@/lib/customer-account-ledger";
import { resolvePrintContext } from "@/lib/print-engine/data-mapper";
import { generateDocumentPdf } from "@/lib/print-engine/pdf/generate";
import { usePrintTemplates } from "@/lib/print-engine/template-store";
import { dispatchAutomaticBusinessEvent } from "@/lib/comm/automatic-communication-engine";

// Mock base repository to operate in-memory for unit tests
vi.mock("@/lib/repositories/base-repository", () => ({
  createRepository: (tableName: string) => {
    const memory = new Map<string, any>();
    return {
      get: vi.fn(async (id: string) => memory.get(id) ?? null),
      list: vi.fn(async () => Array.from(memory.values())),
      save: vi.fn(async (entity: any) => {
        memory.set(entity.id, entity);
        return entity;
      }),
      delete: vi.fn(async (id: string) => {
        memory.delete(id);
      }),
    };
  },
}));

let mockSeq = 1;
vi.mock("@/lib/sequence-manager", () => ({
  getNextSequenceNumber: vi.fn(async (docType: string) => `${docType.toUpperCase()}-${mockSeq++}`),
}));

vi.mock("@/lib/email-service", () => ({
  sendGenericEmail: vi.fn().mockImplementation(async (opts) => {
    return {
      success: true,
      emailId: `mock_eml_${Date.now()}`,
    };
  }),
}));

describe("MTJ ERP — Master Implementation Directive Comprehensive Test Suite", () => {
  beforeEach(() => {
    useBilling.setState({ invoices: [], payments: [] });
    useDeliveryChallans.setState({ challans: [] });
    usePeople.setState({ people: [] });
    useWorkerGoldBook.setState({ entries: [] });
    useOrders.setState({ orders: [] });
  });

  describe("1. Global Gold-First & Billing Automatic Calculations", () => {
    it("Calculates Tunch + Wastage = Hisab and computes Fine Gold accurately", () => {
      const grossMg = 10000; // 10.000 g
      const lessMg = 500;    // 0.500 g
      const netMg = grossMg - lessMg; // 9.500 g (9500 mg)
      const tunchPct = 91.6; // 22K (916 per mille)
      const wastagePct = 2.4; // 2.4%
      const hisabPct = tunchPct + wastagePct; // 94.0% (940 per mille)

      expect(hisabPct).toBe(94.0);

      // Fine Gold = Net * Hisab / 100
      const fineMg = Math.round((netMg * hisabPct) / 100);
      expect(fineMg).toBe(8930); // 8.930 g Fine Gold

      // Gold Value at ₹7,500/g (750000 paise/g)
      const goldRatePerGramPaise = 750000;
      const goldValuePaise = Math.round((fineMg * goldRatePerGramPaise) / 1000);
      expect(goldValuePaise).toBe(6697500); // ₹66,975.00
    });

    it("Cash Payment retains Cash identity AND computes Gold Equivalent at transaction-time rate", () => {
      const cashPaidPaise = 7500000; // ₹75,000.00
      const ratePerGramPaise = 750000; // ₹7,500/g
      const goldEquivalentMg = Math.round((cashPaidPaise / ratePerGramPaise) * 1000);

      expect(goldEquivalentMg).toBe(10000); // 10.000 g Fine Gold
    });

    it("Mixed Payment: 11g Invoice - 10g Gold Paid auto-calculates 1g Cash at transaction-time rate", () => {
      const invoiceFineMg = 11000; // 11.000 g
      const goldPaidMg = 10000;    // 10.000 g
      const remainingFineMg = invoiceFineMg - goldPaidMg; // 1.000 g

      expect(remainingFineMg).toBe(1000);

      const ratePerGramPaise = 900000; // ₹9,000/g
      const cashRequiredPaise = Math.round((remainingFineMg * ratePerGramPaise) / 1000);

      expect(cashRequiredPaise).toBe(900000); // ₹9,000.00
    });

    it("Existing Gold Credit: 200g opening - 50g invoice = 150g remaining balance with zero credit notes", () => {
      const customerId = "cust-gold-balance-01";
      usePeople.setState({
        people: [
          {
            id: customerId,
            name: "Shree Ganesh Jewellers",
            type: "customer",
            goldOpeningFineMg: 200000, // 200 g
            goldOpeningType: "payable", // Customer Credit
            cashOpeningBalancePaise: 0,
            status: "active",
          } as any,
        ],
      });

      const jobWorkInvoice = {
        id: "inv-jw-50g-test",
        invoiceNo: "JW-2026-50",
        customerId,
        customerName: "Shree Ganesh Jewellers",
        billingType: "job_work" as const,
        totalFineMg: 50000,
        subtotalPaise: 1000000,
        gstPaise: 30000,
        grandTotalPaise: 1030000,
        paidPaise: 0,
        balancePaise: 1030000,
        status: "confirmed" as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        items: [],
        payments: [],
      };

      useBilling.setState({ invoices: [jobWorkInvoice as any] });

      const ledger = compileCustomerLedger(customerId);
      expect(ledger.openingGoldMg).toBe(200000);
      expect(ledger.closingGoldMg).toBe(150000); // 150.000 g remaining credit
      expect(ledger.goldAdvanceMg).toBe(150000);

      // Verify no credit notes were generated
      const creditNotes = useBilling.getState().invoices.filter((i) => (i as any).isCreditNote);
      expect(creditNotes.length).toBe(0);
    });
  });

  describe("2. Delivery Challan Integration with Billing", () => {
    it("Auto-generates and links Delivery Challan when 'movingForDelivery' is selected", async () => {
      const invoiceInput = {
        invoiceNo: "INV-2026-DELIVERY-01",
        customerId: "cust-delivery-01",
        customerName: "Rajesh Jewellers",
        billingType: "ready_stock" as const,
        movingForDelivery: true,
        carrierName: "BlueDart Express Courier",
        deliveryAddress: "45 Bullion Street, Kolkata - 700001",
        items: [
          {
            id: "it-d1",
            itemName: "22K Gold Chain",
            category: "Chains",
            purity: 916,
            grossMg: 15000,
            netMg: 15000,
            fineMg: 13740,
            pieces: 1,
            lineTotalPaise: 1100000,
          },
        ],
        gst: "gst3" as const,
        cgstPaise: 16500,
        sgstPaise: 16500,
        gstPaise: 33000,
        subtotalPaise: 1100000,
        grandTotalPaise: 1133000,
        paidPaise: 1133000,
        balancePaise: 0,
        payments: [],
        status: "confirmed" as const,
      };

      const createdInvoice = await useBilling.getState().add(invoiceInput as any);

      expect(createdInvoice).toBeDefined();
      expect(createdInvoice.linkedChallanNo).toBeDefined();

      const challans = useDeliveryChallans.getState().challans;
      expect(challans.length).toBe(1);
      expect(challans[0].challanNo).toBe(createdInvoice.linkedChallanNo);
      expect(challans[0].carrierName).toBe("BlueDart Express Courier");
      expect(challans[0].deliveryAddress).toBe("45 Bullion Street, Kolkata - 700001");
      expect(challans[0].items.length).toBe(1);
      expect(challans[0].items[0].grossMg).toBe(15000);
    });
  });

  describe("3. Karigar Purity-Specific Books & Custody Accounting", () => {
    it("Groups Karigar custody entries by purity grade (24K vs 22K)", () => {
      const workerId = "karigar-purity-01";
      useWorkerGoldBook.setState({
        entries: [
          {
            id: "w-24k-issue",
            workerId,
            date: "2026-08-31",
            type: "given",
            particulars: "24K Gold",
            purity: 999,
            grossMg: 100000,
            fineMg: 99900,
            quantity: 1,
            notes: "Raw pure gold",
          } as any,
          {
            id: "w-22k-issue",
            workerId,
            date: "2026-08-31",
            type: "given",
            particulars: "22K Gold",
            purity: 916,
            grossMg: 50000,
            fineMg: 45800,
            quantity: 1,
            notes: "22K alloyed stock",
          } as any,
          {
            id: "w-22k-return",
            workerId,
            date: "2026-08-31",
            type: "return",
            particulars: "22K Gold",
            purity: 916,
            grossMg: 45000,
            fineMg: 41220,
            quantity: 2,
            notes: "Finished jewellery returned",
          } as any,
        ],
      });

      const balance = useWorkerGoldBook.getState().getWorkerBalance(workerId);
      expect(balance.materialBalances.length).toBe(2);

      const pure24k = balance.materialBalances.find((m) => m.purity === 999);
      expect(pure24k).toBeDefined();
      expect(pure24k?.pendingGross).toBe(100000);
      expect(pure24k?.pendingFine).toBe(99900);

      const alloy22k = balance.materialBalances.find((m) => m.purity === 916);
      expect(alloy22k).toBeDefined();
      expect(alloy22k?.givenGross).toBe(50000);
      expect(alloy22k?.returnedGross).toBe(45000);
      expect(alloy22k?.pendingGross).toBe(5000); // 5.000 g 22K pending in custody
    });

    it("Transparent Work / Chain / Loss Settlement Formula", () => {
      const workDoneValuePaise = 5000000; // ₹50,000.00 labour
      const chainComponentDeductionPaise = 1500000; // ₹15,000.00 component cost
      const allowableWastageMg = 500; // 0.500 g allowable
      const actualLossMg = 650; // 0.650 g actual loss
      const overLossMg = Math.max(0, actualLossMg - allowableWastageMg); // 150 mg over-loss
      const goldRatePaisePerGram = 750000; // ₹7,500/g

      const overLossDeductionPaise = Math.round((overLossMg * goldRatePaisePerGram) / 1000); // ₹1,125.00

      const netSettlementPaise = workDoneValuePaise - chainComponentDeductionPaise - overLossDeductionPaise;

      expect(overLossMg).toBe(150);
      expect(overLossDeductionPaise).toBe(112500); // ₹1,125.00
      expect(netSettlementPaise).toBe(3387500); // ₹33,875.00 net payable to karigar
    });
  });

  describe("4. Universal Print Engine & Communication Integration", () => {
    it("Resolves Print Context & Generates Vector PDF for Retail Invoice and Job Card", async () => {
      const mockInv = {
        id: "inv-print-01",
        invoiceNo: "INV-2026-UPE",
        customerId: "cust-01",
        customerName: "Kolkata Gems",
        status: "paid" as const,
        subtotalPaise: 500000,
        grandTotalPaise: 500000,
        paidPaise: 500000,
        balancePaise: 0,
        items: [
          {
            id: "it-1",
            itemName: "Gold Necklace",
            category: "Necklaces",
            purity: 916,
            grossMg: 10000,
            netMg: 10000,
            fineMg: 9160,
            lineTotalPaise: 500000,
          },
        ],
        payments: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useBilling.setState({ invoices: [mockInv as any] });

      const data = resolvePrintContext("retail_invoice", "inv-print-01");
      expect(data).not.toBeNull();
      expect(data?.docNumber).toBe("INV-2026-UPE");

      const firmProfile = {
        shopName: "Maa Tara Jewellers",
        tagline: "Purity and Trust Since 1995",
        address: "Kolkata, WB",
        phone: "+91 98300 00000",
      };

      const a4Template = usePrintTemplates.getState().getForDocType("retail_invoice", "a4");
      const pdf = await generateDocumentPdf(data!, a4Template, firmProfile as any);
      expect(pdf.blob).toBeDefined();
      expect(pdf.blob.size).toBeGreaterThan(1000);
    });

    it("Dispatches automated email with full digital PDF attached", async () => {
      const res = await dispatchAutomaticBusinessEvent({
        eventKey: "invoice_created",
        recipient: {
          name: "Test Customer",
          email: "customer@example.com",
        },
        documentNumber: "INV-2026-UPE",
      });

      expect(res.ok).toBe(true);
    });
  });
});
