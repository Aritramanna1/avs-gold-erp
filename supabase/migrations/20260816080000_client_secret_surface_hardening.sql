-- Client secret surface hardening: migrate legacy plaintext columns into vault,
-- scrub JSON blobs, and expose a non-revealing configured check RPC.

INSERT INTO public.comm_provider_secrets (branch_id, provider_type, secret_data)
SELECT
  bs.branch_id,
  'email_smtp',
  jsonb_build_object(
    'password', bs.smtp_password,
    'username', COALESCE(bs.smtp_user, '')
  )
FROM public.branch_settings bs
WHERE bs.smtp_password IS NOT NULL
  AND btrim(bs.smtp_password) <> ''
ON CONFLICT (branch_id, provider_type)
DO UPDATE SET
  secret_data = public.comm_provider_secrets.secret_data || EXCLUDED.secret_data,
  updated_at = now();

UPDATE public.branch_settings
SET smtp_password = NULL
WHERE smtp_password IS NOT NULL;

DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'branch_settings' AND column_name = 'wa_config'
  ) THEN
    UPDATE public.branch_settings
    SET wa_config = COALESCE(wa_config, '{}'::jsonb)
      - 'accessToken'
      - 'webhookVerifyToken'
      - 'webhookSecret'
      - 'access_token'
      - 'webhook_verify_token'
      - 'webhook_secret'
    WHERE wa_config IS NOT NULL;
  END IF;
END;
$wa$;

UPDATE public.branch_settings
SET data = COALESCE(data, '{}'::jsonb)
  || jsonb_build_object(
    'wa_config',
    COALESCE(data->'wa_config', '{}'::jsonb)
      - 'accessToken'
      - 'webhookVerifyToken'
      - 'webhookSecret'
      - 'access_token'
      - 'webhook_verify_token'
      - 'webhook_secret'
  )
WHERE data ? 'wa_config';

UPDATE public.app_settings
SET data = jsonb_set(
  data,
  '{configs}',
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_set(
          cfg,
          '{settings}',
          COALESCE(cfg->'settings', '{}'::jsonb)
            - 'access_token'
            - 'api_key'
            - 'password'
            - 'webhook_verify_token'
            - 'webhook_secret'
            - 'auth_token'
            - 'account_sid'
            - 'token'
        )
      )
      FROM jsonb_array_elements(COALESCE(data->'configs', '[]'::jsonb)) AS cfg
    ),
    '[]'::jsonb
  )
)
WHERE id = 'comm_configs'
  AND data ? 'configs';

UPDATE public.app_settings
SET data = jsonb_set(
  data,
  '{smtp}',
  COALESCE(data->'smtp', '{}'::jsonb)
    || jsonb_build_object('passKey', '', 'apiKey', '')
)
WHERE data ? 'smtp';

UPDATE public.app_settings
SET data = jsonb_set(
  data,
  '{bullionRateProvider,httpProvider,apiKey}',
  '""'::jsonb,
  true
)
WHERE data #> '{bullionRateProvider,httpProvider,apiKey}' IS NOT NULL;

CREATE OR REPLACE FUNCTION public.provider_secret_is_configured(
  p_branch_id TEXT,
  p_provider_type TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.comm_provider_secrets cps
    WHERE cps.branch_id = p_branch_id
      AND cps.provider_type = p_provider_type
      AND cps.secret_data IS NOT NULL
      AND cps.secret_data <> '{}'::jsonb
  );
$$;

REVOKE ALL ON FUNCTION public.provider_secret_is_configured(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provider_secret_is_configured(TEXT, TEXT) TO authenticated, service_role;
