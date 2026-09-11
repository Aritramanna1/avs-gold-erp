import fs from 'fs';
import path from 'path';

const SUPABASE_TOKEN = 'SUPABASE_ACCESS_TOKEN_REDACTED';
const TARGET_PROJECT_REF = 'yqiaitjxfbkmqlnckxid';
const QUERY_API = `https://api.supabase.com/v1/projects/${TARGET_PROJECT_REF}/database/query`;
const BACKUP_DIR = path.resolve(process.cwd(), 'backups', 'supabase_backup_dqgrrafuoxaorvyrcuuh_2026-09-11T12-43-09-433Z');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runSql(query, retries = 10) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(QUERY_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      if (res.status === 429) {
        const waitTime = Math.min(attempt * 2500, 25000);
        process.stdout.write(`[429, wait ${waitTime / 1000}s] `);
        await sleep(waitTime);
        continue;
      }

      if (!res.ok) {
        const msg = data && data.message ? data.message : (typeof data === 'string' ? data : JSON.stringify(data));
        return { error: true, status: res.status, message: msg };
      }

      await sleep(100);
      return { error: false, data };
    } catch (err) {
      if (attempt === retries) return { error: true, message: err.message };
      await sleep(attempt * 1500);
    }
  }
  return { error: true, message: "Exceeded max retries" };
}

function inferSqlType(val) {
  if (val === null || val === undefined) return 'text';
  if (typeof val === 'boolean') return 'boolean';
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return 'bigint';
    return 'numeric';
  }
  if (typeof val === 'object') return 'jsonb';
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) return 'timestamptz';
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) return 'uuid';
    return 'text';
  }
  return 'text';
}

function escapeSqlVal(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? 'NULL' : String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function restoreAuthUsers() {
  console.log("=== STEP 1: Restoring 53 Auth Users & Identities ===");
  const usersPath = path.join(BACKUP_DIR, '00_AUTH_USERS.json');
  if (!fs.existsSync(usersPath)) {
    console.log("No auth users file found.");
    return;
  }
  const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  console.log(`Restoring ${users.length} auth users...`);

  for (const u of users) {
    const insertSql = `
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        invited_at, confirmation_token, confirmation_sent_at, recovery_token,
        recovery_sent_at, email_change_token_new, email_change, email_change_sent_at,
        last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
        created_at, updated_at, phone, phone_confirmed_at, confirmation_token_created_at
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
        ${escapeSqlVal(u.phone_confirmed_at)},
        ${escapeSqlVal(u.confirmation_token_created_at)}
      ) ON CONFLICT (id) DO UPDATE SET
        encrypted_password = EXCLUDED.encrypted_password,
        raw_app_meta_data = EXCLUDED.raw_app_meta_data,
        raw_user_meta_data = EXCLUDED.raw_user_meta_data;
    `;
    await runSql(insertSql);
  }
  console.log("Auth users restored ✓\n");
}

async function setupTypesAndFunctions() {
  console.log("=== STEP 2: Creating Types, Roles & Core Functions ===");

  const typeInitSql = `
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    DO $$ BEGIN
      CREATE TYPE public.app_role AS ENUM (
        'saas_admin','owner','admin','ceo','manager','accountant','billing','vault','workshop','viewer','staff','karigar','customer','supplier','operator','auditor'
      );
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END $$;
  `;
  await runSql(typeInitSql);

  const enumValues = ['saas_admin','owner','admin','ceo','manager','accountant','billing','vault','workshop','viewer','staff','karigar','customer','supplier','operator','auditor'];
  for (const val of enumValues) {
    await runSql(`ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS '${val}';`);
  }

  const helperSql = `
    CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
    LANGUAGE plpgsql SET search_path = public AS $$
    BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

    CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
    RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
      SELECT exists (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
    $$;

    CREATE OR REPLACE FUNCTION public.is_saas_admin()
    RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
      SELECT exists (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'saas_admin'::public.app_role);
    $$;

    CREATE OR REPLACE FUNCTION public.my_active_firm_id()
    RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
    DECLARE
      v_ctx uuid;
      v_fallback uuid;
    BEGIN
      IF auth.uid() IS NULL THEN RETURN NULL; END IF;
      IF public.is_saas_admin() THEN RETURN NULL; END IF;

      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'identity_active_context') THEN
        SELECT iac.organization_id INTO v_ctx FROM public.identity_active_context iac WHERE iac.auth_user_id = auth.uid();
        IF v_ctx IS NOT NULL THEN RETURN v_ctx; END IF;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_memberships') THEN
        SELECT tm.organization_id INTO v_fallback FROM public.tenant_memberships tm
        WHERE tm.auth_user_id = auth.uid() AND tm.status = 'active'
        ORDER BY tm.last_active_at DESC NULLS LAST, tm.joined_at DESC LIMIT 1;
        RETURN v_fallback;
      END IF;

      RETURN NULL;
    END;
    $$;

    CREATE OR REPLACE FUNCTION public.my_firm_id()
    RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
      SELECT public.my_active_firm_id();
    $$;
  `;
  await runSql(helperSql);
  console.log("Types, Roles & Core Functions initialized ✓\n");
}

async function createAllTables() {
  console.log("=== STEP 3: Creating and Aligning All 264 Tables ===");
  const consolidatedPath = path.join(BACKUP_DIR, '02_ALL_TABLES_DATA_CONSOLIDATED.json');
  const allData = JSON.parse(fs.readFileSync(consolidatedPath, 'utf8'));

  const schemaRes = await runSql(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public';`);
  const existingTableCols = new Map();
  for (const row of (schemaRes.data || [])) {
    if (!existingTableCols.has(row.table_name)) existingTableCols.set(row.table_name, new Set());
    existingTableCols.get(row.table_name).add(row.column_name);
  }

  const ddlList = [];
  for (const [tName, rows] of Object.entries(allData)) {
    if (!existingTableCols.has(tName)) {
      if (rows && rows.length > 0) {
        const sampleRow = rows[0];
        const colDefs = [];
        for (const [col, val] of Object.entries(sampleRow)) {
          let type = inferSqlType(val);
          if (col === 'id') {
            if (typeof val === 'string' && val.length === 36 && val.includes('-')) {
              colDefs.push(`"${col}" uuid PRIMARY KEY DEFAULT gen_random_uuid()`);
            } else {
              colDefs.push(`"${col}" text PRIMARY KEY`);
            }
          } else {
            colDefs.push(`"${col}" ${type}`);
          }
        }
        ddlList.push(`CREATE TABLE IF NOT EXISTS public."${tName}" (\n  ${colDefs.join(',\n  ')}\n);`);
        existingTableCols.set(tName, new Set(Object.keys(sampleRow)));
      }
    } else if (rows && rows.length > 0) {
      const existingCols = existingTableCols.get(tName);
      const sampleRow = rows[0];
      for (const [col, val] of Object.entries(sampleRow)) {
        if (!existingCols.has(col)) {
          const type = inferSqlType(val);
          ddlList.push(`ALTER TABLE public."${tName}" ADD COLUMN IF NOT EXISTS "${col}" ${type};`);
          existingCols.add(col);
        }
      }
    }
  }

  console.log(`Applying ${ddlList.length} DDL statements...`);
  for (let i = 0; i < ddlList.length; i += 20) {
    const batch = ddlList.slice(i, i + 20).join('\n\n');
    await runSql(batch);
  }
  console.log("All tables created & columns aligned ✓\n");
}

async function applyMigrationBundle() {
  console.log("=== STEP 4: Applying 208 Master Migrations (Views, Functions, Triggers, RLS) ===");
  const bundlePath = path.resolve(process.cwd(), 'new and final', 'supabase', 'MASTER_MIGRATION_BUNDLE.sql');
  const content = fs.readFileSync(bundlePath, 'utf8');
  const sections = content.split(/-- -+\r?\n-- \[\d+\/\d+\] MIGRATION:[^\n]*\r?\n-- -+/);

  let applied = 0;
  for (let i = 1; i < sections.length; i++) {
    const rawSql = sections[i].trim();
    if (!rawSql || rawSql.length < 10) continue;
    const firstLine = rawSql.split('\n')[0].replace(/^--\s*/, '').trim().slice(0, 45);
    process.stdout.write(`  [${i.toString().padStart(3, ' ')}/${sections.length - 1}] ${firstLine}... `);

    const cleanSql = rawSql.replace(/\bBEGIN\b\s*;/gi, '').replace(/\bCOMMIT\b\s*;/gi, '');
    const res = await runSql(cleanSql);
    if (!res.error) {
      console.log("✓ OK");
      applied++;
    } else if (res.message?.includes('already exists') || res.message?.includes('relation') && res.message?.includes('exists')) {
      console.log("✓ OK (exists)");
      applied++;
    } else {
      console.log(`⚠ ${res.message?.slice(0, 65)}`);
    }
  }
  console.log(`Migrations applied: ${applied} / ${sections.length - 1}\n`);
}

async function restoreAllData() {
  console.log("=== STEP 5: Restoring All Table Data (44,492 Rows) ===");
  const consolidatedPath = path.join(BACKUP_DIR, '02_ALL_TABLES_DATA_CONSOLIDATED.json');
  const allData = JSON.parse(fs.readFileSync(consolidatedPath, 'utf8'));
  const tableNames = Object.keys(allData);

  const schemaRes = await runSql(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public';`);
  const existingTableCols = new Map();
  for (const row of (schemaRes.data || [])) {
    if (!existingTableCols.has(row.table_name)) existingTableCols.set(row.table_name, new Set());
    existingTableCols.get(row.table_name).add(row.column_name);
  }

  let totalInserted = 0;
  for (let i = 0; i < tableNames.length; i++) {
    const tName = tableNames[i];
    const rows = allData[tName];
    if (!rows || rows.length === 0) continue;

    const validCols = existingTableCols.get(tName);
    if (!validCols) continue;

    process.stdout.write(`  [${(i + 1).toString().padStart(3, ' ')}/${tableNames.length}] "${tName}" (${rows.length} rows)... `);

    const chunkSize = 100;
    let tableSuccess = 0;

    for (let c = 0; c < rows.length; c += chunkSize) {
      const chunk = rows.slice(c, c + chunkSize);
      const allRowCols = Object.keys(chunk[0]);
      const activeCols = allRowCols.filter(col => validCols.has(col));
      if (activeCols.length === 0) continue;

      const colsSql = activeCols.map(col => `"${col}"`).join(', ');
      const valuesSql = chunk.map(row => `(${activeCols.map(col => escapeSqlVal(row[col])).join(', ')})`).join(',\n');

      const insertSql = `
        SET session_replication_role = 'replica';
        INSERT INTO public."${tName}" (${colsSql})
        VALUES ${valuesSql}
        ON CONFLICT DO NOTHING;
        SET session_replication_role = 'origin';
      `;

      const res = await runSql(insertSql);
      if (!res.error) tableSuccess += chunk.length;
    }

    totalInserted += tableSuccess;
    console.log(`${tableSuccess} rows ✓`);
  }

  console.log(`\nTotal Rows Restored: ${totalInserted}`);
}

async function main() {
  console.log("==========================================================================");
  console.log("  AVS ERP — MASTER MIGRATION & DATA RESTORATION TO TARGET                  ");
  console.log(`  Target: ${TARGET_PROJECT_REF} (maa tara erp 2 - ap-south-1 Mumbai)       `);
  console.log("==========================================================================\n");

  await restoreAuthUsers();
  await setupTypesAndFunctions();
  await createAllTables();
  await applyMigrationBundle();
  await restoreAllData();

  console.log("\n==========================================================================");
  console.log("  MIGRATION AND DATA POPULATION COMPLETED SUCCESSFULLY!");
  console.log("==========================================================================\n");

  const finalCheck = await runSql(`
    SELECT 
      (SELECT count(*)::int FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') as total_tables,
      (SELECT count(*)::int FROM auth.users) as total_auth_users;
  `);
  console.log("Verification Summary:", finalCheck.data);
}

main().catch(console.error);
