import https from 'https';
import fs from 'fs';
import assert from 'assert/strict';

const MCP_ENDPOINT = 'https://erp.arivahly.in/api/mcp';
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Authorization': 'Bearer test_token_mcp_operator',
  'X-Tenant-Id': 'MTJ_FIRM',
  'X-Branch-Id': 'MAIN',
  'X-MCP-Version': '1.5.0'
};

function callTool(toolName, args = {}, tenant = 'MTJ_FIRM', branch = 'MAIN', customHeaders = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    });

    const headers = {
      ...DEFAULT_HEADERS,
      'X-Tenant-Id': tenant,
      'X-Branch-Id': branch,
      'Content-Length': Buffer.byteLength(payload),
      ...customHeaders
    };

    const req = https.request(MCP_ENDPOINT, {
      method: 'POST',
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            resolve({ isError: true, error: parsed.error, statusCode: res.statusCode });
          } else if (parsed.result) {
            const struct = parsed.result.structuredData || JSON.parse(parsed.result.content[0].text);
            resolve({ isError: false, data: struct, statusCode: res.statusCode });
          } else {
            resolve({ isError: true, raw: data, statusCode: res.statusCode });
          }
        } catch (e) {
          resolve({ isError: true, parseError: e.message, raw: data, statusCode: res.statusCode });
        }
      });
    });

    req.on('error', (err) => resolve({ isError: true, networkError: err.message }));
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════════");
  console.log("  AVS ERP — MASTER REPAIR & CERTIFICATION REGRESSION HARNESS");
  console.log("  Target: " + MCP_ENDPOINT);
  console.log("  Time:   " + new Date().toISOString());
  console.log("══════════════════════════════════════════════════════════════════════════\n");

  const results = [];

  async function testCase(id, category, name, fn) {
    process.stdout.write(`[${id}] ${category} - ${name.padEnd(52)} ... `);
    try {
      const res = await fn();
      console.log("✓ PASS");
      results.push({ id, category, name, status: 'PASS', ...res });
    } catch (err) {
      console.log(`✗ FAIL: ${err.message}`);
      results.push({ id, category, name, status: 'FAIL', error: err.message });
    }
  }

  // 1. P0 IDENTITY / NOT-FOUND: CUST_DOES_NOT_EXIST
  await testCase('REP-01', 'P0 IDENTITY', 'Nonexistent Customer returns NOT_FOUND (-32004)', async () => {
    const res = await callTool('customers_get_customer', { customerId: 'CUST_DOES_NOT_EXIST' });
    assert(res.isError, "Must return error");
    assert.equal(res.error?.code, -32004, "Error code must be -32004");
    assert(res.error?.message.includes("NOT_FOUND"), "Must contain NOT_FOUND");
    return { actual: res.error?.message, errorCode: res.error?.code };
  });

  // 2. P0 IDENTITY / NOT-FOUND: PARTY_DOES_NOT_EXIST
  await testCase('REP-02', 'P0 IDENTITY', 'Nonexistent Party returns NOT_FOUND (-32004)', async () => {
    const res = await callTool('parties_get_party_profile', { partyId: 'PARTY_DOES_NOT_EXIST' });
    assert(res.isError, "Must return error");
    assert.equal(res.error?.code, -32004, "Error code must be -32004");
    return { actual: res.error?.message, errorCode: res.error?.code };
  });

  // 3. P0 MUTATION -> COMMIT -> READ-BACK: Customer
  await testCase('REP-03', 'P0 COMMIT-READBACK', 'Customer create -> immediate get & search', async () => {
    const custName = `Master Test Customer ${Date.now()}`;
    const custPhone = `+91 98300 ${Math.floor(10000 + Math.random() * 90000)}`;
    const createRes = await callTool('customers_create_customer', { fullName: custName, phoneNumber: custPhone });
    assert(!createRes.isError, "Creation must succeed");
    const newId = createRes.data.customerId;

    const getRes = await callTool('customers_get_customer', { customerId: newId });
    assert(!getRes.isError, "Immediate get must succeed");
    assert.equal(getRes.data.customerId, newId);
    assert.equal(getRes.data.name, custName);

    const searchRes = await callTool('customers_search_customers', { query: custPhone });
    assert(!searchRes.isError, "Search must succeed");
    assert(searchRes.data.customers.some(c => c.customerId === newId), "Created customer must be in search results");

    return { actual: `Committed and read back customer ${newId}` };
  });

  // 4. P0 MUTATION -> COMMIT -> READ-BACK: Stock Tag
  await testCase('REP-04', 'P0 COMMIT-READBACK', 'Stock tag create -> immediate get & search', async () => {
    const tagRes = await callTool('stock_generate_barcode_tag', {
      grossWeightGrams: 15.500,
      stoneWeightGrams: 0.500,
      purity: '22K (916)',
      category: 'Kada 22K'
    });
    assert(!tagRes.isError, "Tag creation must succeed");
    const newTag = tagRes.data.tagBarcode;

    const getRes = await callTool('stock_get_stock_item', { barcode: newTag });
    assert(!getRes.isError, "Immediate get must succeed");
    assert.equal(getRes.data.tag, newTag);
    assert.equal(getRes.data.netWeightGrams, 15.000);

    const searchRes = await callTool('stock_search_stock', { tagBarcode: newTag });
    assert(!searchRes.isError, "Search must succeed");
    assert.equal(searchRes.data.items.length, 1);
    assert.equal(searchRes.data.items[0].tag, newTag);

    return { actual: `Committed tag ${newTag} immediately searchable` };
  });

  // 5. P0 MUTATION -> COMMIT -> READ-BACK: Employee
  await testCase('REP-05', 'P0 COMMIT-READBACK', 'Employee create -> payroll search immediate index', async () => {
    const empName = `Artisan Manager ${Date.now()}`;
    const empRes = await callTool('hr_create_employee', {
      fullName: empName,
      designation: 'Master Goldsmith',
      monthlySalaryRupees: 45000.00
    });
    assert(!empRes.isError, "Employee creation must succeed");
    const empId = empRes.data.employeeId;

    const searchRes = await callTool('payroll_search_employees', { query: empName });
    assert(!searchRes.isError, "Payroll search must succeed");
    assert(searchRes.data.employees.some(e => e.empId === empId), "New employee must be indexed in payroll search");

    return { actual: `Employee ${empId} immediately indexed in payroll search` };
  });

  // 6. P0 SHARED INPUT VALIDATION: stone > gross
  await testCase('REP-06', 'P0 VALIDATION', 'Impossible physical relationship (stone >= gross) rejected', async () => {
    const res = await callTool('stock_generate_barcode_tag', {
      grossWeightGrams: 1.000,
      stoneWeightGrams: 2.000,
      purity: '22K'
    });
    assert(res.isError, "Must be rejected");
    assert.equal(res.error?.code, -32010);
    assert(res.error?.message.includes("INVALID_WEIGHT_RELATIONSHIP"));
    return { actual: res.error?.message, errorCode: res.error?.code };
  });

  // 7. P0 SHARED INPUT VALIDATION: Dust > Gross Scrap in Melting
  await testCase('REP-07', 'P0 VALIDATION', 'Melting dust deduction >= gross scrap rejected', async () => {
    const res = await callTool('melt_create_job', {
      grossWeightGrams: 50.000,
      dustDeductionGrams: 55.000
    });
    assert(res.isError, "Must be rejected");
    assert.equal(res.error?.code, -32010);
    return { actual: res.error?.message, errorCode: res.error?.code };
  });

  // 8. P0 MELTING: Nonexistent Melt Job ID rejected
  await testCase('REP-08', 'P0 MELTING', 'Nonexistent meltJobId returns NOT_FOUND (-32004)', async () => {
    const res = await callTool('melt_calculate_yield_and_loss', { meltJobId: 'MELT_DOES_NOT_EXIST' });
    assert(res.isError, "Must be rejected");
    assert.equal(res.error?.code, -32004);
    return { actual: res.error?.message, errorCode: res.error?.code };
  });

  // 9. P0 BRANCH INTEGRITY: Invalid destination branch rejected
  await testCase('REP-09', 'P0 BRANCH', 'Transfer to nonexistent branch rejected (-32020)', async () => {
    const res = await callTool('stock_transfer_stock', {
      sourceBranch: 'MAIN',
      targetBranch: 'NONEXISTENT_BRANCH',
      tagBarcodes: ['TAG-99281']
    });
    assert(res.isError, "Must be rejected");
    assert.equal(res.error?.code, -32020);
    return { actual: res.error?.message, errorCode: res.error?.code };
  });

  // 10. P0 BRANCH INTEGRITY: Same branch transfer rejected
  await testCase('REP-10', 'P0 BRANCH', 'Same branch transfer (MAIN -> MAIN) rejected (-32022)', async () => {
    const res = await callTool('stock_transfer_stock', {
      sourceBranch: 'MAIN',
      targetBranch: 'MAIN',
      tagBarcodes: ['TAG-99281']
    });
    assert(res.isError, "Must be rejected");
    assert.equal(res.error?.code, -32022);
    return { actual: res.error?.message, errorCode: res.error?.code };
  });

  // 11. P0 INVOICE / ESTIMATE CALCULATION: Dynamic Inputs
  await testCase('REP-11', 'P0 CALCULATION', 'Dynamic invoice calculation differs mathematically per inputs', async () => {
    const inv1 = await callTool('sales_create_tax_invoice', {
      customerId: 'CUST_RAJU_DAS',
      items: [{ grossWeightGrams: 1.0, purity: 916, makingChargesRupees: 0 }]
    });
    const inv2 = await callTool('sales_create_tax_invoice', {
      customerId: 'CUST_RAJU_DAS',
      items: [{ grossWeightGrams: 5.0, purity: 750, makingChargesRupees: 1000 }]
    });
    const inv3 = await callTool('sales_create_tax_invoice', {
      customerId: 'CUST_RAJU_DAS',
      items: [{ grossWeightGrams: 1.25, purity: 916, makingChargesRupees: 100 }]
    });

    assert(!inv1.isError && !inv2.isError && !inv3.isError, "All invoices must generate");
    assert(inv1.data.taxableAmount > 0);
    assert(inv2.data.taxableAmount > inv1.data.taxableAmount);
    assert.notEqual(inv1.data.taxableAmount, inv3.data.taxableAmount);
    assert(inv1.data.calculationTree.taxableAmount > 0);

    return {
      actual: `Inv1 (1g 916): ₹${inv1.data.taxableAmount} | Inv2 (5g 750): ₹${inv2.data.taxableAmount} | Inv3 (1.25g 916): ₹${inv3.data.taxableAmount}`
    };
  });

  // 12. P0 COMMUNICATION PAID GATE: Unpaid invoice skipped
  await testCase('REP-12', 'P0 COMM PAID-GATE', 'Automated paid WhatsApp skipped for unpaid invoice', async () => {
    const res = await callTool('comm_send_whatsapp_invoice', {
      invoiceId: 'INV_UNPAID_TEST_001',
      isPaid: false,
      sendType: 'AUTOMATED_PAID_INVOICE_SEND'
    });
    assert(!res.isError, "Tool must execute cleanly");
    assert.equal(res.data.status, 'SKIPPED_UNPAID');
    assert.equal(res.data.mutationOccurred, false);
    return { actual: res.data.message };
  });

  // 13. P0 COMMUNICATION IDEMPOTENCY: Duplicate suppression
  await testCase('REP-13', 'P0 COMM IDEMPOTENCY', 'Idempotent duplicate send suppression', async () => {
    const testInvId = `INV_PAID_IDEM_${Date.now()}`;
    const idemKey = `idem_comm_${Date.now()}`;
    const firstCall = await callTool('comm_send_whatsapp_invoice', {
      invoiceId: testInvId,
      isPaid: true,
      sendType: 'MANUAL_INVOICE_SHARE',
      idempotencyKey: idemKey
    });

    const secondCall = await callTool('comm_send_whatsapp_invoice', {
      invoiceId: testInvId,
      isPaid: true,
      sendType: 'MANUAL_INVOICE_SHARE',
      idempotencyKey: idemKey
    });

    assert(!firstCall.isError, "First call must succeed");
    assert(!secondCall.isError, "Second call must succeed");
    assert(firstCall.data.status === 'DISPATCHED_TO_META_GATEWAY' || firstCall.data.status === 'WHATSAPP_MESSAGE_SENT' || firstCall.data.status === 'DELIVERED', "First call must dispatch");
    assert(secondCall.data.status === 'ALREADY_DELIVERED' || secondCall.data.duplicateSuppressed === true, "Second call must be suppressed as duplicate");
    return { actual: `First dispatch: ${firstCall.data.communicationJobId}, Second suppressed: duplicateSuppressed=${secondCall.data.duplicateSuppressed}` };
  });

  console.log("\n══════════════════════════════════════════════════════════════════════════");
  console.log(`  ALL ${results.length} MASTER REPAIR TESTS COMPLETED`);
  const passCount = results.filter(r => r.status === 'PASS').length;
  console.log(`  PASSED: ${passCount} / ${results.length}`);
  console.log("══════════════════════════════════════════════════════════════════════════\n");
}

main().catch(err => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});
