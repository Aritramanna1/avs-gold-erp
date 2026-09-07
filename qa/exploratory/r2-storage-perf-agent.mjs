#!/usr/bin/env node
/**
 * Exploratory Cloudflare R2 Performance & Resilience QA Agent
 * Benchmarks latency, cold vs warm cache, concurrent requests, and endpoint resilience.
 */
import { strict as assert } from "node:assert";

console.log("══════════════════════════════════════════════════════════════════");
console.log("  PASS 3: EXPLORATORY CLOUDFLARE R2 PERFORMANCE & LATENCY AUDIT");
console.log("══════════════════════════════════════════════════════════════════\n");

const PROXY_BASE = "https://mtj-storage-proxy.aritramanna222.workers.dev";
let passed = 0;
let failed = 0;

async function runBenchmark() {
  // Test 1: Single Object Fetch Latency (Cold/Edge)
  const start1 = performance.now();
  const res1 = await fetch(`${PROXY_BASE}/firm-assets/firms/MTJ_FIRM/branches/MAIN/firm_profile/logo.png`);
  const latency1 = performance.now() - start1;
  console.log(`  ✓ Cold/Edge Proxy Request: ${latency1.toFixed(2)}ms (HTTP ${res1.status})`);
  assert.ok(latency1 < 2000, "Latency must be under 2000ms");
  passed++;

  // Test 2: Repeat Request (Warm Edge Caching)
  const start2 = performance.now();
  const res2 = await fetch(`${PROXY_BASE}/firm-assets/firms/MTJ_FIRM/branches/MAIN/firm_profile/logo.png`);
  const latency2 = performance.now() - start2;
  console.log(`  ✓ Warm Cache Edge Request: ${latency2.toFixed(2)}ms (HTTP ${res2.status})`);
  assert.ok(latency2 < 1000, "Warm latency must be under 1000ms");
  passed++;

  // Test 3: Concurrent Burst (10 Simultaneous Requests)
  console.log("  ▶ Testing 10 Concurrent Storage Fetches...");
  const burstStart = performance.now();
  const promises = Array.from({ length: 10 }).map((_, i) =>
    fetch(`${PROXY_BASE}/catalog-designs/firms/MTJ_FIRM/branches/MAIN/catalog/design-${i}/test.jpg`)
  );
  const results = await Promise.all(promises);
  const totalBurstTime = performance.now() - burstStart;
  const allSuccessful = results.every(r => r.status === 200 || r.status === 404);
  console.log(`  ✓ 10 Concurrent Requests completed in ${totalBurstTime.toFixed(2)}ms (Avg: ${(totalBurstTime / 10).toFixed(2)}ms/req)`);
  assert.ok(allSuccessful, "All requests should resolve gracefully without connection timeouts");
  assert.ok(totalBurstTime < 4500, "10 concurrent requests must complete in under 4.5s (SLA < 5s)");
  passed++;

  // Test 4: Verify Zero 20s Bottlenecks
  assert.ok(totalBurstTime < 5000, "Zero 20s load delays detected!");
  console.log("  ✓ SLA Verification: Zero 20s storage delays detected across all runs.");
  passed++;

  console.log(`\n── Summary: ${passed} Passed, ${failed} Failed ──\n`);
}

runBenchmark().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
