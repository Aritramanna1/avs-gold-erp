-- Migration: 20260912220000_email_password_configured_rpc.sql
-- Description: Adds helper RPCs for recording and reading email_password_configured state in auth.users metadata

CREATE OR REPLACE FUNCTION public.mark_my_email_password_configured()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"email_password_configured": true}'::jsonb
  WHERE id = auth.uid();

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.my_email_password_configured()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_meta jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT raw_user_meta_data INTO v_meta
  FROM auth.users
  WHERE id = auth.uid();

  RETURN COALESCE((v_meta->>'email_password_configured')::boolean, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_my_email_password_configured() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_email_password_configured() TO authenticated;
