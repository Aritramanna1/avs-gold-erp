#!/usr/bin/env node
/**
 * ==============================================================================
 * AVS / MTJ ERP — DIRECT SUPABASE API MIGRATION RUNNER
 * ==============================================================================
 * Applies all 208 migrations sequentially to the target project database
 * via Supabase Management Query API.
 * ==============================================================================
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const PROJECT_REF = "slbvphnxfcypeinclgmw";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || "SUPABASE_ACCESS_TOKEN_REDACTED";
const QUERY_API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function executeSql(query, retries = 5) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(QUERY_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (res.status === 429) {
      const waitMs = attempt * 2000;
      await sleep(waitMs);
      continue;
    }

    if (!res.ok) {
      const msg = data && data.message ? data.message : text;
      throw new Error(`[HTTP ${res.status}] ${msg}`);
    }

    await sleep(300);
    return data;
  }
  throw new Error('[HTTP 429] Rate limit exceeded after retries');
}

async function main() {
  console.log("==================================================================");
  console.log(`  AVS ERP — EXECUTING MIGRATIONS ON PROJECT: ${PROJECT_REF}       `);
  console.log("==================================================================");

  // 1. Ensure migrations tracking table exists
  console.log("[Init] Setting up supabase_migrations tracking table...");
  await executeSql(`
    CREATE SCHEMA IF NOT EXISTS supabase_migrations;
    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
      version text PRIMARY KEY,
      statements text[],
      name text
    );
  `);

  // 2. Fetch already executed migrations
  const existingRows = await executeSql(`SELECT version FROM supabase_migrations.schema_migrations;`);
  const appliedVersions = new Set((existingRows || []).map((r) => r.version));
  console.log(`[Init] Currently applied migrations: ${appliedVersions.size}`);

  // 3. Read all migration files
  const migrationsDir = path.join(ROOT, "supabase", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`[Plan] Total migration files to inspect: ${files.length}`);

  let successCount = 0;
  let skippedCount = 0;
  const errors = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const version = file.split("_")[0];

    if (appliedVersions.has(version)) {
      skippedCount++;
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf8");

    process.stdout.write(`[${i + 1}/${files.length}] Applying ${file}... `);

    try {
      await executeSql(sql);
      await executeSql(`
        INSERT INTO supabase_migrations.schema_migrations (version, name)
        VALUES ('${version}', '${file}')
        ON CONFLICT (version) DO NOTHING;
      `);
      console.log("✓ OK");
      successCount++;
    } catch (err) {
      console.log("✗ FAILED");
      console.error(`  Error: ${err.message}`);
      errors.push({ file, error: err.message });
      // If error, check if we should abort or continue
      // For migrations that try to re-create existing types or objects, note it
    }
  }

  console.log("\n==================================================================");
  console.log(`Migration Run Finished!`);
  console.log(`- Applied: ${successCount}`);
  console.log(`- Previously Applied / Skipped: ${skippedCount}`);
  console.log(`- Errors: ${errors.length}`);
  console.log("==================================================================");

  if (errors.length > 0) {
    console.log("\nFailed migrations:");
    errors.forEach((e) => console.log(`  - ${e.file}: ${e.error}`));
  }

  // Verification step
  console.log("\n[Verify] Checking database table counts...");
  const tables = await executeSql(`
    SELECT count(*)::int as table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public';
  `);
  console.log(`Public tables count: ${tables[0]?.table_count}`);

  const functions = await executeSql(`
    SELECT count(*)::int as function_count
    FROM information_schema.routines 
    WHERE routine_schema = 'public';
  `);
  console.log(`Public functions count: ${functions[0]?.function_count}`);
}

main().catch((err) => {
  console.error("Fatal migration failure:", err);
  process.exit(1);
});
