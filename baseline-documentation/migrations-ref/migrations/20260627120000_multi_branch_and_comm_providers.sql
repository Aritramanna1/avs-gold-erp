-- ============================================================
-- MTJ ERP — Multi-Branch Architecture + Communication Providers
-- Migration: 20260627120000
-- ============================================================

-- ── 1. BRANCHES TABLE ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.branches (
  id            TEXT PRIMARY KEY,           -- e.g. "branch_retail_ich"
  name          TEXT NOT NULL,
  short_name    TEXT NOT NULL,
  branch_type   TEXT NOT NULL CHECK (branch_type IN ('retail', 'manufacturing')),
  city          TEXT NOT NULL,
  state         TEXT NOT NULL,
  gstin         TEXT,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  logo_url      TEXT,
  invoice_prefix TEXT NOT NULL DEFAULT '',
  barcode_prefix TEXT NOT NULL DEFAULT '',
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  settings      JSONB NOT NULL DEFAULT '{}',  -- per-branch settings blob
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the three branches
INSERT INTO public.branches (id, name, short_name, branch_type, city, state, invoice_prefix, barcode_prefix)
VALUES
  ('branch_retail_ich', 'MTJ Retail — Ichalkaranji',        'Retail ICH', 'retail',        'Ichalkaranji', 'Maharashtra',   'RET-', 'R'),
  ('branch_mfg_ich',    'MTJ Manufacturing — Ichalkaranji', 'Mfg ICH',    'manufacturing', 'Ichalkaranji', 'Maharashtra',   'MFG-', 'M'),
  ('branch_mfg_gkp',    'MTJ Manufacturing — Gorakhpur',    'Mfg GKP',    'manufacturing', 'Gorakhpur',    'Uttar Pradesh', 'GKP-', 'G')
ON CONFLICT (id) DO NOTHING;

-- ── 2. USER_BRANCH_PERMISSIONS TABLE ─────────────────────────────────────────
-- Links auth.users to branches with a role
CREATE TABLE IF NOT EXISTS public.user_branch_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id   TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN (
    'owner_ceo', 'branch_manager', 'billing_staff',
    'workshop_staff', 'accountant', 'readonly'
  )),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, branch_id)
);

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_user_branch_perms_user ON public.user_branch_permissions(user_id);

-- ── 3. COMMUNICATION PROVIDER SETTINGS TABLE ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comm_provider_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms')),
  provider_type   TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  priority        INTEGER NOT NULL DEFAULT 0,
  -- Credentials stored as encrypted JSON (never plain text in application)
  settings        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_prov_branch_channel ON public.comm_provider_settings(branch_id, channel);

-- Default: deep-link WhatsApp for all branches
INSERT INTO public.comm_provider_settings (branch_id, channel, provider_type, is_active, priority, settings)
SELECT b.id, 'whatsapp', 'whatsapp_deep_link', TRUE, 0, '{}'
FROM public.branches b
ON CONFLICT DO NOTHING;

-- ── 4. ADD branch_id TO KEY TABLES ───────────────────────────────────────────
-- These are the tables that need branch isolation.
-- The column is added with a default so existing rows aren't broken.

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'invoices', 'invoice_items', 'customers', 'orders', 'stock_items',
    'job_cards', 'workers', 'attendance_records', 'expenses',
    'gold_ledger_entries', 'gold_settlements', 'comm_events',
    'document_sequences', 'file_attachments'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'branch_id'
      ) THEN
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN branch_id TEXT NOT NULL DEFAULT %L', tbl, 'branch_retail_ich');
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_branch ON public.%I(branch_id)', tbl, tbl);
        RAISE NOTICE 'Added branch_id to %', tbl;
      ELSE
        RAISE NOTICE 'branch_id already exists on %', tbl;
      END IF;
    ELSE
      RAISE NOTICE 'Table % does not exist yet — branch_id will be added when created', tbl;
    END IF;
  END LOOP;
END $$;

-- ── 5. BRANCH-SCOPED RLS POLICIES ────────────────────────────────────────────
-- Helper function: get the current user's accessible branch IDs
CREATE OR REPLACE FUNCTION public.get_user_branch_ids()
RETURNS TEXT[] LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT ARRAY_AGG(branch_id)
  FROM public.user_branch_permissions
  WHERE user_id = auth.uid() AND is_active = TRUE;
$$;

-- Helper function: check if user has CEO/global access
CREATE OR REPLACE FUNCTION public.is_global_user()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_branch_permissions
    WHERE user_id = auth.uid() AND role = 'owner_ceo' AND is_active = TRUE
  );
$$;

-- Helper function: check branch access
CREATE OR REPLACE FUNCTION public.can_access_branch(bid TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT public.is_global_user()
      OR bid = ANY(public.get_user_branch_ids());
$$;

-- Enable RLS on branches (everyone can read their own branches)
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "branches_select" ON public.branches;
CREATE POLICY "branches_select" ON public.branches
  FOR SELECT USING (
    public.is_global_user()
    OR id = ANY(public.get_user_branch_ids())
  );

-- Enable RLS on comm_provider_settings
ALTER TABLE public.comm_provider_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comm_prov_select" ON public.comm_provider_settings;
CREATE POLICY "comm_prov_select" ON public.comm_provider_settings
  FOR SELECT USING (public.can_access_branch(branch_id));
DROP POLICY IF EXISTS "comm_prov_manage" ON public.comm_provider_settings;
CREATE POLICY "comm_prov_manage" ON public.comm_provider_settings
  FOR ALL USING (public.can_access_branch(branch_id));

-- Enable RLS on user_branch_permissions (users can only see their own)
ALTER TABLE public.user_branch_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ubp_select_own" ON public.user_branch_permissions;
CREATE POLICY "ubp_select_own" ON public.user_branch_permissions
  FOR SELECT USING (user_id = auth.uid() OR public.is_global_user());

-- Apply branch RLS to key tables
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'invoices', 'customers', 'orders', 'stock_items',
    'job_cards', 'workers', 'attendance_records', 'expenses',
    'gold_ledger_entries', 'gold_settlements'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "branch_isolation" ON public.%I', tbl);
      EXECUTE format(
        'CREATE POLICY "branch_isolation" ON public.%I FOR ALL USING (public.can_access_branch(branch_id))',
        tbl
      );
      RAISE NOTICE 'Branch RLS applied to %', tbl;
    END IF;
  END LOOP;
END $$;

-- ── 6. COMMUNICATION LOG TABLE (branch-aware) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comm_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       TEXT NOT NULL DEFAULT 'branch_retail_ich',
  channel         TEXT NOT NULL,
  provider        TEXT NOT NULL,
  template        TEXT NOT NULL,
  recipient_name  TEXT NOT NULL,
  recipient_contact TEXT,      -- phone or email
  linked_type     TEXT,
  linked_id       TEXT,
  status          TEXT NOT NULL DEFAULT 'queued',
  message_id      TEXT,        -- Provider message ID if available
  error_message   TEXT,
  body_preview    TEXT,        -- First 200 chars of message
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_events_branch ON public.comm_events(branch_id);
CREATE INDEX IF NOT EXISTS idx_comm_events_linked ON public.comm_events(linked_type, linked_id);

ALTER TABLE public.comm_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comm_events_branch" ON public.comm_events;
CREATE POLICY "comm_events_branch" ON public.comm_events
  FOR ALL USING (public.can_access_branch(branch_id));

-- ── 7. TRIGGER: update timestamps ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER comm_prov_updated_at
  BEFORE UPDATE ON public.comm_provider_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
