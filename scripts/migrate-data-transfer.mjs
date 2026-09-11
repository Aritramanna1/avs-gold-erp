#!/usr/bin/env node
/**
 * ==============================================================================
 * AVS / AURUM / ORNEXA — OPERATIONAL DATA BACKUP & RESTORE CLI
 * ==============================================================================
 * Exports business tables from a source Supabase project and imports them
 * into a target Supabase project via batch upserts.
 * ==============================================================================
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_BACKUP_DIR = path.join(ROOT, "backups", "data_tables");

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : true;
      out[key] = val;
    }
  }
  return out;
}

const args = parseArgs();
const mode = args.export ? "export" : args.import ? "import" : null;

// Core business tables in dependency order
const CORE_TABLES = [
  "app_settings",
  "branches",
  "branch_settings",
  "purity_grades",
  "precious_metals",
  "licenses",
  "document_sequences",
  "people",
  "party_bank_accounts",
  "party_opening_balances",
  "item_groups",
  "item_masters",
  "stock_inventory",
  "bills",
  "bill_items",
  "vouchers",
  "gold_transactions",
  "metal_ledger",
  "universal_transactions",
  "jobcards",
  "manufacturing_bills",
  "orders",
  "order_items",
  "repair_orders",
  "audit_log",
];

if (!mode) {
  console.log("Usage:");
  console.log("  Export data from source project:");
  console.log("    node scripts/migrate-data-transfer.mjs --export --url <SOURCE_URL> --service-key <SOURCE_SERVICE_KEY>");
  console.log("  Import data to target project:");
  console.log("    node scripts/migrate-data-transfer.mjs --import --url <TARGET_URL> --service-key <TARGET_SERVICE_KEY>");
  process.exit(0);
}

const client = createClient(args.url, args["service-key"], {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runExport() {
  console.log("Starting data export to:", DATA_BACKUP_DIR);
  if (!fs.existsSync(DATA_BACKUP_DIR)) fs.mkdirSync(DATA_BACKUP_DIR, { recursive: true });

  for (const table of CORE_TABLES) {
    try {
      console.log(`Exporting table: ${table}...`);
      const { data, error } = await client.from(table).select("*").limit(10000);
      if (error) {
        console.warn(`  ! Skip ${table}: ${error.message}`);
        continue;
      }
      const outPath = path.join(DATA_BACKUP_DIR, `${table}.json`);
      fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf8");
      console.log(`  ✓ Saved ${data.length} records to ${table}.json`);
    } catch (err) {
      console.error(`  ✗ Error exporting ${table}:`, err.message);
    }
  }
  console.log("Data export completed.");
}

async function runImport() {
  console.log("Starting data import from:", DATA_BACKUP_DIR);
  if (!fs.existsSync(DATA_BACKUP_DIR)) {
    console.error(`Backup folder not found: ${DATA_BACKUP_DIR}`);
    process.exit(1);
  }

  for (const table of CORE_TABLES) {
    const filePath = path.join(DATA_BACKUP_DIR, `${table}.json`);
    if (!fs.existsSync(filePath)) continue;

    try {
      const records = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (!Array.isArray(records) || records.length === 0) {
        console.log(`Table ${table} has 0 records, skipping.`);
        continue;
      }

      console.log(`Importing ${records.length} records into ${table}...`);
      // Chunk into batches of 100
      for (let i = 0; i < records.length; i += 100) {
        const batch = records.slice(i, i + 100);
        const { error } = await client.from(table).upsert(batch, { ignoreDuplicates: false });
        if (error) {
          console.error(`  ✗ Batch insert error on ${table}:`, error.message);
        }
      }
      console.log(`  ✓ Finished importing ${table}`);
    } catch (err) {
      console.error(`  ✗ Error importing ${table}:`, err.message);
    }
  }
  console.log("Data import completed.");
}

if (mode === "export") runExport();
if (mode === "import") runImport();
