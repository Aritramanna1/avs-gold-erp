import fs from 'fs';
import path from 'path';

const SUPABASE_TOKEN = 'SUPABASE_ACCESS_TOKEN_REDACTED';
const TARGET_PROJECT_REF = 'yqiaitjxfbkmqlnckxid';
const QUERY_API = `https://api.supabase.com/v1/projects/${TARGET_PROJECT_REF}/database/query`;
const BACKUP_DIR = path.resolve(process.cwd(), 'backups', 'supabase_backup_dqgrrafuoxaorvyrcuuh_2026-09-11T12-43-09-433Z');

function escapeSqlVal(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? 'NULL' : String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

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
  console.log("  RESTORING ALL AUTH IDENTITIES & STORAGE BUCKETS TO yqiaitjxfbkmqlnckxid");
  console.log("==================================================================\n");

  // 1. Restore Identities
  const identsPath = path.join(BACKUP_DIR, '00_AUTH_IDENTITIES.json');
  if (fs.existsSync(identsPath)) {
    const idents = JSON.parse(fs.readFileSync(identsPath, 'utf8'));
    console.log(`Restoring ${idents.length} auth identities...`);
    let success = 0;
    for (const id of idents) {
      const sql = `
        INSERT INTO auth.identities (
          id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
        ) VALUES (
          ${escapeSqlVal(id.id)},
          ${escapeSqlVal(id.user_id)},
          ${escapeSqlVal(id.identity_data || {})},
          ${escapeSqlVal(id.provider || 'email')},
          ${escapeSqlVal(id.provider_id || id.user_id)},
          ${escapeSqlVal(id.last_sign_in_at)},
          ${escapeSqlVal(id.created_at)},
          ${escapeSqlVal(id.updated_at)}
        ) ON CONFLICT (id) DO UPDATE SET
          identity_data = EXCLUDED.identity_data,
          last_sign_in_at = EXCLUDED.last_sign_in_at;
      `;
      const res = await runSql(sql);
      if (!res.message) success++;
    }
    console.log(`Restored ${success}/${idents.length} auth identities ✓`);
  }

  // 2. Restore Storage Buckets
  const bucketsPath = path.join(BACKUP_DIR, '03_STORAGE_BUCKETS.json');
  if (fs.existsSync(bucketsPath)) {
    const buckets = JSON.parse(fs.readFileSync(bucketsPath, 'utf8'));
    console.log(`\nRestoring ${buckets.length} storage buckets...`);
    for (const b of buckets) {
      const mimeTypes = b.allowed_mime_types ? `ARRAY[${b.allowed_mime_types.map(m => `'${m}'`).join(',')}]::text[]` : 'NULL';
      const sql = `
        INSERT INTO storage.buckets (
          id, name, public, avif_autodetection, file_size_limit, allowed_mime_types
        ) VALUES (
          ${escapeSqlVal(b.id)},
          ${escapeSqlVal(b.name)},
          ${b.public ? 'TRUE' : 'FALSE'},
          ${b.avif_autodetection ? 'TRUE' : 'FALSE'},
          ${b.file_size_limit ? b.file_size_limit : 'NULL'},
          ${mimeTypes}
        ) ON CONFLICT (id) DO UPDATE SET
          public = EXCLUDED.public,
          file_size_limit = EXCLUDED.file_size_limit;
      `;
      await runSql(sql);
    }
    console.log(`Storage buckets restored ✓`);
  }

  // 3. Verification
  const verifyRes = await runSql(`
    SELECT 
      (SELECT count(*)::int FROM auth.users) as auth_users,
      (SELECT count(*)::int FROM auth.identities) as auth_identities,
      (SELECT count(*)::int FROM storage.buckets) as storage_buckets,
      (SELECT count(*)::int FROM public.user_roles) as user_roles,
      (SELECT count(*)::int FROM public.user_profiles) as user_profiles,
      (SELECT count(*)::int FROM public.tenant_memberships) as tenant_memberships;
  `);

  console.log("\n==================================================================");
  console.log("  VERIFICATION COMPLETE:", verifyRes);
  console.log("==================================================================\n");
}

main().catch(console.error);
