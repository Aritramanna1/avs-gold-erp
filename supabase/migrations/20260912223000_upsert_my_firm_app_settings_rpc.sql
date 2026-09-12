-- Migration: 20260912223000_upsert_my_firm_app_settings_rpc.sql
-- Description: Adds RPC upsert_my_firm_app_settings to reliably persist firm settings under RLS

CREATE OR REPLACE FUNCTION public.upsert_my_firm_app_settings(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_firm_id uuid;
  v_user_id uuid;
  v_target_id text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_firm_id := public.my_firm_id();
  
  IF v_firm_id IS NOT NULL THEN
    v_target_id := v_firm_id::text;
    
    INSERT INTO public.app_settings (id, firm_id, scope, data, updated_at)
    VALUES (v_target_id, v_firm_id, 'firm', p_data, now())
    ON CONFLICT (id) DO UPDATE
    SET data = excluded.data,
        firm_id = excluded.firm_id,
        updated_at = excluded.updated_at;
  ELSE
    -- If user has no firm assigned (e.g. SaaS Admin or superuser), check if admin
    IF public.is_saas_admin() THEN
      v_target_id := 'main_settings';
      
      INSERT INTO public.app_settings (id, scope, data, updated_at)
      VALUES (v_target_id, 'firm', p_data, now())
      ON CONFLICT (id) DO UPDATE
      SET data = excluded.data,
          updated_at = excluded.updated_at;
    ELSE
      -- Normal user without firm: store keyed by user_id
      v_target_id := v_user_id::text;
      
      INSERT INTO public.app_settings (id, scope, data, updated_at)
      VALUES (v_target_id, 'user', p_data, now())
      ON CONFLICT (id) DO UPDATE
      SET data = excluded.data,
          updated_at = excluded.updated_at;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_target_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_my_firm_app_settings(jsonb) TO authenticated;
