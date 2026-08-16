-- 20260815120000_tenant_credit_wallets_and_ledger.sql
-- Complete Ornexa Credit System: Wallets, Ledger, Rate Cards, and Stored Procedures

-- 1. Tenant Credit Wallets
CREATE TABLE IF NOT EXISTS public.tenant_credit_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    balance_credits NUMERIC(14, 4) NOT NULL DEFAULT 1000.0000,
    plan_credits_monthly NUMERIC(14, 4) NOT NULL DEFAULT 500.0000,
    purchased_credits NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    promo_credits NUMERIC(14, 4) NOT NULL DEFAULT 500.0000,
    auto_recharge_enabled BOOLEAN NOT NULL DEFAULT false,
    low_balance_threshold NUMERIC(14, 4) NOT NULL DEFAULT 100.0000,
    last_recharge_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tenant_credit_wallets_firm UNIQUE (firm_id)
);

-- 2. Credit Rate Cards (Per Service Pricing in Credits)
CREATE TABLE IF NOT EXISTS public.credit_rate_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_code TEXT NOT NULL UNIQUE,
    service_name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('ai', 'whatsapp', 'storage', 'sms', 'system')),
    credits_per_unit NUMERIC(10, 4) NOT NULL,
    unit_name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Default Rate Cards
INSERT INTO public.credit_rate_cards (service_code, service_name, category, credits_per_unit, unit_name, description)
VALUES 
    ('ai_query', 'AI Conversational Query', 'ai', 1.0000, 'query', 'Standard Gemini/GPT AI conversational interaction'),
    ('ai_doc_ocr', 'AI Document/Expense OCR', 'ai', 5.0000, 'document', 'Vision-based receipt, invoice or design extraction'),
    ('ai_action_exec', 'AI Structured Action Execution', 'ai', 2.0000, 'action', 'Automated creation of customer, order, job, or invoice'),
    ('wa_utility', 'WhatsApp Utility Notification', 'whatsapp', 1.5000, 'message', 'Meta Cloud API transaction confirmation, invoice link, OTP'),
    ('wa_marketing', 'WhatsApp Marketing Campaign', 'whatsapp', 3.0000, 'message', 'Catalogue share, promotional festival greeting, anniversary'),
    ('wa_service', 'WhatsApp 24h Customer Service', 'whatsapp', 0.5000, 'session', 'Inbound customer support response session')
ON CONFLICT (service_code) DO UPDATE SET
    credits_per_unit = EXCLUDED.credits_per_unit,
    service_name = EXCLUDED.service_name,
    category = EXCLUDED.category,
    unit_name = EXCLUDED.unit_name,
    updated_at = now();

-- 3. Credit Ledger
CREATE TABLE IF NOT EXISTS public.credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES public.tenant_credit_wallets(id) ON DELETE CASCADE,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('plan_grant', 'purchase', 'promo', 'deduction_ai', 'deduction_wa', 'adjustment', 'refund')),
    service_type TEXT NOT NULL,
    units NUMERIC(10, 2) NOT NULL DEFAULT 1,
    rate_applied NUMERIC(10, 4) NOT NULL DEFAULT 1,
    amount_credits NUMERIC(14, 4) NOT NULL,
    balance_after_credits NUMERIC(14, 4) NOT NULL,
    reference_id TEXT,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_firm ON public.credit_ledger(firm_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_service ON public.credit_ledger(service_type);

-- 4. RPC: Get or Initialize Tenant Credit Wallet
CREATE OR REPLACE FUNCTION public.get_tenant_credit_wallet(p_firm_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_target_firm_id UUID;
    v_wallet RECORD;
    v_recent_usage JSONB;
BEGIN
    v_target_firm_id := COALESCE(p_firm_id, public.my_firm_id());
    IF v_target_firm_id IS NULL THEN
        RAISE EXCEPTION 'Firm context required';
    END IF;

    -- Ensure wallet exists
    INSERT INTO public.tenant_credit_wallets (firm_id, balance_credits, plan_credits_monthly, promo_credits)
    VALUES (v_target_firm_id, 1000.0000, 500.0000, 500.0000)
    ON CONFLICT (firm_id) DO NOTHING;

    SELECT * INTO v_wallet FROM public.tenant_credit_wallets WHERE firm_id = v_target_firm_id;

    -- Aggregate this month's usage
    SELECT jsonb_build_object(
        'total_deducted', COALESCE(ABS(SUM(amount_credits)) FILTER (WHERE amount_credits < 0 AND created_at >= date_trunc('month', now())), 0),
        'ai_deducted', COALESCE(ABS(SUM(amount_credits)) FILTER (WHERE entry_type = 'deduction_ai' AND created_at >= date_trunc('month', now())), 0),
        'wa_deducted', COALESCE(ABS(SUM(amount_credits)) FILTER (WHERE entry_type = 'deduction_wa' AND created_at >= date_trunc('month', now())), 0),
        'recent_entries', COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', l.id,
                'entry_type', l.entry_type,
                'service_type', l.service_type,
                'units', l.units,
                'amount_credits', l.amount_credits,
                'balance_after_credits', l.balance_after_credits,
                'description', l.description,
                'created_at', l.created_at
            ) ORDER BY l.created_at DESC
        ) FILTER (WHERE l.id IS NOT NULL), '[]'::jsonb)
    ) INTO v_recent_usage
    FROM (
        SELECT * FROM public.credit_ledger 
        WHERE firm_id = v_target_firm_id 
        ORDER BY created_at DESC 
        LIMIT 20
    ) l;

    RETURN jsonb_build_object(
        'firm_id', v_wallet.firm_id,
        'balance_credits', v_wallet.balance_credits,
        'plan_credits_monthly', v_wallet.plan_credits_monthly,
        'purchased_credits', v_wallet.purchased_credits,
        'promo_credits', v_wallet.promo_credits,
        'low_balance_threshold', v_wallet.low_balance_threshold,
        'is_low_balance', (v_wallet.balance_credits <= v_wallet.low_balance_threshold),
        'usage', v_recent_usage,
        'updated_at', v_wallet.updated_at
    );
END;
$$;

-- 5. RPC: Deduct Tenant Credits (Atomic with Ledger Log)
CREATE OR REPLACE FUNCTION public.deduct_tenant_credits(
    p_service_code TEXT,
    p_units NUMERIC DEFAULT 1,
    p_reference_id TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_firm_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_firm_id UUID;
    v_wallet RECORD;
    v_rate RECORD;
    v_total_credits NUMERIC(14, 4);
    v_new_balance NUMERIC(14, 4);
    v_entry_type TEXT;
    v_ledger_id UUID;
BEGIN
    v_firm_id := COALESCE(p_firm_id, public.my_firm_id());
    IF v_firm_id IS NULL THEN
        RAISE EXCEPTION 'Firm context required';
    END IF;

    -- Lookup rate card
    SELECT * INTO v_rate FROM public.credit_rate_cards WHERE service_code = p_service_code AND is_active = true;
    IF NOT FOUND THEN
        v_total_credits := p_units * 1.0000;
        v_entry_type := CASE WHEN p_service_code LIKE 'ai%' THEN 'deduction_ai' ELSE 'deduction_wa' END;
    ELSE
        v_total_credits := p_units * v_rate.credits_per_unit;
        v_entry_type := CASE WHEN v_rate.category = 'ai' THEN 'deduction_ai' WHEN v_rate.category = 'whatsapp' THEN 'deduction_wa' ELSE 'deduction_ai' END;
    END IF;

    -- Lock wallet row for update
    SELECT * INTO v_wallet 
    FROM public.tenant_credit_wallets 
    WHERE firm_id = v_firm_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.tenant_credit_wallets (firm_id, balance_credits)
        VALUES (v_firm_id, 1000.0000)
        RETURNING * INTO v_wallet;
    END IF;

    IF v_wallet.balance_credits < v_total_credits THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient credits. Please recharge your wallet.',
            'balance_credits', v_wallet.balance_credits,
            'required_credits', v_total_credits
        );
    END IF;

    v_new_balance := v_wallet.balance_credits - v_total_credits;

    UPDATE public.tenant_credit_wallets
    SET balance_credits = v_new_balance,
        updated_at = now()
    WHERE id = v_wallet.id;

    INSERT INTO public.credit_ledger (
        firm_id, wallet_id, entry_type, service_type, units, rate_applied,
        amount_credits, balance_after_credits, reference_id, description, metadata, created_by
    ) VALUES (
        v_firm_id, v_wallet.id, v_entry_type, p_service_code, p_units,
        COALESCE(v_rate.credits_per_unit, 1.0), -v_total_credits, v_new_balance,
        p_reference_id, COALESCE(p_description, 'Service usage: ' || p_service_code),
        p_metadata, auth.uid()
    ) RETURNING id INTO v_ledger_id;

    RETURN jsonb_build_object(
        'success', true,
        'ledger_id', v_ledger_id,
        'deducted_credits', v_total_credits,
        'new_balance', v_new_balance,
        'service_code', p_service_code
    );
END;
$$;

-- 6. RPC: Grant Tenant Credits (Purchased, Plan Grant, Promo, Adjustment)
CREATE OR REPLACE FUNCTION public.grant_tenant_credits(
    p_credit_amount NUMERIC,
    p_entry_type TEXT DEFAULT 'purchase',
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_firm_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_firm_id UUID;
    v_wallet RECORD;
    v_new_balance NUMERIC(14, 4);
    v_ledger_id UUID;
BEGIN
    v_firm_id := COALESCE(p_firm_id, public.my_firm_id());
    IF v_firm_id IS NULL THEN
        RAISE EXCEPTION 'Firm context required';
    END IF;

    IF p_credit_amount <= 0 THEN
        RAISE EXCEPTION 'Credit amount must be positive';
    END IF;

    SELECT * INTO v_wallet 
    FROM public.tenant_credit_wallets 
    WHERE firm_id = v_firm_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.tenant_credit_wallets (firm_id, balance_credits)
        VALUES (v_firm_id, p_credit_amount)
        RETURNING * INTO v_wallet;
        v_new_balance := p_credit_amount;
    ELSE
        v_new_balance := v_wallet.balance_credits + p_credit_amount;
        UPDATE public.tenant_credit_wallets
        SET balance_credits = v_new_balance,
            purchased_credits = CASE WHEN p_entry_type = 'purchase' THEN purchased_credits + p_credit_amount ELSE purchased_credits END,
            promo_credits = CASE WHEN p_entry_type = 'promo' THEN promo_credits + p_credit_amount ELSE promo_credits END,
            plan_credits_monthly = CASE WHEN p_entry_type = 'plan_grant' THEN p_credit_amount ELSE plan_credits_monthly END,
            last_recharge_at = now(),
            updated_at = now()
        WHERE id = v_wallet.id;
    END IF;

    INSERT INTO public.credit_ledger (
        firm_id, wallet_id, entry_type, service_type, units, rate_applied,
        amount_credits, balance_after_credits, reference_id, description, metadata, created_by
    ) VALUES (
        v_firm_id, v_wallet.id, p_entry_type, 'credit_grant', 1, 1.0,
        p_credit_amount, v_new_balance,
        p_metadata->>'reference_id', COALESCE(p_description, 'Credit top-up: ' || p_entry_type),
        p_metadata, auth.uid()
    ) RETURNING id INTO v_ledger_id;

    RETURN jsonb_build_object(
        'success', true,
        'ledger_id', v_ledger_id,
        'granted_credits', p_credit_amount,
        'new_balance', v_new_balance
    );
END;
$$;

-- 7. Enable RLS
ALTER TABLE public.tenant_credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_rate_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_credit_wallets_tenant_isolation ON public.tenant_credit_wallets;
CREATE POLICY tenant_credit_wallets_tenant_isolation ON public.tenant_credit_wallets
    FOR ALL TO authenticated
    USING (firm_id = public.my_firm_id() OR public.is_saas_admin())
    WITH CHECK (firm_id = public.my_firm_id() OR public.is_saas_admin());

DROP POLICY IF EXISTS credit_rate_cards_read_all ON public.credit_rate_cards;
CREATE POLICY credit_rate_cards_read_all ON public.credit_rate_cards
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS credit_ledger_tenant_isolation ON public.credit_ledger;
CREATE POLICY credit_ledger_tenant_isolation ON public.credit_ledger
    FOR ALL TO authenticated
    USING (firm_id = public.my_firm_id() OR public.is_saas_admin())
    WITH CHECK (firm_id = public.my_firm_id() OR public.is_saas_admin());
