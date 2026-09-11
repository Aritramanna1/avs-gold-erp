import fs from 'fs';
import path from 'path';

const SUPABASE_TOKEN = 'SUPABASE_ACCESS_TOKEN_REDACTED';
const TARGET_PROJECT_REF = 'yqiaitjxfbkmqlnckxid';
const QUERY_API = `https://api.supabase.com/v1/projects/${TARGET_PROJECT_REF}/database/query`;

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
  const identsPath = path.resolve('backups/supabase_backup_dqgrrafuoxaorvyrcuuh_2026-09-11T12-43-09-433Z/00_AUTH_IDENTITIES.json');
  const idents = JSON.parse(fs.readFileSync(identsPath, 'utf8'));

  console.log(`Total identities in backup: ${idents.length}`);

  let success = 0;
  let errors = 0;

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
      )
      ON CONFLICT (id) DO UPDATE SET
        identity_data = EXCLUDED.identity_data,
        last_sign_in_at = EXCLUDED.last_sign_in_at,
        updated_at = EXCLUDED.updated_at;
    `;

    const res = await runSql(sql);
    if (res && res.message) {
      console.error(`Failed on identity ${id.id} (${id.email || id.user_id}):`, res.message);
      errors++;
    } else {
      success++;
    }
  }

  console.log(`\nIdentities Migration Finished: ${success} Succeeded, ${errors} Failed.`);

  // Verify total count in target
  const check = await runSql(`SELECT count(*)::int as count FROM auth.identities;`);
  console.log("Total auth.identities in target DB:", check);
}

main().catch(console.error);
