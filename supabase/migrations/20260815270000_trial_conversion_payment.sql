-- Trial conversion on payment + lifecycle sweep helpers

CREATE OR REPLACE FUNCTION public.convert_trial_to_paid(
  p_organization_id uuid,
  p_plan_id uuid DEFAULT NULL,
  p_reason text DEFAULT 'Razorpay payment captured'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
BEGIN
  IF p_plan_id IS NOT NULL THEN
    v_plan_id := p_plan_id;
  ELSE
    SELECT plan_id INTO v_plan_id FROM public.organization_subscriptions WHERE organization_id = p_organization_id;
  END IF;

  UPDATE public.organization_subscriptions
  SET
    status = 'active',
    trial_lifecycle_status = 'CONVERTED',
    starts_at = COALESCE(starts_at, now()),
    renews_at = now() + interval '1 year',
    updated_at = now()
  WHERE organization_id = p_organization_id;

  IF v_plan_id IS NOT NULL THEN
    PERFORM public.apply_plan_entitlements(p_organization_id, v_plan_id, p_reason);
  END IF;

  UPDATE public.platform_commercial_leads
  SET lead_stage = 'won', updated_at = now()
  WHERE organization_id = p_organization_id AND lead_stage NOT IN ('won', 'lost');
END;
$$;

-- Extend payment capture to convert trial
CREATE OR REPLACE FUNCTION public.process_razorpay_payment_captured(
  p_razorpay_event_id text,
  p_event_type text,
  p_payload jsonb,
  p_razorpay_payment_id text,
  p_razorpay_order_id text,
  p_amount_paise bigint,
  p_firm_id uuid,
  p_platform_invoice_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid;
  v_payment_id uuid;
  v_invoice_id uuid;
  v_plan_id uuid;
BEGIN
  SELECT id INTO v_existing FROM public.webhook_events WHERE razorpay_event_id = p_razorpay_event_id;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  INSERT INTO public.webhook_events (razorpay_event_id, event_type, payload, processed)
  VALUES (p_razorpay_event_id, p_event_type, p_payload, false);

  SELECT id INTO v_payment_id FROM public.platform_payments WHERE razorpay_payment_id = p_razorpay_payment_id;
  IF v_payment_id IS NOT NULL THEN
    UPDATE public.webhook_events SET processed = true, processed_at = now() WHERE razorpay_event_id = p_razorpay_event_id;
    RETURN jsonb_build_object('ok', true, 'duplicate_payment', true);
  END IF;

  INSERT INTO public.platform_payments (
    firm_id, platform_invoice_id, razorpay_payment_id, razorpay_order_id,
    amount_paise, currency, status, captured_at, metadata
  )
  VALUES (
    p_firm_id, p_platform_invoice_id, p_razorpay_payment_id, p_razorpay_order_id,
    p_amount_paise, 'INR', 'CAPTURED', now(),
    jsonb_build_object('event_id', p_razorpay_event_id)
  )
  RETURNING id INTO v_payment_id;

  IF p_platform_invoice_id IS NOT NULL THEN
    UPDATE public.platform_invoices
    SET paid_paise = LEAST(total_paise, paid_paise + p_amount_paise),
        status = CASE WHEN paid_paise + p_amount_paise >= total_paise THEN 'paid' ELSE 'partially_paid' END,
        updated_at = now()
    WHERE id = p_platform_invoice_id
    RETURNING id INTO v_invoice_id;

    SELECT (metadata->>'plan_id')::uuid INTO v_plan_id
    FROM public.platform_invoice_items
    WHERE invoice_id = p_platform_invoice_id AND item_type = 'licence'
    LIMIT 1;

    IF v_plan_id IS NOT NULL THEN
      PERFORM public.convert_trial_to_paid(p_firm_id, v_plan_id, 'Licence payment via Razorpay');
    ELSE
      PERFORM public.convert_trial_to_paid(p_firm_id, NULL, 'Payment via Razorpay');
    END IF;
  END IF;

  IF p_platform_invoice_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.platform_invoice_items
    WHERE invoice_id = p_platform_invoice_id
      AND item_type IN ('credit_topup', 'whatsapp_topup', 'wallet_topup')
  ) THEN
    PERFORM public.grant_tenant_credits(
      (SELECT COALESCE(SUM((metadata->>'credits')::numeric), 0)
       FROM public.platform_invoice_items WHERE invoice_id = p_platform_invoice_id),
      'purchase',
      'Credit top-up via Razorpay',
      jsonb_build_object('razorpay_payment_id', p_razorpay_payment_id),
      p_firm_id
    );
  END IF;

  UPDATE public.webhook_events SET processed = true, processed_at = now() WHERE razorpay_event_id = p_razorpay_event_id;

  RETURN jsonb_build_object('ok', true, 'payment_id', v_payment_id, 'invoice_id', v_invoice_id);
END;
$$;

-- Trial lifecycle sweep (call from scheduler/cron)
CREATE OR REPLACE FUNCTION public.sweep_trial_lifecycle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired int := 0;
  v_expiring int := 0;
  v_follow_up int := 0;
  v_warning_days int;
  v_day2 int;
BEGIN
  SELECT COALESCE((value #>> '{}')::int, 3) INTO v_warning_days
  FROM public.platform_settings WHERE key = 'licensing.trial_expiry_warning_days';
  SELECT COALESCE((value #>> '{}')::int, 2) INTO v_day2
  FROM public.platform_settings WHERE key = 'licensing.trial_follow_up_day_2';

  UPDATE public.organization_subscriptions
  SET trial_lifecycle_status = 'TRIAL_EXPIRED', status = 'expired', updated_at = now()
  WHERE status = 'trial' AND trial_ends_at < now() AND trial_lifecycle_status NOT IN ('CONVERTED', 'TRIAL_EXPIRED');
  GET DIAGNOSTICS v_expired = ROW_COUNT;

  UPDATE public.organization_subscriptions
  SET trial_lifecycle_status = 'TRIAL_EXPIRING', updated_at = now()
  WHERE status = 'trial'
    AND trial_ends_at > now()
    AND trial_ends_at < now() + make_interval(days => v_warning_days)
    AND trial_lifecycle_status = 'TRIAL_ACTIVE';
  GET DIAGNOSTICS v_expiring = ROW_COUNT;

  UPDATE public.platform_commercial_leads
  SET follow_up_due_at = now(), lead_stage = 'contact_pending', updated_at = now()
  WHERE lead_stage = 'new_trial'
    AND trial_started_at < now() - make_interval(days => v_day2)
    AND follow_up_due_at IS NULL;
  GET DIAGNOSTICS v_follow_up = ROW_COUNT;

  PERFORM public.evaluate_trial_expiry();

  RETURN jsonb_build_object('expired', v_expired, 'expiring', v_expiring, 'follow_ups', v_follow_up);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sweep_trial_lifecycle() TO service_role;
