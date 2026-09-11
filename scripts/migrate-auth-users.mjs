#!/usr/bin/env node
/**
 * ==============================================================================
 * AVS / AURUM / ORNEXA — USER & IDENTITY MIGRATION CLI
 * ==============================================================================
 * Provisions and restores existing users into the new Supabase Auth instance.
 * Usage:
 *   node scripts/migrate-auth-users.mjs \
 *     --url "https://<new-ref>.supabase.co" \
 *     --service-key "<new-service-role-key>" \
 *     [--input users_backup.json] \
 *     [--default-password "TemporaryPass123!"]
 * ==============================================================================
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

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
const targetUrl = args.url || process.env.TARGET_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = args["service-key"] || args.service || process.env.TARGET_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const inputFile = args.input || args.file;
const defaultPassword = args["default-password"] || "Mtj-Erp-2026!SecurePass";

if (!targetUrl || !serviceKey) {
  console.log("Usage: node scripts/migrate-auth-users.mjs --url <URL> --service-key <SERVICE_KEY> [--input users.json]");
  console.log("Error: Target URL and Service Role Key are required to provision Auth users.");
  process.exit(1);
}

const supabase = createClient(targetUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Standard core role template accounts for MTJ / AVS ERP if bootstrapping or migrating
const DEFAULT_STAFF_ACCOUNTS = [
  { email: "owner@maatarajewellers.shop", name: "MTJ Owner", role: "owner" },
  { email: "admin@maatarajewellers.shop", name: "MTJ Main Admin", role: "admin" },
  { email: "accountant@maatarajewellers.shop", name: "MTJ Lead Accountant", role: "accountant" },
  { email: "billing@maatarajewellers.shop", name: "MTJ Billing Counter", role: "billing" },
  { email: "vault@maatarajewellers.shop", name: "MTJ Vault Manager", role: "vault" },
  { email: "workshop@maatarajewellers.shop", name: "MTJ Workshop Karigar Supervisor", role: "workshop" },
  { email: "ceo@maatarajewellers.shop", name: "MTJ Executive CEO", role: "ceo" },
  { email: "manager@maatarajewellers.shop", name: "MTJ Operations Manager", role: "manager" },
  { email: "viewer@maatarajewellers.shop", name: "MTJ Auditor Viewer", role: "viewer" },
];

async function main() {
  console.log("==================================================================");
  console.log("  AVS ERP — USER MIGRATION & PROVISIONING ASSISTANT               ");
  console.log("==================================================================");
  console.log(`Target: ${targetUrl}`);

  let usersToMigrate = [];

  if (inputFile && fs.existsSync(inputFile)) {
    console.log(`Reading users from file: ${inputFile}`);
    const raw = fs.readFileSync(inputFile, "utf8");
    const parsed = JSON.parse(raw);
    usersToMigrate = Array.isArray(parsed) ? parsed : parsed.users || [];
    console.log(`Loaded ${usersToMigrate.length} user records from file.`);
  } else {
    console.log("No input file provided. Using standard system staff accounts.");
    usersToMigrate = DEFAULT_STAFF_ACCOUNTS;
  }

  let createdCount = 0;
  let existingCount = 0;
  let failedCount = 0;

  for (const user of usersToMigrate) {
    const email = user.email?.trim().toLowerCase();
    if (!email) continue;

    console.log(`Processing: ${email} (${user.role || "user"})...`);

    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: user.password || defaultPassword,
        email_confirm: true,
        user_metadata: {
          full_name: user.name || user.full_name || email.split("@")[0],
          role: user.role || "staff",
          migrated_at: new Date().toISOString(),
          ...(user.user_metadata || {}),
        },
      });

      if (error) {
        if (error.message?.includes("already registered") || error.message?.includes("already exists")) {
          console.log(`  ✓ Already exists in target auth.`);
          existingCount++;
        } else {
          console.error(`  ✗ Error creating ${email}:`, error.message);
          failedCount++;
        }
      } else {
        console.log(`  ✓ Created user: ${data.user.id}`);
        createdCount++;
      }
    } catch (err) {
      console.error(`  ✗ Failed ${email}:`, err.message);
      failedCount++;
    }
  }

  console.log("==================================================================");
  console.log(`Summary: Created: ${createdCount} | Existing: ${existingCount} | Failed: ${failedCount}`);
  console.log("==================================================================");
}

main();
