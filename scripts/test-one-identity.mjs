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

async function test() {
  const idents = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, '00_AUTH_IDENTITIES.json'), 'utf8'));
  const id = idents[0];
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
    );
  `;
  const res = await fetch(QUERY_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SUPABASE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  });
  console.log('Status:', res.status, await res.json());
}
test();
