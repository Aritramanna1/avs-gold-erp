-- Declarative business rules (dedicated table) + communication scheduler cron hook

CREATE TABLE IF NOT EXISTS public.declarative_business_rules (
  id TEXT NOT NULL,
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  condition_logic TEXT NOT NULL DEFAULT 'AND',
  action JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (firm_id, id)
);

CREATE INDEX IF NOT EXISTS idx_declarative_business_rules_firm
  ON public.declarative_business_rules (firm_id, is_active);

ALTER TABLE public.declarative_business_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS declarative_business_rules_firm ON public.declarative_business_rules;
CREATE POLICY declarative_business_rules_firm ON public.declarative_business_rules
  FOR ALL TO authenticated
  USING (firm_id = public.my_firm_id())
  WITH CHECK (firm_id = public.my_firm_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.declarative_business_rules TO authenticated;

-- Migrate legacy app_settings blob into table (one-time, idempotent)
INSERT INTO public.declarative_business_rules (
  id, firm_id, name, description, category, conditions, condition_logic, action, is_active
)
SELECT
  r->>'id',
  (s.firm_id)::uuid,
  COALESCE(r->>'name', r->>'id'),
  r->>'description',
  COALESCE(r->>'category', 'general'),
  COALESCE(r->'conditions', '[]'::jsonb),
  COALESCE(r->>'conditionLogic', 'AND'),
  COALESCE(r->'action', '{}'::jsonb),
  COALESCE((r->>'isActive')::boolean, true)
FROM public.app_settings s,
     jsonb_array_elements(COALESCE(s.data->'rules', '[]'::jsonb)) AS r
WHERE s.id LIKE '%_declarative_business_rules'
  AND s.data ? 'rules'
ON CONFLICT (firm_id, id) DO NOTHING;

-- Scheduler invocation helper (callable by pg_cron or manual SQL)
CREATE OR REPLACE FUNCTION public.invoke_communication_scheduler()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  v_url := current_setting('app.settings.supabase_url', true);
  v_secret := current_setting('app.settings.communication_scheduler_secret', true);
  IF v_url IS NULL OR v_url = '' THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/communication-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-scheduler-secret', COALESCE(v_secret, '')
    ),
    body := '{}'::jsonb
  );
EXCEPTION
  WHEN undefined_function THEN
    -- pg_net not available — no-op
    NULL;
  WHEN OTHERS THEN
    RAISE WARNING 'invoke_communication_scheduler failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_communication_scheduler() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invoke_communication_scheduler() TO authenticated, service_role;

-- Schedule hourly if pg_cron is available
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'avs_communication_scheduler_hourly';
    PERFORM cron.schedule(
      'avs_communication_scheduler_hourly',
      '0 * * * *',
      'SELECT public.invoke_communication_scheduler();'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron schedule skipped: %', SQLERRM;
END;
$cron$;
