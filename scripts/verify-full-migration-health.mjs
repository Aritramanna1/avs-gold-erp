import fs from 'fs';
import path from 'path';

const SUPABASE_TOKEN = 'SUPABASE_ACCESS_TOKEN_REDACTED';
const TARGET_PROJECT_REF = 'yqiaitjxfbkmqlnckxid';
const QUERY_API = `https://api.supabase.com/v1/projects/${TARGET_PROJECT_REF}/database/query`;

async function runSql(query) {
  const res = await fetch(QUERY_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });
  return res.json();
}

async function main() {
  console.log("==================================================================");
  console.log("  COMPREHENSIVE AUDIT & VERIFICATION FOR yqiaitjxfbkmqlnckxid");
  console.log("==================================================================\n");

  const query = `
    SELECT 
      (SELECT count(*)::int FROM auth.users) as auth_users,
      (SELECT count(*)::int FROM auth.identities) as auth_identities,
      (SELECT count(*)::int FROM storage.buckets) as storage_buckets,
      (SELECT count(*)::int FROM public.tenants) as tenants,
      (SELECT count(*)::int FROM public.branches) as branches,
      (SELECT count(*)::int FROM public.user_roles) as user_roles,
      (SELECT count(*)::int FROM public.user_profiles) as user_profiles,
      (SELECT count(*)::int FROM public.tenant_memberships) as tenant_memberships,
      (SELECT count(*)::int FROM public.customers) as customers,
      (SELECT count(*)::int FROM public.suppliers) as suppliers,
      (SELECT count(*)::int FROM public.karigars) as karigars,
      (SELECT count(*)::int FROM public.employees) as employees,
      (SELECT count(*)::int FROM public.sales_transactions) as sales_transactions,
      (SELECT count(*)::int FROM public.gold_bhav_history) as gold_bhav_history,
      (SELECT count(*)::int FROM public.stock_items) as stock_items;
  `;

  const counts = await runSql(query);
  console.log("DATABASE COUNTS AUDIT:\n", JSON.stringify(counts[0], null, 2));

  // Check sample auth users and password encryption validity
  const sampleUsers = await runSql(`
    SELECT id, email, encrypted_password IS NOT NULL as has_password, email_confirmed_at, role, raw_app_meta_data->>'provider' as provider
    FROM auth.users
    ORDER BY created_at ASC
    LIMIT 10;
  `);
  console.log("\nSAMPLE AUTH USERS STATUS:\n", JSON.stringify(sampleUsers, null, 2));

  // Check storage buckets
  const buckets = await runSql(`
    SELECT id, name, public, file_size_limit FROM storage.buckets;
  `);
  console.log("\nSTORAGE BUCKETS:\n", JSON.stringify(buckets, null, 2));
}

main().catch(console.error);
