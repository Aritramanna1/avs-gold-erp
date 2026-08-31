#!/usr/bin/env node
/**
 * Seeds QA tenants/users on TEST/STAGING Supabase. Run once per environment.
 * Requires QA_SUPABASE_URL + service role in CI secrets (never in repo).
 */
import { assertStagingSafe } from "./staging-guard.mjs";

const guard = assertStagingSafe("tenant-mutation");
if (!guard.ok) {
  console.error(guard.reason);
  process.exit(2);
}

console.log(
  "[seed] QA tenant seed — implement via Supabase MCP / migration when credentials available.",
);
console.log("[seed] Targets: Firm A, Firm B, Branch A1/A2, role users per qa/fixtures/tenants.ts");
process.exit(0);
