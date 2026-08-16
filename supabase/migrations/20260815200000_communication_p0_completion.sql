-- P0 Communication completion: email outbox, template versions, webhook idempotency

CREATE TABLE IF NOT EXISTS public.email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.communication_jobs(id) ON DELETE SET NULL,
  tenant_email_account_id UUID REFERENCES public.tenant_email_accounts(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  template_key TEXT,
  event_key TEXT,
  entity_type TEXT,
  entity_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','sending','sent','delivered','failed','retrying')),
  external_message_id TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_firm ON public.email_outbox (firm_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_outbox_status ON public.email_outbox (status) WHERE status IN ('queued','retrying');

-- Template version history for rollback
CREATE TABLE IF NOT EXISTS public.email_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT NOT NULL REFERENCES public.email_template_library(id) ON DELETE CASCADE,
  firm_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  subject_template TEXT NOT NULL,
  html_template TEXT NOT NULL,
  text_template TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_email_template_version UNIQUE (template_id, version)
);

CREATE INDEX IF NOT EXISTS idx_email_template_versions_template ON public.email_template_versions (template_id, version DESC);

-- Webhook idempotency
CREATE UNIQUE INDEX IF NOT EXISTS uq_comm_webhook_external
  ON public.communication_webhook_events (provider, external_id)
  WHERE external_id IS NOT NULL;

ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_template_versions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'email_outbox_firm') THEN
    CREATE POLICY email_outbox_firm ON public.email_outbox
      FOR ALL USING (firm_id = public.my_firm_id() OR public.is_saas_admin())
      WITH CHECK (firm_id = public.my_firm_id() OR public.is_saas_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'email_template_versions_firm') THEN
    CREATE POLICY email_template_versions_read ON public.email_template_versions
      FOR SELECT USING (firm_id IS NULL OR firm_id = public.my_firm_id() OR public.is_saas_admin());
    CREATE POLICY email_template_versions_write ON public.email_template_versions
      FOR ALL USING (firm_id = public.my_firm_id() OR public.is_saas_admin())
      WITH CHECK (firm_id = public.my_firm_id() OR public.is_saas_admin());
  END IF;
END $$;
