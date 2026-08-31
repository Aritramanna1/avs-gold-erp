-- =====================================================================
-- MTJ ERP — Owner setup for external Supabase (project kjfjsfhftytezsjyegmb)
-- Owner email: games48480@gmail.com
-- Run AFTER docs/option_b_schema.sql has been applied AND after the owner
-- has signed up at least once through the deployed app (so auth.users has
-- a row for that email). No password is hardcoded; the user sets it during
-- signup / password reset.
-- =====================================================================

-- 1. VERIFY the owner row exists in auth.users
SELECT id, email, created_at, last_sign_in_at
FROM auth.users
WHERE email = 'games48480@gmail.com';

-- 2. VERIFY current role assignments (if any) for that user
SELECT ur.user_id, u.email, ur.role
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE u.email = 'games48480@gmail.com';

-- 3. ASSIGN owner role if missing (idempotent — ON CONFLICT DO NOTHING)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'owner'::public.app_role
FROM auth.users
WHERE email = 'games48480@gmail.com'
ON CONFLICT DO NOTHING;

-- 4. (Optional) REMOVE the auto-assigned 'viewer' role for the owner so the
--    role list is clean. Owner already implies full access via has_role().
DELETE FROM public.user_roles
WHERE role = 'viewer'
  AND user_id IN (SELECT id FROM auth.users WHERE email = 'games48480@gmail.com');

-- 5. FINAL VERIFY
SELECT u.email, array_agg(ur.role ORDER BY ur.role) AS roles
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.email = 'games48480@gmail.com'
GROUP BY u.email;
-- Expected: roles = {owner}
