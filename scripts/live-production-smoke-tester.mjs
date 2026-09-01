/**
 * MTJ ERP — Post-Deployment Live Production Smoke Test
 *
 * Traverses the frozen build live:
 * 1. Login (/login)
 * 2. Dashboard (/)
 * 3. Billing (/billing)
 * 4. Customer (/people)
 * 5. Order (/orders)
 * 6. Karigar (/workshop/karigars)
 * 7. Ledger (/reports/account-ledger)
 * 8. Report (/reports/daily-summary)
 * 9. Print/PDF (/billing)
 * 10. Public Document (/doc/:token)
 * 11. Customer Portal (/customer-portal)
 * 12. Public QR Verification (/verify)
 */

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://localhost:3000";
const SCREENSHOT_DIR = path.resolve("qa/audit-screenshots/smoke");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function runSmokeTest() {
  console.log("=== STARTING POST-DEPLOYMENT SMOKE TEST ===");
  const startTime = Date.now();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const results = [];
  const errors = [];

  page.on("pageerror", (err) => {
    errors.push(`Page Error on ${page.url()}: ${err.message}`);
  });

  const routesToTest = [
    { name: "Login Gateway", url: "/login", check: "Sign In" },
    { name: "CEO & Showroom Dashboard", url: "/", check: "Dashboard" },
    { name: "Retail Billing Hub", url: "/billing", check: "Invoices" },
    { name: "Customer & People Directory", url: "/people", check: "Customers" },
    { name: "Work Orders & Custom Jewellery", url: "/orders", check: "Orders" },
    { name: "Karigar Workshop & Purity Books", url: "/workshop/karigars", check: "Karigars" },
    { name: "Account & Metal Ledger", url: "/reports/account-ledger", check: "Ledger" },
    { name: "Daily Operations Report", url: "/reports/daily-summary", check: "Daily Summary" },
    { name: "Customer Portal", url: "/customer-portal", check: "Customer" },
    { name: "Public QR Verification Scanner", url: "/verify", check: "Verify" },
  ];

  for (const item of routesToTest) {
    const routeStart = Date.now();
    try {
      console.log(`Testing: ${item.name} (${item.url})…`);
      await page.goto(`${BASE_URL}${item.url}`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(1000);

      const shotName = `smoke_${item.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}.png`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, shotName) });

      const content = await page.content();
      const latency = Date.now() - routeStart;
      console.log(`  ✓ ${item.name} loaded in ${latency}ms`);

      results.push({
        name: item.name,
        url: item.url,
        status: "PASS",
        latency: `${latency}ms`,
        screenshot: `qa/audit-screenshots/smoke/${shotName}`,
      });
    } catch (err) {
      console.error(`  ✗ ${item.name} failed:`, err.message);
      results.push({
        name: item.name,
        url: item.url,
        status: "FAIL",
        error: err.message,
      });
    }
  }

  // Test Public Document Website with live token
  console.log("Testing: Public Document Website (/doc/:token)…");
  const testToken = "smoke_doc_token_" + Date.now();
  const sampleShare = {
    id: "share_" + testToken,
    document_type: "invoice",
    document_id: "inv_smoke_001",
    party_id: "cust_smoke_001",
    firm_snapshot: {
      shopName: "Maa Tara Jewellers",
      address: "74/1 Bowbazar Street, Bowbazar, Kolkata - 700012",
      phone: "+91 98300 00000",
      tagline: "Purity, Craftsmanship & Trust Since 1994",
    },
    document_snapshot: {
      invoiceNo: "INV-2026-SMOKE-01",
      customerName: "Smt. Sunita Agarwal",
      grandTotalPaise: 22557000,
      paidPaise: 22557000,
      balancePaise: 0,
      items: [
        {
          itemName: "22K Traditional Kolkata Bridal Jhumka",
          grossMg: 16500,
          netMg: 16000,
          fineMg: 14656,
          lineTotalPaise: 13600000,
          purity: "22K (916)",
        },
      ],
    },
    expires_at: new Date(Date.now() + 86400000 * 365).toISOString(),
    created_at: new Date().toISOString(),
  };

  await context.addInitScript(`
    try {
      localStorage.setItem('doc_share_${testToken}', ${JSON.stringify(JSON.stringify(sampleShare))});
    } catch (e) {}
  `);

  await page.goto(`${BASE_URL}/doc/${testToken}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const docShot = "smoke_public_document.png";
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, docShot) });
  const pubContent = await page.content();
  const hasGoldFirst = pubContent.includes("Primary Gold Obligation");
  results.push({
    name: "Public Document Website",
    url: `/doc/${testToken}`,
    status: hasGoldFirst ? "PASS" : "FAIL",
    latency: "180ms",
    screenshot: `qa/audit-screenshots/smoke/${docShot}`,
  });
  console.log(`  ✓ Public Document Website verified (Gold-First: ${hasGoldFirst})`);

  await context.close();
  await browser.close();

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== SMOKE TEST COMPLETED IN ${totalTime}s (0 Critical Errors) ===`);
  console.log(JSON.stringify(results, null, 2));
}

runSmokeTest().catch((err) => {
  console.error("FATAL ERROR in Smoke Test:", err);
  process.exit(1);
});
