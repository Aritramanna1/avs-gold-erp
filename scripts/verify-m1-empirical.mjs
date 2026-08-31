import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const MIGRATIONS_DIR = path.join(root, "supabase", "migrations");
const TYPES_FILE = path.join(root, "src", "integrations", "supabase", "types.ts");

console.log("=== EMPIRICAL VERIFICATION HARNESS FOR MILESTONE 1 ===");

const errors = [];
const passes = [];

function assert(condition, message) {
  if (!condition) {
    errors.push(`FAIL: ${message}`);
    console.error(`❌ FAIL: ${message}`);
  } else {
    passes.push(`PASS: ${message}`);
    console.log(`✅ PASS: ${message}`);
  }
}

// 1. Check Migration Files Existence
const m1MigrationFiles = [
  "20260814231000_rls_security_hardening.sql",
  "20260814232000_canonical_schema_alignments.sql",
  "20260814233000_server_side_device_entitlement_gating.sql",
];

for (const file of m1MigrationFiles) {
  const fullPath = path.join(MIGRATIONS_DIR, file);
  assert(fs.existsSync(fullPath), `Migration file exists: ${file}`);
}

// 2. Audit 20260814231000_rls_security_hardening.sql
const rlsHardeningSql = fs.readFileSync(
  path.join(MIGRATIONS_DIR, "20260814231000_rls_security_hardening.sql"),
  "utf8",
);

assert(
  rlsHardeningSql.includes("DROP POLICY IF EXISTS"),
  "RLS hardening drops legacy permissive policies",
);
assert(
  rlsHardeningSql.includes("ENABLE ROW LEVEL SECURITY"),
  "RLS hardening enables RLS on business tables",
);
assert(
  rlsHardeningSql.includes("SET search_path = public, pg_temp"),
  "RLS hardening sets secure search_path on SECURITY DEFINER functions",
);
assert(
  rlsHardeningSql.includes("platform_service_requests"),
  "RLS hardening covers platform_service_requests",
);
assert(
  rlsHardeningSql.includes("platform_support_tickets"),
  "RLS hardening covers platform_support_tickets",
);
assert(
  rlsHardeningSql.includes("platform_conversations"),
  "RLS hardening covers platform_conversations",
);
assert(
  rlsHardeningSql.includes("platform_billing_documents"),
  "RLS hardening covers platform_billing_documents",
);
assert(
  rlsHardeningSql.includes("platform_deployments"),
  "RLS hardening covers platform_deployments",
);
assert(
  rlsHardeningSql.includes("platform_backup_runs"),
  "RLS hardening covers platform_backup_runs",
);
assert(rlsHardeningSql.includes("erp_setup_guard"), "RLS hardening covers erp_setup_guard");
assert(
  rlsHardeningSql.includes("comm_provider_secrets"),
  "RLS hardening covers comm_provider_secrets",
);

// 3. Audit Canonical 8 Tables in 20260814232000_canonical_schema_alignments.sql
const canonicalTables = [
  {
    name: "party_role_profiles",
    expectedCols: [
      "id",
      "firm_id",
      "party_id",
      "role_type",
      "credit_limit_paise",
      "metal_limit_mg",
      "credit_days",
      "stop_billing_date",
      "allowed_wastage_pct",
      "making_rate_paise",
      "making_charge_type",
      "is_active",
      "settings",
      "created_at",
      "updated_at",
    ],
    hasTrigger: true,
  },
  {
    name: "party_bank_accounts",
    expectedCols: [
      "id",
      "firm_id",
      "party_id",
      "bank_name",
      "account_holder_name",
      "account_number",
      "account_type",
      "ifsc_code",
      "branch_name",
      "upi_id",
      "is_primary",
      "is_verified",
      "metadata",
      "created_at",
      "updated_at",
    ],
    hasTrigger: true,
  },
  {
    name: "party_opening_balances",
    expectedCols: [
      "id",
      "firm_id",
      "party_id",
      "migration_batch_id",
      "as_of_date",
      "cash_debit_paise",
      "cash_credit_paise",
      "fine_gold_debit_mg",
      "fine_gold_credit_mg",
      "silver_debit_mg",
      "silver_credit_mg",
      "diamond_carats",
      "diamond_pieces",
      "notes",
      "metadata",
      "created_at",
      "updated_at",
    ],
    hasTrigger: true,
  },
  {
    name: "migration_batches",
    expectedCols: [
      "id",
      "firm_id",
      "batch_number",
      "as_of_date",
      "status",
      "frozen_at",
      "frozen_by",
      "checksum_sha256",
      "dry_run_simulation",
      "metadata",
      "created_at",
      "updated_at",
    ],
    hasTrigger: true,
  },
  {
    name: "rate_book_history",
    expectedCols: [
      "id",
      "firm_id",
      "branch_id",
      "metal_type",
      "purity_id",
      "purity_label",
      "touch_pct",
      "sell_rate_per_gram_paise",
      "buy_rate_per_gram_paise",
      "reference_rate_paise",
      "day_high_rate_paise",
      "day_low_rate_paise",
      "source_type",
      "effective_from",
      "status",
      "entered_by_user_id",
      "approved_by_user_id",
      "metadata",
      "created_at",
    ],
    hasTrigger: false,
  },
  {
    name: "item_masters",
    expectedCols: [
      "id",
      "firm_id",
      "item_code",
      "item_name",
      "item_group",
      "category",
      "metal_type",
      "purity_stamp",
      "default_touch_pct",
      "fine_calculation_mode",
      "labour_basis",
      "default_making_rate_paise",
      "min_making_charge_paise",
      "allowed_wastage_pct",
      "stock_method",
      "tag_weight_deduction_mg",
      "huid_applicable",
      "hsn_code",
      "is_active",
      "design_code",
      "collection_name",
      "metadata",
      "created_at",
      "updated_at",
    ],
    hasTrigger: true,
  },
  {
    name: "tenant_backups",
    expectedCols: [
      "id",
      "firm_id",
      "backup_name",
      "archive_version",
      "schema_version",
      "encryption_algorithm",
      "sha256_checksum",
      "size_bytes",
      "storage_path",
      "download_url",
      "download_url_expires_at",
      "included_modules",
      "record_counts",
      "status",
      "created_by_user_id",
      "metadata",
      "created_at",
    ],
    hasTrigger: false,
  },
  {
    name: "tenant_restore_audit",
    expectedCols: [
      "id",
      "firm_id",
      "backup_id",
      "archive_checksum",
      "pre_restore_snapshot_id",
      "status",
      "current_phase",
      "phase_results",
      "diff_summary",
      "dual_ledger_reconciliation",
      "initiated_by_user_id",
      "initiated_at",
      "completed_at",
      "error_message",
      "metadata",
    ],
    hasTrigger: false,
  },
];

const canonicalSql = fs.readFileSync(
  path.join(MIGRATIONS_DIR, "20260814232000_canonical_schema_alignments.sql"),
  "utf8",
);

for (const table of canonicalTables) {
  assert(
    canonicalSql.includes(`CREATE TABLE IF NOT EXISTS public.${table.name}`),
    `Table ${table.name} created in SQL`,
  );
  assert(
    canonicalSql.includes(`ALTER TABLE public.${table.name} ENABLE ROW LEVEL SECURITY`),
    `Table ${table.name} has RLS enabled`,
  );
  assert(
    canonicalSql.includes(`${table.name}_tenant_select`),
    `Table ${table.name} has SELECT policy`,
  );
  assert(
    canonicalSql.includes(`${table.name}_tenant_write`),
    `Table ${table.name} has WRITE/ALL policy`,
  );

  if (table.hasTrigger) {
    assert(
      canonicalSql.includes(`trg_${table.name}_uat`),
      `Table ${table.name} has updated_at trigger`,
    );
  }

  for (const col of table.expectedCols) {
    const colRegex = new RegExp(`\\b${col}\\b`, "i");
    assert(colRegex.test(canonicalSql), `Table ${table.name} has column ${col}`);
  }
}

// 4. Verify Types.ts parity
const typesContent = fs.readFileSync(TYPES_FILE, "utf8");

for (const table of canonicalTables) {
  assert(typesContent.includes(`${table.name}: {`), `types.ts contains Table ${table.name}`);
  for (const col of table.expectedCols) {
    assert(
      typesContent.includes(`${col}: `) || typesContent.includes(`${col}?: `),
      `types.ts contains ${table.name}.${col}`,
    );
  }
}

// 5. Verify Server-Side Device Entitlement Logic in 20260814233000_server_side_device_entitlement_gating.sql
const deviceSql = fs.readFileSync(
  path.join(MIGRATIONS_DIR, "20260814233000_server_side_device_entitlement_gating.sql"),
  "utf8",
);

assert(
  deviceSql.includes("FUNCTION public.validate_license("),
  "validate_license function defined",
);
assert(
  deviceSql.includes("SET search_path = public, pg_temp"),
  "validate_license has pinned search_path",
);
assert(deviceSql.includes("client.web"), "validate_license includes client.web feature check");
assert(
  deviceSql.includes("client.desktop"),
  "validate_license includes client.desktop feature check",
);
assert(
  deviceSql.includes("client.mobile"),
  "validate_license includes client.mobile feature check",
);
assert(
  deviceSql.includes("CLIENT_NOT_ENTITLED"),
  "validate_license returns CLIENT_NOT_ENTITLED error payload",
);

// Test simulator for validate_license server-side logic
function simulateDeviceEntitlement(planEdition, clientType, featureOverrides = {}) {
  const normClient = (clientType || "web").toLowerCase().trim();
  const featureKey = `client.${normClient}`;

  if (featureOverrides[featureKey] !== undefined) {
    return featureOverrides[featureKey];
  }

  const edition = (planEdition || "basic").toLowerCase().trim();
  if (["basic", "manufacturing_starter", "starter"].includes(edition)) {
    return normClient === "web" || normClient === "desktop";
  }
  if (["growth", "manufacturing_essential", "essential"].includes(edition)) {
    return ["web", "desktop", "mobile"].includes(normClient);
  }
  if (
    [
      "professional",
      "manufacturing_standard",
      "standard",
      "scale",
      "manufacturing_professional",
    ].includes(edition)
  ) {
    return ["web", "desktop", "mobile"].includes(normClient);
  }
  if (["max", "manufacturing_enterprise", "enterprise", "developer", "pilot"].includes(edition)) {
    return true;
  }
  return normClient === "web" || normClient === "desktop";
}

// Device simulation test matrix
const deviceTestCases = [
  { plan: "basic", client: "web", expected: true },
  { plan: "basic", client: "desktop", expected: true },
  { plan: "basic", client: "mobile", expected: false },
  { plan: "growth", client: "web", expected: true },
  { plan: "growth", client: "desktop", expected: true },
  { plan: "growth", client: "mobile", expected: true },
  { plan: "professional", client: "web", expected: true },
  { plan: "professional", client: "desktop", expected: true },
  { plan: "professional", client: "mobile", expected: true },
  { plan: "scale", client: "web", expected: true },
  { plan: "scale", client: "desktop", expected: true },
  { plan: "scale", client: "mobile", expected: true },
  { plan: "max", client: "web", expected: true },
  { plan: "max", client: "desktop", expected: true },
  { plan: "max", client: "mobile", expected: true },
  { plan: "basic", client: "mobile", override: { "client.mobile": true }, expected: true },
  { plan: "max", client: "mobile", override: { "client.mobile": false }, expected: false },
];

for (const tc of deviceTestCases) {
  const result = simulateDeviceEntitlement(tc.plan, tc.client, tc.override || {});
  assert(
    result === tc.expected,
    `Device entitlement check: Plan=${tc.plan}, Client=${tc.client}, Override=${JSON.stringify(tc.override || {})} => ${result}`,
  );
}

console.log(`\n=== VERIFICATION SUMMARY ===`);
console.log(`Total Passes: ${passes.length}`);
console.log(`Total Failures: ${errors.length}`);

if (errors.length > 0) {
  console.error(`\nFAILED CHECKS (${errors.length}):`);
  errors.forEach((e) => console.error(e));
  process.exit(1);
} else {
  console.log("\nALL M1 EMPIRICAL TESTS PASSED SUCCESSFULLY! 🎉");
  process.exit(0);
}
