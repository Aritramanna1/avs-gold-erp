import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

async function loadDotenv(path) {
  try {
    const text = await import("node:fs").then((fs) => fs.readFileSync(path, "utf8"));
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^([^#=\s]+)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    // Optional file.
  }
}

await loadDotenv(".env");
await loadDotenv(".env.production.local");

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set the service-role key only in your local shell/secret manager, never in VITE_* or git.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const testDomain = process.env.MTJ_TEST_EMAIL_DOMAIN || "maatarajewellers.shop";
const password =
  process.env.MTJ_TEST_PASSWORD || `Mtj-Test-${randomBytes(9).toString("base64url")}!26`;

const users = [
  ["mtj.owner.test", "MTJ Owner Tester", "owner"],
  ["mtj.admin1.test", "MTJ Admin Tester 1", "admin"],
  ["mtj.admin2.test", "MTJ Admin Tester 2", "admin"],
  ["mtj.ceo.test", "MTJ CEO Tester", "ceo"],
  ["mtj.manager.test", "MTJ Manager Tester", "manager"],
  ["mtj.accountant.test", "MTJ Accountant Tester", "accountant"],
  ["mtj.billing.test", "MTJ Billing Tester", "billing"],
  ["mtj.vault.test", "MTJ Vault Tester", "vault"],
  ["mtj.workshop.test", "MTJ Workshop Tester", "workshop"],
  ["mtj.viewer.test", "MTJ Viewer Tester", "viewer"],
].map(([local, name, role]) => ({ email: `${local}@${testDomain}`, name, role }));

async function findUserByEmail(email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function ensureOrganization() {
  const slug = process.env.MTJ_TEST_FIRM_SLUG || "maa-tara-jewellers";
  const name = process.env.MTJ_TEST_FIRM_NAME || "Maa Tara Jewellers";
  const { data: existing, error: existingError } = await supabase
    .from("organizations")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from("organizations")
    .insert({
      slug,
      name,
      license_type: "testing",
      is_active: true,
      data: { provisionedFor: "external-testing" },
    })
    .select("id, slug, name")
    .single();
  if (error) throw error;
  return data;
}

async function ensureBranch(firmId) {
  const { data: existing, error: existingError } = await supabase
    .from("branches")
    .select("id, name")
    .eq("active", true)
    .limit(1);
  if (existingError) throw existingError;
  if (existing?.[0]) return existing[0];

  const id = `br_${randomBytes(6).toString("hex")}`;
  const { data, error } = await supabase
    .from("branches")
    .insert({
      id,
      name: "Main Branch",
      short_name: "MAIN",
      branch_type: "retail",
      city: "Ichalkaranji",
      state: "Maharashtra",
      invoice_prefix: "MTJ-",
      barcode_prefix: "M",
      active: true,
      data: { firm_id: firmId, code: "MAIN", is_default: true },
    })
    .select("id, name")
    .single();
  if (error) throw error;
  return data;
}

async function ensureAuthUser({ email, name }) {
  const existing = await findUserByEmail(email);
  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: name, testing: true },
      app_metadata: { testing: true },
    });
    if (error) throw error;
    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name, testing: true },
    app_metadata: { testing: true },
  });
  if (error) throw error;
  return data.user;
}

async function ensureRole(userId, role) {
  const { error } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
  if (error) throw error;
}

async function ensureProfile(user, tester, firmId, branchId) {
  const { error } = await supabase.from("user_profiles").upsert(
    {
      auth_id: user.id,
      firm_id: firmId,
      branch_id: branchId,
      full_name: tester.name,
      status: "active",
      active: true,
      role: tester.role,
      permissions: {},
      data: { provisionedFor: "external-testing" },
    },
    { onConflict: "auth_id" },
  );
  if (error) throw error;
}

async function ensureLicenses() {
  const now = new Date();
  const expiry = new Date(now);
  expiry.setMonth(expiry.getMonth() + 6);
  const enabledFeatures = [
    "dashboard",
    "people",
    "orders",
    "billing",
    "stock",
    "manufacturing",
    "workshop",
    "reports",
    "settings",
  ];

  const rows = [1, 2, 3].map((n) => ({
    license_id: `MTJ-TEST-${now.getFullYear()}-${String(n).padStart(3, "0")}`,
    customer_name: process.env.MTJ_TEST_LICENSE_OWNER || "Aritra Manna",
    company_name: process.env.MTJ_TEST_FIRM_NAME || "Maa Tara Jewellers",
    status: "active",
    edition: "testing-full",
    seats: users.length,
    expiry_date: expiry.toISOString(),
    payload: JSON.stringify({
      licenseId: `MTJ-TEST-${now.getFullYear()}-${String(n).padStart(3, "0")}`,
      edition: "testing-full",
      enabledFeatures,
      maximumDevices: 3,
      customerStatus: "active",
      issuedTo: process.env.MTJ_TEST_LICENSE_OWNER || "Aritra Manna",
      issuedAt: now.toISOString(),
      expiresAt: expiry.toISOString(),
    }),
    signature: "managed-server-license",
  }));

  const { error } = await supabase.from("licenses").upsert(rows, { onConflict: "license_id" });
  if (error) throw error;
  return rows.map((row) => row.license_id);
}

const organization = await ensureOrganization();
const branch = await ensureBranch(organization.id);
const createdUsers = [];

for (const tester of users) {
  const user = await ensureAuthUser(tester);
  await ensureRole(user.id, tester.role);
  await ensureProfile(user, tester, organization.id, branch.id);
  createdUsers.push({ email: tester.email, password, role: tester.role, name: tester.name });
}

const licenseKeys = await ensureLicenses();
const output = {
  generatedAt: new Date().toISOString(),
  projectUrl: supabaseUrl,
  organization: organization.name,
  branch: branch.name,
  users: createdUsers,
  licenseKeys,
};

const outputPath = `testing-credentials-${new Date().toISOString().replace(/[:.]/g, "-")}.local.json`;
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);

console.log(`Provisioned ${createdUsers.length} users and ${licenseKeys.length} license keys.`);
console.log(`Credentials written to ${outputPath}`);
