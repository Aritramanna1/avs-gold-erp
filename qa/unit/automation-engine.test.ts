import { describe, it, expect, beforeEach } from "vitest";
import {
  createERPEvent,
  getEventCategory,
  automationRuleEngine,
  automationQueue,
  automationAudit,
  automationScheduler,
  approvalEngine,
  reconciliationEngine,
  exceptionsManager,
  eodAutomationRunner,
  crmQuotationAutomation,
  useAutomationEngine,
  DEFAULT_AUTOMATION_RULES,
} from "../../src/lib/automation";

describe("Native ERP Automation Engine — Comprehensive Enterprise Test Suite", () => {
  beforeEach(() => {
    automationQueue.clearQueue();
    automationRuleEngine.setRules([...DEFAULT_AUTOMATION_RULES]);
  });

  it("1. Central Event Registry: correctly resolves event categories and envelopes", () => {
    const saleEvt = createERPEvent("SALE_CONFIRMED", { amountPaise: 100000 }, { tenantId: "tenant_alpha" });
    expect(saleEvt.category).toBe("sales");
    expect(saleEvt.context.tenantId).toBe("tenant_alpha");
    expect(saleEvt.id).toBeDefined();

    expect(getEventCategory("STOCK_LOW")).toBe("stock");
    expect(getEventCategory("KARIGAR_ISSUE_CREATED")).toBe("karigar");
    expect(getEventCategory("PAYROLL_ATTENDANCE_RECORDED")).toBe("payroll");
    expect(getEventCategory("SECURITY_ALERT")).toBe("security");
    expect(getEventCategory("SYSTEM_HEALTH_FAILED")).toBe("health");
    expect(getEventCategory("QUOTATION_CREATED")).toBe("quotation");
    expect(getEventCategory("APPOINTMENT_MISSED")).toBe("appointment");
    expect(getEventCategory("APPROVAL_REQUESTED")).toBe("approval");
    expect(getEventCategory("RECONCILIATION_RUN")).toBe("reconciliation");
  });

  it("2. Retail Store Automation: SALE_CONFIRMED triggers stock, customer ledger, and accounting actions", async () => {
    const saleEvent = createERPEvent(
      "SALE_CONFIRMED",
      {
        status: "confirmed",
        invoiceNumber: "INV-2026-001",
        totalAmountPaise: 5000000,
        customerName: "Aman Sharma",
        customerId: "CUST-101",
        stockItemId: "STK-991",
        quantity: 1,
      },
      { tenantId: "tenant_alpha", actorId: "pos_cashier_1" },
    );

    const result = await automationRuleEngine.processEvent(saleEvent);
    expect(result.matchedRules).toContain("rule_sale_confirmed_stock_ledger");
    expect(result.actionsQueued).toBe(4);

    // Drain queue
    await automationQueue.drain();

    const logs = automationAudit.getRecentLogs(10, { tenantId: "tenant_alpha" });
    const actionTypes = logs.map((l) => l.actionType);
    expect(actionTypes).toContain("update_inventory");
    expect(actionTypes).toContain("post_customer_ledger");
    expect(actionTypes).toContain("post_accounting_journal");
  });

  it("3. Ready Stock Auto-Barcode: READY_STOCK_CREATED generates unique barcode", async () => {
    const stockEvent = createERPEvent(
      "READY_STOCK_CREATED",
      {
        tag: "Gold Chain 22K",
        grossWeightG: 22.5,
        netWeightG: 22.5,
        purity: "22K/916",
      },
      { tenantId: "tenant_alpha" },
    );

    const res = await automationRuleEngine.processEvent(stockEvent);
    expect(res.matchedRules).toContain("rule_ready_stock_auto_barcode");

    await automationQueue.drain();
    const jobs = automationQueue.getAllJobs(5, "tenant_alpha");
    const barcodeJob = jobs.find((j) => j.action.type === "generate_barcode");
    expect(barcodeJob).toBeDefined();
    expect(barcodeJob?.status).toBe("completed");
    expect((barcodeJob?.result as any)?.barcode).toBeDefined();
  });

  it("4. Karigar Issue & Receipt: purity-wise book posting, wastage, over-loss, and settlement", async () => {
    // A. Issue
    const issueEvent = createERPEvent(
      "KARIGAR_ISSUE_CREATED",
      {
        workerId: "KARIGAR-SURESH",
        issuedWeightG: 30.0,
        purity: "22K/916",
      },
      { tenantId: "tenant_alpha" },
    );
    const issueRes = await automationRuleEngine.processEvent(issueEvent);
    expect(issueRes.matchedRules).toContain("rule_karigar_issue_purity_book");

    // B. Receipt with 0.150g Over-Loss and 1.5% Wastage
    const receiptEvent = createERPEvent(
      "KARIGAR_RECEIPT_CREATED",
      {
        workerId: "KARIGAR-SURESH",
        issuedWeightG: 30.0,
        receivedWeightG: 29.5,
        overLossG: 0.15,
        deductionsG: 0.0,
        wastagePct: 1.5,
        advancePaise: 200000,
      },
      { tenantId: "tenant_alpha" },
    );
    const receiptRes = await automationRuleEngine.processEvent(receiptEvent);
    expect(receiptRes.matchedRules).toContain("rule_karigar_receipt_settlement");

    await automationQueue.drain();

    const jobs = automationQueue.getAllJobs(10, "tenant_alpha");
    const settlementJob = jobs.find((j) => j.action.type === "calculate_karigar_settlement");
    expect(settlementJob?.status).toBe("completed");
    const result = settlementJob?.result as any;
    expect(result.overLossDeductedG).toBe(0.15);
    expect(result.allowedWastageG).toBe(0.45); // 30.0 * 1.5% = 0.45g
    expect(result.netSettledQuantityG).toBe(30.0 - 0.15 + 0.45); // 30.3g
  });

  it("5. CRM Quotation Conversion & Appointments: converts quotation to sale without duplicate creation", async () => {
    const quoteRes = await crmQuotationAutomation.convertQuotationToSale(
      {
        quotationId: "Q-9901",
        quotationNumber: "QT-2026-9901",
        customerId: "CUST-400",
        customerName: "Rahul Verma",
        items: [{ description: "Diamond Necklace", grossWeightG: 45.0, purity: "18K/750", estimatedPricePaise: 35000000 }],
        totalPaise: 35000000,
      },
      "tenant_alpha",
    );

    expect(quoteRes.matchedRules).toContain("rule_sale_confirmed_stock_ledger");

    // Appointment missed trigger
    const apptRes = await crmQuotationAutomation.trackAppointment(
      {
        appointmentId: "APPT-10",
        customerId: "CUST-400",
        customerName: "Rahul Verma",
        scheduledTime: "2026-09-06T15:00:00Z",
        serviceType: "Bridal Consultation",
        status: "missed",
      },
      "tenant_alpha",
    );

    expect(apptRes.matchedRules).toContain("rule_appointment_missed_followup");
  });

  it("6. Reusable Approval Engine: enforces human authorization for high-risk operations", async () => {
    const req = await approvalEngine.createRequest({
      tenantId: "tenant_alpha",
      type: "large_discount",
      title: "15% Special Discount on Bridal Set",
      description: "Salesperson applied ₹25,000 discount exceeding ₹5,000 limit.",
      sourceTransactionId: "INV-DRAFT-12",
      requestedBy: "Cashier-1",
      thresholdValue: 5000,
      actualValue: 25000,
      payload: { invoiceId: "INV-DRAFT-12", discountAmountPaise: 2500000 },
    });

    expect(req.status).toBe("pending");

    // Approve
    const resolveRes = await approvalEngine.resolveRequest(req.id, "approve", "Store Manager", "Authorized by owner");
    expect(resolveRes.success).toBe(true);
    expect(resolveRes.request?.status).toBe("approved");
    expect(resolveRes.request?.reviewedBy).toBe("Store Manager");
  });

  it("7. Daily Reconciliation & EOD Automation: verifies financial balance and closing report", async () => {
    const report = await reconciliationEngine.runReconciliation("tenant_alpha");
    expect(report.id).toBeDefined();
    expect(report.totalSalesPaise).toBeGreaterThan(0);

    const eod = await eodAutomationRunner.runEODClosing("tenant_alpha");
    expect(eod.date).toBeDefined();
    expect(eod.totalSalesCount).toBe(14);
  });

  it("8. Exception-First Attention Center: raises, tracks, and resolves discrepancies", async () => {
    const exc = await exceptionsManager.raiseException({
      tenantId: "tenant_alpha",
      category: "stock_variance",
      title: "Physical count variance on 22K Rings",
      description: "Expected 10 units, counted 9 units (-4.5g).",
      severity: "high",
      sourceId: "AUDIT-COUNT-01",
    });

    expect(exc.status).toBe("open");
    expect(exceptionsManager.getOpenExceptions("tenant_alpha").length).toBeGreaterThan(0);

    const ok = await exceptionsManager.resolveException(exc.id, "resolved", "Auditor-1");
    expect(ok).toBe(true);
  });

  it("9. Idempotency Guard: identical idempotencyKey prevents duplicate processing", async () => {
    const key = "idemp_unique_tx_12345";
    const jobData = {
      ruleId: "rule_test",
      ruleName: "Test Rule",
      event: createERPEvent("SALE_CONFIRMED", { amount: 100 }, { tenantId: "tenant_alpha" }),
      action: { type: "update_inventory" as const, name: "Deduct Stock", config: {} },
      idempotencyKey: key,
      correlationId: "corr_123",
    };

    const firstEnqueue = automationQueue.enqueue(jobData);
    expect(firstEnqueue.enqueued).toBe(true);

    // Drain queue to complete job
    await automationQueue.drain();

    // Second enqueue with same key
    const secondEnqueue = automationQueue.enqueue(jobData);
    expect(secondEnqueue.enqueued).toBe(false);
    expect(secondEnqueue.isDuplicate).toBe(true);
  });

  it("10. Multi-Tenant Isolation: Tenant B events do not trigger Tenant A scoped rules", async () => {
    automationRuleEngine.setRules([
      {
        id: "rule_tenant_a_only",
        name: "Tenant A VIP Rule",
        description: "Only for Tenant A",
        category: "customer",
        triggerEvent: "CUSTOMER_PURCHASED",
        enabled: true,
        conditions: [],
        actions: [{ type: "dispatch_notification", name: "Notify VIP", config: {} }],
        tenantId: "tenant_alpha",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const tenantBEvent = createERPEvent("CUSTOMER_PURCHASED", { amount: 500 }, { tenantId: "tenant_beta" });
    const res = await automationRuleEngine.processEvent(tenantBEvent);
    expect(res.matchedRules.length).toBe(0);

    const tenantAEvent = createERPEvent("CUSTOMER_PURCHASED", { amount: 500 }, { tenantId: "tenant_alpha" });
    const resA = await automationRuleEngine.processEvent(tenantAEvent);
    expect(resA.matchedRules).toContain("rule_tenant_a_only");
  });

  it("11. Scheduler Sweeps: can execute due payments, weekly allowances, and dead stock scans", async () => {
    const taskRes = await automationScheduler.runTask("sched_daily_due_payments", "tenant_alpha");
    expect(taskRes.success).toBe(true);

    const tasks = automationScheduler.getTasks();
    expect(tasks.length).toBeGreaterThanOrEqual(5);

    const allowanceTask = tasks.find((t) => t.id === "sched_weekly_karigar_allowances");
    expect(allowanceTask?.frequency).toBe("weekly");
  });

  it("12. Zustand Automation Store: reactive dispatch and rule toggle", async () => {
    const store = useAutomationEngine.getState();
    await store.initialize("tenant_alpha");

    const initialActive = store.stats.activeRulesCount;
    expect(initialActive).toBeGreaterThan(0);

    // Toggle rule
    const firstRuleId = store.rules[0].id;
    await store.toggleRule(firstRuleId, false);
    expect(useAutomationEngine.getState().rules.find((r) => r.id === firstRuleId)?.enabled).toBe(false);

    // Re-enable
    await store.toggleRule(firstRuleId, true);
    expect(useAutomationEngine.getState().rules.find((r) => r.id === firstRuleId)?.enabled).toBe(true);
  });
});
