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
  const users = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, '00_AUTH_USERS.json'), 'utf8'));
  console.log(`Inserting ${users.length} auth users...`);

  let count = 0;
  for (const u of users) {
    const sql = `
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        invited_at, confirmation_token, confirmation_sent_at, recovery_token,
        recovery_sent_at, email_change_token_new, email_change, email_change_sent_at,
        last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
        created_at, updated_at, phone, phone_confirmed_at
      ) VALUES (
        ${escapeSqlVal(u.id)},
        ${escapeSqlVal(u.instance_id)},
        ${escapeSqlVal(u.aud || 'authenticated')},
        ${escapeSqlVal(u.role || 'authenticated')},
        ${escapeSqlVal(u.email)},
        ${escapeSqlVal(u.encrypted_password)},
        ${escapeSqlVal(u.email_confirmed_at)},
        ${escapeSqlVal(u.invited_at)},
        ${escapeSqlVal(u.confirmation_token)},
        ${escapeSqlVal(u.confirmation_sent_at)},
        ${escapeSqlVal(u.recovery_token)},
        ${escapeSqlVal(u.recovery_sent_at)},
        ${escapeSqlVal(u.email_change_token_new)},
        ${escapeSqlVal(u.email_change)},
        ${escapeSqlVal(u.email_change_sent_at)},
        ${escapeSqlVal(u.last_sign_in_at)},
        ${escapeSqlVal(u.raw_app_meta_data || {})},
        ${escapeSqlVal(u.raw_user_meta_data || {})},
        ${u.is_super_admin ? 'TRUE' : 'FALSE'},
        ${escapeSqlVal(u.created_at)},
        ${escapeSqlVal(u.updated_at)},
        ${escapeSqlVal(u.phone)},
        ${escapeSqlVal(u.phone_confirmed_at)}
      ) ON CONFLICT (id) DO UPDATE SET
        encrypted_password = EXCLUDED.encrypted_password,
        raw_app_meta_data = EXCLUDED.raw_app_meta_data,
        raw_user_meta_data = EXCLUDED.raw_user_meta_data,
        email = EXCLUDED.email;
    `;
    const res = await runSql(sql);
    if (!res.message) count++;
  }
  console.log(`Successfully restored ${count} of ${users.length} auth users.`);

  const finalCheck = await runSql("SELECT count(*)::int as count FROM auth.users;");
  console.log("Total auth.users in target database:", finalCheck);
}

main().catch(console.error);
