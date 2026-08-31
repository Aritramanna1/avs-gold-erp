-- Platform Payment Engine v1 — fulfillment allocation, cash policy, receipts
-- Chain: Invoice → Razorpay/Cash → Payment → Allocation → Entitlements/Credits → Receipt

-- ============================================================================
-- 1. Fulfillment idempotency ledger (prevents duplicate credits/renewals)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.platform_invoice_fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_payment_id uuid NOT NULL REFERENCES public.platform_payments(id) ON DELETE CASCADE,
  platform_invoice_id uuid NOT NULL REFERENCES public.platform_invoices(id) ON DELETE CASCADE,
  invoice_item_id uuid REFERENCES public.platform_invoice_items(id) ON DELETE SET NULL,
  fulfillment_type text NOT NULL,
  amount_paise bigint NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  fulfilled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform_payment_id, invoice_item_id, fulfillment_type)
);
CREATE INDEX IF NOT EXISTS idx_platform_invoice_fulfillments_invoice
  ON public.platform_invoice_fulfillments(platform_invoice_id);

ALTER TABLE public.platform_invoice_fulfillments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_invoice_fulfillments_tenant ON public.platform_invoice_fulfillments;
CREATE POLICY platform_invoice_fulfillments_tenant ON public.platform_invoice_fulfillments
  FOR SELECT TO authenticated
  USING (
    public.is_saas_admin()
    OR platform_invoice_id IN (
      SELECT id FROM public.platform_invoices WHERE firm_id = public.my_firm_id()
    )
  );

-- ============================================================================
-- 2. Payment receipts (generated after successful allocation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.platform_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_no text NOT NULL UNIQUE,
  firm_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  platform_invoice_id uuid REFERENCES public.platform_invoices(id) ON DELETE SET NULL,
  platform_payment_id uuid REFERENCES public.platform_payments(id) ON DELETE SET NULL,
  cash_collection_id uuid REFERENCES public.cash_collections(id) ON DELETE SET NULL,
  amount_paise bigint NOT NULL CHECK (amount_paise >= 0),
  payment_method text NOT NULL CHECK (payment_method IN ('razorpay', 'cash', 'bank_transfer', 'adjustment')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_receipts_firm ON public.platform_receipts(firm_id, issued_at DESC);

ALTER TABLE public.platform_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_receipts_tenant ON public.platform_receipts;
CREATE POLICY platform_receipts_tenant ON public.platform_receipts
  FOR SELECT TO authenticated
  USING (public.is_saas_admin() OR firm_id = public.my_firm_id());

-- ============================================================================
-- 3. Fix trial conversion — persist purchased plan_id
-- ============================================================================
CREATE OR REPLACE FUNCTION public.convert_trial_to_paid(
  p_organization_id uuid,
  p_plan_id uuid DEFAULT NULL,
  p_reason text DEFAULT 'Payment captured'
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
    plan_id = COALESCE(v_plan_id, plan_id),
    trial_lifecycle_status = 'CONVERTED',
    starts_at = COALESCE(starts_at, now()),
    renews_at = COALESCE(renews_at, now() + interval '1 year'),
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

-- ============================================================================
-- 4. Cash geography policy helper (configurable — not hardcoded in app code)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_cash_collection_location_allowed(
  p_location text,
  p_override_reason text DEFAULT NULL,
  p_override_by uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy jsonb;
  v_locations jsonb;
  v_norm text;
BEGIN
  IF p_override_reason IS NOT NULL AND length(trim(p_override_reason)) > 0
     AND p_override_by IS NOT NULL AND public.is_saas_admin() THEN
    RETURN true;
  END IF;

  SELECT default_collection_policy INTO v_policy FROM public.payment_configuration WHERE id = 1;
  v_locations := COALESCE(v_policy->'cash_allowed_locations', '[]'::jsonb);
  v_norm := lower(trim(p_location));

  RETURN EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(v_locations) loc
    WHERE lower(trim(loc)) = v_norm
  );
END;
$$;

-- ============================================================================
-- 5. Create commercial invoice from rate-card / plan metadata (no hardcoded prices)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_platform_commercial_invoice(
  p_firm_id uuid,
  p_billing_name text,
  p_lines jsonb,
  p_billing_gstin text DEFAULT NULL,
  p_billing_address text DEFAULT NULL,
  p_due_days int DEFAULT 15,
  p_terms text DEFAULT NULL,
  p_primary_item_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_invoice_no text;
  v_line jsonb;
  v_item_type text;
  v_qty numeric;
  v_unit bigint;
  v_tax numeric;
  v_amount bigint;
  v_desc text;
  v_meta jsonb;
BEGIN
  IF NOT public.is_saas_admin() AND p_firm_id IS DISTINCT FROM public.my_firm_id() THEN
    RAISE EXCEPTION 'Unauthorized firm' USING ERRCODE = '42501';
  END IF;

  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one invoice line required';
  END IF;

  v_invoice_no := 'AVS-' || to_char(now(), 'YYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  INSERT INTO public.platform_invoices (
    invoice_no, firm_id, billing_name, billing_gstin, billing_address,
    due_date, item_type, status, terms, created_by
  )
  VALUES (
    v_invoice_no, p_firm_id, p_billing_name, p_billing_gstin, p_billing_address,
    current_date + COALESCE(p_due_days, 15),
    p_primary_item_type, 'sent', p_terms, auth.uid()
  )
  RETURNING id INTO v_invoice_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_item_type := v_line->>'item_type';
    IF NOT public.is_valid_platform_item_type(v_item_type) THEN
      RAISE EXCEPTION 'Invalid item_type: %', v_item_type;
    END IF;
    v_qty := COALESCE((v_line->>'quantity')::numeric, 1);
    v_unit := COALESCE((v_line->>'unit_price_paise')::bigint, 0);
    v_tax := COALESCE((v_line->>'tax_rate_pct')::numeric, 0);
    v_amount := round(v_qty * v_unit * (1 + v_tax / 100.0))::bigint;
    v_desc := COALESCE(v_line->>'description', v_item_type);
    v_meta := COALESCE(v_line->'metadata', '{}'::jsonb);

    INSERT INTO public.platform_invoice_items (
      invoice_id, description, item_type, quantity, unit_price_paise, tax_rate_pct, amount_paise, metadata
    )
    VALUES (v_invoice_id, v_desc, v_item_type, v_qty, v_unit, v_tax, v_amount, v_meta);
  END LOOP;

  PERFORM public.audit_log_append(
    'platform_invoice.create', 'platform_invoices', v_invoice_id::text, NULL,
    jsonb_build_object('firm_id', p_firm_id, 'invoice_no', v_invoice_no)
  );

  RETURN jsonb_build_object('ok', true, 'invoice_id', v_invoice_id, 'invoice_no', v_invoice_no);
END;
$$;

REVOKE ALL ON FUNCTION public.create_platform_commercial_invoice(uuid, text, jsonb, text, text, int, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_platform_commercial_invoice(uuid, text, jsonb, text, text, int, text, text) TO authenticated, service_role;

-- ============================================================================
-- 6. Invoice payment allocation — idempotent fulfillment per line type
-- ============================================================================
CREATE OR REPLACE FUNCTION public.allocate_platform_invoice_payment(
  p_payment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment record;
  v_item record;
  v_credits numeric;
  v_plan_id uuid;
  v_receipt_no text;
  v_fulfillment_count int := 0;
  v_amc_months int;
BEGIN
  SELECT * INTO v_payment FROM public.platform_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_not_found');
  END IF;
  IF v_payment.platform_invoice_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'no_invoice');
  END IF;

  FOR v_item IN
    SELECT * FROM public.platform_invoice_items WHERE invoice_id = v_payment.platform_invoice_id
  LOOP
  IF EXISTS (
    SELECT 1 FROM public.platform_invoice_fulfillments
    WHERE platform_payment_id = p_payment_id AND invoice_item_id = v_item.id AND fulfillment_type = v_item.item_type
  ) THEN
    CONTINUE;
  END IF;

  CASE v_item.item_type
    WHEN 'licence', 'plan_upgrade' THEN
      v_plan_id := (v_item.metadata->>'plan_id')::uuid;
      IF v_plan_id IS NOT NULL THEN
        PERFORM public.convert_trial_to_paid(v_payment.firm_id, v_plan_id, 'Invoice ' || v_item.item_type);
      END IF;
    WHEN 'plan_renewal', 'amc' THEN
      v_amc_months := COALESCE((v_item.metadata->>'months')::int, 12);
      UPDATE public.organization_subscriptions
      SET renews_at = COALESCE(renews_at, now()) + make_interval(months => v_amc_months),
          status = 'active',
          updated_at = now()
      WHERE organization_id = v_payment.firm_id;
    WHEN 'credit_topup', 'wallet_topup' THEN
      v_credits := COALESCE((v_item.metadata->>'credits')::numeric, 0);
      IF v_credits > 0 THEN
        PERFORM public.grant_tenant_credits(
          v_credits, 'purchase', 'Credit top-up — invoice line',
          jsonb_build_object('payment_id', p_payment_id, 'invoice_item_id', v_item.id),
          v_payment.firm_id
        );
      END IF;
    WHEN 'whatsapp_topup' THEN
      v_credits := COALESCE((v_item.metadata->>'credits')::numeric, (v_item.metadata->>'whatsapp_credits')::numeric, 0);
      IF v_credits > 0 THEN
        PERFORM public.grant_tenant_credits(
          v_credits, 'purchase', 'WhatsApp credit top-up',
          jsonb_build_object('payment_id', p_payment_id, 'service', 'whatsapp'),
          v_payment.firm_id
        );
      END IF;
    ELSE
      NULL; -- addon, branch_addon, etc. — audited via fulfillment row; PO applies entitlements manually or via future hooks
  END CASE;

  INSERT INTO public.platform_invoice_fulfillments (
    platform_payment_id, platform_invoice_id, invoice_item_id, fulfillment_type, amount_paise, metadata
  )
  VALUES (
    p_payment_id, v_payment.platform_invoice_id, v_item.id, v_item.item_type, v_item.amount_paise, v_item.metadata
  );
  v_fulfillment_count := v_fulfillment_count + 1;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM public.platform_receipts WHERE platform_payment_id = p_payment_id) THEN
    v_receipt_no := 'RCP-' || to_char(now(), 'YYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    INSERT INTO public.platform_receipts (
      receipt_no, firm_id, platform_invoice_id, platform_payment_id, cash_collection_id,
      amount_paise, payment_method, metadata
    )
    VALUES (
      v_receipt_no, v_payment.firm_id, v_payment.platform_invoice_id, p_payment_id,
      NULLIF(v_payment.metadata->>'cash_collection_id', '')::uuid,
      v_payment.amount_paise, COALESCE(v_payment.method, 'razorpay'),
      jsonb_build_object(
        'razorpay_payment_id', v_payment.razorpay_payment_id,
        'cash_collection_id', v_payment.metadata->>'cash_collection_id'
      )
    );
  END IF;

  PERFORM public.audit_log_append(
    'platform_payment.allocated', 'platform_payments', p_payment_id::text, NULL,
    jsonb_build_object('fulfillments', v_fulfillment_count)
  );

  RETURN jsonb_build_object('ok', true, 'fulfillments', v_fulfillment_count);
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_platform_invoice_payment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_platform_invoice_payment(uuid) TO service_role;

-- ============================================================================
-- 7. Cash collection — propose + confirm with geography policy
-- ============================================================================
CREATE OR REPLACE FUNCTION public.propose_cash_collection(
  p_firm_id uuid,
  p_platform_invoice_id uuid,
  p_amount_paise bigint,
  p_collection_location text,
  p_collector text,
  p_receipt_no text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_proof_attachment_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_invoice record;
BEGIN
  IF NOT public.is_saas_admin() THEN
    RAISE EXCEPTION 'Only Platform Owner can record cash collections' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_invoice FROM public.platform_invoices WHERE id = p_platform_invoice_id AND firm_id = p_firm_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found for firm';
  END IF;

  IF p_amount_paise <= 0 OR p_amount_paise > v_invoice.balance_paise THEN
    RAISE EXCEPTION 'Invalid collection amount';
  END IF;

  INSERT INTO public.cash_collections (
    firm_id, platform_invoice_id, amount_paise, collection_location,
    collector, receipt_no, notes, proof_attachment_url, status
  )
  VALUES (
    p_firm_id, p_platform_invoice_id, p_amount_paise, trim(p_collection_location),
    trim(p_collector), p_receipt_no, p_notes, p_proof_attachment_url, 'pending'
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'cash_collection_id', v_id, 'requires_override',
    NOT public.is_cash_collection_location_allowed(p_collection_location, NULL, NULL));
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_cash_collection(
  p_cash_collection_id uuid,
  p_override_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cash record;
  v_payment_id uuid;
  v_receipt_no text;
  v_allowed boolean;
BEGIN
  IF NOT public.is_saas_admin() THEN
    RAISE EXCEPTION 'Only Platform Owner can confirm cash' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_cash FROM public.cash_collections WHERE id = p_cash_collection_id FOR UPDATE;
  IF NOT FOUND OR v_cash.status <> 'pending' THEN
    RAISE EXCEPTION 'Cash collection not pending';
  END IF;

  v_allowed := public.is_cash_collection_location_allowed(
    v_cash.collection_location, p_override_reason, auth.uid()
  );
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Cash not allowed outside approved geography. Record override with reason.';
  END IF;

  IF p_override_reason IS NOT NULL AND length(trim(p_override_reason)) > 0 THEN
    UPDATE public.cash_collections
    SET override_reason = p_override_reason, override_by = auth.uid(), override_at = now()
    WHERE id = p_cash_collection_id;
    PERFORM public.audit_log_append(
      'cash_collection.override', 'cash_collections', p_cash_collection_id::text, NULL,
      jsonb_build_object('reason', p_override_reason, 'location', v_cash.collection_location)
    );
  END IF;

  INSERT INTO public.platform_payments (
    firm_id, platform_invoice_id, amount_paise, currency, status, captured_at, method, metadata
  )
  VALUES (
    v_cash.firm_id, v_cash.platform_invoice_id, v_cash.amount_paise, 'INR', 'CAPTURED', now(), 'cash',
    jsonb_build_object('cash_collection_id', v_cash.id, 'collector', v_cash.collector, 'location', v_cash.collection_location)
  )
  RETURNING id INTO v_payment_id;

  UPDATE public.platform_invoices
  SET paid_paise = LEAST(total_paise, paid_paise + v_cash.amount_paise),
      status = CASE WHEN paid_paise + v_cash.amount_paise >= total_paise THEN 'paid' ELSE 'partially_paid' END,
      updated_at = now()
  WHERE id = v_cash.platform_invoice_id;

  UPDATE public.cash_collections
  SET status = 'confirmed', confirmed_by = auth.uid(), collected_at = COALESCE(collected_at, now())
  WHERE id = p_cash_collection_id;

  PERFORM public.allocate_platform_invoice_payment(v_payment_id);

  PERFORM public.audit_log_append(
    'cash_collection.confirmed', 'cash_collections', p_cash_collection_id::text, NULL,
    jsonb_build_object('payment_id', v_payment_id, 'amount_paise', v_cash.amount_paise)
  );

  RETURN jsonb_build_object('ok', true, 'payment_id', v_payment_id);
END;
$$;

REVOKE ALL ON FUNCTION public.propose_cash_collection(uuid, uuid, bigint, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_cash_collection(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.propose_cash_collection(uuid, uuid, bigint, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_cash_collection(uuid, text) TO authenticated;

-- ============================================================================
-- 8. Enhanced Razorpay capture — delegates to allocation engine
-- ============================================================================
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
  v_alloc jsonb;
BEGIN
  SELECT id INTO v_existing FROM public.webhook_events WHERE razorpay_event_id = p_razorpay_event_id;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  INSERT INTO public.webhook_events (razorpay_event_id, event_type, payload, processed)
  VALUES (p_razorpay_event_id, p_event_type, p_payload, false);

  SELECT id INTO v_payment_id FROM public.platform_payments WHERE razorpay_payment_id = p_razorpay_payment_id;
  IF v_payment_id IS NULL THEN
    INSERT INTO public.platform_payments (
      firm_id, platform_invoice_id, razorpay_payment_id, razorpay_order_id,
      amount_paise, currency, status, captured_at, method, metadata
    )
    VALUES (
      p_firm_id, p_platform_invoice_id, p_razorpay_payment_id, p_razorpay_order_id,
      p_amount_paise, 'INR', 'CAPTURED', now(), 'razorpay',
      jsonb_build_object('event_id', p_razorpay_event_id)
    )
    RETURNING id INTO v_payment_id;
  END IF;

  IF p_platform_invoice_id IS NOT NULL THEN
    UPDATE public.platform_invoices
    SET paid_paise = LEAST(total_paise, paid_paise + p_amount_paise),
        status = CASE WHEN paid_paise + p_amount_paise >= total_paise THEN 'paid' ELSE 'partially_paid' END,
        updated_at = now()
    WHERE id = p_platform_invoice_id;

    UPDATE public.razorpay_orders SET status = 'paid' WHERE razorpay_order_id = p_razorpay_order_id;
  END IF;

  v_alloc := public.allocate_platform_invoice_payment(v_payment_id);

  UPDATE public.webhook_events SET processed = true, processed_at = now() WHERE razorpay_event_id = p_razorpay_event_id;

  RETURN jsonb_build_object('ok', true, 'payment_id', v_payment_id, 'allocation', v_alloc);
END;
$$;

-- Credit top-up helper: resolve amount from rate card
CREATE OR REPLACE FUNCTION public.create_credit_topup_invoice(
  p_firm_id uuid,
  p_credits numeric,
  p_wallet_type text DEFAULT 'ai'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org record;
  v_rate bigint;
  v_item_type text;
  v_desc text;
BEGIN
  IF p_firm_id IS DISTINCT FROM public.my_firm_id() AND NOT public.is_saas_admin() THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT name INTO v_org FROM public.organizations WHERE id = p_firm_id;

  SELECT COALESCE((value #>> '{}')::bigint, 100)
  INTO v_rate
  FROM public.platform_settings
  WHERE key = 'billing.credit_unit_price_paise';
  IF v_rate IS NULL OR v_rate <= 0 THEN
    v_rate := 100; -- fallback only when platform setting unset; PO should configure rate card
  END IF;

  v_item_type := CASE WHEN p_wallet_type = 'whatsapp' THEN 'whatsapp_topup' ELSE 'credit_topup' END;
  v_desc := CASE WHEN p_wallet_type = 'whatsapp'
    THEN format('WhatsApp credits top-up — %s units', p_credits)
    ELSE format('AI / Ornexa credits top-up — %s units', p_credits)
  END;

  RETURN public.create_platform_commercial_invoice(
    p_firm_id,
    COALESCE(v_org.name, 'Tenant'),
    jsonb_build_array(jsonb_build_object(
      'item_type', v_item_type,
      'description', v_desc,
      'quantity', p_credits,
      'unit_price_paise', v_rate,
      'tax_rate_pct', 18,
      'metadata', jsonb_build_object('credits', p_credits, 'wallet_type', p_wallet_type, 'rate_card_paise', v_rate)
    )),
    NULL, NULL, 7, NULL, v_item_type
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_credit_topup_invoice(uuid, numeric, text) TO authenticated, service_role;
