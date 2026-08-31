-- Platform Owner (saas_admin) read access for communication platform tables

DO $$
BEGIN
  -- communication_jobs
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'communication_jobs_firm') THEN
    DROP POLICY communication_jobs_firm ON public.communication_jobs;
    CREATE POLICY communication_jobs_firm ON public.communication_jobs
      FOR ALL
      USING (firm_id = public.my_firm_id() OR public.is_saas_admin())
      WITH CHECK (firm_id = public.my_firm_id() OR public.is_saas_admin());
  END IF;

  -- communication_channel_results
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'communication_channel_results_firm') THEN
    DROP POLICY communication_channel_results_firm ON public.communication_channel_results;
    CREATE POLICY communication_channel_results_firm ON public.communication_channel_results
      FOR ALL
      USING (
        public.is_saas_admin()
        OR EXISTS (
          SELECT 1 FROM public.communication_jobs j
          WHERE j.id = job_id AND j.firm_id = public.my_firm_id()
        )
      )
      WITH CHECK (
        public.is_saas_admin()
        OR EXISTS (
          SELECT 1 FROM public.communication_jobs j
          WHERE j.id = job_id AND j.firm_id = public.my_firm_id()
        )
      );
  END IF;

  -- tenant_email_accounts
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_email_accounts_firm') THEN
    DROP POLICY tenant_email_accounts_firm ON public.tenant_email_accounts;
    CREATE POLICY tenant_email_accounts_firm ON public.tenant_email_accounts
      FOR ALL
      USING (firm_id = public.my_firm_id() OR public.is_saas_admin())
      WITH CHECK (firm_id = public.my_firm_id() OR public.is_saas_admin());
  END IF;

  -- whatsapp_connections
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'whatsapp_connections_firm') THEN
    DROP POLICY whatsapp_connections_firm ON public.whatsapp_connections;
    CREATE POLICY whatsapp_connections_firm ON public.whatsapp_connections
      FOR ALL
      USING (firm_id = public.my_firm_id() OR public.is_saas_admin())
      WITH CHECK (firm_id = public.my_firm_id() OR public.is_saas_admin());
  END IF;

  -- whatsapp_message_templates
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'whatsapp_templates_firm') THEN
    DROP POLICY whatsapp_templates_firm ON public.whatsapp_message_templates;
    CREATE POLICY whatsapp_templates_firm ON public.whatsapp_message_templates
      FOR ALL
      USING (
        public.is_saas_admin()
        OR EXISTS (
          SELECT 1 FROM public.whatsapp_connections c
          WHERE c.id = connection_id AND c.firm_id = public.my_firm_id()
        )
      )
      WITH CHECK (
        public.is_saas_admin()
        OR EXISTS (
          SELECT 1 FROM public.whatsapp_connections c
          WHERE c.id = connection_id AND c.firm_id = public.my_firm_id()
        )
      );
  END IF;

  -- notification_preferences
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notification_preferences_firm') THEN
    DROP POLICY notification_preferences_firm ON public.notification_preferences;
    CREATE POLICY notification_preferences_firm ON public.notification_preferences
      FOR ALL
      USING (firm_id = public.my_firm_id() OR public.is_saas_admin())
      WITH CHECK (firm_id = public.my_firm_id() OR public.is_saas_admin());
  END IF;

  -- scheduled_report_deliveries
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'scheduled_reports_firm') THEN
    DROP POLICY scheduled_reports_firm ON public.scheduled_report_deliveries;
    CREATE POLICY scheduled_reports_firm ON public.scheduled_report_deliveries
      FOR ALL
      USING (firm_id = public.my_firm_id() OR public.is_saas_admin())
      WITH CHECK (firm_id = public.my_firm_id() OR public.is_saas_admin());
  END IF;

  -- communication_webhook_events
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'comm_webhooks_firm') THEN
    DROP POLICY comm_webhooks_firm ON public.communication_webhook_events;
    CREATE POLICY comm_webhooks_firm ON public.communication_webhook_events
      FOR SELECT
      USING (firm_id IS NULL OR firm_id = public.my_firm_id() OR public.is_saas_admin());
  END IF;
END $$;
