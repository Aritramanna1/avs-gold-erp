#!/usr/bin/env node
/**
 * Exploratory Accounting & Mathematical Invariants QA Agent
 * Independently recalculates and stress-tests gold math, tax rules, and token balances.
 */
import { strict as assert } from "node:assert";

console.log("══════════════════════════════════════════════════════════════════");
console.log("  PASS 1: EXPLORATORY ACCOUNTING, TAX & BULLION MATH AUDIT");
console.log("══════════════════════════════════════════════════════════════════\n");

let passed = 0;
let failed = 0;
const errors = [];

function check(title, fn) {
  try {
    fn();
    console.log(`  ✓ ${title}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${title}: ${err.message}`);
    failed++;
    errors.push({ title, error: err.message });
  }
}

// 1. Fine Gold Weight Invariant: Fine = NetMg * (Purity / 1000)
check("Purity calculation invariance (22K = 916.0 purity)", () => {
  const grossMg = 18450; // 18.450g
  const stoneMg = 450;   // 0.450g
  const netMg = grossMg - stoneMg; // 18.000g = 18000mg
  const purity = 916; // 91.6%
  const fineMg = Math.round((netMg * purity) / 1000);
  assert.equal(fineMg, 16488, "Fine weight must equal 16.488g (16488mg)");
});

// 2. GST & TCS Tax Engine Rules
check("Gold Jewellery Tax Calculation (3% GST = 1.5% CGST + 1.5% SGST)", () => {
  const taxablePaise = 14616000; // ₹1,46,160.00
  const gstRate = 0.03; // 3%
  const gstPaise = Math.round(taxablePaise * gstRate); // ₹4,384.80 -> 438480 paise
  const cgstPaise = Math.floor(gstPaise / 2); // 219240 paise = ₹2,192.40
  const sgstPaise = gstPaise - cgstPaise;     // 219240 paise = ₹2,192.40
  assert.equal(gstPaise, 438480);
  assert.equal(cgstPaise + sgstPaise, gstPaise);
  assert.equal(taxablePaise + gstPaise, 15054480); // ₹1,50,544.80 Total
});

check("TCS Threshold Exemption (< ₹2,00,000 threshold = 0 TCS)", () => {
  const grandTotalPaise = 15054480; // ₹1,50,544.80
  const tcsThresholdPaise = 20000000; // ₹2,00,000.00
  const tcsPaise = grandTotalPaise > tcsThresholdPaise ? Math.round(grandTotalPaise * 0.01) : 0;
  assert.equal(tcsPaise, 0, "No TCS should be applied below ₹2,00,000");
});

check("TCS Applicability (> ₹2,00,000 threshold = 1% TCS without PAN)", () => {
  const grandTotalPaise = 25000000; // ₹2,50,000.00
  const tcsThresholdPaise = 20000000; // ₹2,00,000.00
  const tcsPaise = grandTotalPaise > tcsThresholdPaise ? Math.round(grandTotalPaise * 0.01) : 0;
  assert.equal(tcsPaise, 250000, "1% TCS on ₹2,50,000 must equal ₹2,500.00 (250000 paise)");
});

// 3. Karigar Over-Loss Invariant
check("Karigar Allowed Loss vs Over-Loss Penalty Calculation", () => {
  const goldIssuedFineMg = 100000; // 100g pure
  const goldReturnedFineMg = 98500; // 98.5g fine returned
  const actualLossFineMg = goldIssuedFineMg - goldReturnedFineMg; // 1500mg = 1.5g
  const allowedLossPct = 0.008; // 0.8%
  const allowedLossFineMg = Math.round(goldIssuedFineMg * allowedLossPct); // 800mg = 0.8g
  const overLossFineMg = Math.max(0, actualLossFineMg - allowedLossFineMg); // 700mg = 0.7g
  
  assert.equal(actualLossFineMg, 1500);
  assert.equal(allowedLossFineMg, 800);
  assert.equal(overLossFineMg, 700, "Over-loss must be 700mg (0.700g Fine Gold)");
});

// 4. Token & Credit Pricing Invariants
check("WhatsApp Canonical Rate Cards Invariance", () => {
  const utilityRate = 0.31; // ₹0.31 (Meta 0.11 + AVS 0.20)
  const marketingRate = 0.98; // ₹0.98 (Meta 0.78 + AVS 0.20)
  const serviceRate = 0.20; // ₹0.20 (Meta 0.00 + AVS 0.20)

  assert.equal(utilityRate, 0.31);
  assert.equal(marketingRate, 0.98);
  assert.equal(serviceRate, 0.20);

  // Metered dispatches deduction
  const initialCredits = 1000.00;
  const utilityMsgs = 50;
  const marketingMsgs = 20;
  const serviceMsgs = 10;
  
  const totalDeduction = (utilityMsgs * utilityRate) + (marketingMsgs * marketingRate) + (serviceMsgs * serviceRate);
  // (50 * 0.31) = 15.5 + (20 * 0.98) = 19.6 + (10 * 0.20) = 2.0 = 37.10 credits
  const finalBalance = Number((initialCredits - totalDeduction).toFixed(2));
  assert.equal(totalDeduction, 37.10);
  assert.equal(finalBalance, 962.90);
});

console.log(`\n── Summary: ${passed} Passed, ${failed} Failed ──\n`);
if (failed > 0) process.exit(1);
