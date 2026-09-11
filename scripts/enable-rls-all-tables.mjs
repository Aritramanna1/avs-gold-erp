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
  console.log("  ENABLING ROW LEVEL SECURITY (RLS) ON ALL TABLES IN PUBLIC SCHEMA");
  console.log("==================================================================\n");

  const enableAllRlsSql = `
    DO $$
    DECLARE
      r RECORD;
      has_firm_col boolean;
      has_policies boolean;
    BEGIN
      -- Loop over all tables in public schema
      FOR r IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
      LOOP
        -- 1. Enable RLS
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
        
        -- Check if policies exist
        SELECT EXISTS (
          SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = r.tablename
        ) INTO has_policies;

        -- If table has no policies at all, create appropriate default authenticated policies
        IF NOT has_policies THEN
          SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = r.tablename AND column_name = 'firm_id'
          ) INTO has_firm_col;

          IF has_firm_col THEN
            EXECUTE format('
              CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
                USING (
                  public.is_saas_admin() 
                  OR firm_id::text = public.my_firm_id() 
                  OR (firm_id IS NULL AND public.my_firm_id() IS NULL)
                );
            ', r.tablename || '_select_policy', r.tablename);

            EXECUTE format('
              CREATE POLICY %I ON public.%I FOR ALL TO authenticated
                USING (
                  public.is_saas_admin() 
                  OR firm_id::text = public.my_firm_id() 
                  OR (firm_id IS NULL AND public.my_firm_id() IS NULL)
                )
                WITH CHECK (
                  public.is_saas_admin() 
                  OR firm_id::text = public.my_firm_id() 
                  OR (firm_id IS NULL AND public.my_firm_id() IS NULL)
                );
            ', r.tablename || '_manage_policy', r.tablename);
          ELSE
            -- Tables without firm_id (system, master, public, audit tables)
            EXECUTE format('
              CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
                USING (true);
            ', r.tablename || '_authed_select', r.tablename);

            EXECUTE format('
              CREATE POLICY %I ON public.%I FOR ALL TO authenticated
                USING (true)
                WITH CHECK (true);
            ', r.tablename || '_authed_manage', r.tablename);
          END IF;
        END IF;
      END LOOP;
    END $$;
  `;

  const res = await runSql(enableAllRlsSql);
  console.log("Enable RLS Result:", res);

  // Verification
  const verifyRes = await runSql(`
    SELECT 
      count(*)::int as total_tables,
      sum(case when rowsecurity then 1 else 0 end)::int as rls_enabled_tables,
      sum(case when not rowsecurity then 1 else 0 end)::int as rls_disabled_tables
    FROM pg_tables 
    WHERE schemaname = 'public';
  `);

  console.log("\n==================================================================");
  console.log("  RLS AUDIT SUMMARY:\n", JSON.stringify(verifyRes[0], null, 2));
  console.log("==================================================================\n");
}

main().catch(console.error);
