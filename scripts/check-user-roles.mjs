import fs from 'fs';
import path from 'path';

const SUPABASE_TOKEN = 'SUPABASE_ACCESS_TOKEN_REDACTED';
const TARGET_PROJECT_REF = 'yqiaitjxfbkmqlnckxid';
const QUERY_API = `https://api.supabase.com/v1/projects/${TARGET_PROJECT_REF}/database/query`;

async function runSql(query) {
  const res = await fetch(QUERY_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SUPABASE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  return res.json();
}

async function main() {
  const targetCheck = await runSql(`
    SELECT u.id, u.email, r.role as user_role, p.full_name, p.role as profile_role, p.firm_id, tm.role as tm_role, tm.organization_id
    FROM auth.users u
    LEFT JOIN public.user_roles r ON r.user_id = u.id
    LEFT JOIN public.user_profiles p ON p.auth_id = u.id
    LEFT JOIN public.tenant_memberships tm ON tm.auth_user_id = u.id
    WHERE u.email IN ('aritramanna222@gmail.com', 'aritramanna777@gmail.com');
  `);
  console.log('Target DB user state:\n', JSON.stringify(targetCheck, null, 2));

  // Let's check all firms
  const firms = await runSql(`
    SELECT id, name, pan, gstin, is_active FROM public.firms;
  `);
  console.log('\nFirms in DB:\n', JSON.stringify(firms, null, 2));
}

main().catch(console.error);
