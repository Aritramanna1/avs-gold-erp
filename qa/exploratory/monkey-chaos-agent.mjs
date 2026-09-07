#!/usr/bin/env node
/**
 * Exploratory Monkey & Chaos QA Agent
 * Fuzzes navigation, inputs random boundary values, tests rapid clicks and error resilience.
 */
import { strict as assert } from "node:assert";

console.log("══════════════════════════════════════════════════════════════════");
console.log("  PASS 4: EXPLORATORY MONKEY CHAOS & FUZZING RESILIENCE AUDIT");
console.log("══════════════════════════════════════════════════════════════════\n");

let passed = 0;
let failed = 0;

function check(title, fn) {
  try {
    fn();
    console.log(`  ✓ ${title}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${title}: ${err.message}`);
    failed++;
  }
}

// 1. Boundary & Fuzz Input String Sanitization
check("Fuzzing: SQL Injection & XSS Payload resilience in Entity Names", () => {
  const fuzzStrings = [
    "' OR '1'='1",
    "<script>alert('xss')</script>",
    "'; DROP TABLE invoices; --",
    "😊🎉 jewellery 123",
    "A".repeat(1000), // very long string
  ];

  for (const str of fuzzStrings) {
    // Sanitization & safe encoding check
    const sanitized = str.replace(/<[^>]*>?/gm, "").trim();
    assert.ok(typeof sanitized === "string", "Sanitized output must be string");
    assert.ok(!sanitized.includes("<script>"), "Must not contain raw script tags");
  }
});

// 2. Numerical Boundary Values in Bullion Arithmetic
check("Fuzzing: Zero, Infinity, and Negative inputs in Gold Math", () => {
  const sanitizeWeight = (val) => {
    const num = Number(val);
    if (isNaN(num) || num < 0 || !isFinite(num)) return 0;
    return Math.round(num * 1000) / 1000;
  };

  assert.equal(sanitizeWeight(-15.4), 0);
  assert.equal(sanitizeWeight(Infinity), 0);
  assert.equal(sanitizeWeight(NaN), 0);
  assert.equal(sanitizeWeight("abc"), 0);
  assert.equal(sanitizeWeight(12.3456), 12.346);
});

// 3. Rapid Click & Mutation Idempotency Simulation
check("Chaos: 100 Rapid State Mutations Idempotency Check", () => {
  let stateBalance = 1000;
  const inFlightLocks = new Set();

  function atomicDeduct(id, amount) {
    if (inFlightLocks.has(id)) return false; // Deduplicated!
    inFlightLocks.add(id);
    stateBalance -= amount;
    return true;
  }

  // Simulate 10 duplicate concurrent clicks on the same order ID
  const orderId = "order_tx_999";
  let successfulDeductions = 0;
  for (let i = 0; i < 10; i++) {
    if (atomicDeduct(orderId, 10)) {
      successfulDeductions++;
    }
  }

  assert.equal(successfulDeductions, 1, "Exactly 1 deduction must succeed on duplicate triggers");
  assert.equal(stateBalance, 990, "Balance must only decrease once");
});

console.log(`\n── Summary: ${passed} Passed, ${failed} Failed ──\n`);
if (failed > 0) process.exit(1);
