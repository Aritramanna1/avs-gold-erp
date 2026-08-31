-- AVS Communication Platform — multi-product WhatsApp + Email infrastructure
-- Refs: COMMUNICATION_MASTER.md, EMAIL_SERVICE_MASTER.md, WHATSAPP_META_PARTNER_MASTER.md

-- 1. AVS software products (Ornexa, Restaurant POS, future ERPs)
CREATE TABLE IF NOT EXISTS public.avs_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.avs_products (id, name, description) VALUES
  ('ORNEXA', 'Ornexa Jewellery ERP', 'Jewellery manufacturing ERP'),
  ('RESTAURANT_POS', 'AVS Restaurant POS', 'Restaurant point of sale'),
  ('ACCOUNTING_ERP', 'AVS Accounting ERP', 'Accounting and compliance ERP'),
  ('INVENTORY_ERP', 'AVS Inventory ERP', 'Inventory management ERP')
ON CONFLICT (id) DO NOTHING;

-- 2. Canonical communication event catalog
CREATE TABLE IF NOT EXISTS public.communication_event_catalog (
  event_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'transactional',
  default_channels JSONB NOT NULL DEFAULT '["email"]'::jsonb,
  whatsapp_allowed BOOLEAN NOT NULL DEFAULT true,
  email_allowed BOOLEAN NOT NULL DEFAULT true,
  in_app_allowed BOOLEAN NOT NULL DEFAULT true,
  is_schedulable BOOLEAN NOT NULL DEFAULT false,
  credit_category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.communication_event_catalog (event_key, display_name, default_channels, whatsapp_allowed, is_schedulable, credit_category) VALUES
  ('invoice.ready', 'Invoice Ready', '["email"]', true, false, 'whatsapp'),
  ('payment.received', 'Payment Receipt', '["email"]', true, false, 'whatsapp'),
  ('payment.due', 'Payment Due Reminder', '["email"]', true, false, 'whatsapp'),
  ('order.created', 'Order Confirmation', '["email"]', true, false, 'whatsapp'),
  ('order.progress', 'Order Progress Update', '["email"]', true, false, 'whatsapp'),
  ('order.ready', 'Order Ready for Collection', '["email","whatsapp"]', true, false, 'whatsapp'),
  ('document.ready', 'Document Ready', '["email"]', true, false, null),
  ('quotation.sent', 'Quotation Sent', '["email"]', true, false, 'whatsapp'),
  ('portal.invited', 'Portal Invitation', '["email"]', false, false, null),
  ('auth.password_reset', 'Password Reset', '["email"]', false, false, null),
  ('auth.otp_login', 'OTP Login Code', '["email"]', false, false, null),
  ('support.updated', 'Support Ticket Update', '["email","in_app"]', false, false, null),
  ('karigar.job_reminder', 'Karigar Job Reminder', '["email"]', true, false, 'whatsapp'),
  ('supplier.purchase_order', 'Supplier Purchase Order', '["email"]', true, false, 'whatsapp'),
  ('hallmark.memo', 'Hallmark Memo', '["email"]', true, false, null),
  ('catalogue.share', 'Catalogue Share', '["email","whatsapp"]', true, false, 'whatsapp'),
  ('subscription.amc_reminder', 'AMC Renewal Reminder', '["email"]', false, true, null),
  ('subscription.plan_renewal', 'Plan Renewal', '["email"]', false, true, null),
  ('credits.low', 'Low Credits Alert', '["email","in_app"]', false, true, null),
  ('credits.purchased', 'Credits Purchased', '["email"]', false, false, null),
  ('report.daily', 'Daily Management Report', '["email"]', false, true, null),
  ('report.weekly', 'Weekly Business Summary', '["email"]', false, true, null),
  ('report.monthly', 'Monthly Statement', '["email"]', false, true, null)
ON CONFLICT (event_key) DO NOTHING;

-- 3. Unified communication job queue
CREATE TABLE IF NOT EXISTS public.communication_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL REFERENCES public.avs_products(id),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id TEXT,
  event_key TEXT NOT NULL REFERENCES public.communication_event_catalog(event_key),
  channels_requested TEXT[] NOT NULL DEFAULT ARRAY['email']::TEXT[],
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','partial','failed','cancelled')),
  recipient JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  reference_type TEXT,
  reference_id TEXT,
  document_url TEXT,
  party_id TEXT,
  user_id UUID,
  credit_cost INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_comm_jobs_firm ON public.communication_jobs (firm_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_jobs_status ON public.communication_jobs (status) WHERE status IN ('pending','processing');
CREATE INDEX IF NOT EXISTS idx_comm_jobs_event ON public.communication_jobs (event_key, created_at DESC);

-- 4. Per-channel delivery results
CREATE TABLE IF NOT EXISTS public.communication_channel_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.communication_jobs(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email','whatsapp','sms','in_app')),
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','queued','sending','sent','delivered','read','failed','skipped')),
  external_message_id TEXT,
  cost_credits INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  fallback_from_channel TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_channel_results_job ON public.communication_channel_results (job_id);

-- 5. Tenant email configuration (non-secret fields only)
CREATE TABLE IF NOT EXISTS public.tenant_email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES public.avs_products(id),
  branch_id TEXT,
  display_name TEXT,
  from_email TEXT NOT NULL,
  reply_to TEXT,
  provider_type TEXT NOT NULL DEFAULT 'email_smtp'
    CHECK (provider_type IN ('email_smtp','email_google_workspace','email_resend','email_sendgrid','email_ses','email_mailgun')),
  provider_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_test_at TIMESTAMPTZ,
  last_test_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_email_accounts_firm ON public.tenant_email_accounts (firm_id);

-- 6. Email template library (system + tenant versions)
CREATE TABLE IF NOT EXISTS public.email_template_library (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES public.avs_products(id),
  event_key TEXT REFERENCES public.communication_event_catalog(event_key),
  template_key TEXT NOT NULL,
  name TEXT NOT NULL,
  subject_template TEXT NOT NULL,
  html_template TEXT NOT NULL,
  text_template TEXT,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT true,
  is_published BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  firm_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_event ON public.email_template_library (event_key);
CREATE INDEX IF NOT EXISTS idx_email_templates_firm ON public.email_template_library (firm_id) WHERE firm_id IS NOT NULL;

-- 7. WhatsApp connections (Meta partner / client WABA)
CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.avs_products(id),
  branch_id TEXT,
  connection_mode TEXT NOT NULL DEFAULT 'off'
    CHECK (connection_mode IN ('off','managed_partner','client_owned','custom_connector')),
  provider_type TEXT DEFAULT 'whatsapp_cloud_api',
  waba_id TEXT,
  phone_number_id TEXT,
  display_phone TEXT,
  display_name TEXT,
  onboarding_status TEXT NOT NULL DEFAULT 'not_started',
  embedded_signup_status TEXT DEFAULT 'not_started',
  webhook_status TEXT DEFAULT 'unknown',
  template_sync_status TEXT DEFAULT 'pending',
  business_verification_status TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  messages_sent_count INTEGER NOT NULL DEFAULT 0,
  messages_delivered_count INTEGER NOT NULL DEFAULT 0,
  messages_failed_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  last_webhook_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_whatsapp_connection_firm_product_branch UNIQUE (firm_id, product_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_firm ON public.whatsapp_connections (firm_id);

-- 8. WhatsApp message templates
CREATE TABLE IF NOT EXISTS public.whatsapp_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE,
  event_key TEXT REFERENCES public.communication_event_catalog(event_key),
  template_name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  category TEXT DEFAULT 'utility' CHECK (category IN ('utility','marketing','authentication')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paused')),
  meta_template_id TEXT,
  body_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_wa_template_connection_name UNIQUE (connection_id, template_name, language)
);

-- 9. Notification preferences (per tenant / event / branch)
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.avs_products(id),
  event_key TEXT NOT NULL REFERENCES public.communication_event_catalog(event_key),
  branch_id TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  channels JSONB NOT NULL DEFAULT '["email"]'::jsonb,
  email_template_key TEXT,
  whatsapp_template_name TEXT,
  schedule_cron TEXT,
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  language TEXT NOT NULL DEFAULT 'en-IN',
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_pref
  ON public.notification_preferences (firm_id, product_id, event_key, COALESCE(branch_id, ''));

-- 10. Scheduled report deliveries
CREATE TABLE IF NOT EXISTS public.scheduled_report_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.avs_products(id),
  report_key TEXT NOT NULL,
  report_name TEXT NOT NULL,
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  schedule_cron TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'html' CHECK (format IN ('html','pdf','excel','csv','link')),
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email','whatsapp','in_app')),
  branch_id TEXT,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_job_id UUID REFERENCES public.communication_jobs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Provider webhook events
CREATE TABLE IF NOT EXISTS public.communication_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  product_id TEXT REFERENCES public.avs_products(id),
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  external_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT false,
  processing_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_webhooks_received ON public.communication_webhook_events (received_at DESC);

-- RLS
ALTER TABLE public.avs_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_event_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_channel_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_template_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_report_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_webhook_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'avs_products_read') THEN
    CREATE POLICY avs_products_read ON public.avs_products FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'comm_event_catalog_read') THEN
    CREATE POLICY comm_event_catalog_read ON public.communication_event_catalog FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'communication_jobs_firm') THEN
    CREATE POLICY communication_jobs_firm ON public.communication_jobs
      FOR ALL USING (firm_id = public.my_firm_id())
      WITH CHECK (firm_id = public.my_firm_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'communication_channel_results_firm') THEN
    CREATE POLICY communication_channel_results_firm ON public.communication_channel_results
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.communication_jobs j
          WHERE j.id = job_id AND j.firm_id = public.my_firm_id()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.communication_jobs j
          WHERE j.id = job_id AND j.firm_id = public.my_firm_id()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_email_accounts_firm') THEN
    CREATE POLICY tenant_email_accounts_firm ON public.tenant_email_accounts
      FOR ALL USING (firm_id = public.my_firm_id())
      WITH CHECK (firm_id = public.my_firm_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'email_template_library_read') THEN
    CREATE POLICY email_template_library_read ON public.email_template_library
      FOR SELECT USING (is_system = true OR firm_id IS NULL OR firm_id = public.my_firm_id());
    CREATE POLICY email_template_library_tenant_write ON public.email_template_library
      FOR ALL USING (firm_id = public.my_firm_id())
      WITH CHECK (firm_id = public.my_firm_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'whatsapp_connections_firm') THEN
    CREATE POLICY whatsapp_connections_firm ON public.whatsapp_connections
      FOR ALL USING (firm_id = public.my_firm_id())
      WITH CHECK (firm_id = public.my_firm_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'whatsapp_templates_firm') THEN
    CREATE POLICY whatsapp_templates_firm ON public.whatsapp_message_templates
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.whatsapp_connections c
          WHERE c.id = connection_id AND c.firm_id = public.my_firm_id()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.whatsapp_connections c
          WHERE c.id = connection_id AND c.firm_id = public.my_firm_id()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notification_preferences_firm') THEN
    CREATE POLICY notification_preferences_firm ON public.notification_preferences
      FOR ALL USING (firm_id = public.my_firm_id())
      WITH CHECK (firm_id = public.my_firm_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'scheduled_reports_firm') THEN
    CREATE POLICY scheduled_reports_firm ON public.scheduled_report_deliveries
      FOR ALL USING (firm_id = public.my_firm_id())
      WITH CHECK (firm_id = public.my_firm_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'comm_webhooks_firm') THEN
    CREATE POLICY comm_webhooks_firm ON public.communication_webhook_events
      FOR SELECT USING (firm_id IS NULL OR firm_id = public.my_firm_id());
    CREATE POLICY comm_webhooks_insert ON public.communication_webhook_events
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;
