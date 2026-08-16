-- 20260815150000_platform_owner_razorpay_billing.sql
-- AVS Platform Owner commercial billing via Razorpay: invoices, orders, payment
-- links, subscriptions, canonical payments, refunds, settlements, cash
-- collection, and webhook idempotency.
--
-- Reused rather than duplicated:
--   * public.organizations           -- firm/tenant identity (firm_id FK target)
--   * public.platform_plans          -- stands in for "plan_version" (no
--                                        separate plan_versions table exists yet)
--   * public.platform_credentials    -- existing platform-scoped secret store
--                                        (key/provider/secret_encrypted/metadata);
--                                        Razorpay key_id/key_secret/webhook_secret
--                                        go here as provider = 'razorpay' rows.
--                                        comm_provider_secrets was NOT reused
--                                        because it is branch-scoped (communication
--                                        providers per branch); Razorpay creds are
--                                        platform-global.
--   * public.audit_log               -- existing hash-chained audit ledger; a
--                                        shared helper (audit_log_append) below
--                                        appends to it instead of a parallel table.
--   * public.my_firm_id() / public.is_saas_admin() / public.has_role() -- existing
--                                        RLS helpers, signatures confirmed live.
--   * public.set_updated_at()        -- existing generic updated_at trigger fn.
--   * public.tenant_credit_wallets / credit_ledger / grant_tenant_credits /
--     deduct_tenant_credits          -- existing AI-credit wallet system; credit
--                                        top-ups purchased here just create a
--                                        platform_invoices/platform_payments row
--                                        with item_type='credit_topup' and, on
--                                        capture, the webhook handler calls the
--                                        existing grant_tenant_credits() RPC. No
--                                        parallel credit ledger is created here.
--
-- Money is always integer paise (bigint). No floats. Every tenant-scoped table
-- carries firm_id; the only platform-global tables are payment_configuration,
-- settlements/settlement_transactions, and webhook_events.

-- ============================================================================
-- 0. Shared audit helper -- appends to the EXISTING audit_log hash chain.
--    A pure SQL trigger cannot reproduce the device-local HMAC signature the
--    client computes, so server-side rows are tagged device_id='server-trigger'
--    with signature = hash (self-referential). The app's verifyAuditChain()
--    already scopes signature verification to the writing device's own rows,
--    so this does not break client-side verification; it still participates
--    in the shared hash chain for cross-device tamper-evidence, per the
--    invariant documented on audit_log itself.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.audit_log_append(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_before jsonb,
  p_after jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prev_hash text;
  v_hash text;
BEGIN
  SELECT hash INTO v_prev_hash FROM public.audit_log ORDER BY seq DESC LIMIT 1;
  v_prev_hash := COALESCE(v_prev_hash, 'genesis');
  v_hash := encode(
    digest(v_prev_hash || '|' || p_action || '|' || p_entity_type || '|' ||
           COALESCE(p_entity_id, '') || '|' || COALESCE(p_after::text, '') || '|' || clock_timestamp()::text,
           'sha256'),
    'hex'
  );
  INSERT INTO public.audit_log (
    id, actor_id, actor_email, action, entity_type, entity_id,
    before_json, after_json, device_id, prev_hash, hash, signature
  ) VALUES (
    gen_random_uuid()::text, auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    p_action, p_entity_type, p_entity_id,
    p_before::text, p_after::text,
    'server-trigger', v_prev_hash, v_hash, v_hash
  );
END;
$$;
REVOKE ALL ON FUNCTION public.audit_log_append(text, text, text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_log_append(text, text, text, jsonb, jsonb) TO authenticated, service_role;

-- Generic row-audit trigger: logs INSERT (create) and UPDATE (change) as
-- before/after JSON. One function, reused across every billing table instead
-- of a bespoke trigger per table.
CREATE OR REPLACE FUNCTION public.audit_billing_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.audit_log_append(TG_TABLE_NAME || '.create', TG_TABLE_NAME, NEW.id::text, NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.audit_log_append(TG_TABLE_NAME || '.change', TG_TABLE_NAME, NEW.id::text, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_billing_row() FROM PUBLIC;

-- ============================================================================
-- 1. payment_configuration -- platform-global singleton, Platform Owner editable
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payment_configuration (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  environment text NOT NULL DEFAULT 'test' CHECK (environment IN ('test', 'live')),
  currency text NOT NULL DEFAULT 'INR',
  default_collection_policy jsonb NOT NULL DEFAULT '{"cash_allowed_locations": ["Ichalkaranji", "Kolhapur"]}'::jsonb,
  enabled_methods jsonb NOT NULL DEFAULT '["card", "upi", "netbanking", "wallet"]'::jsonb,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.payment_configuration (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.payment_configuration ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_configuration_read_all ON public.payment_configuration;
CREATE POLICY payment_configuration_read_all ON public.payment_configuration
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS payment_configuration_admin_write ON public.payment_configuration;
CREATE POLICY payment_configuration_admin_write ON public.payment_configuration
  FOR ALL TO authenticated USING (public.is_saas_admin()) WITH CHECK (public.is_saas_admin());

DROP TRIGGER IF EXISTS payment_configuration_updated_at ON public.payment_configuration;
CREATE TRIGGER payment_configuration_updated_at BEFORE UPDATE ON public.payment_configuration
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 2. platform_invoices + platform_invoice_items
-- ============================================================================
-- Shared item_type vocabulary used by both the invoice (primary/summary type,
-- for quick filtering) and each invoice line (authoritative per-line type).
CREATE OR REPLACE FUNCTION public.is_valid_platform_item_type(p_type text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT p_type IN (
    'licence', 'amc', 'plan_renewal', 'plan_upgrade', 'addon', 'branch_addon',
    'user_pack', 'capability_licence', 'device_upgrade', 'storage_addon',
    'setup', 'migration', 'training', 'support', 'custom_integration',
    'credit_topup', 'whatsapp_topup', 'wallet_topup'
  );
$$;

CREATE TABLE IF NOT EXISTS public.platform_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no text NOT NULL UNIQUE,
  firm_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  billing_name text NOT NULL,
  billing_gstin text,
  billing_pan text,
  billing_address text,
  invoice_date date NOT NULL DEFAULT current_date,
  due_date date,
  item_type text CHECK (item_type IS NULL OR public.is_valid_platform_item_type(item_type)),
  subtotal_paise bigint NOT NULL DEFAULT 0 CHECK (subtotal_paise >= 0),
  tax_paise bigint NOT NULL DEFAULT 0 CHECK (tax_paise >= 0),
  total_paise bigint NOT NULL DEFAULT 0 CHECK (total_paise >= 0),
  paid_paise bigint NOT NULL DEFAULT 0 CHECK (paid_paise >= 0),
  balance_paise bigint GENERATED ALWAYS AS (total_paise - paid_paise) STORED,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  terms text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_invoices_firm ON public.platform_invoices(firm_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_invoices_status ON public.platform_invoices(status);

CREATE TABLE IF NOT EXISTS public.platform_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.platform_invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  item_type text NOT NULL CHECK (public.is_valid_platform_item_type(item_type)),
  quantity numeric(12, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_paise bigint NOT NULL CHECK (unit_price_paise >= 0),
  tax_rate_pct numeric(5, 2) NOT NULL DEFAULT 0 CHECK (tax_rate_pct >= 0),
  amount_paise bigint NOT NULL CHECK (amount_paise >= 0),
  -- No hardcoded prices: metadata always names the plan version / addon /
  -- rate card the amount was sourced from (e.g. {"plan_id": "...", "rate_card_code": "..."}).
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_invoice_items_invoice ON public.platform_invoice_items(invoice_id);

-- Rollup trigger: invoice items are the source of truth for subtotal/tax/total,
-- so the parent invoice's money columns are always derived, never hand-edited.
CREATE OR REPLACE FUNCTION public.platform_invoice_items_rollup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice_id uuid := COALESCE(NEW.invoice_id, OLD.invoice_id);
  v_subtotal bigint;
  v_tax bigint;
BEGIN
  SELECT
    COALESCE(SUM(ROUND(quantity * unit_price_paise)), 0),
    COALESCE(SUM(ROUND(quantity * unit_price_paise * tax_rate_pct / 100.0)), 0)
  INTO v_subtotal, v_tax
  FROM public.platform_invoice_items
  WHERE invoice_id = v_invoice_id;

  UPDATE public.platform_invoices
  SET subtotal_paise = v_subtotal,
      tax_paise = v_tax,
      total_paise = v_subtotal + v_tax,
      updated_at = now()
  WHERE id = v_invoice_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS platform_invoice_items_rollup_trg ON public.platform_invoice_items;
CREATE TRIGGER platform_invoice_items_rollup_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.platform_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.platform_invoice_items_rollup();

DROP TRIGGER IF EXISTS platform_invoices_updated_at ON public.platform_invoices;
CREATE TRIGGER platform_invoices_updated_at BEFORE UPDATE ON public.platform_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS platform_invoices_audit ON public.platform_invoices;
CREATE TRIGGER platform_invoices_audit AFTER INSERT OR UPDATE ON public.platform_invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_billing_row();

ALTER TABLE public.platform_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_invoices_tenant_select ON public.platform_invoices;
CREATE POLICY platform_invoices_tenant_select ON public.platform_invoices
  FOR SELECT TO authenticated USING (firm_id = public.my_firm_id() OR public.is_saas_admin());
DROP POLICY IF EXISTS platform_invoices_admin_write ON public.platform_invoices;
CREATE POLICY platform_invoices_admin_write ON public.platform_invoices
  FOR ALL TO authenticated USING (public.is_saas_admin()) WITH CHECK (public.is_saas_admin());

DROP POLICY IF EXISTS platform_invoice_items_tenant_select ON public.platform_invoice_items;
CREATE POLICY platform_invoice_items_tenant_select ON public.platform_invoice_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.platform_invoices i WHERE i.id = invoice_id AND (i.firm_id = public.my_firm_id() OR public.is_saas_admin()))
  );
DROP POLICY IF EXISTS platform_invoice_items_admin_write ON public.platform_invoice_items;
CREATE POLICY platform_invoice_items_admin_write ON public.platform_invoice_items
  FOR ALL TO authenticated USING (public.is_saas_admin()) WITH CHECK (public.is_saas_admin());

-- ============================================================================
-- 3. razorpay_orders
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.razorpay_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform_invoice_id uuid REFERENCES public.platform_invoices(id) ON DELETE SET NULL,
  razorpay_order_id text NOT NULL UNIQUE,
  amount_paise bigint NOT NULL CHECK (amount_paise >= 0),
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'attempted', 'paid')),
  receipt text,
  notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_razorpay_orders_firm ON public.razorpay_orders(firm_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_razorpay_orders_invoice ON public.razorpay_orders(platform_invoice_id);

ALTER TABLE public.razorpay_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS razorpay_orders_tenant_select ON public.razorpay_orders;
CREATE POLICY razorpay_orders_tenant_select ON public.razorpay_orders
  FOR SELECT TO authenticated USING (firm_id = public.my_firm_id() OR public.is_saas_admin());
DROP POLICY IF EXISTS razorpay_orders_admin_write ON public.razorpay_orders;
CREATE POLICY razorpay_orders_admin_write ON public.razorpay_orders
  FOR ALL TO authenticated USING (public.is_saas_admin()) WITH CHECK (public.is_saas_admin());

-- ============================================================================
-- 4. payment_links
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_payment_link_id text NOT NULL UNIQUE,
  platform_invoice_id uuid REFERENCES public.platform_invoices(id) ON DELETE SET NULL,
  firm_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  amount_paise bigint NOT NULL CHECK (amount_paise >= 0),
  currency text NOT NULL DEFAULT 'INR',
  expiry timestamptz,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'cancelled', 'expired')),
  short_url text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_links_firm ON public.payment_links(firm_id, created_at DESC);

ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_links_tenant_select ON public.payment_links;
CREATE POLICY payment_links_tenant_select ON public.payment_links
  FOR SELECT TO authenticated USING (firm_id = public.my_firm_id() OR public.is_saas_admin());
DROP POLICY IF EXISTS payment_links_admin_write ON public.payment_links;
CREATE POLICY payment_links_admin_write ON public.payment_links
  FOR ALL TO authenticated USING (public.is_saas_admin()) WITH CHECK (public.is_saas_admin());

-- ============================================================================
-- 5. subscriptions (Razorpay recurring mandate, per firm)
--    plan_id references platform_plans -- the closest existing analog to a
--    "plan_version" (no separate plan_versions table exists yet).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_subscription_id text UNIQUE,
  firm_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.platform_plans(id),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'PAYMENT_PENDING', 'ACTIVE', 'GRACE', 'PAYMENT_FAILED',
    'EXPIRED', 'SUSPENDED', 'CANCELLED'
  )),
  recurring_enabled boolean NOT NULL DEFAULT false,
  mandate_ref text,
  consent_at timestamptz,
  consent_by uuid REFERENCES auth.users(id),
  enabled_by_platform_owner boolean NOT NULL DEFAULT false,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_firm ON public.subscriptions(firm_id, status);

DROP TRIGGER IF EXISTS subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS subscriptions_audit ON public.subscriptions;
CREATE TRIGGER subscriptions_audit AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.audit_billing_row();

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscriptions_tenant_select ON public.subscriptions;
CREATE POLICY subscriptions_tenant_select ON public.subscriptions
  FOR SELECT TO authenticated USING (firm_id = public.my_firm_id() OR public.is_saas_admin());
DROP POLICY IF EXISTS subscriptions_admin_write ON public.subscriptions;
CREATE POLICY subscriptions_admin_write ON public.subscriptions
  FOR ALL TO authenticated USING (public.is_saas_admin()) WITH CHECK (public.is_saas_admin());

-- ============================================================================
-- 6. settlements + settlement_transactions (platform-global; bank settlement
--    batches span multiple firms' payments, so these are NOT firm_id-scoped).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_settlement_id text NOT NULL UNIQUE,
  amount_paise bigint NOT NULL CHECK (amount_paise >= 0),
  fees_paise bigint NOT NULL DEFAULT 0 CHECK (fees_paise >= 0),
  tax_paise bigint NOT NULL DEFAULT 0 CHECK (tax_paise >= 0),
  status text,
  settled_at timestamptz,
  utr text,
  bank_account_ref_masked text,
  -- Reconciliation state lives directly on the settlement (per-settlement,
  -- not a separate table -- keeps the join-free common case simple).
  reconciliation_status text NOT NULL DEFAULT 'UNRECONCILED' CHECK (reconciliation_status IN (
    'UNRECONCILED', 'MATCHED', 'PARTIAL', 'EXCEPTION', 'RECONCILED'
  )),
  reconciled_by uuid REFERENCES auth.users(id),
  reconciled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settlement_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES public.settlements(id) ON DELETE CASCADE,
  platform_payment_id uuid NOT NULL, -- FK added after platform_payments below
  amount_paise bigint NOT NULL CHECK (amount_paise >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (settlement_id, platform_payment_id)
);

DROP TRIGGER IF EXISTS settlements_audit ON public.settlements;
CREATE TRIGGER settlements_audit AFTER INSERT OR UPDATE ON public.settlements
  FOR EACH ROW EXECUTE FUNCTION public.audit_billing_row();

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS settlements_admin_only ON public.settlements;
CREATE POLICY settlements_admin_only ON public.settlements
  FOR ALL TO authenticated USING (public.is_saas_admin()) WITH CHECK (public.is_saas_admin());
DROP POLICY IF EXISTS settlement_transactions_admin_only ON public.settlement_transactions;
CREATE POLICY settlement_transactions_admin_only ON public.settlement_transactions
  FOR ALL TO authenticated USING (public.is_saas_admin()) WITH CHECK (public.is_saas_admin());

-- ============================================================================
-- 7. platform_payments -- canonical payment record
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.platform_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform_invoice_id uuid REFERENCES public.platform_invoices(id) ON DELETE SET NULL,
  razorpay_order_id text REFERENCES public.razorpay_orders(razorpay_order_id),
  razorpay_payment_id text UNIQUE,
  razorpay_signature text,
  payment_link_id uuid REFERENCES public.payment_links(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount_paise bigint NOT NULL CHECK (amount_paise >= 0),
  currency text NOT NULL DEFAULT 'INR',
  method text,
  status text NOT NULL DEFAULT 'CREATED' CHECK (status IN (
    'CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'CANCELLED',
    'PARTIALLY_REFUNDED', 'REFUNDED', 'DISPUTED', 'REVERSED'
  )),
  captured_amount_paise bigint NOT NULL DEFAULT 0 CHECK (captured_amount_paise >= 0),
  fee_paise bigint,
  tax_on_fee_paise bigint,
  settlement_id uuid REFERENCES public.settlements(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  authorized_at timestamptz,
  captured_at timestamptz,
  failed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_platform_payments_firm ON public.platform_payments(firm_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_payments_invoice ON public.platform_payments(platform_invoice_id);
CREATE INDEX IF NOT EXISTS idx_platform_payments_status ON public.platform_payments(status);
CREATE INDEX IF NOT EXISTS idx_platform_payments_settlement ON public.platform_payments(settlement_id);

ALTER TABLE public.settlement_transactions
  ADD CONSTRAINT settlement_transactions_platform_payment_fk
  FOREIGN KEY (platform_payment_id) REFERENCES public.platform_payments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_settlement_transactions_settlement ON public.settlement_transactions(settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlement_transactions_payment ON public.settlement_transactions(platform_payment_id);

DROP TRIGGER IF EXISTS platform_payments_audit ON public.platform_payments;
CREATE TRIGGER platform_payments_audit AFTER INSERT OR UPDATE ON public.platform_payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_billing_row();

ALTER TABLE public.platform_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_payments_tenant_select ON public.platform_payments;
CREATE POLICY platform_payments_tenant_select ON public.platform_payments
  FOR SELECT TO authenticated USING (firm_id = public.my_firm_id() OR public.is_saas_admin());
-- Tenants NEVER write payment status directly -- captures/failures land here
-- only via the Razorpay webhook edge function using the service role (which
-- bypasses RLS entirely). This ALL policy covers platform-admin manual
-- overrides/reconciliation only.
DROP POLICY IF EXISTS platform_payments_admin_write ON public.platform_payments;
CREATE POLICY platform_payments_admin_write ON public.platform_payments
  FOR ALL TO authenticated USING (public.is_saas_admin()) WITH CHECK (public.is_saas_admin());

-- ============================================================================
-- 8. payment_attempts -- append-only operational log (checkout/order/webhook)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform_invoice_id uuid REFERENCES public.platform_invoices(id) ON DELETE SET NULL,
  attempt_type text NOT NULL CHECK (attempt_type IN ('order_create', 'checkout_open', 'webhook', 'payment_link', 'subscription_charge')),
  razorpay_order_id text,
  razorpay_payment_id text,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  error_code text,
  error_description text,
  request_payload jsonb,
  response_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_firm ON public.payment_attempts(firm_id, created_at DESC);

ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_attempts_tenant_select ON public.payment_attempts;
CREATE POLICY payment_attempts_tenant_select ON public.payment_attempts
  FOR SELECT TO authenticated USING (firm_id = public.my_firm_id() OR public.is_saas_admin());
DROP POLICY IF EXISTS payment_attempts_admin_write ON public.payment_attempts;
CREATE POLICY payment_attempts_admin_write ON public.payment_attempts
  FOR ALL TO authenticated USING (public.is_saas_admin()) WITH CHECK (public.is_saas_admin());

-- ============================================================================
-- 9. refunds
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.platform_payments(id) ON DELETE CASCADE,
  razorpay_refund_id text UNIQUE,
  amount_paise bigint NOT NULL CHECK (amount_paise >= 0),
  reason text,
  status text NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'processed', 'failed')),
  approved_by uuid REFERENCES auth.users(id),
  requested_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refunds_firm ON public.refunds(firm_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refunds_payment ON public.refunds(payment_id);

DROP TRIGGER IF EXISTS refunds_audit ON public.refunds;
CREATE TRIGGER refunds_audit AFTER INSERT OR UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.audit_billing_row();

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS refunds_tenant_select ON public.refunds;
CREATE POLICY refunds_tenant_select ON public.refunds
  FOR SELECT TO authenticated USING (firm_id = public.my_firm_id() OR public.is_saas_admin());
DROP POLICY IF EXISTS refunds_admin_write ON public.refunds;
CREATE POLICY refunds_admin_write ON public.refunds
  FOR ALL TO authenticated USING (public.is_saas_admin()) WITH CHECK (public.is_saas_admin());

-- ============================================================================
-- 10. cash_collections -- manual cash payments, location-gated
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cash_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform_invoice_id uuid REFERENCES public.platform_invoices(id) ON DELETE SET NULL,
  amount_paise bigint NOT NULL CHECK (amount_paise >= 0),
  collection_location text,
  override_reason text,
  override_by uuid REFERENCES auth.users(id),
  override_at timestamptz,
  collector text,
  collected_at timestamptz NOT NULL DEFAULT now(),
  receipt_no text,
  notes text,
  proof_attachment_url text,
  confirmed_by uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cash_collections_location_or_override CHECK (
    collection_location IN ('Ichalkaranji', 'Kolhapur')
    OR (override_reason IS NOT NULL AND override_by IS NOT NULL AND override_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_cash_collections_firm ON public.cash_collections(firm_id, collected_at DESC);

DROP TRIGGER IF EXISTS cash_collections_audit ON public.cash_collections;
CREATE TRIGGER cash_collections_audit AFTER INSERT OR UPDATE ON public.cash_collections
  FOR EACH ROW EXECUTE FUNCTION public.audit_billing_row();

ALTER TABLE public.cash_collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cash_collections_tenant_select ON public.cash_collections;
CREATE POLICY cash_collections_tenant_select ON public.cash_collections
  FOR SELECT TO authenticated USING (firm_id = public.my_firm_id() OR public.is_saas_admin());
-- Firm-side billing staff may record a collection for their own firm; only
-- Platform Owner (is_saas_admin) or those same firm-billing roles can confirm
-- it. Status transition to 'confirmed'/'rejected' is left to the app/RPC
-- layer to gate by role beyond firm match; RLS here enforces the tenant
-- boundary and that outside-location collections always carry an override.
DROP POLICY IF EXISTS cash_collections_tenant_insert ON public.cash_collections;
CREATE POLICY cash_collections_tenant_insert ON public.cash_collections
  FOR INSERT TO authenticated WITH CHECK (
    public.is_saas_admin()
    OR (firm_id = public.my_firm_id() AND (
      public.has_role(auth.uid(), 'owner'::public.app_role)
      OR public.has_role(auth.uid(), 'ceo'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'billing'::public.app_role)
      OR public.has_role(auth.uid(), 'accountant'::public.app_role)
    ))
  );
DROP POLICY IF EXISTS cash_collections_admin_update ON public.cash_collections;
CREATE POLICY cash_collections_admin_update ON public.cash_collections
  FOR UPDATE TO authenticated
  USING (public.is_saas_admin())
  WITH CHECK (public.is_saas_admin());

-- ============================================================================
-- 11. webhook_events -- idempotency guard for Razorpay webhook delivery
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  error text,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON public.webhook_events(event_type, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed ON public.webhook_events(processed) WHERE NOT processed;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- Platform-global, admin-read-only from the client; the actual INSERT/UPDATE
-- traffic is the webhook edge function on the service role, which bypasses
-- RLS entirely -- this is intentionally the only client-facing policy.
DROP POLICY IF EXISTS webhook_events_admin_only ON public.webhook_events;
CREATE POLICY webhook_events_admin_only ON public.webhook_events
  FOR ALL TO authenticated USING (public.is_saas_admin()) WITH CHECK (public.is_saas_admin());

-- ============================================================================
-- 12. Seed Razorpay credential slots in the existing platform_credentials
--     table (secret_encrypted populated later via an edge function in the
--     save-provider-secret style, not in this migration).
-- ============================================================================
-- platform_credentials.key is globally UNIQUE (not scoped per-provider), so
-- keys are namespaced with the provider prefix to avoid colliding with any
-- other provider's credential slots.
INSERT INTO public.platform_credentials (key, provider, metadata)
VALUES
  ('razorpay_key_id', 'razorpay', '{"environment": "test"}'::jsonb),
  ('razorpay_key_secret', 'razorpay', '{"environment": "test"}'::jsonb),
  ('razorpay_webhook_secret', 'razorpay', '{"environment": "test"}'::jsonb)
ON CONFLICT (key) DO NOTHING;
