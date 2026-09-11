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
  console.log("  ALIGNING ROLES, POLICIES & FUNCTIONS FOR SAAS ADMIN & OWNER");
  console.log("==================================================================\n");

  // 1. Create Core Security and Role Helper Functions
  const coreSql = `
    -- Create has_role helper
    CREATE OR REPLACE FUNCTION public.has_role(p_user_id uuid, p_role text)
    RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = p_user_id AND role::text = p_role::text
      );
    $$;
    GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated, anon;

    -- Create is_saas_admin helper
    CREATE OR REPLACE FUNCTION public.is_saas_admin()
    RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
      SELECT COALESCE(
        public.has_role((select auth.uid()), 'saas_admin') OR
        EXISTS (
          SELECT 1 FROM auth.users 
          WHERE id = (select auth.uid()) 
            AND (email = 'aritramanna222@gmail.com' OR raw_user_meta_data->>'requested_role' = 'saas_admin')
        ),
        false
      );
    $$;
    GRANT EXECUTE ON FUNCTION public.is_saas_admin() TO authenticated, anon;

    -- Create my_firm_id helper
    CREATE OR REPLACE FUNCTION public.my_firm_id()
    RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
      SELECT COALESCE(
        (SELECT firm_id::text FROM public.user_profiles WHERE auth_id = (select auth.uid()) LIMIT 1),
        (SELECT organization_id::text FROM public.tenant_memberships WHERE auth_user_id = (select auth.uid()) LIMIT 1)
      );
    $$;
    GRANT EXECUTE ON FUNCTION public.my_firm_id() TO authenticated, anon;

    -- Create is_owner helper
    CREATE OR REPLACE FUNCTION public.is_owner()
    RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
      SELECT COALESCE(
        public.has_role((select auth.uid()), 'owner') OR
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE auth_id = (select auth.uid()) AND (role ILIKE 'owner%' OR (data->>'is_super_owner')::boolean = true)
        ) OR
        EXISTS (
          SELECT 1 FROM auth.users
          WHERE id = (select auth.uid()) AND email = 'aritramanna777@gmail.com'
        ),
        false
      );
    $$;
    GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated, anon;

    -- Ensure explicit role in public.user_roles for aritramanna222@gmail.com (saas_admin)
    INSERT INTO public.user_roles (id, user_id, role, created_at)
    VALUES (
      '32e5e087-a353-4633-808d-239c13a46030',
      '1fad90cc-b28e-47d9-b34d-d8785a8e25b0',
      'saas_admin',
      now()
    )
    ON CONFLICT (id) DO UPDATE SET role = 'saas_admin';

    -- Ensure explicit role in public.user_roles for aritramanna777@gmail.com (owner)
    INSERT INTO public.user_roles (id, user_id, role, created_at)
    VALUES (
      'f4700b45-df88-43b0-b356-e6d2bd0c1d98',
      'b58809f6-1318-4f38-a143-d7bc2ca41997',
      'owner',
      now()
    )
    ON CONFLICT (id) DO UPDATE SET role = 'owner';

    -- Ensure user_profiles row for aritramanna222@gmail.com
    INSERT INTO public.user_profiles (
      id, auth_id, firm_id, branch_id, full_name, phone, status, active, role, data, permissions, created_at, updated_at
    ) VALUES (
      '3b2ada77-9aea-4166-9d09-4d4c59c42002',
      '1fad90cc-b28e-47d9-b34d-d8785a8e25b0',
      '0e0d8a84-6f20-48d0-873c-45da0004879f',
      'br_06368769e322',
      'Aritra Manna',
      '8484803580',
      'active',
      true,
      'saas_admin',
      '{"is_saas_admin": true}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      role = 'saas_admin',
      full_name = 'Aritra Manna',
      updated_at = now();

    -- Ensure user_profiles row for aritramanna777@gmail.com (Owner of Maa Tara Jewellers)
    INSERT INTO public.user_profiles (
      id, auth_id, firm_id, branch_id, full_name, phone, status, active, role, data, permissions, created_at, updated_at
    ) VALUES (
      '3354a1cf-0e06-4859-83e4-1251d1d74f9a',
      'b58809f6-1318-4f38-a143-d7bc2ca41997',
      '3aa73b3f-bd48-4a5f-943d-d4263364b8f7',
      'br_9e38e0b41cac',
      'Aritra Manna',
      '8484803580',
      'active',
      true,
      'Owner',
      '{"is_super_owner": true}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      role = 'Owner',
      full_name = 'Aritra Manna',
      firm_id = '3aa73b3f-bd48-4a5f-943d-d4263364b8f7',
      updated_at = now();

    -- Ensure tenant_memberships row for aritramanna777@gmail.com
    INSERT INTO public.tenant_memberships (
      id, auth_user_id, organization_id, product_id, membership_kind, role, status, user_profile_id, branch_ids, joined_at, metadata, created_at, updated_at
    ) VALUES (
      '58f37cf2-f819-4002-b3d6-53a052babf80',
      'b58809f6-1318-4f38-a143-d7bc2ca41997',
      '3aa73b3f-bd48-4a5f-943d-d4263364b8f7',
      'ORNEXA',
      'internal',
      'Owner',
      'active',
      '3354a1cf-0e06-4859-83e4-1251d1d74f9a',
      '["br_9e38e0b41cac"]'::jsonb,
      now(),
      '{}'::jsonb,
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      role = 'Owner',
      organization_id = '3aa73b3f-bd48-4a5f-943d-d4263364b8f7',
      updated_at = now();
  `;

  const coreRes = await runSql(coreSql);
  console.log("Core functions & roles update result:", coreRes);

  // 2. Align RLS Policies on user_profiles, user_roles, tenant_memberships
  const rlsSql = `
    -- user_profiles RLS policies
    ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS user_profiles_self_select ON public.user_profiles;
    DROP POLICY IF EXISTS user_profiles_read_policy ON public.user_profiles;
    CREATE POLICY user_profiles_read_policy ON public.user_profiles FOR SELECT TO authenticated
      USING (
        public.is_saas_admin() 
        OR auth_id = (select auth.uid())
        OR firm_id::text = public.my_firm_id()
      );

    DROP POLICY IF EXISTS user_profiles_manage_policy ON public.user_profiles;
    CREATE POLICY user_profiles_manage_policy ON public.user_profiles FOR ALL TO authenticated
      USING (
        public.is_saas_admin()
        OR auth_id = (select auth.uid())
        OR (public.is_owner() AND firm_id::text = public.my_firm_id())
      )
      WITH CHECK (
        public.is_saas_admin()
        OR auth_id = (select auth.uid())
        OR (public.is_owner() AND firm_id::text = public.my_firm_id())
      );

    -- user_roles RLS policies
    ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS user_roles_self_select ON public.user_roles;
    DROP POLICY IF EXISTS user_roles_read_policy ON public.user_roles;
    CREATE POLICY user_roles_read_policy ON public.user_roles FOR SELECT TO authenticated
      USING (
        public.is_saas_admin()
        OR user_id = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.auth_id = user_roles.user_id AND up.firm_id::text = public.my_firm_id()
        )
      );

    -- tenant_memberships RLS policies
    ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_memberships_read_policy ON public.tenant_memberships;
    CREATE POLICY tenant_memberships_read_policy ON public.tenant_memberships FOR SELECT TO authenticated
      USING (
        public.is_saas_admin()
        OR auth_user_id = (select auth.uid())
        OR organization_id::text = public.my_firm_id()
      );

    -- organizations RLS policies
    ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS organizations_read_policy ON public.organizations;
    CREATE POLICY organizations_read_policy ON public.organizations FOR SELECT TO authenticated
      USING (
        public.is_saas_admin()
        OR id::text = public.my_firm_id()
      );
  `;

  const rlsRes = await runSql(rlsSql);
  console.log("RLS policies update result:", rlsRes);

  // 3. Verification Check
  const check = await runSql(`
    SELECT 
      u.email,
      ur.role as user_roles_entry,
      up.role as profile_role,
      up.full_name,
      tm.role as membership_role,
      tm.organization_id
    FROM auth.users u
    LEFT JOIN public.user_roles ur ON ur.user_id = u.id
    LEFT JOIN public.user_profiles up ON up.auth_id = u.id
    LEFT JOIN public.tenant_memberships tm ON tm.auth_user_id = u.id
    WHERE u.email IN ('aritramanna222@gmail.com', 'aritramanna777@gmail.com');
  `);
  console.log("\n==================================================================");
  console.log("  CONFIRMED USER STATE:\n", JSON.stringify(check, null, 2));
  console.log("==================================================================\n");
}

main().catch(console.error);
