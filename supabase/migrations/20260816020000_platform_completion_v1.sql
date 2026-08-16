-- 20260816020000_platform_completion_v1.sql
-- AMC renewal sweep, refund RPC, lead stage config, platform receipt email template

INSERT INTO public.platform_settings (key, value)
VALUES (
  'commercial.lead_stages',
  '["new_trial","contact_pending","contacted","demo","proposal","negotiation","won","lost"]'::jsonb
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.platform_settings (key, value)
VALUES (
  'licensing.amc_renewal_warning_days',
  '30'::jsonb
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.communication_event_catalog (event_key, display_name, default_channels, whatsapp_allowed, is_schedulable, credit_category)
VALUES ('platform.payment.receipt', 'Platform Payment Receipt', '["email"]', true, false, null)
ON CONFLICT (event_key) DO NOTHING;

-- Platform payment receipt email template
INSERT INTO public.email_template_library (
  id, product_id, event_key, template_key, name, subject_template, html_template, text_template, is_system, is_published
)
VALUES (
  'platform_payment_receipt',
  'ORNEXA',
  'payment.received',
  'platform_payment_receipt',
  'Platform Payment Receipt',
  'Payment received — {{invoice_no}} ({{amount_display}})',
  '<p>Dear {{firm_name}},</p><p>We received <strong>{{amount_display}}</strong> for invoice <strong>{{invoice_no}}</strong>.</p><p>Receipt: <strong>{{receipt_no}}</strong></p><p>— Ornexa Platform</p>',
  'Payment received: {{amount_display}} for {{invoice_no}}. Receipt {{receipt_no}}.',
  true,
  true
)
ON CONFLICT (id) DO UPDATE SET
  subject_template = EXCLUDED.subject_template,
  html_template = EXCLUDED.html_template,
  text_template = EXCLUDED.text_template,
  is_published = true;

-- Refund recording RPC (Razorpay refund webhook can call later)
CREATE OR REPLACE FUNCTION public.record_platform_refund(
  p_payment_id uuid,
  p_amount_paise bigint,
  p_razorpay_refund_id text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment record;
  v_refund_id uuid;
BEGIN
  IF NOT public.is_saas_admin() THEN
    RAISE EXCEPTION 'Only Platform Owner can record refunds' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_payment FROM public.platform_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_not_found');
  END IF;

  INSERT INTO public.refunds (
    firm_id, payment_id, razorpay_refund_id, amount_paise, status, reason
  )
  VALUES (
    v_payment.firm_id, p_payment_id, p_razorpay_refund_id, p_amount_paise, 'processed',
    p_reason
  )
  ON CONFLICT (razorpay_refund_id) DO NOTHING
  RETURNING id INTO v_refund_id;

  UPDATE public.platform_payments
  SET status = CASE WHEN p_amount_paise >= amount_paise THEN 'refunded' ELSE 'partially_refunded' END,
      metadata = metadata || jsonb_build_object('last_refund_id', v_refund_id),
      updated_at = now()
  WHERE id = p_payment_id;

  PERFORM public.audit_log_append(
    'platform_payment.refund', 'platform_payments', p_payment_id::text, NULL,
    jsonb_build_object('amount_paise', p_amount_paise, 'refund_id', v_refund_id)
  );

  RETURN jsonb_build_object('ok', true, 'refund_id', v_refund_id);
END;
$$;

REVOKE ALL ON FUNCTION public.record_platform_refund(uuid, bigint, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_platform_refund(uuid, bigint, text, text) TO authenticated, service_role;

-- AMC / subscription renewal reminder sweep
CREATE OR REPLACE FUNCTION public.sweep_amc_renewals()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_warning_days int;
  v_queued int := 0;
  v_rec record;
BEGIN
  SELECT COALESCE((value #>> '{}')::int, 30) INTO v_warning_days
  FROM public.platform_settings WHERE key = 'licensing.amc_renewal_warning_days';

  FOR v_rec IN
    SELECT os.organization_id AS firm_id, os.renews_at, o.name AS firm_name
    FROM public.organization_subscriptions os
    JOIN public.organizations o ON o.id = os.organization_id
    WHERE os.status = 'active'
      AND os.renews_at IS NOT NULL
      AND os.renews_at > now()
      AND os.renews_at < now() + make_interval(days => v_warning_days)
  LOOP
    INSERT INTO public.communication_jobs (
      firm_id, product_id, event_key, channels_requested, status, recipient, payload, reference_type
    )
    SELECT
      v_rec.firm_id, 'ORNEXA', 'subscription.amc_reminder', ARRAY['email'], 'pending',
      jsonb_build_object('name', v_rec.firm_name),
      jsonb_build_object('renews_at', v_rec.renews_at, 'firm_name', v_rec.firm_name),
      'amc_renewal'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.communication_jobs
      WHERE firm_id = v_rec.firm_id
        AND event_key = 'subscription.amc_reminder'
        AND created_at > now() - interval '7 days'
    );
    IF FOUND THEN v_queued := v_queued + 1; END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'queued', v_queued);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sweep_amc_renewals() TO service_role;

-- Commercial lead follow-up tasks table
CREATE TABLE IF NOT EXISTS public.platform_lead_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.platform_commercial_leads(id) ON DELETE CASCADE,
  task_type text NOT NULL DEFAULT 'follow_up',
  due_at timestamptz NOT NULL,
  assigned_to uuid,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','skipped','cancelled')),
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_platform_lead_tasks_due ON public.platform_lead_tasks (due_at) WHERE status = 'open';

ALTER TABLE public.platform_lead_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_lead_tasks_admin ON public.platform_lead_tasks;
CREATE POLICY platform_lead_tasks_admin ON public.platform_lead_tasks
  FOR ALL TO authenticated
  USING (public.is_saas_admin())
  WITH CHECK (public.is_saas_admin());
