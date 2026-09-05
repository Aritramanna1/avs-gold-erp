-- ==============================================================================
-- AVS ERP — Database Schema Migration
-- Module: Cloudflare R2 Storage Registry, Automated Reports, Service Requests & Notifications
-- ==============================================================================

-- 1. Storage Objects Registry (Tenant-Isolated Media & Documents)
CREATE TABLE IF NOT EXISTS public.storage_objects_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
    object_key TEXT NOT NULL UNIQUE, -- 'tenant/<tenant_id>/<category>/<uuid>.<ext>'
    category TEXT NOT NULL, -- 'designs', 'products', 'documents', 'invoices', 'inventory'
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    is_private BOOLEAN NOT NULL DEFAULT true,
    storage_provider TEXT NOT NULL DEFAULT 'cloudflare_r2',
    uploaded_by TEXT NOT NULL DEFAULT 'system',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storage_objects_tenant ON public.storage_objects_registry (tenant_id);
CREATE INDEX IF NOT EXISTS idx_storage_objects_category ON public.storage_objects_registry (category);

-- 2. Automated Report Schedules Table
CREATE TABLE IF NOT EXISTS public.automated_reports_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
    report_type TEXT NOT NULL, -- 'daily_gold_balance', 'sales_register', 'cash_flow', 'vault_reconciliation', 'karigar_outstanding'
    title TEXT NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'daily', -- 'daily', 'weekly', 'monthly'
    execution_time TEXT NOT NULL DEFAULT '08:00',
    day_of_week INT DEFAULT 1, -- 1=Monday for weekly
    day_of_month INT DEFAULT 1, -- for monthly
    recipients_json JSONB NOT NULL DEFAULT '["owner@maatarajewellers.shop"]'::jsonb,
    format TEXT NOT NULL DEFAULT 'pdf', -- 'pdf', 'excel', 'both'
    branch_scope TEXT NOT NULL DEFAULT 'all', -- 'all' or specific branch ID
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMPTZ,
    last_status TEXT DEFAULT 'pending', -- 'success', 'failed', 'pending'
    next_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automated_reports_tenant ON public.automated_reports_schedules (tenant_id);
CREATE INDEX IF NOT EXISTS idx_automated_reports_enabled ON public.automated_reports_schedules (is_enabled);

-- 3. Service Requests / Helpdesk Tickets Table
CREATE TABLE IF NOT EXISTS public.service_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
    ticket_no TEXT NOT NULL UNIQUE, -- 'SR-2026-0001'
    category TEXT NOT NULL, -- 'technical', 'billing', 'integration', 'account', 'feature_request', 'deployment'
    priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'acknowledged', 'in_progress', 'waiting', 'resolved', 'closed'
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    resolution_notes TEXT,
    created_by TEXT NOT NULL DEFAULT 'admin',
    assigned_to TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_requests_tenant ON public.service_requests (tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON public.service_requests (status);

-- 4. Service Alerts & Outage Broadcasts Table
CREATE TABLE IF NOT EXISTS public.service_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL UNIQUE,
    alert_type TEXT NOT NULL, -- 'SERVICE_DOWN', 'SERVICE_DEGRADED', 'PLANNED_MAINTENANCE', 'MAINTENANCE_STARTED', 'MAINTENANCE_COMPLETED', 'SERVICE_RESTORED'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info', -- 'info', 'warning', 'critical'
    is_active BOOLEAN NOT NULL DEFAULT true,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at TIMESTAMPTZ,
    acknowledged_by JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_alerts_active ON public.service_alerts (is_active);

-- 5. Notification Logs Table
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
    idempotency_key TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL, -- 'subscription.expiring', 'report.generated', 'service.outage', 'service_request.updated'
    channel TEXT NOT NULL, -- 'email', 'in_app', 'webhook'
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_snippet TEXT,
    status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'delivered', 'failed', 'suppressed'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_tenant ON public.notification_logs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_event ON public.notification_logs (event_type);

-- Enable RLS
ALTER TABLE public.storage_objects_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automated_reports_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Default RLS Policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read storage registry" ON public.storage_objects_registry;
    CREATE POLICY "Allow authenticated read storage registry" ON public.storage_objects_registry FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow authenticated write storage registry" ON public.storage_objects_registry;
    CREATE POLICY "Allow authenticated write storage registry" ON public.storage_objects_registry FOR ALL TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow authenticated read report schedules" ON public.automated_reports_schedules;
    CREATE POLICY "Allow authenticated read report schedules" ON public.automated_reports_schedules FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow authenticated write report schedules" ON public.automated_reports_schedules;
    CREATE POLICY "Allow authenticated write report schedules" ON public.automated_reports_schedules FOR ALL TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow authenticated read service requests" ON public.service_requests;
    CREATE POLICY "Allow authenticated read service requests" ON public.service_requests FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow authenticated write service requests" ON public.service_requests;
    CREATE POLICY "Allow authenticated write service requests" ON public.service_requests FOR ALL TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow authenticated read service alerts" ON public.service_alerts;
    CREATE POLICY "Allow authenticated read service alerts" ON public.service_alerts FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow authenticated write service alerts" ON public.service_alerts;
    CREATE POLICY "Allow authenticated write service alerts" ON public.service_alerts FOR ALL TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow authenticated read notification logs" ON public.notification_logs;
    CREATE POLICY "Allow authenticated read notification logs" ON public.notification_logs FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow authenticated write notification logs" ON public.notification_logs;
    CREATE POLICY "Allow authenticated write notification logs" ON public.notification_logs FOR INSERT TO authenticated WITH CHECK (true);
END $$;
