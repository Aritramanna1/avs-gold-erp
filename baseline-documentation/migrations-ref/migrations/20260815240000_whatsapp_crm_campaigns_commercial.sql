-- WhatsApp CRM: conversations, inbox messages, campaigns, opt-ins, commercial fees
-- AVS Communication Platform — multi-product (ORNEXA, RESTAURANT_POS, etc.)

-- ============================================================================
-- 1. WhatsApp Conversations (Inbox threads)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.avs_products(id),
  connection_id UUID REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL,
  branch_id TEXT,
  party_id TEXT,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  contact_wa_id TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','unassigned','assigned','waiting_customer','waiting_internal','resolved','closed')),
  assigned_user_id UUID,
  assigned_team TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  last_message_direction TEXT CHECK (last_message_direction IN ('inbound','outbound','internal_note','system_event')),
  unread_count INTEGER NOT NULL DEFAULT 0,
  labels JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_wa_conversation_phone UNIQUE (firm_id, product_id, contact_phone)
);

CREATE INDEX IF NOT EXISTS idx_wa_conversations_firm ON public.whatsapp_conversations (firm_id, product_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_party ON public.whatsapp_conversations (firm_id, party_id) WHERE party_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wa_conversations_assigned ON public.whatsapp_conversations (firm_id, assigned_user_id) WHERE assigned_user_id IS NOT NULL;

-- ============================================================================
-- 2. WhatsApp Messages (inbound, outbound, internal notes, system events)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.avs_products(id),
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound','internal_note','system_event')),
  message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text','image','document','audio','video','template','location','system')),
  provider_message_id TEXT,
  reply_to_provider_id TEXT,
  body_text TEXT,
  media_url TEXT,
  media_mime TEXT,
  media_filename TEXT,
  template_name TEXT,
  template_params JSONB,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','delivered','read','failed','received')),
  sender_type TEXT NOT NULL DEFAULT 'customer'
    CHECK (sender_type IN ('customer','agent','automation','system')),
  sender_user_id UUID,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_messages_provider_id
  ON public.whatsapp_messages (firm_id, provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wa_messages_conversation ON public.whatsapp_messages (conversation_id, created_at);

-- ============================================================================
-- 3. Conversation assignment history
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.conversation_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  assigned_to_user_id UUID,
  assigned_to_team TEXT,
  assigned_by UUID,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_at TIMESTAMPTZ,
  notes TEXT
);

-- ============================================================================
-- 4. WhatsApp opt-in / consent tracking (Meta policy)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_opt_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.avs_products(id),
  party_id TEXT,
  phone_e164 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'opted_in'
    CHECK (status IN ('opted_in','opted_out','pending')),
  opt_in_at TIMESTAMPTZ,
  opt_out_at TIMESTAMPTZ,
  source TEXT,
  purpose TEXT,
  evidence_ref TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_wa_opt_in_phone UNIQUE (firm_id, product_id, phone_e164)
);

CREATE INDEX IF NOT EXISTS idx_wa_opt_ins_party ON public.whatsapp_opt_ins (firm_id, party_id) WHERE party_id IS NOT NULL;

-- ============================================================================
-- 5. Saved campaign audiences / segments
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.campaign_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.avs_products(id),
  name TEXT NOT NULL,
  description TEXT,
  segment_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 6. WhatsApp campaigns
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.avs_products(id),
  connection_id UUID REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL,
  branch_id TEXT,
  name TEXT NOT NULL,
  objective TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','READY','APPROVAL_REQUIRED','SCHEDULED','RUNNING','PAUSED','COMPLETED','PARTIAL','FAILED','CANCELLED')),
  template_name TEXT,
  template_language TEXT NOT NULL DEFAULT 'en',
  template_variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  audience_type TEXT NOT NULL DEFAULT 'segment'
    CHECK (audience_type IN ('segment','saved_audience','manual_list','all_opted_in')),
  audience_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  saved_audience_id UUID REFERENCES public.campaign_audiences(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  sender_phone_number_id TEXT,
  estimated_recipients INTEGER NOT NULL DEFAULT 0,
  estimated_cost_paise BIGINT NOT NULL DEFAULT 0,
  estimated_credits INTEGER NOT NULL DEFAULT 0,
  approval_required BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  stats JSONB NOT NULL DEFAULT '{"sent":0,"delivered":0,"read":0,"failed":0,"responses":0,"opt_outs":0}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_campaigns_firm ON public.whatsapp_campaigns (firm_id, product_id, status);

-- ============================================================================
-- 7. Campaign recipients (per-message outcomes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.whatsapp_campaigns(id) ON DELETE CASCADE,
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  party_id TEXT,
  phone_e164 TEXT NOT NULL,
  person_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','delivered','read','failed','responded','opted_out','skipped')),
  provider_message_id TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  response_message_id UUID REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON public.campaign_recipients (campaign_id, status);

-- ============================================================================
-- 8. Campaign events (audit timeline)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.campaign_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.whatsapp_campaigns(id) ON DELETE CASCADE,
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 9. Commercial product fees (Platform Owner configurable — no hardcoded prices)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.commercial_product_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL REFERENCES public.avs_products(id),
  fee_code TEXT NOT NULL,
  fee_name TEXT NOT NULL,
  fee_type TEXT NOT NULL
    CHECK (fee_type IN ('setup','annual_integration','annual_management','support','amc','migration','training','custom','whatsapp_managed','whatsapp_external_bsp')),
  amount_paise BIGINT NOT NULL DEFAULT 0,
  billing_cycle TEXT NOT NULL DEFAULT 'one_time'
    CHECK (billing_cycle IN ('one_time','monthly','annual')),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  plan_eligibility JSONB NOT NULL DEFAULT '[]'::jsonb,
  tenant_override_firm_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_commercial_fee
  ON public.commercial_product_fees (product_id, fee_code, effective_from, COALESCE(tenant_override_firm_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ============================================================================
-- 10. Commercial plan versions (effective-dated pricing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.commercial_plan_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.platform_plans(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.avs_products(id),
  version_number INTEGER NOT NULL DEFAULT 1,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  price_monthly_paise BIGINT NOT NULL DEFAULT 0,
  price_annual_paise BIGINT NOT NULL DEFAULT 0,
  setup_fee_paise BIGINT NOT NULL DEFAULT 0,
  amc_annual_paise BIGINT NOT NULL DEFAULT 0,
  feature_limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  whatsapp_eligibility TEXT NOT NULL DEFAULT 'none'
    CHECK (whatsapp_eligibility IN ('none','external_bsp','managed_full','managed_limited')),
  ai_eligibility BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_plan_version UNIQUE (plan_id, product_id, version_number)
);

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_opt_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_product_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_plan_versions ENABLE ROW LEVEL SECURITY;

-- Firm-scoped tables
DO $rls$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'whatsapp_conversations','whatsapp_messages','conversation_assignments',
    'whatsapp_opt_ins','campaign_audiences','whatsapp_campaigns',
    'campaign_recipients','campaign_events'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_firm ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_firm ON public.%I FOR ALL TO authenticated USING (firm_id = public.my_firm_id()) WITH CHECK (firm_id = public.my_firm_id())',
      t, t
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END;
$rls$;

-- Platform admin for commercial fees and plan versions
DROP POLICY IF EXISTS commercial_product_fees_admin ON public.commercial_product_fees;
CREATE POLICY commercial_product_fees_admin ON public.commercial_product_fees
  FOR ALL TO authenticated
  USING (public.is_saas_admin() OR tenant_override_firm_id = public.my_firm_id())
  WITH CHECK (public.is_saas_admin());

DROP POLICY IF EXISTS commercial_product_fees_read ON public.commercial_product_fees;
CREATE POLICY commercial_product_fees_read ON public.commercial_product_fees
  FOR SELECT TO authenticated
  USING (is_active = true AND (tenant_override_firm_id IS NULL OR tenant_override_firm_id = public.my_firm_id()));

DROP POLICY IF EXISTS commercial_plan_versions_admin ON public.commercial_plan_versions;
CREATE POLICY commercial_plan_versions_admin ON public.commercial_plan_versions
  FOR ALL TO authenticated USING (public.is_saas_admin()) WITH CHECK (public.is_saas_admin());

DROP POLICY IF EXISTS commercial_plan_versions_read ON public.commercial_plan_versions;
CREATE POLICY commercial_plan_versions_read ON public.commercial_plan_versions
  FOR SELECT TO authenticated USING (is_published = true OR public.is_saas_admin());

GRANT SELECT ON public.commercial_product_fees TO authenticated;
GRANT SELECT ON public.commercial_plan_versions TO authenticated;
GRANT ALL ON public.commercial_product_fees TO authenticated;
GRANT ALL ON public.commercial_plan_versions TO authenticated;

-- ============================================================================
-- Helper: resolve or create conversation (webhook + send)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.resolve_whatsapp_conversation(
  p_firm_id UUID,
  p_product_id TEXT,
  p_connection_id UUID,
  p_contact_phone TEXT,
  p_contact_name TEXT DEFAULT NULL,
  p_party_id TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM public.whatsapp_conversations
  WHERE firm_id = p_firm_id AND product_id = p_product_id AND contact_phone = p_contact_phone;
  IF v_id IS NOT NULL THEN
    IF p_party_id IS NOT NULL THEN
      UPDATE public.whatsapp_conversations SET party_id = COALESCE(party_id, party_id), updated_at = now() WHERE id = v_id;
    END IF;
    RETURN v_id;
  END IF;
  INSERT INTO public.whatsapp_conversations (
    firm_id, product_id, connection_id, contact_phone, contact_name, party_id, status
  ) VALUES (
    p_firm_id, p_product_id, p_connection_id, p_contact_phone, p_contact_name, p_party_id, 'unassigned'
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_whatsapp_conversation(UUID, TEXT, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_whatsapp_conversation(UUID, TEXT, UUID, TEXT, TEXT, TEXT) TO service_role;

-- Realtime publication for inbox
DO $pub$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'realtime publication skipped: %', SQLERRM;
END;
$pub$;
