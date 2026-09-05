-- ==============================================================================
-- AVS ERP — Database Schema Migration
-- Module: Admin Control Center, Subscription Management & Webhook Framework
-- ==============================================================================

-- 1. Company Subscriptions Table
CREATE TABLE IF NOT EXISTS public.company_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL DEFAULT 'AVS Gold & Diamond Jewellers',
    plan_tier TEXT NOT NULL DEFAULT 'avs_30k', -- 'free_trial', 'avs_10k', 'avs_30k', 'avs_50k', 'enterprise_custom'
    plan_name TEXT NOT NULL DEFAULT 'AVS Manufacturing · Standard',
    status TEXT NOT NULL DEFAULT 'active', -- 'trial', 'active', 'past_due', 'suspended', 'cancelled', 'expired'
    billing_cycle TEXT NOT NULL DEFAULT 'annual', -- 'monthly', 'annual', 'custom'
    price_inr NUMERIC(12, 2) NOT NULL DEFAULT 30000.00,
    start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    renewal_date TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 year'),
    trial_end_date TIMESTAMPTZ,
    limits_json JSONB NOT NULL DEFAULT '{
        "max_branches": 2,
        "max_users": 10,
        "storage_gb": 25,
        "customer_capacity": 5000,
        "inventory_capacity": 10000,
        "portals_enabled": true,
        "advanced_reports": true,
        "api_access": true,
        "whatsapp_integration": true,
        "payment_gateway": true,
        "automated_backups": true
    }'::jsonb,
    features_json JSONB NOT NULL DEFAULT '[
        "business.core",
        "business.orders",
        "business.workshop",
        "business.ledger",
        "business.billing_full",
        "business.barcode",
        "business.gst",
        "business.item_masters",
        "business.customer_portal",
        "business.document_hosting",
        "business.api_webhooks"
    ]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure a single active primary subscription record
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_subscriptions_singleton ON public.company_subscriptions ((true));

-- 2. Subscription Events Audit Table
CREATE TABLE IF NOT EXISTS public.subscription_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL, -- 'subscription.created', 'subscription.trial_started', 'subscription.activated', 'subscription.upgraded', 'subscription.downgraded', 'subscription.renewed', 'subscription.payment_failed', 'subscription.suspended', 'subscription.cancelled', 'subscription.expired'
    previous_tier TEXT,
    new_tier TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    actor_id TEXT,
    actor_email TEXT,
    source TEXT NOT NULL DEFAULT 'admin_panel', -- 'admin_panel', 'hostinger_cron', 'razorpay_webhook', 'system'
    provider_reference TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_created_at ON public.subscription_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_events_event_type ON public.subscription_events (event_type);

-- 3. Third-Party Integrations Registry
CREATE TABLE IF NOT EXISTS public.integrations_registry (
    id TEXT PRIMARY KEY, -- 'razorpay', 'whatsapp_meta', 'whatsapp_openwa', 'hostinger_smtp', 'sms_gateway', 'accounting_tally', 'custom_webhook'
    provider_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'communication', -- 'payment', 'communication', 'accounting', 'shipping', 'custom'
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    environment TEXT NOT NULL DEFAULT 'production', -- 'production', 'sandbox'
    settings_json JSONB NOT NULL DEFAULT '{}'::jsonb, -- public non-sensitive config
    secrets_masked_json JSONB NOT NULL DEFAULT '{}'::jsonb, -- masked view of keys (e.g. key_id, from_email)
    webhook_url TEXT,
    health_status TEXT NOT NULL DEFAULT 'unknown', -- 'healthy', 'degraded', 'error', 'unknown'
    last_tested_at TIMESTAMPTZ,
    last_error_message TEXT,
    updated_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Central Inbound & Outbound Webhooks Log Table
CREATE TABLE IF NOT EXISTS public.inbound_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL, -- 'razorpay', 'whatsapp', 'sms', 'custom'
    event_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'received', -- 'received', 'processing', 'processed', 'failed', 'ignored'
    signature_verified BOOLEAN NOT NULL DEFAULT false,
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed_result JSONB DEFAULT '{}'::jsonb,
    retry_count INT NOT NULL DEFAULT 0,
    last_error TEXT,
    processing_time_ms INT,
    source_ip TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inbound_webhooks_provider ON public.inbound_webhooks (provider);
CREATE INDEX IF NOT EXISTS idx_inbound_webhooks_status ON public.inbound_webhooks (status);
CREATE INDEX IF NOT EXISTS idx_inbound_webhooks_received_at ON public.inbound_webhooks (received_at DESC);

-- 5. Administrative Audit Logs Table
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id TEXT NOT NULL,
    actor_email TEXT NOT NULL,
    actor_role TEXT NOT NULL DEFAULT 'admin',
    action TEXT NOT NULL, -- 'plan_changed', 'user_created', 'permission_changed', 'integration_enabled', 'webhook_retried', 'api_credential_changed', 'branch_created', 'security_setting_changed'
    entity_type TEXT NOT NULL, -- 'subscription', 'user', 'branch', 'integration', 'webhook', 'security'
    entity_id TEXT,
    previous_state JSONB,
    new_state JSONB,
    result TEXT NOT NULL DEFAULT 'success', -- 'success', 'failure', 'rejected'
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor ON public.admin_audit_logs (actor_email);

-- Enable RLS
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbound_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Default Read/Write policies for authenticated staff
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read subscriptions" ON public.company_subscriptions;
    CREATE POLICY "Allow authenticated read subscriptions" ON public.company_subscriptions FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow authenticated write subscriptions" ON public.company_subscriptions;
    CREATE POLICY "Allow authenticated write subscriptions" ON public.company_subscriptions FOR ALL TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow authenticated read subscription events" ON public.subscription_events;
    CREATE POLICY "Allow authenticated read subscription events" ON public.subscription_events FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow authenticated write subscription events" ON public.subscription_events;
    CREATE POLICY "Allow authenticated write subscription events" ON public.subscription_events FOR INSERT TO authenticated WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow authenticated read integrations" ON public.integrations_registry;
    CREATE POLICY "Allow authenticated read integrations" ON public.integrations_registry FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow authenticated write integrations" ON public.integrations_registry;
    CREATE POLICY "Allow authenticated write integrations" ON public.integrations_registry FOR ALL TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow authenticated read webhooks" ON public.inbound_webhooks;
    CREATE POLICY "Allow authenticated read webhooks" ON public.inbound_webhooks FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow authenticated write webhooks" ON public.inbound_webhooks;
    CREATE POLICY "Allow authenticated write webhooks" ON public.inbound_webhooks FOR ALL TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow authenticated read audit logs" ON public.admin_audit_logs;
    CREATE POLICY "Allow authenticated read audit logs" ON public.admin_audit_logs FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow authenticated write audit logs" ON public.admin_audit_logs;
    CREATE POLICY "Allow authenticated write audit logs" ON public.admin_audit_logs FOR INSERT TO authenticated WITH CHECK (true);
END $$;
