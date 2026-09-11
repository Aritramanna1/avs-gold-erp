import fs from 'fs';
import path from 'path';

const backupDir = path.resolve('backups/supabase_backup_dqgrrafuoxaorvyrcuuh_2026-09-11T12-43-09-433Z');
const users = JSON.parse(fs.readFileSync(path.join(backupDir, '00_AUTH_USERS.json'), 'utf8'));
const u = users[0];

function escapeSqlVal(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? 'NULL' : String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function testOne() {
  const insertSql = `
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at
    ) VALUES (
      ${escapeSqlVal(u.id)},
      ${escapeSqlVal(u.instance_id)},
      ${escapeSqlVal(u.aud || 'authenticated')},
      ${escapeSqlVal(u.role || 'authenticated')},
      ${escapeSqlVal(u.email)},
      ${escapeSqlVal(u.encrypted_password)},
      ${escapeSqlVal(u.email_confirmed_at)},
      ${escapeSqlVal(u.raw_app_meta_data || {})},
      ${escapeSqlVal(u.raw_user_meta_data || {})},
      ${u.is_super_admin ? 'TRUE' : 'FALSE'},
      ${escapeSqlVal(u.created_at)},
      ${escapeSqlVal(u.updated_at)}
    );
  `;
  const res = await fetch('https://api.supabase.com/v1/projects/yqiaitjxfbkmqlnckxid/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer SUPABASE_ACCESS_TOKEN_REDACTED', 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: insertSql })
  });
  console.log('Insert status:', res.status, await res.json());
}
testOne();
