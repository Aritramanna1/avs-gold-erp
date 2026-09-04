CREATE OR REPLACE FUNCTION public.my_firm_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT '00000000-0000-0000-0000-000000000001'::uuid;
$$;

GRANT EXECUTE ON FUNCTION public.my_firm_id() TO anon, authenticated, service_role;
