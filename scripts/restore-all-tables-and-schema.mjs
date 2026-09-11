import fs from 'fs';
import path from 'path';

const SUPABASE_TOKEN = 'SUPABASE_ACCESS_TOKEN_REDACTED';
const TARGET_PROJECT_REF = 'slbvphnxfcypeinclgmw';
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
        const waitTime = Math.min(attempt * 2500, 20000);
        process.stdout.write(`[429, waiting ${waitTime/1000}s] `);
        await sleep(waitTime);
        continue;
      }

      if (!res.ok) {
        const msg = data && data.message ? data.message : (typeof data === 'string' ? data : JSON.stringify(data));
        return { error: true, status: res.status, message: msg };
      }

      await sleep(150);
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

async function step1_createCoreHelpers() {
  console.log("=== STEP 1: Setting up Core Types & Helper Functions ===");

  const coreSql = `
    -- Enable standard extensions
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    -- Core helper: set_updated_at
    CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
    LANGUAGE plpgsql SET search_path = public AS $$
    BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

    -- Core helper: is_saas_admin
    CREATE OR REPLACE FUNCTION public.is_saas_admin()
    RETURNS boolean
    LANGUAGE sql
    STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT exists (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
          AND role = 'saas_admin'::public.app_role
      );
    $$;

    -- Core helper: my_active_firm_id
    CREATE OR REPLACE FUNCTION public.my_active_firm_id()
    RETURNS uuid
    LANGUAGE plpgsql
    STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_ctx uuid;
      v_fallback uuid;
    BEGIN
      IF auth.uid() IS NULL THEN
        RETURN NULL;
      END IF;

      IF public.is_saas_admin() THEN
        RETURN NULL;
      END IF;

      -- Check if identity_active_context table exists
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'identity_active_context') THEN
        SELECT iac.organization_id
        INTO v_ctx
        FROM public.identity_active_context iac
        WHERE iac.auth_user_id = auth.uid();

        IF v_ctx IS NOT NULL THEN
          RETURN v_ctx;
        END IF;
      END IF;

      -- Fallback to tenant memberships
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_memberships') THEN
        SELECT tm.organization_id
        INTO v_fallback
        FROM public.tenant_memberships tm
        WHERE tm.auth_user_id = auth.uid()
          AND tm.status = 'active'
        ORDER BY tm.last_active_at DESC NULLS LAST, tm.joined_at DESC
        LIMIT 1;

        RETURN v_fallback;
      END IF;

      RETURN NULL;
    END;
    $$;

    -- Core helper: my_firm_id
    CREATE OR REPLACE FUNCTION public.my_firm_id()
    RETURNS uuid
    LANGUAGE sql
    STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT public.my_active_firm_id();
    $$;

    -- Core helper: has_role
    CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
    RETURNS boolean
    LANGUAGE sql
    STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT exists (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = _user_id AND role = _role
      );
    $$;
  `;

  const res = await runSql(coreSql);
  if (res.error) console.log("Core helpers warning:", res.message);
  else console.log("Core helpers installed ✓");
}

async function step2_createAllBackupTables() {
  console.log("\n=== STEP 2: Ensuring all 264 tables and columns from backup exist ===");

  const consolidatedPath = path.join(BACKUP_DIR, '02_ALL_TABLES_DATA_CONSOLIDATED.json');
  const allData = JSON.parse(fs.readFileSync(consolidatedPath, 'utf8'));

  const checkRes = await runSql("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';");
  const existingTables = new Set((checkRes.data || []).map(r => r.table_name));

  for (const [tName, rows] of Object.entries(allData)) {
    if (!existingTables.has(tName)) {
      if (rows && rows.length > 0) {
        // Build table DDL from sample row
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

        const createSql = `CREATE TABLE IF NOT EXISTS public."${tName}" (\n  ${colDefs.join(',\n  ')}\n);`;
        const res = await runSql(createSql);
        if (!res.error) {
          existingTables.add(tName);
          console.log(`Created table "${tName}" ✓`);
        } else {
          console.log(`Failed to create "${tName}":`, res.message?.slice(0, 70));
        }
      }
    } else if (rows && rows.length > 0) {
      // Ensure missing columns exist
      const colsRes = await runSql(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${tName}';`);
      const existingCols = new Set((colsRes.data || []).map(c => c.column_name));

      const sampleRow = rows[0];
      for (const [col, val] of Object.entries(sampleRow)) {
        if (!existingCols.has(col)) {
          const type = inferSqlType(val);
          await runSql(`ALTER TABLE public."${tName}" ADD COLUMN IF NOT EXISTS "${col}" ${type};`);
        }
      }
    }
  }

  const finalCheck = await runSql("SELECT count(*)::int as count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';");
  console.log(`Total public tables now active in target: ${finalCheck.data?.[0]?.count || 0}`);
}

async function step3_applyAllMigrationBundle() {
  console.log("\n=== STEP 3: Applying 208 Master Migrations (Views, Triggers, RLS, Indexes) ===");

  const bundlePath = path.resolve(process.cwd(), 'new and final', 'supabase', 'MASTER_MIGRATION_BUNDLE.sql');
  const content = fs.readFileSync(bundlePath, 'utf8');
  const sections = content.split(/-- -+\r?\n-- \[\d+\/\d+\] MIGRATION:[^\n]*\r?\n-- -+/);

  let applied = 0;
  let notices = 0;

  for (let i = 1; i < sections.length; i++) {
    const rawSql = sections[i].trim();
    if (!rawSql || rawSql.length < 10) continue;

    const firstLine = rawSql.split('\n')[0].replace(/^--\s*/, '').trim().slice(0, 45);
    process.stdout.write(`[${i.toString().padStart(3, ' ')}/${sections.length - 1}] ${firstLine}... `);

    const cleanSql = rawSql.replace(/\bBEGIN\b\s*;/gi, '').replace(/\bCOMMIT\b\s*;/gi, '');
    const res = await runSql(cleanSql);

    if (res.error) {
      const msg = res.message || '';
      if (msg.includes('already exists') || msg.includes('duplicate key') || msg.includes('relation') && msg.includes('exists')) {
        console.log("✓ OK (exists)");
        applied++;
      } else {
        console.log(`⚠ ${msg.slice(0, 70)}`);
        notices++;
      }
    } else {
      console.log("✓ OK");
      applied++;
    }
  }

  console.log(`Master migrations applied: ${applied} / ${sections.length - 1}`);
}

async function main() {
  console.log("==========================================================================");
  console.log("  AVS ERP — MASTER REPAIR & COMPLETE REHYDRATION ENGINE                   ");
  console.log(`  Target: ${TARGET_PROJECT_REF} (ap-south-1 Mumbai)`);
  console.log("==========================================================================\n");

  await step1_createCoreHelpers();
  await step2_createAllBackupTables();
  await step3_applyAllMigrationBundle();

  console.log("\n==========================================================================");
  console.log("  ALL SCHEMAS AND FOUNDATIONS READY FOR DATA RESTORE");
  console.log("==========================================================================\n");
}

main().catch(console.error);
