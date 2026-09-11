#!/usr/bin/env node
/**
 * AVS ERP — Authoritative 24-Point Live Business Service & MCP Verification Suite
 * Executes real JSON-RPC 2.0 calls directly against https://erp.arivahly.in/api/mcp
 */

import { strict as assert } from "node:assert";

const REMOTE_MCP_URL = "https://erp.arivahly.in/api/mcp";

async function postJsonRpc(method, params = {}, headers = {}) {
  const reqBody = {
    jsonrpc: "2.0",
    id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    method,
    params,
  };

  const response = await fetch(REMOTE_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer test_operator_token_mcp",
      "X-Tenant-Id": "MTJ_FIRM",
      "X-Branch-Id": "MAIN",
      ...headers,
    },
    body: JSON.stringify(reqBody),
  });

  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

async function callTool(name, args = {}, headers = {}) {
  const res = await postJsonRpc("tools/call", { name, arguments: args }, headers);
  if (res.data?.error) {
    return { status: res.status, error: res.data.error, raw: res.data };
  }
  const result = res.data?.result?.structuredData || res.data?.result;
  return { status: res.status, result, raw: res.data };
}

console.log("══════════════════════════════════════════════════════════════════════════");
console.log("  AVS ERP — 24-POINT AUTHORITATIVE LIVE MCP BUSINESS VERIFICATION");
console.log(`  Endpoint: ${REMOTE_MCP_URL}`);
console.log(`  Timestamp: ${new Date().toISOString()}`);
console.log("══════════════════════════════════════════════════════════════════════════\n");

const results = [];

async function runTest(testNum, title, fn) {
  process.stdout.write(`[TEST ${testNum.toString().padStart(2, '0')}] ${title.padEnd(52)} ... `);
  try {
    const evidence = await fn();
    results.push({ num: testNum, title, status: "PASS", evidence });
    console.log("✓ PASS");
  } catch (err) {
    results.push({ num: testNum, title, status: "FAIL", error: err.message });
    console.log("✗ FAIL");
    console.error(`       Error: ${err.message}`);
  }
}

async function runAll() {
  // TEST 01: Global Party Identity Resolution (KG_101 strictly Gopal Karigar across all services)
  await runTest(1, "P0-1: KG_101 Global Canonical Identity Resolution", async () => {
    const balRes = await callTool("finance_get_account_balance", { partyId: "KG_101" });
    const profRes = await callTool("parties_get_party_profile", { partyId: "KG_101" });
    const kgRes = await callTool("karigar_search_karigars", { query: "KG_101" });

    assert.equal(balRes.result.partyName, "Gopal Karigar", `finance balance mismatch: ${balRes.result.partyName}`);
    assert.equal(balRes.result.partyType, "KARIGAR");
    assert.equal(profRes.result.name, "Gopal Karigar", `party profile mismatch: ${profRes.result.name}`);
    assert.equal(kgRes.result.karigars[0].name, "Gopal Karigar");

    // Also check Sanjay Mehta
    const sanjayBal = await callTool("finance_get_account_balance", { partyId: "CUST_SANJAY_MEHTA" });
    assert.equal(sanjayBal.result.partyName, "Sanjay Mehta");
    assert.equal(sanjayBal.result.partyType, "CUSTOMER");

    return { kg101: balRes.result, sanjay: sanjayBal.result };
  });

  // TEST 02: Generate August Payroll
  let initialPayrollRunId = null;
  await runTest(2, "P0-2: Generate August Payroll (2026-08 v1)", async () => {
    const res = await callTool("hr_generate_monthly_payroll", { month: "2026-08", version: 1 });
    assert.ok(res.result.status === "PROCESSED" || res.result.status === "ALREADY_PROCESSED");
    assert.ok(res.result.payrollRunId, "Missing payrollRunId");
    assert.equal(res.result.month, "2026-08");
    initialPayrollRunId = res.result.payrollRunId;
    return res.result;
  });

  // TEST 03: Repeat Exact Same Payroll Request -> Deterministic Idempotency
  await runTest(3, "P0-2: Deterministic Payroll Idempotency & Replay", async () => {
    const res = await callTool("hr_generate_monthly_payroll", { month: "2026-08", version: 1 });
    assert.equal(res.result.status, "ALREADY_PROCESSED");
    assert.equal(res.result.idempotentResult, true);
    assert.equal(res.result.payrollRunId, initialPayrollRunId);
    assert.equal(res.result.duplicateFinancialPostingPrevented, true);
    return res.result;
  });

  // TEST 04: Invoice A (1.25g Line @ ₹7,450 + ₹500 making)
  let invoiceAResult = null;
  await runTest(4, "P0-3: Invoice A Dynamic Calculation (1.25g line)", async () => {
    const res = await callTool("sales_create_tax_invoice", {
      customerId: "CUST_SANJAY_MEHTA",
      grossWeightGrams: 1.25,
      purity: 916,
      wastagePercent: 0,
      goldRatePerGramRupees: 7450,
      makingChargesRupees: 500,
      amountPaidRupees: 0
    });
    assert.equal(res.result.status, "INVOICE_GENERATED");
    const tree = res.result.calculationTree;
    assert.equal(tree.gross, 1.25);
    assert.equal(tree.goldValue, 9312.5);
    assert.equal(tree.making, 500);
    assert.equal(tree.taxableAmount, 9812.5);
    assert.equal(tree.cgst, 147.19);
    assert.equal(tree.sgst, 147.19);
    assert.equal(tree.grandTotal, 10106.88);
    invoiceAResult = res.result;
    return res.result;
  });

  // TEST 05: Invoice B (0.01g Line @ ₹7,450 + ₹0 making + ₹80 paid)
  await runTest(5, "P0-3: Invoice B Dynamic Calculation (0.01g line)", async () => {
    const res = await callTool("sales_create_tax_invoice", {
      customerId: "CUST_SANJAY_MEHTA",
      grossWeightGrams: 0.01,
      purity: 916,
      wastagePercent: 0,
      goldRatePerGramRupees: 7450,
      makingChargesRupees: 0,
      amountPaidRupees: 80
    });
    assert.equal(res.result.status, "INVOICE_GENERATED");
    const tree = res.result.calculationTree;
    assert.equal(tree.gross, 0.01);
    assert.equal(tree.goldValue, 74.5);
    assert.equal(tree.making, 0);
    assert.equal(tree.taxableAmount, 74.5);
    assert.equal(tree.cgst, 1.12);
    assert.equal(tree.sgst, 1.12);
    assert.equal(tree.grandTotal, 76.74);
    assert.equal(tree.amountPaid, 80);
    assert.equal(tree.remaining, 0);
    assert.equal(tree.excessLedgerCredit, 3.26);

    // Assert that Invoice A and Invoice B are materially different and NOT static mocks
    assert.notEqual(invoiceAResult.grandTotalRupees, res.result.grandTotalRupees);
    return res.result;
  });

  // TEST 06: Customer Jama (Raju Das, 20.000g @ 995, Cash ₹0)
  await runTest(6, "P0-4: Canonical Customer Gold Jama Transaction", async () => {
    const res = await callTool("customer_gold_receipt", {
      customerId: "CUST_RAJU_DAS",
      goldGrams: 20.0,
      purity: 995,
      cashAmount: 0,
      narration: "Authoritative Raju Das Gold Jama"
    });
    assert.equal(res.result.status, "RECEIPT_COMMITTED_AND_ALLOCATED");
    assert.equal(res.result.customerName, "Raju Das");
    assert.equal(res.result.physicalGoldGrams, 20.0);
    assert.equal(res.result.fineGoldGrams995, 20.0);
    assert.ok(res.result.receiptNumber.startsWith("JAMA_RCP_"));
    assert.ok(res.result.publicVerificationUrl.includes("/verify/doc/"));
    assert.equal(res.result.duplicatePostingPrevented, true);
    return res.result;
  });

  // TEST 07: CASE A - 20g @ 995 against 10g + 7g + 3g -> all PAID
  await runTest(7, "P0-5: Case A FIFO Allocation (20g against 10+7+3g)", async () => {
    const res = await callTool("customer_gold_receipt", {
      customerId: "CUST_RAJU_DAS",
      goldGrams: 20.0,
      purity: 995,
      outstandingInvoices: [
        { invoiceId: "INV_001", dueGoldGrams: 10.0 },
        { invoiceId: "INV_002", dueGoldGrams: 7.0 },
        { invoiceId: "INV_003", dueGoldGrams: 3.0 }
      ]
    });
    assert.equal(res.result.status, "RECEIPT_COMMITTED_AND_ALLOCATED");
    assert.equal(res.result.allocations.length, 3);
    assert.equal(res.result.allocations[0].status, "PAID");
    assert.equal(res.result.allocations[0].appliedGoldGrams, 10.0);
    assert.equal(res.result.allocations[1].status, "PAID");
    assert.equal(res.result.allocations[1].appliedGoldGrams, 7.0);
    assert.equal(res.result.allocations[2].status, "PAID");
    assert.equal(res.result.allocations[2].appliedGoldGrams, 3.0);
    assert.equal(res.result.remainingCustomerGoldGrams, 0.0);
    assert.equal(res.result.excessLedgerCreditGrams, 0.0);
    return res.result;
  });

  // TEST 08: CASE B - 25g @ 995 against 20g -> 20g applied, 5g excess credit
  await runTest(8, "P0-5: Case B Advance Excess Credit (25g against 20g)", async () => {
    const res = await callTool("customer_gold_receipt", {
      customerId: "CUST_RAJU_DAS",
      goldGrams: 25.0,
      purity: 995,
      outstandingInvoices: [
        { invoiceId: "INV_001", dueGoldGrams: 20.0 }
      ]
    });
    assert.equal(res.result.allocations[0].status, "PAID");
    assert.equal(res.result.allocations[0].appliedGoldGrams, 20.0);
    assert.equal(res.result.remainingCustomerGoldGrams, 5.0);
    assert.equal(res.result.excessLedgerCreditGrams, 5.0);
    assert.ok(res.result.excessLedgerCreditNote.includes("Excess 5g credited to Customer Ledger"));
    return res.result;
  });

  // TEST 09: CASE C - Partial 4g against 10g -> 4g applied, 6g remains PARTIAL
  await runTest(9, "P0-5: Case C Partial Allocation (4g against 10g)", async () => {
    const res = await callTool("customer_gold_receipt", {
      customerId: "CUST_RAJU_DAS",
      goldGrams: 4.0,
      purity: 995,
      outstandingInvoices: [
        { invoiceId: "INV_001", dueGoldGrams: 10.0 }
      ]
    });
    assert.equal(res.result.allocations[0].status, "PARTIAL");
    assert.equal(res.result.allocations[0].appliedGoldGrams, 4.0);
    assert.equal(res.result.allocations[0].remainingDueGrams, 6.0);
    assert.equal(res.result.excessLedgerCreditGrams, 0.0);
    return res.result;
  });

  // TEST 10: CASE D - Idempotency Replay
  await runTest(10, "P0-5: Case D Idempotency Replay with same key", async () => {
    const testKey = "idem_jama_test_" + Date.now();
    const res1 = await callTool("customer_gold_receipt", {
      customerId: "CUST_RAJU_DAS",
      goldGrams: 10.0,
      purity: 995,
      idempotencyKey: testKey
    });
    const res2 = await callTool("customer_gold_receipt", {
      customerId: "CUST_RAJU_DAS",
      goldGrams: 10.0,
      purity: 995,
      idempotencyKey: testKey
    });

    assert.equal(res1.result.receiptNumber, res2.result.receiptNumber);
    assert.equal(res2.result.status, "IDEMPOTENT_REPLAY");
    assert.equal(res2.result.isReplay, true);
    return { first: res1.result, replay: res2.result };
  });

  // TEST 11: Karigar Settlement Complete Calculation Breakdown
  await runTest(11, "P0-6: Karigar Deduction Tree & Settlement Breakdown", async () => {
    const res = await callTool("karigar_prepare_karigar_settlement", {
      karigarId: "KG_101",
      totalWorkGrossGrams: 100.0,
      overLossGrams: 1.5,
      chainWeightGrams: 18.5,
      priorDeductionsGrams: 0.0,
      loanAdvanceGrams: 5.0,
      wastagePercent: 8.5,
      goldRatePerGramRupees: 7500.0
    });
    const t = res.result.calculationTree;
    assert.equal(t.totalWorkGrossGrams, 100.0);
    assert.equal(t.overLossGrams, 1.5);
    assert.equal(t.chainWeightGrams, 18.5);
    assert.equal(t.loanAdvanceGrams, 5.0);
    assert.equal(t.finalSettlementBasisGrams, 75.0); // 100 - 1.5 - 18.5 - 5 = 75.0
    assert.equal(t.wastageWeightGrams, 6.375); // 75 * 8.5% = 6.375
    assert.equal(res.result.karigarName, "Gopal Karigar");
    return res.result;
  });

  // TEST 12: Karigar GOLD Payout Mode
  await runTest(12, "P0-6: Karigar GOLD Payout Contract", async () => {
    const res = await callTool("workshop_settle_worker_bill", {
      karigarId: "KG_101",
      payoutMode: "GOLD",
      finalGoldEntitlementGrams: 1.8,
      goldRatePerGramRupees: 7500.0
    });
    assert.equal(res.result.payoutMode, "GOLD");
    assert.equal(res.result.goldPaid, "1.800 g Fine Gold @ 995");
    assert.equal(res.result.cashPaid, "₹0.00");
    assert.equal(res.result.remainingGoldObligation, "0.000 g");
    assert.ok(res.result.paymentReference.startsWith("VCH_METAL_GOLD_"));
    return res.result;
  });

  // TEST 13: Karigar CASH Payout Mode
  await runTest(13, "P0-6: Karigar CASH Payout Contract", async () => {
    const res = await callTool("workshop_settle_worker_bill", {
      karigarId: "KG_101",
      payoutMode: "CASH",
      finalGoldEntitlementGrams: 1.8,
      goldRatePerGramRupees: 7500.0
    });
    assert.equal(res.result.payoutMode, "CASH");
    assert.equal(res.result.goldPaid, "0.000 g");
    assert.equal(res.result.cashPaid, "₹13,500.00"); // 1.8 * 7500
    assert.equal(res.result.remainingGoldObligation, "0.000 g");
    assert.ok(res.result.paymentReference.startsWith("VCH_CASH_PAY_"));
    return res.result;
  });

  // TEST 14: Karigar BANK_TRANSFER Payout Mode
  await runTest(14, "P0-6: Karigar BANK_TRANSFER Payout Contract", async () => {
    const res = await callTool("workshop_settle_worker_bill", {
      karigarId: "KG_101",
      payoutMode: "BANK_TRANSFER",
      finalGoldEntitlementGrams: 1.8,
      goldRatePerGramRupees: 7500.0
    });
    assert.equal(res.result.payoutMode, "BANK_TRANSFER");
    assert.equal(res.result.goldPaid, "0.000 g");
    assert.equal(res.result.cashPaid, "₹13,500.00");
    assert.ok(res.result.paymentReference.startsWith("NEFT_HDFC_"));
    return res.result;
  });

  // TEST 15: Public Document Verification Reference
  await runTest(15, "P1-7: Public Document Verification Reference", async () => {
    const docRes = await callTool("comm_generate_document_pdf", {
      documentType: "INVOICE",
      documentId: "INV_2026_0909_881"
    });
    assert.ok(docRes.result.verificationToken.startsWith("DOC_VERIFY_"));
    assert.ok(docRes.result.publicVerificationUrl.includes("/verify/doc/"));

    const verifyRes = await callTool("documents_verify_document_token", {
      verificationToken: docRes.result.verificationToken
    });
    assert.equal(verifyRes.result.verificationStatus, "VERIFIED_AUTHENTIC");
    assert.equal(verifyRes.result.documentType, "TAX_INVOICE");
    assert.equal(verifyRes.result.isRevoked, false);
    return { doc: docRes.result, verified: verifyRes.result };
  });

  // TEST 16: Paid Invoice -> WhatsApp Lifecycle
  const testWaInvoiceId = "INV_LIVE_PAID_" + Date.now();
  await runTest(16, "P1-8: Paid Invoice WhatsApp Event Dispatch", async () => {
    const waRes = await callTool("comm_send_whatsapp_invoice", {
      invoiceId: testWaInvoiceId,
      phoneNumber: "+919830012345",
      isPaid: true
    });
    assert.equal(waRes.result.status, "WHATSAPP_MESSAGE_SENT");
    assert.equal(waRes.result.deliveryStatus, "DELIVERED");
    return waRes.result;
  });

  // TEST 17: Duplicate WhatsApp Event Suppression
  await runTest(17, "P1-8: Duplicate WhatsApp Suppression on Replay", async () => {
    const res = await callTool("comm_send_whatsapp_invoice", {
      invoiceId: testWaInvoiceId,
      phoneNumber: "+919830012345",
      isPaid: true
    });
    assert.equal(res.result.status, "ALREADY_DELIVERED");
    assert.equal(res.result.duplicateSuppressed, true);
    return res.result;
  });

  // TEST 18: Automation Center CRUD & Execution History
  await runTest(18, "P1-9: Automation Center CRUD & Execution History", async () => {
    const listRes = await callTool("automation_list_rules", {});
    const createRes = await callTool("automation_create_rule", {
      name: "Auto-Alert on Bullion Rate Change",
      event: "DAILY_BHAV_UPDATED",
      action: "BROADCAST_SMS"
    });
    const triggerRes = await callTool("automation_test_trigger", { ruleId: "RULE_01" });
    const histRes = await callTool("automation_get_execution_history", {});

    assert.ok(listRes.result.rules.length >= 3);
    assert.equal(createRes.result.status, "RULE_CREATED");
    assert.equal(triggerRes.result.status, "TEST_TRIGGERED_SUCCESSFULLY");
    assert.ok(histRes.result.executions.length >= 3);
    return { list: listRes.result, create: createRes.result, test: triggerRes.result };
  });

  // TEST 19: Provider Credential Center (Zero Secret Leakage)
  await runTest(19, "P1-10: Provider Credential Center & Secret Masking", async () => {
    const listRes = await callTool("provider_list_credentials", {});
    const saveRes = await callTool("provider_save_credential", {
      provider: "WHATSAPP_META",
      apiKey: "EAAK992817264810293847291a1"
    });
    const testRes = await callTool("provider_test_connection", { provider: "WHATSAPP_META" });

    // Assert secrets are masked
    assert.ok(listRes.result.providers[0].maskedKey.includes("••••"));
    assert.equal(saveRes.result.secretExposed, false);
    assert.ok(saveRes.result.maskedKey.includes("••••"));
    assert.equal(testRes.result.status, "CONNECTION_SUCCESSFUL");
    return { providers: listRes.result.providers, save: saveRes.result };
  });

  // TEST 20: Customer Multi-Document Print Bundle
  await runTest(20, "P1-11: Customer Print Bundle Generation", async () => {
    const res = await callTool("comm_generate_customer_bundle", {
      customerId: "CUST_SANJAY_MEHTA",
      bundleType: "ALL"
    });
    assert.equal(res.result.status, "BUNDLE_GENERATED");
    assert.equal(res.result.customerName, "Sanjay Mehta");
    assert.equal(res.result.sections.length, 4);
    assert.equal(res.result.universalPrintReady, true);
    return res.result;
  });

  // TEST 21: Chronological Authoritative Karigar Book
  await runTest(21, "P1-4: Cumulative Chronological Karigar Book", async () => {
    const res = await callTool("reports_get_karigar_book", { karigarId: "KG_101" });
    assert.equal(res.result.karigarName, "Gopal Karigar");
    assert.equal(res.result.bookPurity, "916 / 22K");
    assert.ok(res.result.chronologicalEntries.length >= 8);
    const activities = res.result.chronologicalEntries.map(e => e.activity);
    assert.ok(activities.includes("ISSUE"));
    assert.ok(activities.includes("OUTSIDE_WORK"));
    assert.ok(activities.includes("RECEIVE"));
    assert.ok(activities.includes("OVER_LOSS"));
    assert.ok(activities.includes("CHAIN_DEDUCTION"));
    assert.ok(activities.includes("ADVANCE_RECOVERY"));
    assert.ok(activities.includes("SETTLEMENT_PAYOUT"));
    return res.result;
  });

  // TEST 22: Exact Audit Query Filtering
  await runTest(22, "P1-13: Audit Search Query Filtering", async () => {
    const payrollLogs = await callTool("audit_search_logs", { actionType: "PAYROLL" });
    const waLogs = await callTool("audit_search_logs", { actionType: "WHATSAPP_MESSAGE_SENT" });
    const kgLogs = await callTool("audit_search_logs", { actionType: "KARIGAR_SETTLEMENT" });
    const jamaLogs = await callTool("audit_search_logs", { actionType: "CUSTOMER_GOLD_RECEIPT" });

    assert.equal(payrollLogs.result.logs.length, 1);
    assert.equal(payrollLogs.result.logs[0].actionType, "PAYROLL");

    assert.equal(waLogs.result.logs.length, 1);
    assert.equal(waLogs.result.logs[0].actionType, "WHATSAPP_MESSAGE_SENT");

    assert.equal(kgLogs.result.logs.length, 1);
    assert.equal(kgLogs.result.logs[0].actionType, "KARIGAR_SETTLEMENT");

    assert.equal(jamaLogs.result.logs.length, 1);
    assert.equal(jamaLogs.result.logs[0].actionType, "CUSTOMER_GOLD_RECEIPT");

    return { payroll: payrollLogs.result, wa: waLogs.result, kg: kgLogs.result, jama: jamaLogs.result };
  });

  // TEST 23: Trial Balance Exact Zero Variance
  await runTest(23, "P1-12: Trial Balance Zero Variance Invariance", async () => {
    const res = await callTool("finance_get_trial_balance", {});
    assert.equal(res.result.balanced, true);
    assert.equal(res.result.cashDebitRupees, "₹18,45,000.00");
    assert.equal(res.result.cashCreditRupees, "₹18,45,000.00");
    assert.equal(res.result.cashVariance, "₹0.00");
    assert.equal(res.result.goldDebitFineGrams, "1250.000 g @ 995");
    assert.equal(res.result.goldCreditFineGrams, "1250.000 g @ 995");
    assert.equal(res.result.goldVariance, "0.000 g");
    assert.equal(res.result.invarianceCheck, "EXACT_ZERO_VARIANCE_VERIFIED");
    return res.result;
  });

  // TEST 24: Cross-Tenant Isolation Enforcement
  await runTest(24, "P0-1: Cross-Tenant Isolation Rejection Guard (403)", async () => {
    const rogueRes = await callTool("finance_get_account_balance", {
      tenantId: "ROGUE_TENANT_ATTACK",
      partyId: "CUST_SANJAY_MEHTA"
    });
    assert.equal(rogueRes.status, 403);
    assert.equal(rogueRes.error.code, -32003);
    assert.ok(rogueRes.error.message.includes("TENANT_ACCESS_DENIED"));
    return { status: 403, error: rogueRes.error };
  });

  console.log("\n══════════════════════════════════════════════════════════════════════════");
  const passed = results.filter(r => r.status === "PASS").length;
  console.log(`  FINAL VERIFICATION RESULT: ${passed} / ${results.length} PASSED (${Math.round((passed / results.length) * 100)}%)`);
  console.log("══════════════════════════════════════════════════════════════════════════\n");
}

runAll().catch(err => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
