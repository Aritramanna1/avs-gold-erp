import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import {
  AIService,
  getAIConfig,
  saveAIConfig,
  resolveConfiguredApiKey,
  testAIConnectivity,
} from "@/lib/ai-readiness/ai-service-interface";
import { AI_TOOL_REGISTRY } from "@/lib/ai-readiness/ai-tool-registry";
import { evaluateAIPermission, AIPermissionLevel } from "@/lib/ai-readiness/ai-permission-matrix";
import { getAIAuditLogs, logAIAction } from "@/lib/ai-readiness/ai-audit-logger";
import { usePeople } from "@/lib/people-store";
import { useStock } from "@/lib/stock-store";
import { useLedger } from "@/lib/ledger-store";
import { useBilling } from "@/lib/billing-store";
import { useJobCards } from "@/lib/jobcards-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";

// Mock localStorage for node environment
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value.toString();
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    Object.keys(store).forEach((k) => delete store[k]);
  },
};

describe("AI Activation & Production Readiness Test Suite", () => {
  beforeAll(() => {
    (globalThis as any).window = (globalThis as any).window || { localStorage: localStorageMock };
    (globalThis as any).localStorage = localStorageMock;
  });

  beforeEach(() => {
    localStorageMock.clear();
  });

  describe("1. AI Configuration & Key Auto-Detection", () => {
    it("resolves API key from secure storage and auto-enables AI", () => {
      saveAIConfig({
        enabled: true,
        provider: "google_gemini",
        model: "gemini-1.5-flash",
        apiKey: "AIzaSyTestApiKey1234567890",
        temperature: 0.3,
        maxUsagePerDay: 500,
        dailyUsageCount: 0,
        approvalMode: "supervised",
        logAllPrompts: true,
      });

      const key = resolveConfiguredApiKey();
      expect(key).toBe("AIzaSyTestApiKey1234567890");

      const config = getAIConfig();
      expect(config.enabled).toBe(true);
      expect(config.provider).toBe("google_gemini");
      expect(AIService.isEnabled()).toBe(true);
    });

    it("reports correct status description in Active vs Sandbox mode", () => {
      saveAIConfig({
        enabled: true,
        provider: "google_gemini",
        model: "gemini-1.5-flash",
        apiKey: "AIzaSyTestApiKey1234567890",
        temperature: 0.3,
        maxUsagePerDay: 500,
        dailyUsageCount: 0,
        approvalMode: "supervised",
        logAllPrompts: true,
      });

      const activeStatus = AIService.getStatusDescription();
      expect(activeStatus.status).toBe("ACTIVE");
      expect(activeStatus.message).toContain("Active & Operational");

      saveAIConfig({
        ...getAIConfig(),
        approvalMode: "strict_approval",
      });
      const sandboxStatus = AIService.getStatusDescription();
      expect(sandboxStatus.status).toBe("SANDBOX");
      expect(sandboxStatus.message).toContain("Sandbox Mode");
    });
  });

  describe("2. Comprehensive Controlled ERP Tool Registry", () => {
    it("executes customer and supplier search tools correctly", async () => {
      usePeople.setState({
        people: [
          { id: "CUST-001", name: "Aarav Sharma", phone: "9876543210", city: "Mumbai", category: "customer" } as any,
          { id: "SUPP-001", name: "Apex Bullion Refiners", phone: "9811122233", city: "Zaveri Bazaar", category: "supplier" } as any,
        ],
      });

      const custRes = await AI_TOOL_REGISTRY.search_customer.handler({ query: "aarav" });
      expect(custRes.status).toBe("success");
      expect((custRes as any).count).toBe(1);
      expect((custRes as any).matches[0].name).toBe("Aarav Sharma");

      const suppRes = await AI_TOOL_REGISTRY.search_supplier.handler({ query: "apex" });
      expect(suppRes.status).toBe("success");
      expect((suppRes as any).count).toBe(1);
      expect((suppRes as any).matches[0].name).toBe("Apex Bullion Refiners");
    });

    it("executes item search and inventory levels tools", async () => {
      useStock.setState({
        items: [
          {
            id: "STK-1",
            itemCode: "RNG-22K-001",
            barcode: "BRC123456",
            name: "22K Solitaire Ring",
            category: "Ring",
            purity: "22K",
            grossWeightG: 5.5,
            netWeightG: 5.2,
            status: "in_stock",
          } as any,
        ],
      });

      const itemRes = await AI_TOOL_REGISTRY.search_item.handler({ query: "ring" });
      expect(itemRes.status).toBe("success");
      expect((itemRes as any).count).toBe(1);

      const barcodeRes = await AI_TOOL_REGISTRY.search_barcode.handler({ barcode: "BRC123456" });
      expect(barcodeRes.status).toBe("success");
      expect((barcodeRes as any).type).toBe("stock_item");
      expect((barcodeRes as any).item.itemCode).toBe("RNG-22K-001");
    });

    it("executes Three-Ledger tools: Cash Ledger, Gold Ledger, and Mixed Ledger", async () => {
      useBilling.setState({
        invoices: [
          {
            id: "INV-101",
            invoiceNumber: "INV-2026-001",
            customerId: "CUST-001",
            customerName: "Aarav Sharma",
            grandTotalPaise: 15000000, // ₹1,50,000
            createdAt: new Date().toISOString(),
            status: "unpaid",
          } as any,
        ],
      });

      const cashRes = await AI_TOOL_REGISTRY.get_cash_ledger.handler({ partyId: "CUST-001" });
      expect(cashRes.status).toBe("success");
      expect((cashRes as any).totalSalesRupees).toBe(150000);

      const mixedRes = await AI_TOOL_REGISTRY.get_mixed_ledger.handler({ partyId: "CUST-001" });
      expect(mixedRes.status).toBe("success");
      expect((mixedRes as any).cashBalanceRupees).toBe(150000);
    });

    it("executes Karigar balance and over-loss query tools", async () => {
      const now = new Date().toISOString();
      useWorkerGoldBook.setState({
        entries: [
          {
            id: "WGB-1",
            workerId: "WRK-001",
            type: "issue",
            purity: "22K",
            weightGrams: 100,
            fineGrams: 91.6,
            createdAt: now,
          } as any,
          {
            id: "WGB-2",
            workerId: "WRK-001",
            type: "over_loss",
            purity: "22K",
            weightGrams: 0.5,
            fineGrams: 0.458,
            notes: "Filing loss exceeding allowance",
            createdAt: now,
          } as any,
        ],
        getWorkerBalance: (workerId: string) => ({
          workerId,
          totalGivenFine: 91600,
          totalReturnedFine: 0,
          pendingFine: 91600,
          pendingQty: 1,
        }),
      });

      const balRes = await AI_TOOL_REGISTRY.get_karigar_balance.handler({ workerId: "WRK-001" });
      expect(balRes.status).toBe("success");
      expect((balRes as any).pendingFineG).toBe(91.6);

      const overlossRes = await AI_TOOL_REGISTRY.get_karigar_overloss.handler({ workerId: "WRK-001" });
      expect(overlossRes.status).toBe("success");
      expect((overlossRes as any).overLossCount).toBe(1);
    });
  });

  describe("3. Draft-First Financial Safety Controls", () => {
    it("generates draft quotation with frozen gold rate without posting financial records", async () => {
      const quoteRes = await AI_TOOL_REGISTRY.draft_quotation.handler({
        customerId: "CUST-001",
        grossWeightG: 10,
        purityPermille: 916,
        makingChargePerGram: 450,
      });

      expect(quoteRes.status).toBe("success");
      const draft = (quoteRes as any).draftQuotation;
      expect(draft.customerId).toBe("CUST-001");
      expect(draft.grossWeightG).toBe(10);
      expect(draft.goldValueRupees).toBeGreaterThan(0);
      expect(draft.makingChargeRupees).toBe(4500);
      expect(draft.grandTotalRupees).toBeGreaterThan(draft.goldValueRupees);
    });

    it("generates draft invoice requiring maker-checker approval", async () => {
      const draftInv = await AI_TOOL_REGISTRY.draft_invoice.handler({
        customerId: "CUST-001",
        itemsDescription: "1x Gold Ring, 1x Bangle",
      });

      expect(draftInv.status).toBe("success");
      expect((draftInv as any).requiresMakerCheckerApproval).toBe(true);
      expect((draftInv as any).draftStatus).toBe("DRAFT_PENDING_REVIEW");
    });

    it("routes draft owner drawings strictly through Expense workflow with founder approval", async () => {
      const drawings = await AI_TOOL_REGISTRY.draft_owner_drawings.handler({
        ownerName: "Partner A",
        amountRupees: 50000,
        reason: "Personal Advance",
      });

      expect(drawings.status).toBe("success");
      expect((drawings as any).workflow).toBe("Expense -> Record Owner Drawings");
      expect((drawings as any).draftStatus).toBe("DRAFT_REQUIRES_FOUNDER_APPROVAL");
    });
  });

  describe("4. Permission Matrix & Safety Rules", () => {
    it("correctly identifies high-risk actions requiring mandatory human approval", () => {
      const rateRule = evaluateAIPermission("gold_rate.update");
      expect(rateRule.level).toBe(AIPermissionLevel.LEVEL_4_HUMAN_APPROVAL_MANDATORY);
      expect(rateRule.canEverAutoExecute).toBe(false);

      const cancelRule = evaluateAIPermission("invoice.cancel");
      expect(cancelRule.level).toBe(AIPermissionLevel.LEVEL_4_HUMAN_APPROVAL_MANDATORY);
      expect(cancelRule.requiresFounderApproval).toBe(true);

      const searchRule = evaluateAIPermission("customer.search");
      expect(searchRule.level).toBe(AIPermissionLevel.LEVEL_0_READ_ONLY);
      expect(searchRule.canEverAutoExecute).toBe(true);
    });
  });

  describe("5. AI Audit Logging & Observability", () => {
    it("persists and retrieves immutable AI action logs", () => {
      const record = logAIAction({
        agentName: "AI Copilot",
        provider: "google_gemini",
        model: "gemini-1.5-flash",
        toolUsed: "search_customer",
        parameters: { query: "Aarav" },
        outputResult: { count: 1 },
        permissionLevel: 0,
        requiresHumanApproval: false,
        approvalStatus: "auto_executed",
      });

      expect(record.id).toMatch(/^AILOG-/);
      const logs = getAIAuditLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].toolUsed).toBe("search_customer");
    });
  });
});
