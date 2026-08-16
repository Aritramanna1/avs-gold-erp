-- Portal tenant isolation + WhatsApp billing modes + versioned rate cards + billing ledger
-- Invariant: A portal identity belongs to one authorized tenant context and one or more
-- explicitly linked Party relationships. No portal request may escape that authorization boundary.

BEGIN;

-- ---------------------------------------------------------------------------
-- PART 1: Portal identity model
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.portal_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  firm_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  portal_type TEXT NOT NULL CHECK (portal_type IN ('customer', 'karigar', 'supplier', 'external')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'suspended', 'revoked')),
  branch_id TEXT,
  user_profile_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  invitation_id UUID REFERENCES public.invitations(id) ON DELETE SET NULL,
  invited_by UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_portal_identity_user_firm_type UNIQUE (auth_user_id, firm_id, portal_type)
);

CREATE INDEX IF NOT EXISTS idx_portal_identities_auth ON public.portal_identities (auth_user_id, status);
CREATE INDEX IF NOT EXISTS idx_portal_identities_firm ON public.portal_identities (firm_id, portal_type, status);

CREATE TABLE IF NOT EXISTS public.portal_party_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_identity_id UUID NOT NULL REFERENCES public.portal_identities(id) ON DELETE CASCADE,
  firm_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  party_id TEXT NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  link_role TEXT NOT NULL DEFAULT 'primary'
    CHECK (link_role IN ('primary', 'secondary', 'viewer')),
  allowed_branch_ids TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_portal_party_link UNIQUE (portal_identity_id, party_id)
);

CREATE INDEX IF NOT EXISTS idx_portal_party_links_party ON public.portal_party_links (firm_id, party_id)
  WHERE is_active = true;

-- Backfill portal identities from existing user_profiles links
INSERT INTO public.portal_identities (auth_user_id, firm_id, portal_type, status, branch_id, user_profile_id, metadata)
SELECT
  up.auth_id,
  up.firm_id,
  CASE
    WHEN lower(coalesce(up.role, '')) IN ('supplier', 'vendor') THEN 'supplier'
    WHEN lower(coalesce(up.role, '')) IN ('karigar', 'worker') THEN 'karigar'
    ELSE 'customer'
  END,
  CASE WHEN up.active AND up.status = 'active' THEN 'active' ELSE 'suspended' END,
  up.branch_id,
  up.id,
  jsonb_build_object('backfilled_from', 'user_profiles', 'legacy_role', up.role)
FROM public.user_profiles up
WHERE up.auth_id IS NOT NULL
  AND up.firm_id IS NOT NULL
  AND up.customer_person_id IS NOT NULL
  AND lower(coalesce(up.role, '')) IN (
    'customer', 'viewer', 'customer portal', 'customer_portal',
    'supplier', 'vendor', 'karigar', 'worker'
  )
ON CONFLICT (auth_user_id, firm_id, portal_type) DO NOTHING;

INSERT INTO public.portal_party_links (portal_identity_id, firm_id, party_id, link_role, is_active)
SELECT
  pi.id,
  pi.firm_id,
  up.customer_person_id,
  'primary',
  true
FROM public.portal_identities pi
JOIN public.user_profiles up
  ON up.id = pi.user_profile_id
WHERE up.customer_person_id IS NOT NULL
ON CONFLICT (portal_identity_id, party_id) DO NOTHING;

-- Resolve active portal context for authenticated caller (server-side only)
CREATE OR REPLACE FUNCTION public.get_my_portal_context(p_portal_type TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_identity public.portal_identities;
  v_parties JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_identity
  FROM public.portal_identities pi
  WHERE pi.auth_user_id = auth.uid()
    AND pi.status = 'active'
    AND (p_portal_type IS NULL OR pi.portal_type = lower(p_portal_type))
  ORDER BY pi.updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'party_id', ppl.party_id,
    'link_role', ppl.link_role,
    'allowed_branch_ids', ppl.allowed_branch_ids
  ) ORDER BY CASE WHEN ppl.link_role = 'primary' THEN 0 ELSE 1 END), '[]'::jsonb)
  INTO v_parties
  FROM public.portal_party_links ppl
  WHERE ppl.portal_identity_id = v_identity.id
    AND ppl.is_active = true;

  RETURN jsonb_build_object(
    'identity_id', v_identity.id,
    'firm_id', v_identity.firm_id,
    'portal_type', v_identity.portal_type,
    'branch_id', v_identity.branch_id,
    'party_links', v_parties
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_portal_party_in_scope(p_party_id TEXT, p_portal_type TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_ctx JSONB;
  v_firm UUID;
  v_party TEXT;
BEGIN
  v_ctx := public.get_my_portal_context(p_portal_type);
  IF v_ctx IS NULL THEN
    RAISE EXCEPTION 'portal access is not configured' USING ERRCODE = '42501';
  END IF;

  v_firm := (v_ctx->>'firm_id')::uuid;

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_ctx->'party_links') elem
    WHERE elem->>'party_id' = p_party_id
  ) THEN
    RAISE EXCEPTION 'party is outside portal authorization boundary' USING ERRCODE = '42501';
  END IF;

  SELECT p.id INTO v_party
  FROM public.people p
  WHERE p.id = p_party_id
    AND p.firm_id = v_firm
    AND p.active;

  IF v_party IS NULL THEN
    RAISE EXCEPTION 'party was not found in tenant scope' USING ERRCODE = '42501';
  END IF;

  RETURN v_firm;
END;
$$;

CREATE OR REPLACE FUNCTION public.my_portal_primary_party_id(p_portal_type TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT elem->>'party_id'
  FROM public.get_my_portal_context(p_portal_type) ctx,
       LATERAL jsonb_array_elements(ctx->'party_links') elem
  WHERE ctx IS NOT NULL
  ORDER BY CASE WHEN elem->>'link_role' = 'primary' THEN 0 ELSE 1 END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.my_customer_person_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(
    public.my_portal_primary_party_id('customer'),
    (
      SELECT up.customer_person_id
      FROM public.user_profiles up
      WHERE up.auth_id = auth.uid()
        AND up.active
        AND up.status = 'active'
        AND up.customer_person_id IS NOT NULL
        AND (
          lower(coalesce(up.role, '')) = 'customer'
          OR lower(coalesce(up.role, '')) IN ('viewer', 'customer portal', 'customer_portal')
        )
      LIMIT 1
    )
  );
$$;

-- Communication scope guard: recipient party + document must belong to same tenant
CREATE OR REPLACE FUNCTION public.assert_communication_scope(
  p_firm_id UUID,
  p_party_id TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_effective_firm UUID;
BEGIN
  IF p_firm_id IS NULL THEN
    RAISE EXCEPTION 'firm context required' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_saas_admin() AND p_firm_id <> public.my_firm_id() THEN
    RAISE EXCEPTION 'cross-tenant communication is forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_party_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.people p
      WHERE p.id = p_party_id AND p.firm_id = p_firm_id AND p.active
    ) THEN
      RAISE EXCEPTION 'recipient party is outside tenant scope' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_reference_type IS NOT NULL AND p_reference_id IS NOT NULL THEN
    CASE lower(p_reference_type)
      WHEN 'invoice' THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.invoices i
          WHERE i.id = p_reference_id AND i.firm_id = p_firm_id
            AND (p_party_id IS NULL OR i.customer_id = p_party_id)
        ) THEN
          RAISE EXCEPTION 'document is outside tenant/party scope' USING ERRCODE = '42501';
        END IF;
      WHEN 'order' THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id = p_reference_id AND o.firm_id = p_firm_id
            AND (p_party_id IS NULL OR o.customer_id = p_party_id)
        ) THEN
          RAISE EXCEPTION 'document is outside tenant/party scope' USING ERRCODE = '42501';
        END IF;
      WHEN 'repair' THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.repairs r
          WHERE r.id = p_reference_id AND r.firm_id = p_firm_id
            AND (p_party_id IS NULL OR r.customer_id = p_party_id)
        ) THEN
          RAISE EXCEPTION 'document is outside tenant/party scope' USING ERRCODE = '42501';
        END IF;
      WHEN 'supplier_purchase' THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.supplier_purchases sp
          WHERE sp.id = p_reference_id AND sp.firm_id = p_firm_id
            AND (p_party_id IS NULL OR sp.supplier_id = p_party_id)
        ) THEN
          RAISE EXCEPTION 'document is outside tenant/party scope' USING ERRCODE = '42501';
        END IF;
      ELSE
        NULL;
    END CASE;
  END IF;

  RETURN true;
END;
$$;

-- ---------------------------------------------------------------------------
-- PART 2: WhatsApp connection billing modes
-- ---------------------------------------------------------------------------

ALTER TABLE public.whatsapp_connections
  ADD COLUMN IF NOT EXISTS billing_responsibility TEXT NOT NULL DEFAULT 'AVS'
    CHECK (billing_responsibility IN ('AVS', 'CLIENT')),
  ADD COLUMN IF NOT EXISTS provider_adapter TEXT DEFAULT 'whatsapp_cloud_api',
  ADD COLUMN IF NOT EXISTS provider_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS provider_secret_ref UUID REFERENCES public.comm_provider_secrets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metered_credits_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS setup_fee_paise BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_management_fee_paise BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.whatsapp_connections.connection_mode IS
  'off=Mode A disabled; managed_partner=Mode B AVS managed; client_owned=Mode C client Meta; custom_connector=Mode D BSP/custom';
COMMENT ON COLUMN public.whatsapp_connections.billing_responsibility IS
  'AVS when AVS pays Meta/provider and may deduct credits; CLIENT when tenant owns billing';

UPDATE public.whatsapp_connections
SET billing_responsibility = CASE
  WHEN connection_mode IN ('client_owned', 'custom_connector') THEN 'CLIENT'
  WHEN connection_mode = 'off' THEN 'AVS'
  ELSE 'AVS'
END,
metered_credits_enabled = CASE
  WHEN connection_mode IN ('client_owned', 'custom_connector') THEN false
  WHEN connection_mode = 'off' THEN false
  ELSE true
END
WHERE billing_responsibility IS DISTINCT FROM CASE
  WHEN connection_mode IN ('client_owned', 'custom_connector') THEN 'CLIENT'
  ELSE 'AVS'
END;

-- ---------------------------------------------------------------------------
-- PART 3: Versioned communication rate cards (Meta pricing + AVS markup)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.communication_rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_card_version TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'meta_whatsapp_cloud',
  pricing_source TEXT NOT NULL DEFAULT 'meta_public',
  country_code TEXT NOT NULL DEFAULT 'IN',
  market TEXT,
  message_category TEXT NOT NULL
    CHECK (message_category IN ('utility', 'marketing', 'authentication', 'service')),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  meta_unit_cost NUMERIC(14, 6) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  avs_markup_type TEXT NOT NULL DEFAULT 'PERCENTAGE'
    CHECK (avs_markup_type IN ('NONE', 'PERCENTAGE', 'FIXED')),
  markup_value NUMERIC(14, 6) NOT NULL DEFAULT 0,
  credits_per_unit NUMERIC(14, 6) NOT NULL,
  plan_code TEXT,
  firm_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_comm_rate_card_version_scope
  ON public.communication_rate_cards (
    rate_card_version,
    provider,
    country_code,
    message_category,
    COALESCE(plan_code, ''),
    COALESCE(firm_id::text, '')
  );

CREATE INDEX IF NOT EXISTS idx_comm_rate_cards_lookup
  ON public.communication_rate_cards (provider, country_code, message_category, effective_from DESC)
  WHERE is_active = true;

INSERT INTO public.communication_rate_cards (
  rate_card_version, provider, pricing_source, country_code, market, message_category,
  effective_from, meta_unit_cost, currency, avs_markup_type, markup_value, credits_per_unit, metadata
) VALUES
  ('2026-08-15', 'meta_whatsapp_cloud', 'meta_public', 'IN', 'India', 'utility', '2026-08-01', 0.115000, 'INR', 'PERCENTAGE', 30.0, 1.5000, '{"note":"Pre Oct-2026 utility baseline"}'),
  ('2026-08-15', 'meta_whatsapp_cloud', 'meta_public', 'IN', 'India', 'marketing', '2026-08-01', 0.784600, 'INR', 'PERCENTAGE', 30.0, 3.0000, '{}'),
  ('2026-08-15', 'meta_whatsapp_cloud', 'meta_public', 'IN', 'India', 'authentication', '2026-08-01', 0.115000, 'INR', 'PERCENTAGE', 30.0, 1.5000, '{}'),
  ('2026-08-15', 'meta_whatsapp_cloud', 'meta_public', 'IN', 'India', 'service', '2026-10-01', 0.290000, 'INR', 'PERCENTAGE', 30.0, 0.5000, '{"note":"Meta Oct-2026 service-message pricing placeholder"}')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- PART 4: WhatsApp billing ledger (provider-cost aware, idempotent)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.whatsapp_billing_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES public.avs_products(id),
  connection_id UUID REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL,
  waba_id TEXT,
  provider TEXT NOT NULL DEFAULT 'meta_whatsapp_cloud',
  message_id TEXT NOT NULL,
  message_category TEXT,
  destination_market TEXT,
  provider_cost NUMERIC(14, 6),
  avs_margin NUMERIC(14, 6),
  total_charged NUMERIC(14, 6),
  credit_conversion NUMERIC(14, 6),
  rate_card_version TEXT,
  rate_card_id UUID REFERENCES public.communication_rate_cards(id) ON DELETE SET NULL,
  credit_ledger_id UUID REFERENCES public.credit_ledger(id) ON DELETE SET NULL,
  billing_responsibility TEXT NOT NULL DEFAULT 'AVS'
    CHECK (billing_responsibility IN ('AVS', 'CLIENT')),
  status TEXT NOT NULL DEFAULT 'recorded'
    CHECK (status IN ('recorded', 'deducted', 'skipped', 'failed', 'refunded')),
  reference_event TEXT NOT NULL DEFAULT 'delivered',
  webhook_event_id UUID REFERENCES public.communication_webhook_events(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_billing_idempotent
  ON public.whatsapp_billing_ledger (provider, message_id, reference_event);

CREATE INDEX IF NOT EXISTS idx_whatsapp_billing_firm ON public.whatsapp_billing_ledger (firm_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.resolve_communication_rate_card(
  p_provider TEXT,
  p_country_code TEXT,
  p_message_category TEXT,
  p_firm_id UUID DEFAULT NULL,
  p_plan_code TEXT DEFAULT NULL,
  p_as_of TIMESTAMPTZ DEFAULT now()
)
RETURNS public.communication_rate_cards
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_card public.communication_rate_cards;
BEGIN
  SELECT * INTO v_card
  FROM public.communication_rate_cards rc
  WHERE rc.provider = p_provider
    AND rc.country_code = p_country_code
    AND rc.message_category = p_message_category
    AND rc.is_active = true
    AND rc.effective_from <= p_as_of
    AND (rc.effective_to IS NULL OR rc.effective_to > p_as_of)
    AND (
      (p_firm_id IS NOT NULL AND rc.firm_id = p_firm_id)
      OR (p_plan_code IS NOT NULL AND rc.plan_code = p_plan_code)
      OR (rc.firm_id IS NULL AND rc.plan_code IS NULL)
    )
  ORDER BY
    CASE WHEN rc.firm_id = p_firm_id THEN 0 WHEN rc.plan_code = p_plan_code THEN 1 ELSE 2 END,
    rc.effective_from DESC
  LIMIT 1;

  RETURN v_card;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_whatsapp_billing_from_webhook(
  p_firm_id UUID,
  p_connection_id UUID,
  p_provider TEXT,
  p_message_id TEXT,
  p_message_category TEXT DEFAULT 'utility',
  p_destination_market TEXT DEFAULT 'IN',
  p_reference_event TEXT DEFAULT 'delivered',
  p_webhook_event_id UUID DEFAULT NULL,
  p_product_id TEXT DEFAULT 'ORNEXA'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_conn public.whatsapp_connections;
  v_card public.communication_rate_cards;
  v_existing UUID;
  v_billing_id UUID;
  v_credit_result JSONB;
  v_credit_ledger_id UUID;
  v_provider_cost NUMERIC(14, 6);
  v_avs_margin NUMERIC(14, 6);
  v_total NUMERIC(14, 6);
BEGIN
  IF p_firm_id IS NULL OR p_message_id IS NULL THEN
    RAISE EXCEPTION 'firm_id and message_id are required' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_existing
  FROM public.whatsapp_billing_ledger
  WHERE provider = COALESCE(p_provider, 'meta_whatsapp_cloud')
    AND message_id = p_message_id
    AND reference_event = COALESCE(p_reference_event, 'delivered');

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'billing_id', v_existing);
  END IF;

  SELECT * INTO v_conn
  FROM public.whatsapp_connections
  WHERE id = p_connection_id
     OR (p_connection_id IS NULL AND firm_id = p_firm_id AND is_enabled = true)
  ORDER BY updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    v_conn.id := NULL;
  END IF;

  SELECT * INTO v_card
  FROM public.resolve_communication_rate_card(
    COALESCE(p_provider, 'meta_whatsapp_cloud'),
    COALESCE(p_destination_market, 'IN'),
    COALESCE(p_message_category, 'utility'),
    p_firm_id,
    NULL,
    now()
  );

  v_provider_cost := COALESCE(v_card.meta_unit_cost, 0.115000);
  v_avs_margin := CASE v_card.avs_markup_type
    WHEN 'PERCENTAGE' THEN v_provider_cost * (COALESCE(v_card.markup_value, 0) / 100.0)
    WHEN 'FIXED' THEN COALESCE(v_card.markup_value, 0)
    ELSE 0
  END;
  v_total := v_provider_cost + v_avs_margin;

  INSERT INTO public.whatsapp_billing_ledger (
    firm_id, product_id, connection_id, waba_id, provider, message_id,
    message_category, destination_market, provider_cost, avs_margin, total_charged,
    credit_conversion, rate_card_version, rate_card_id, billing_responsibility,
    status, reference_event, webhook_event_id, metadata
  ) VALUES (
    p_firm_id,
    COALESCE(p_product_id, 'ORNEXA'),
    v_conn.id,
    v_conn.waba_id,
    COALESCE(p_provider, 'meta_whatsapp_cloud'),
    p_message_id,
    COALESCE(p_message_category, 'utility'),
    COALESCE(p_destination_market, 'IN'),
    v_provider_cost,
    v_avs_margin,
    v_total,
    COALESCE(v_card.credits_per_unit, 1),
    COALESCE(v_card.rate_card_version, 'legacy'),
    v_card.id,
    COALESCE(v_conn.billing_responsibility, 'AVS'),
    CASE
      WHEN v_conn.id IS NULL OR v_conn.connection_mode = 'off' THEN 'skipped'
      WHEN COALESCE(v_conn.billing_responsibility, 'AVS') = 'CLIENT' THEN 'skipped'
      WHEN COALESCE(v_conn.metered_credits_enabled, true) = false THEN 'skipped'
      ELSE 'recorded'
    END,
    COALESCE(p_reference_event, 'delivered'),
    p_webhook_event_id,
    jsonb_build_object('connection_mode', COALESCE(v_conn.connection_mode, 'off'))
  )
  RETURNING id INTO v_billing_id;

  IF v_conn.id IS NOT NULL
     AND COALESCE(v_conn.billing_responsibility, 'AVS') = 'AVS'
     AND COALESCE(v_conn.metered_credits_enabled, true) = true
     AND v_conn.connection_mode NOT IN ('off') THEN
    v_credit_result := public.deduct_tenant_credits(
      'wa_' || COALESCE(p_message_category, 'utility'),
      1,
      p_message_id,
      'WhatsApp ' || COALESCE(p_message_category, 'utility') || ' delivery',
      jsonb_build_object(
        'whatsapp_billing_id', v_billing_id,
        'rate_card_version', COALESCE(v_card.rate_card_version, 'legacy'),
        'provider_cost', v_provider_cost,
        'reference_event', p_reference_event
      ),
      p_firm_id
    );

    IF COALESCE((v_credit_result->>'success')::boolean, false) THEN
      v_credit_ledger_id := (v_credit_result->>'ledger_id')::uuid;
      UPDATE public.whatsapp_billing_ledger
      SET status = 'deducted', credit_ledger_id = v_credit_ledger_id
      WHERE id = v_billing_id;
    ELSE
      UPDATE public.whatsapp_billing_ledger
      SET status = 'failed', metadata = metadata || jsonb_build_object('credit_error', v_credit_result->>'error')
      WHERE id = v_billing_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'duplicate', false,
    'billing_id', v_billing_id,
    'credit', v_credit_result,
    'skipped', v_conn.id IS NULL OR COALESCE(v_conn.billing_responsibility, 'AVS') = 'CLIENT'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- PART 5: Portal RPC hardening (derive scope from portal_identities)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_customer_portal()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_ctx JSONB;
  v_firm UUID;
  v_person public.people;
  v_person_id TEXT;
  v_result JSONB;
  v_gold_balance NUMERIC;
  v_gold_entries JSONB;
  v_cash_ledger JSONB;
BEGIN
  v_ctx := public.get_my_portal_context('customer');
  IF v_ctx IS NULL THEN
    RAISE EXCEPTION 'customer portal access is not configured' USING ERRCODE = '42501';
  END IF;

  v_firm := (v_ctx->>'firm_id')::uuid;
  v_person_id := public.my_portal_primary_party_id('customer');

  SELECT * INTO v_person
  FROM public.people
  WHERE id = v_person_id
    AND firm_id = v_firm
    AND type IN ('customer', 'Customer')
    AND active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer profile was not found' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM((g.data->'deltas'->>'customer')::numeric), 0) INTO v_gold_balance
  FROM public.gold_ledger g
  WHERE g.firm_id = v_firm AND g.data->>'customerId' = v_person.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', g.id, 'ts', g.ts, 'type', g.data->>'type',
    'netFineMg', (g.data->>'netFineMg')::numeric,
    'grossMg', (g.data->>'grossMg')::numeric,
    'purity', (g.data->>'purity')::numeric,
    'notes', g.data->>'notes', 'reference', g.data->>'reference'
  ) ORDER BY g.ts DESC), '[]'::jsonb) INTO v_gold_entries
  FROM public.gold_ledger g
  WHERE g.firm_id = v_firm AND g.data->>'customerId' = v_person.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', cl.id, 'ts', cl.ts, 'kind', cl.kind,
    'debit_paise', cl.debit_paise, 'credit_paise', cl.credit_paise,
    'description', cl.description, 'ref', cl.ref
  ) ORDER BY cl.ts DESC), '[]'::jsonb) INTO v_cash_ledger
  FROM public.customer_ledger cl
  WHERE cl.firm_id = v_firm AND cl.customer_id = v_person.id;

  SELECT jsonb_build_object(
    'profile', jsonb_build_object(
      'id', v_person.id, 'full_name', v_person.full_name,
      'phone', v_person.phone, 'whatsapp', v_person.whatsapp,
      'email', v_person.email, 'village_city', v_person.village_city,
      'current_address', v_person.current_address
    ),
    'gold_balance_mg', v_gold_balance,
    'gold_entries', v_gold_entries,
    'cash_ledger', v_cash_ledger,
    'invoices', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'invoice_no', i.invoice_no, 'status', i.status,
        'gst', i.gst, 'subtotal_paise', i.subtotal_paise,
        'gst_paise', i.gst_paise, 'grand_total_paise', i.grand_total_paise,
        'paid_paise', i.paid_paise, 'balance_paise', i.balance_paise,
        'created_at', i.created_at
      ) ORDER BY i.created_at DESC)
      FROM public.invoices i
      WHERE i.firm_id = v_firm AND i.customer_id = v_person.id), '[]'::jsonb),
    'orders', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', o.id, 'order_no', o.order_no, 'type', o.type,
        'status', o.status, 'expected_delivery', o.expected_delivery,
        'priority', o.priority, 'created_at', o.created_at
      ) ORDER BY o.created_at DESC)
      FROM public.orders o
      WHERE o.firm_id = v_firm AND o.customer_id = v_person.id), '[]'::jsonb),
    'repairs', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'repair_no', r.repair_no, 'kind', r.kind,
        'status', r.status, 'estimated_charge_paise', r.estimated_charge_paise,
        'advance_paise', r.advance_paise, 'received_gross_mg', r.received_gross_mg,
        'created_at', r.created_at
      ) ORDER BY r.created_at DESC)
      FROM public.repairs r
      WHERE r.firm_id = v_firm AND r.customer_id = v_person.id), '[]'::jsonb),
    'support_tickets', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', t.id, 'ticket_no', t.ticket_no, 'category', t.category,
        'subject', t.subject, 'description', t.description,
        'severity', t.severity, 'priority', t.priority, 'status', t.status,
        'resolution', CASE WHEN t.status IN ('resolved', 'closed') THEN t.resolution ELSE NULL END,
        'created_at', t.created_at, 'updated_at', t.updated_at
      ) ORDER BY t.created_at DESC)
      FROM public.platform_support_tickets t
      WHERE t.firm_id = v_firm AND t.requester_id = auth.uid()), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_supplier_portal()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_ctx JSONB;
  v_firm UUID;
  v_person public.people;
  v_person_id TEXT;
  v_result JSONB;
BEGIN
  v_ctx := public.get_my_portal_context('supplier');
  IF v_ctx IS NULL THEN
    RAISE EXCEPTION 'supplier portal access is not configured' USING ERRCODE = '42501';
  END IF;

  v_firm := (v_ctx->>'firm_id')::uuid;
  v_person_id := public.my_portal_primary_party_id('supplier');

  SELECT * INTO v_person
  FROM public.people
  WHERE id = v_person_id
    AND firm_id = v_firm
    AND type IN ('vendor', 'outside_worker', 'vendor_supplier', 'supplier')
    AND active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'supplier profile was not found' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'profile', jsonb_build_object(
      'id', v_person.id, 'full_name', v_person.full_name,
      'phone', v_person.phone, 'whatsapp', v_person.whatsapp,
      'email', v_person.email, 'village_city', v_person.village_city,
      'current_address', v_person.current_address
    ),
    'purchases', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'purchase_no', p.purchase_no, 'invoice_no', p.invoice_no,
        'invoice_date', p.invoice_date, 'total_paise', p.total_paise,
        'paid_paise', p.paid_paise, 'due_paise', p.due_paise,
        'fine_mg', p.fine_mg, 'gold_paid_fine_mg', p.gold_paid_fine_mg,
        'gross_mg', p.gross_mg, 'created_at', p.created_at
      ) ORDER BY p.created_at DESC)
      FROM public.supplier_purchases p
      WHERE p.firm_id = v_firm AND p.supplier_id = v_person.id), '[]'::jsonb),
    'outside_work', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', ow.id, 'order_id', ow.order_id, 'created_at', ow.created_at, 'data', ow.data
      ) ORDER BY ow.created_at DESC)
      FROM public.outside_work_transactions ow
      WHERE ow.firm_id = v_firm AND ow.worker_id = v_person.id), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_karigar_portal()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_ctx JSONB;
  v_firm UUID;
  v_worker_id TEXT;
  v_worker_name TEXT;
  v_gold_balance JSONB;
  v_gold_entries JSONB;
  v_wages JSONB;
  v_attendance JSONB;
BEGIN
  v_ctx := public.get_my_portal_context('karigar');
  IF v_ctx IS NULL THEN
    RETURN jsonb_build_object(
      'found', false,
      'message', 'No karigar profile linked to this account. Contact your firm administrator.'
    );
  END IF;

  v_firm := (v_ctx->>'firm_id')::uuid;
  v_worker_id := public.my_portal_primary_party_id('karigar');

  SELECT p.full_name INTO v_worker_name
  FROM public.people p
  WHERE p.id = v_worker_id
    AND p.firm_id = v_firm
    AND p.active;

  IF v_worker_name IS NULL THEN
    RAISE EXCEPTION 'karigar profile was not found' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', gl.id, 'ts', gl.ts, 'type', gl.data->>'type',
    'narration', gl.data->>'narration', 'netFineMg', gl.data->'netFineMg',
    'grossMg', gl.data->'grossMg', 'purity', gl.data->'purity', 'slipNo', gl.data->>'slipNo'
  ) ORDER BY gl.ts DESC), '[]'::jsonb) INTO v_gold_entries
  FROM public.gold_ledger gl
  WHERE gl.firm_id = v_firm
    AND gl.data->>'karigarId' = v_worker_id
    AND gl.ts >= (now() - interval '90 days');

  SELECT jsonb_build_object(
    'netFineMg', COALESCE(SUM((gl.data->>'netFineMg')::numeric), 0),
    'entryCount', COUNT(*)
  ) INTO v_gold_balance
  FROM public.gold_ledger gl
  WHERE gl.firm_id = v_firm AND gl.data->>'karigarId' = v_worker_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id, 'date', a.data->>'date', 'status', a.data->>'status',
    'hours', a.data->>'hours'
  ) ORDER BY a.data->>'date' DESC), '[]'::jsonb) INTO v_attendance
  FROM public.attendance a
  WHERE a.firm_id = v_firm AND a.data->>'workerId' = v_worker_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', wt.id, 'ts', wt.ts, 'type', wt.data->>'type',
    'amountPaise', wt.data->>'amountPaise', 'notes', wt.data->>'notes'
  ) ORDER BY wt.ts DESC), '[]'::jsonb) INTO v_wages
  FROM public.worker_transactions wt
  WHERE wt.firm_id = v_firm AND wt.data->>'workerId' = v_worker_id;

  RETURN jsonb_build_object(
    'found', true,
    'profile', jsonb_build_object('id', v_worker_id, 'fullName', v_worker_name, 'firmId', v_firm),
    'goldBalance', v_gold_balance,
    'goldEntries', v_gold_entries,
    'wages', v_wages,
    'attendance', v_attendance
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.portal_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_party_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_rate_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_billing_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portal_identities_self_read ON public.portal_identities;
CREATE POLICY portal_identities_self_read ON public.portal_identities
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_saas_admin());

DROP POLICY IF EXISTS portal_identities_admin_write ON public.portal_identities;
CREATE POLICY portal_identities_admin_write ON public.portal_identities
  FOR ALL TO authenticated
  USING (firm_id = public.my_firm_id() OR public.is_saas_admin())
  WITH CHECK (firm_id = public.my_firm_id() OR public.is_saas_admin());

DROP POLICY IF EXISTS portal_party_links_scope ON public.portal_party_links;
CREATE POLICY portal_party_links_scope ON public.portal_party_links
  FOR ALL TO authenticated
  USING (
    public.is_saas_admin()
    OR firm_id = public.my_firm_id()
    OR EXISTS (
      SELECT 1 FROM public.portal_identities pi
      WHERE pi.id = portal_identity_id AND pi.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (firm_id = public.my_firm_id() OR public.is_saas_admin());

DROP POLICY IF EXISTS communication_rate_cards_read ON public.communication_rate_cards;
CREATE POLICY communication_rate_cards_read ON public.communication_rate_cards
  FOR SELECT TO authenticated
  USING (firm_id IS NULL OR firm_id = public.my_firm_id() OR public.is_saas_admin());

DROP POLICY IF EXISTS communication_rate_cards_admin_write ON public.communication_rate_cards;
CREATE POLICY communication_rate_cards_admin_write ON public.communication_rate_cards
  FOR ALL TO authenticated
  USING (public.is_saas_admin())
  WITH CHECK (public.is_saas_admin());

DROP POLICY IF EXISTS whatsapp_billing_ledger_tenant ON public.whatsapp_billing_ledger;
CREATE POLICY whatsapp_billing_ledger_tenant ON public.whatsapp_billing_ledger
  FOR SELECT TO authenticated
  USING (firm_id = public.my_firm_id() OR public.is_saas_admin());

REVOKE ALL ON FUNCTION public.get_my_portal_context(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assert_portal_party_in_scope(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assert_communication_scope(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_whatsapp_billing_from_webhook(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_communication_rate_card(TEXT, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_my_portal_context(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_portal_party_in_scope(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_communication_scope(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_communication_rate_card(TEXT, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ) TO authenticated;

REVOKE ALL ON FUNCTION public.get_customer_portal() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_supplier_portal() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_karigar_portal() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_portal() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_supplier_portal() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_karigar_portal() TO authenticated;

COMMIT;
