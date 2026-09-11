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
  const cols = await runSql(`
    SELECT column_name, data_type, is_nullable, is_identity, is_generated, generation_expression 
    FROM information_schema.columns 
    WHERE table_schema = 'auth' AND table_name = 'identities';
  `);
  console.log('auth.identities columns:\n', JSON.stringify(cols, null, 2));

  const constraints = await runSql(`
    SELECT conname, contype, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'auth' AND conrelid = 'auth.identities'::regclass;
  `);
  console.log('auth.identities constraints:\n', JSON.stringify(constraints, null, 2));

  const sample = JSON.parse(fs.readFileSync('backups/supabase_backup_dqgrrafuoxaorvyrcuuh_2026-09-11T12-43-09-433Z/00_AUTH_IDENTITIES.json', 'utf8'))[0];
  console.log('Sample identity object:\n', JSON.stringify(sample, null, 2));

  const testSql = `
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      '${sample.id}', '${sample.user_id}', '${JSON.stringify(sample.identity_data).replace(/'/g, "''")}'::jsonb, '${sample.provider}', '${sample.provider_id || sample.user_id}', '${sample.last_sign_in_at}', '${sample.created_at}', '${sample.updated_at}'
    );
  `;
  const res = await runSql(testSql);
  console.log('Test insert result:\n', JSON.stringify(res, null, 2));
}

main().catch(console.error);
